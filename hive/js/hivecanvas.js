import Board from "./core/board.js";
import {
    BLACK,
    CENTIPEDE,
    DRAGONFLY, getMaxZ,
    MANTIS, MAX_PIECE_QTY,
    PIECE_LINK,
    PIECE_STANDARD, PIECE_TXT,
    PIECES,
    WHITE
} from "./core/piece.js";
import CanvasPlayer from "./player/canvasplayer.js";
import MoveList, {Move} from "./core/movelist.js";
import OnlinePlayer from "./player/onlineplayer.js";
import AIPlayer from "./player/aiplayer.js";

const CAMERA_SPEED = .2;   // between 0 and 1, >0, higher is faster
const PIECE_TOP_SPEED = .11;// between 0 and 1, >0, the top speed
const PIECE_POINT_TOP_SPEED = .6;// between 0 and 1, the point where speed is higher
const PIECE_INITIAL_SPEED = .1;// between 0 and TOP_SPEED, >0, the initial speed
const UPDATE_IN_MS = 20;   // update frame time. Every speed depends of it
const REDRAW_IN_MS = 10;   // draw frame time. Affects FPS only
const MIN_FPS = 40;        // below MIN_FPS, it prints FPS on screen
const MAX_PING = 100;      // above MAX_PING, it prints PING on screen
const GLOWING_SPEED = .1;  // between 0 and 1, higher is faster
const BORDER_SPEED = .05;  // between 0 and 1, higher is faster

export default class HiveCanvas {
    board = new Board();

    #debug = false;
    #coords = false;
    #frameQty = 0;
    #FPSUpdateTime;
    #frameTime;
    #framesPerSecond = null;
    #tooSlow = false;

    #shortOnTime;

    camera = new Camera();

    canvas;
    ctx;

    gameOver;

    bottomPlayerColor;
    whitePlayer;
    blackPlayer;
    #canvasPlayer;
    standardRules;
    flippedPieces;

    moveLists;
    currentMoveListId;

    #callbacks;

    #allBoards;

    constructor(callbacks, shortOnTime) {
        this.#callbacks = callbacks;
        this.#shortOnTime = shortOnTime;
    }

    init($canvas, canvasPlayer) {
        this.canvas = $canvas.get(0);
        this.ctx = this.canvas.getContext("2d");
        this.#canvasPlayer = canvasPlayer;
        this.newGame(WHITE, canvasPlayer, new AIPlayer(this), 0, 0, true);
        this.#FPSUpdateTime = Date.now();
        this.#update();
        this.#redraw();
    }

    #update() {
        const start = Date.now();

        // update timer
        const moveList = this.getMoveList();
        if (moveList.computeTime()) {
            if (moveList.whitePiecesTimeLeft === 0 || moveList.blackPiecesTimeLeft === 0) {
                if (this.getPlayerPlaying() instanceof CanvasPlayer) {
                    this.timeout();
                }
            } else if (this.#canvasPlayer.selectedTargetId !== null) {
                // auto confirm moves if short on time
                if ((moveList.moves.length & 1) === 0 && moveList.whitePiecesTimeLeft <= this.#shortOnTime * 1000 ||
                    (moveList.moves.length & 1) === 1 && moveList.blackPiecesTimeLeft <= this.#shortOnTime * 1000) {
                    this.#canvasPlayer.confirm(true);
                }
            }
        }

        // update piece animation
        const inAnimation = this.board.getPieces().filter(p => p.transition > 0);

        inAnimation.forEach(p => {
            if (p.transition < 1e-4) {
                p.transition = 0;
            } else if (p.transition <= PIECE_POINT_TOP_SPEED) {
                p.transition -= PIECE_TOP_SPEED * p.transition / PIECE_POINT_TOP_SPEED;
            } else {
                p.transition -= PIECE_INITIAL_SPEED + (PIECE_TOP_SPEED - PIECE_INITIAL_SPEED) * (1 - p.transition) / (1 - PIECE_POINT_TOP_SPEED);
            }
        });

        // update camera animation
        this.camera.update();

        // setup next update
        const waitTime = UPDATE_IN_MS - (Date.now() - start);
        this.#tooSlow = waitTime < 1;
        setTimeout(() => this.#update(), Math.max(1, waitTime));
    }
    newGame(bottomPlayerColor, whitePlayer, blackPlayer, totalTime, increment, standardRules) {
        if (this.whitePlayer && !(this.whitePlayer instanceof OnlinePlayer)) {
            this.whitePlayer.reset();
        }
        if (this.blackPlayer && !(this.blackPlayer instanceof OnlinePlayer)) {
            this.blackPlayer.reset();
        }
        this.#allBoards = new Map();
        [this.bottomPlayerColor, this.whitePlayer, this.blackPlayer] = [bottomPlayerColor, whitePlayer, blackPlayer];
        [this.moveLists, this.currentMoveListId] = [[new MoveList(totalTime, increment)], 0];
        this.whitePlayer.reset();
        this.blackPlayer.reset();
        this.camera.reset();
        this.gameOver = false;
        this.standardRules = standardRules;
        this.flippedPieces = false;
        this.board.reset(standardRules);
        this.board.allPiecesByType.forEach(pieces => pieces.forEach(p => p.transition = 0));

        this.#initRound();
        this.#callbacks.newGame(this.getMoveList().timeControlToText());
    }
    getPieceZ(piece) {
        if (piece.transition === 0) {
            return piece.z;
        }
        const [, , fz, , , tz, ] = this.#getPiecePosition(piece);
        return Math.max(fz, tz);
    }
    #getPiecePosition(piece) {
        if (piece.subNumber > 0) {
            return [null, null, 0, piece.x, piece.y, piece.z, 0];
        }
        const animationPosition = (piece.getMoveSteps().length - 1) * (1 - piece.transition);
        const animationFrame = Math.floor(animationPosition);
        const transitionOnFrame = 1 - (animationPosition - animationFrame);

        const [fx, fy, fz] = piece.getMoveSteps()[animationFrame];
        const [tx, ty, tz] = piece.getMoveSteps()[animationFrame + 1];
        return [fx, fy, fz, tx, ty, tz, transitionOnFrame];
    }
    getPiecePixelPosition(piece) {
        if (piece.transition === 0) {
            return this.positionToPixel(piece.x, piece.y, piece.z, piece);
        }
        const [fx, fy, fz, tx, ty, tz, transitionOnFrame] = this.#getPiecePosition(piece);
        const [fromX, fromY] = this.positionToPixel(fx, fy, fz, piece);
        const [toX, toY] = this.positionToPixel(tx, ty, tz, piece);
        return [toX + (fromX - toX) * transitionOnFrame, toY + (fromY - toY) * transitionOnFrame];
    }
    positionToPixel(x, y, z, piece = null) {
        const [rx, ry, offset] = this.getSize();
        const [w, h] = [this.canvas.width, this.canvas.height];
        if (x !== null && z !== null) {
            // piece in game
            return [
                w / 2 + x * rx + offset * z - this.camera.x,
                h / 2 - y * ry * 3 - offset * z + this.camera.y
            ];
        }

        // piece in hud
        let qtyPiecesPositionOnHud = PIECES.reduce((qty, type) => qty + PIECE_STANDARD[type], 0);
        let positionOnHud = 0;
        for (const type of PIECES) {
            positionOnHud++;
            if ([piece.type, PIECE_LINK[piece.type]].includes(type)) {
                break;
            }
        }
        const marginX = w / 2 - (qtyPiecesPositionOnHud + 1) * rx;
        const px = positionOnHud * rx * 2 + marginX + offset * piece.z;
        let py;
        if (this.bottomPlayerColor === piece.color) {
            py = h - ry * 2 - offset * piece.z;
        } else {
            py = 2 * ry + (MAX_PIECE_QTY - 1 - piece.z) * offset;
        }
        return [px, py];
    }
    getSize(scale = null) {
        const r = (scale ?? this.camera.scale) * this.canvas.width / 30;
        const offset = r / 4;
        return [r * Math.sqrt(3), r, offset];
    }
    #redraw() {
        this.#updateFPS();

        this.#clearScreen();

        this.#drawTime();

        this.#drawEmptySpace();

        this.#drawPieces();

        this.#drawAI();

        this.#drawGameTexts();

        this.#drawCoords();

        this.#drawFlip();

        this.#drawXOverFallenQueens();

        this.#drawPassAlert();

        this.#drawConfirm();

        this.#drawDebug();

        const waitTime = REDRAW_IN_MS - (Date.now() - this.#frameTime);
        setTimeout(() => this.#redraw(), Math.max(1, waitTime));
    }
    #drawEmptySpace() {
        const path = this.getPiecePath2D();
        const [, , offset] = this.getSize();
        this.ctx.strokeStyle = "rgb(128, 128, 128)";
        this.ctx.lineWidth = Math.ceil(offset / 4);
        for (const [x, y] of this.#getEmptySpaces()) {
            const [px, py] = this.positionToPixel(x, y, 0);
            this.ctx.setTransform(1, 0, 0, 1, px, py);
            this.ctx.stroke(path);
        }
    }
    #getEmptySpaces() {
        const ret = [];
        for (const p of this.board.getInGameTopPieces()) {
            for (const [x, y] of Board.coordsAround(p.x, p.y)) {
                if (this.board.getPieceEncoded(x, y) === 0 && !ret.find(([ex, ey]) => ex === x && ey === y)) {
                    ret.push([x, y]);
                }
            }
        }
        if (ret.length === 0) {
            ret.push([0, 0]);
        }
        return ret;
    }
    #drawCoords() {
        if (this.#coords) {
            const h = Math.round(26 * this.camera.scale * this.canvas.width / 1000);
            for (const p of this.board.getInGameTopPieces()) {
                const [px, py] = this.positionToPixel(p.x, p.y, p.z);
                this.#drawText([p.x + "," + p.y + "," + p.z, p.txt], px, py, "middle", "center", h);
            }
            for (const [x, y] of this.#getEmptySpaces()) {
                const [px, py] = this.positionToPixel(x, y, 0);
                this.#drawText([x + "," + y + ",0"], px, py, "middle", "center", h);
            }
        }
    }
    #drawPassAlert() {
        const isLastRound = this.getMoveList().moves.length < this.board.round;
        if (this.board.qtyMoves === 0 && isLastRound && this.getPlayerPlaying() instanceof CanvasPlayer) {
            const [w2, h2] = [this.canvas.width / 2, this.canvas.height / 2];
            const fh = Math.round(w2 / 6);
            this.ctx.fillStyle = "rgb(0, 0, 0, 0.5)";
            this.ctx.fillRect(0, 0, w2 * 2, h2 * 2);
            this.#drawText(["Click anywhere to pass"], w2, h2, "middle", "center", fh, "rgb(255, 255, 0)");
        }
    }
    #drawAI() {
        if (this.#debug) {
            return;
        }
        let white = this.whitePlayer instanceof AIPlayer;
        let black = this.blackPlayer instanceof AIPlayer;
        if (black) {
            this.#drawAIImage(this.blackPlayer, "bai", white && black, false);
        }
        if (white) {
            this.#drawAIImage(this.whitePlayer, "wai", white && black, true);
        }
    }
    #drawAIImage(aiPlayer, imagePrefix, both, white) {
        const evaluation = aiPlayer.getEvaluation5Levels();
        if (evaluation === null) {
            return;
        }
        const [rx, ry, ] = this.getSize(1);
        let r = (rx + ry) * 2 / 3;
        let offset = r;
        if (both) {
            r *= .7;
            if (white) {
                offset = 3 * r;
            } else {
                offset = r;
            }
        }

        const [x, y] = [this.canvas.width - offset, this.getHudHeight() + r];
        this.#drawImage(imagePrefix + evaluation, r, x, y);
    }
    #drawGameTexts() {
        let texts = [];
        if (this.#debug) {
            let aiPlayer = null;
            if (this.whitePlayer instanceof AIPlayer) {
                aiPlayer = this.whitePlayer;
            } else if (this.blackPlayer instanceof AIPlayer) {
                aiPlayer = this.blackPlayer;
            }
            if (aiPlayer !== null) {
                aiPlayer.getProgress(this.#debug).forEach(t => texts.push(t));
            }
        }
        if (this.#framesPerSecond !== null && this.#framesPerSecond < MIN_FPS) {
            texts.push(this.#framesPerSecond + " FPS");
        }
        if (this.#tooSlow) {
            texts.push("SLOW");
        }
        let onlinePlayer = null;
        if (this.whitePlayer instanceof OnlinePlayer) {
            onlinePlayer = this.whitePlayer;
        } else if (this.blackPlayer instanceof OnlinePlayer) {
            onlinePlayer = this.blackPlayer;
        }
        if (onlinePlayer !== null && onlinePlayer.ping > MAX_PING) {
            texts.push("ping " + onlinePlayer.ping + "ms")
        }
        if (texts.length > 0) {
            const hudHeight = this.getHudHeight();
            const fh = Math.ceil(20 * this.canvas.width / 1000);
            const color = "rgb(255, 0, 0)";
            this.#drawText(texts, this.canvas.width - 2, hudHeight + 2, "top", "right", fh, color);
        }
    }
    #updateFPS() {
        this.#frameTime = Date.now();
        const CALCULATE_FPS_EVERY_N_FRAMES = 20;
        this.#frameQty++;
        if (this.#frameQty === CALCULATE_FPS_EVERY_N_FRAMES) {
            const now = Date.now();
            this.#framesPerSecond = Math.round(1 / ((now - this.#FPSUpdateTime) / (CALCULATE_FPS_EVERY_N_FRAMES * 1000)));
            this.#FPSUpdateTime = now;
            this.#frameQty = 0;
        }
    }
    #drawDebug() {
        if (this.#debug) {
            const moveList = this.getMoveList();
            let onlinePlayer = null;
            if (this.whitePlayer instanceof OnlinePlayer) {
                onlinePlayer = this.whitePlayer;
            } else if (this.blackPlayer instanceof OnlinePlayer) {
                onlinePlayer = this.blackPlayer;
            }
            let text = [
                "Canvas: " + this.canvas.width + " x " + this.canvas.height + " : " + Math.round(window.devicePixelRatio * 100) / 100,
                "White player: " + this.whitePlayer.constructor.name,
                "Black player: " + this.blackPlayer.constructor.name,
                "Hover: " + this.#canvasPlayer.hoverPieceId,
                "Selected: " + this.#canvasPlayer.selectedPieceId,
                "Target: " + this.#canvasPlayer.selectedTargetId,
                "Mouse: " + Math.round(this.#canvasPlayer.mouseX) + "," + Math.round(this.#canvasPlayer.mouseY),
                "Time left: " + moveList.whitePiecesTimeLeft + " / " + moveList.blackPiecesTimeLeft,
                "Round: " + this.board.round + " / " + moveList.moves.length,
                "Moves available: " + this.board.qtyMoves,
                "FPS: " + this.#framesPerSecond,
                "board: " + this.board.stringfy(),
            ];
            if (onlinePlayer !== null) {
                text.push("Ping: " + onlinePlayer.ping);
            }
            const fh = Math.ceil(26 * this.canvas.width / 1000);
            this.#drawText(text, 0, this.canvas.height / 2, "middle", "left", fh);
        }
    }
    #clearScreen() {
        this.ctx.fillStyle = "rgb(192, 192, 192)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    #drawXOverFallenQueens() {
        if (!this.gameOver) {
            return;
        }
        const [rx, ry, ] = this.getSize();
        const r = (rx + ry) / 2;
        this.board.getQueens().filter(p => p.inGame && this.board.isQueenDead(p.color)).forEach(p => {
            const [x, y] = this.getPiecePixelPosition(this.board.getInGamePiece(p.x, p.y));
            let path = new Path2D();
            path.moveTo(x - r, y - r);
            path.lineTo(x + r, y + r);
            path.moveTo(x + r, y - r);
            path.lineTo(x - r, y + r);
            path.closePath();
            this.ctx.lineWidth = Math.ceil(ry / 2);
            this.ctx.strokeStyle = "rgb(128, 128, 128)";
            this.ctx.stroke(path);
            this.ctx.lineWidth = Math.ceil(ry / 3);
            this.ctx.strokeStyle = "rgb(255, 0, 0)";
            this.ctx.stroke(path);
        });
    }
    getHudHeight() {
        const [, ry, offset] = this.getSize();
        return 4 * ry + (MAX_PIECE_QTY - 1) * offset + 1;
    }
    getTimerHeight() {
        return Math.round(this.canvas.width / 10);
    }
    getMoveList() {
        return this.moveLists[this.currentMoveListId];
    }

    #drawTime() {
        const moveList = this.getMoveList();
        const [w, h] = [this.canvas.width, this.canvas.height]
        const hh = this.getHudHeight();
        const colorPlaying = ((this.gameOver ? this.board.round + 1 : this.getMoveList().moves.length) & 1) === 0 ?
            WHITE : BLACK;
        const bottomPlaying = colorPlaying === this.bottomPlayerColor;
        if (moveList.totalTime === 0) {
            this.ctx.fillStyle = bottomPlaying ? "rgb(0, 0, 0, .25)" : "rgb(0, 0, 0, .75)";
            this.ctx.fillRect(0, 0, w, hh);
            this.ctx.fillStyle = bottomPlaying ? "rgb(0, 0, 0, .75)" : "rgb(0, 0, 0, .25)";
            this.ctx.fillRect(0, h - hh, w, hh);
            return;
        }

        // gets both times in text
        let topTime, bottomTime;
        if (this.gameOver) {
            if (this.board.round === 1) {
                [topTime, bottomTime] = [moveList.totalTime * 1000, moveList.totalTime * 1000];
            } else {
                const move = moveList.moves[this.board.round - 2];
                [topTime, bottomTime] = [move.whitePiecesTimeLeft, move.blackPiecesTimeLeft];
            }
        } else {
            [topTime, bottomTime] = [moveList.whitePiecesTimeLeft, moveList.blackPiecesTimeLeft];
        }
        if (this.bottomPlayerColor === WHITE) {
            [topTime, bottomTime] = [bottomTime, topTime];
        }
        const [topTimeTxt, bottomTimeTxt] = [topTime, bottomTime].map(t => MoveList.timeToText(t, this.#shortOnTime));

        // get coords to draw the timers
        const fh = this.getTimerHeight();
        const fx = Math.round(w / 7);
        const tw = 2 * fx;
        const tyTop = hh;
        const tyBottom = h - hh - fh;

        // draw background
        this.ctx.fillStyle = bottomPlaying ? "rgb(0, 0, 0, .25)" : "rgb(0, 0, 0, .75)";
        this.ctx.beginPath();
        this.ctx.moveTo(0, tyTop + fh);
        this.ctx.lineTo(tw - fh / 4, tyTop + fh);
        this.ctx.arc(tw - fh / 4, tyTop + fh * 3 / 4, fh / 4, Math.PI / 2, 0, true);
        this.ctx.lineTo(tw, tyTop + fh / 4);
        this.ctx.arc(tw + fh / 4, tyTop + fh / 4, fh / 4, Math.PI, 3 * Math.PI / 2);
        this.ctx.lineTo(w, tyTop);
        this.ctx.lineTo(w, 0);
        this.ctx.lineTo(0, 0);
        this.ctx.lineTo(0, tyTop + fh);
        this.ctx.fill();
        this.ctx.fillStyle = bottomPlaying ? "rgb(0, 0, 0, .75)" : "rgb(0, 0, 0, .25)";
        this.ctx.beginPath();
        this.ctx.moveTo(0, tyBottom);
        this.ctx.lineTo(tw - fh / 4, tyBottom);
        this.ctx.arc(tw - fh / 4, tyBottom + fh / 4, fh / 4, 3 * Math.PI / 2, 0);
        this.ctx.lineTo(tw, tyBottom + 3 * fh / 4);
        this.ctx.arc(tw + fh / 4, tyBottom + 3 * fh / 4, fh / 4, Math.PI, Math.PI / 2, true);
        this.ctx.lineTo(w, tyBottom + fh);
        this.ctx.lineTo(w, h);
        this.ctx.lineTo(0, h);
        this.ctx.lineTo(0, tyBottom);
        this.ctx.fill();

        // change font color if time is short
        let topColor = bottomPlaying ? "rgb(255, 255, 255)" : "rgb(255, 255, 0)";
        let bottomColor = bottomPlaying ? "rgb(255, 255, 0)" : "rgb(255, 255, 255)";
        if (bottomTime < this.#shortOnTime * 1000) {
            bottomColor = "rgb(255, 0, 0)";
        }
        if (topTime < this.#shortOnTime * 1000) {
            topColor = "rgb(255, 0, 0)";
        }

        // change font size if time is too long
        const tfh = scaleTimeFontHeight(topTimeTxt, fh);
        const bfh = scaleTimeFontHeight(bottomTimeTxt, fh);

        // draw timer
        this.#drawText([topTimeTxt], tw / 2, tyTop + fh / 2 + 1, "middle", "center", tfh, topColor);
        this.#drawText([bottomTimeTxt], tw / 2, tyBottom + fh / 2 + 1, "middle", "center", bfh, bottomColor);
    }
    #drawFlip() {
        if (this.standardRules) {
            return;
        }

        const [x, y, r, hover] = this.#canvasPlayer.overFlip();

        // fill background
        this.ctx.fillStyle = "rgb(0, 0, 0, .75)";
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, 2 * Math.PI);
        this.ctx.fill();

        this.#drawImage(hover ? "flip_hover" : "flip", r / 2, x, y);
    }
    #drawConfirm() {
        if (this.#canvasPlayer.selectedTargetId === null) {
            return;
        }

        const [x, y, w, h, fh, hover] = this.#canvasPlayer.overConfirm();

        // fill background
        this.ctx.fillStyle = "rgb(0, 0, 0, .75)";
        this.ctx.fillRect(x, y, w, h);

        const fc = hover ? "rgb(255, 255, 0)" : "rgb(255, 255, 255)";
        this.#drawText(["Click here to confirm"], x + w / 2, y + h / 2, "middle", "center", fh, fc);
    }

    #drawPieces() {
        const path = this.getPiecePath2D();

        // get targets to draw
        const player = this.getPlayerPlaying();
        let selectedPieceId = this.#canvasPlayer.selectedPieceId;
        let selectedTargetId = this.#canvasPlayer.selectedTargetId;
        let hoverPieceId = this.#canvasPlayer.hoverPieceId;
        const dragId = player?.dragging ? player.selectedPieceId : null;
        if (this.board.round > this.getMoveList().moves.length && player instanceof AIPlayer && player.target) {
            const target = player.target;
            const piece = this.board.getPieces().find(p => p.id === player.pieceId);
            selectedPieceId = piece.id;
            selectedTargetId = piece.getTargets().findIndex(t => t.x === target.x && t.y === target.y && t.z === target.z);
            hoverPieceId = piece.getTargets()[selectedTargetId].id;
        }
        const targetPiece = selectedPieceId === null || selectedTargetId === null ? null :
            this.board.getPieces().find(p => p.id === selectedPieceId).getTargets()[selectedTargetId];

        const position = this.#getSpecialPiecesPosition(targetPiece, dragId, player);
        this.#getPiecesToDraw(selectedPieceId, selectedTargetId, hoverPieceId, dragId)
            .forEach(p => this.#drawPiece(p, path, selectedPieceId, selectedTargetId, hoverPieceId, targetPiece, position));

        this.#drawBorderOverQueen(path);
    }
    #getSpecialPiecesPosition(targetPiece, dragId, player) {
        // get position of the piece in special cases
        let position = [];
        if (dragId !== null) {
            position.push([dragId, [player.mouseX, player.mouseY]]);
        }
        if (targetPiece) {
            if (targetPiece.type === MANTIS) {
                const [x, y, z] = targetPiece.getMoveSteps()[0];
                if (x !== null && y !== null && z === 0) {
                    position.push([targetPiece.id, this.positionToPixel(x, y, 1)]);
                    const prey = this.board.getInGamePiece(targetPiece.x, targetPiece.y);
                    position.push([prey.id, this.positionToPixel(x, y, 0)]);
                }
            } else if (targetPiece.type === DRAGONFLY) {
                const [x, y, z] = targetPiece.getMoveSteps()[0];
                if (x !== null && y !== null && z > 0 && targetPiece.z === 0) {
                    position.push([targetPiece.id, this.positionToPixel(targetPiece.x, targetPiece.y, 1)]);
                    const prey = this.board.getInGamePieceWithZ(x, y, z - 1);
                    position.push([prey.id, this.positionToPixel(targetPiece.x, targetPiece.y, 0)]);
                }
            } else if (targetPiece.type === CENTIPEDE) {
                const [x, y, z] = targetPiece.getMoveSteps()[0];
                if (x !== null && y !== null && z > 0) {
                    position.push([targetPiece.id, this.positionToPixel(targetPiece.x, targetPiece.y, 0)]);
                    const prey = this.board.getInGamePiece(targetPiece.x, targetPiece.y);
                    position.push([prey.id, this.positionToPixel(x, y, 0)]);
                }
            }
        }
        return position;
    }
    #getPiecesToDraw(selectedPieceId, selectedTargetId, hoverPieceId, dragId) {
        // get the pieces sorted for drawing
        const pieces = this.board.getPieces().filter(p => p.inGame || PIECE_LINK[p.type] === 0 || p.transition > 0 ||
            !PIECE_STANDARD[p.type] === this.flippedPieces && !this.#linkedPieceInAnimation(p));
        const id = selectedPieceId ?? hoverPieceId;
        if (id !== null) {
            this.board.getPieces().find(p => p.id === id).getTargets().forEach(p => pieces.push(p));
        }
        return pieces.map(p => {
            let score = 0;
            // dragging pieces draw at the end
            if (p.id === dragId) {
                score |= 1;
            }
            // draw top pieces at the end
            score *= getMaxZ() + 1;
            score += this.getPieceZ(p);

            // draw hover pieces at the end
            score <<= 1;
            score |= p.id === hoverPieceId ? 1 : 0;

            // draw selected pieces at the end
            score <<= 1;
            score |= p.id === selectedPieceId ? 1 : 0;

            // draw targets at the end
            score <<= 1;
            score |= p.subNumber > 0 ? 1 : 0;

            // draw pieces in animation at the end
            score <<= 1;
            score |= p.transition > 0 ? 1 : 0;

            // draw movable pieces at the end
            score <<= 1;
            score |= p.getTargets().length > 0 ? 1 : 0;

            // draw last moved piece at the end
            score <<= 1;
            score |= this.board.lastMovedPiecesId.includes(p.id) > 0 ? 1 : 0;

            return {
                piece: p,
                score: score,
            };
        }).sort((a, b) => a.score - b.score).map(ps => ps.piece);
    }
    #linkedPieceInAnimation(p) {
        return this.board.getPiecesByType(PIECE_LINK[p.type]).find(l =>
            l.color === p.color &&
            l.number === p.number &&
            l.transition > 0
        );
    }
    getPiecePath2D() {
        let path = new Path2D();
        const [rx, ry, ] = this.getSize();

        let [px, py] = [null, null];
        Board.coordsAround(0, 0).forEach(([x, y]) => {
            const [cx, cy] = [rx * y, ry * x];
            if (px === null && py === null) {
                [px, py] = [cx, cy];
                path.moveTo(cx, cy);
            } else {
                path.lineTo(cx, cy);
            }
        });
        path.lineTo(px, py);
        path.closePath();
        return path;
    }

    #drawPiece(piece, path, selectedPieceId, selectedTargetId, hoverPieceId, targetPiece, position) {
        if (!piece.inGame && PIECE_LINK[piece.type] !== 0 && piece.subNumber === 0) {
            const type = PIECE_LINK[piece.type];
            const mirror = this.board.getPiecesByType(type).find(p => piece.color === p.color && p.number === piece.number);
            if (mirror && mirror.id === selectedPieceId &&
                (selectedTargetId !== null || mirror.getTargets().find(p => p.id === hoverPieceId))) {
                // the linked piece has been selected and hovering target or confirming
                this.#drawPieceWithStyle(piece, path, "selected-from");
                return;
            }
        }
        const pos = position.find(([id, ]) => id === piece.id);
        if (pos) {
            // draw selected piece in specific position
            if (piece.id !== selectedPieceId) {
                this.#drawPieceWithStyle(piece, path, "selected", pos[1]);
            } else {
                this.#drawPieceWithStyle(piece, path, "selected-from");
                if (selectedTargetId === null && !piece.getTargets().find(p => p.id === hoverPieceId)) {
                    this.#drawPieceWithStyle(piece, path, "selected", pos[1]);
                }
            }
        } else if (piece.id === selectedPieceId) {
            if (selectedTargetId === null && !piece.getTargets().find(p => p.id === hoverPieceId)) {
                // drawing selected piece not hovering target or confirming
                this.#drawPieceWithStyle(piece, path, "selected");
            } else {
                // drawing selected piece hovering target or confirming
                this.#drawPieceWithStyle(piece, path, "selected-from");
            }
        } else if (targetPiece && targetPiece.id === piece.id) {
            // drawing target being confirmed
            this.#drawPieceWithStyle(piece, path, "selected");
        } else if (piece.id === hoverPieceId) {
            if (piece.selectedPieceId !== null) {
                if (this.board.getPieces().find(p => p.id === hoverPieceId)) {
                    // drawing another piece being hovered while a piece has been selected
                    this.#drawPieceWithStyle(piece, path, "hover");
                } else {
                    // drawing target being hovered
                    this.#drawPieceWithStyle(piece, path, "selected-to");
                }
            } else {
                // drawing piece being hovered while no piece has been selected
                this.#drawPieceWithStyle(piece, path, "hover");
            }
        } else if (piece.subNumber > 0) {
            if (!targetPiece) {
                // drawing target not being hovered
                this.#drawPieceWithStyle(piece, path, "target");
            }
        } else if (this.board.lastMovedPiecesId.includes(piece.id)) {
            // drawing last piece moved
            this.#drawPieceWithStyle(piece, path, "last-piece");
        } else if (piece.getTargets().length > 0) {
            // drawing movable piece
            this.#drawPieceWithStyle(piece, path, targetPiece ? "" : "movable");
        } else {
            // drawing piece in other cases
            this.#drawPieceWithStyle(piece, path);
        }
    }
    #drawPieceWithStyle(piece, path, style = "", pos = null) {
        // get position
        let x, y;
        if (pos !== null) {
            [x, y] = pos;
        } else {
            [x, y] = this.getPiecePixelPosition(piece);
        }

        const [rx, ry, offset] = this.getSize();

        this.ctx.setTransform(1, 0, 0, 1, x, y);
        if (style === "selected-from") {
            this.ctx.globalAlpha = .5;
        } else if (style === "selected-to") {
            this.ctx.globalAlpha = .75;
        } else if (style === "target") {
            this.ctx.globalAlpha = piece.z > 0 ? .75 : .5;
        }

        // fill color
        if (style === "selected-from") {
            this.ctx.fillStyle = "rgb(255, 255, 0)";
        } else if (style === "selected-to") {
            this.ctx.fillStyle = "rgb(0, 255, 255)";
        } else {
            this.ctx.fillStyle = piece.color === WHITE ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
        }
        this.ctx.fill(path);

        // draw piece image, rotating according to the number identification
        this.ctx.rotate(-Math.PI / 2 + Math.max(0, piece.number - 1) * Math.PI / 3);
        this.#drawImage("piece" + PIECE_TXT[piece.type][0], .75 * (rx + ry) / 2);
        this.ctx.setTransform(1, 0, 0, 1, x, y);

        // draw border
        let borderColor = "rgb(128, 128, 128)";
        let border = offset / 4;
        let dash = false;
        if (style === "last-piece") {
            borderColor = "rgb(255, 0, 0)";
            border = offset / 2;
        } else if (style === "hover") {
            borderColor = "rgb(255, 0, 0)";
            dash = true;
        } else if (style === "movable") {
            dash = true;
        } else if (style === "selected") {
            borderColor = "rgb(255, 255, 0)";
            dash = true;
        } else if (style === "target") {
            borderColor = "rgb(0, 255, 255)";
            dash = true;
        } else if (style === "selected-from") {
            borderColor = "rgb(255, 255, 0)";
            dash = true;
        } else if (style === "selected-to") {
            borderColor = "rgb(0, 255, 255)";
            dash = true;
        }
        if (dash) {
            this.ctx.lineWidth = Math.ceil(border);
            this.ctx.strokeStyle = "rgb(128, 128, 128)";
            this.ctx.stroke(path);
            const lineDash = Math.ceil(offset);
            this.ctx.setLineDash([lineDash, lineDash]);
            const dashOffset = Math.round((this.#frameTime % 1000000) / 750 * this.canvas.width * BORDER_SPEED);
            this.ctx.lineDashOffset = Math.floor(dashOffset % (lineDash * 2));
            this.ctx.lineWidth = Math.ceil(offset);
            this.ctx.strokeStyle = borderColor;
            this.ctx.stroke(path);
        } else {
            this.ctx.lineWidth = Math.ceil(border);
            this.ctx.strokeStyle = borderColor;
            this.ctx.stroke(path);
        }

        // reset
        this.ctx.lineDashOffset = 0;
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    #drawBorderOverQueen(path) {
        let from0to1to0 = Math.round((this.#frameTime % 10000) * GLOWING_SPEED) % 200;
        if (from0to1to0 >= 100) {
            from0to1to0 = 200 - from0to1to0;
        }
        from0to1to0 /= 100;
        this.ctx.globalAlpha = from0to1to0 * from0to1to0;
        this.board.getQueens().filter(q => q.inGame).forEach(p => { // && this.board.getInGamePiece(q.x, q.y).id !== q.id).forEach(p => {
            const [x, y] = this.getPiecePixelPosition(p);
            const [, , offset] = this.getSize();
            this.ctx.setTransform(1, 0, 0, 1, x, y);
            this.ctx.strokeStyle = "rgb(255, 204, 00)";
            this.ctx.lineWidth = Math.ceil(offset / 2);
            this.ctx.stroke(path);
        });
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalAlpha = 1;
    }
    #drawText(texts, x = 0, y = 0, valign = "middle", align = "center",
             height, color = "rgb(255, 255, 255)", borderColor = "rgb(0, 0, 0)") {
        this.ctx.font = height + "px Sans-serif";
        this.ctx.lineWidth = 2 * this.canvas.width / 750;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = valign;
        if (texts.length > 1 && valign !== "top") {
            if (valign === "bottom") {
                y -= (texts.length - 1) * height;
            } else {
                y -= Math.round((texts.length - 1) * height / 2);
            }
        }
        texts.forEach(text => {
            this.ctx.strokeStyle = borderColor;
            this.ctx.strokeText(text, x, y);
            this.ctx.fillStyle = color;
            this.ctx.fillText(text, x, y);
            y += height;
        })
    }
    getPlayerPlaying(notifyOnlinePlayer = false) {
        const player = (this.board.round & 1) === 1 ? this.whitePlayer : this.blackPlayer;
        return this.gameOver && (!notifyOnlinePlayer || !(player instanceof OnlinePlayer)) ? this.#canvasPlayer : player;
    }
    toggleDebug() {
        this.#debug = !this.#debug;
    }
    toggleCoords() {
        this.#coords = !this.#coords;
    }
    #playRound(dragging = false, confirming = false, notifyOnlinePlayer = false) {
        const moveList = this.getMoveList();
        this.#goTo(moveList.moves.length + 1, (p, extraPieceMoving) => {
            if (!confirming && (extraPieceMoving || !dragging)) {
                p.transition = 1;
            }
        }, this.currentMoveListId);
        const lastMove = moveList.moves[moveList.moves.length - 1];
        const moveText = (this.board.round - 1) + ". " + Move.notation(lastMove, this.board, this.#shortOnTime);
        this.#callbacks.move(this.board.round, moveText, this.currentMoveListId);
        this.gameOver = this.gameOver || lastMove.whiteLoses || lastMove.blackLoses || lastMove.draw || lastMove.resign || lastMove.timeout;
        this.#initRound(notifyOnlinePlayer);
    }
    pass(time = null) {
        const moveList = this.getMoveList();
        if (moveList.moves.length >= this.board.round) return;
        moveList.addPass(time);
        this.#playRound();
    }
    resign(time = null) {
        if (this.gameOver) return;
        const moveList = this.getMoveList();
        moveList.addResign(time);
        this.#callbacks.resign((moveList.moves.length & 1) === 1 ? WHITE : BLACK);
        this.#playRound(false, false, true);
    }
    draw(time = null) {
        if (this.gameOver) return;
        const moveList = this.getMoveList();
        moveList.addDraw(time);
        this.#callbacks.drawByAgreement();
        this.#playRound();
    }
    timeout(time = null) {
        if (this.gameOver) return;
        const moveList = this.getMoveList();
        moveList.addTimeout(time);
        this.#callbacks.timeout((moveList.moves.length & 1) === 1 ? WHITE : BLACK);
        this.#playRound(false, false, true);
    }
    #getPieceFromNotation(txt) {
        return this.board.getPieces().find(p => p.txt === txt && (!this.standardRules || PIECE_STANDARD[p.type]));
    }
    playNotation(move, time = null) {
        if (move.match(/^(\d+\D *)?draw by agreement/)) {
            this.draw(time);
            return null;
        }
        if (move.match(/^(\d+\D *)?resign/)) {
            this.resign(time)
            return null;
        }
        if (move.match(/^(\d+\D *)?timeout/)) {
            this.timeout(time);
            return null;
        }
        if (move.match(/^(\d+\D *)?draw/)) {
            return null;
        }
        if (move.match(/^(\d+\D *)?white wins/)) {
            return null;
        }
        if (move.match(/^(\d+\D *)?black wins/)) {
            return null;
        }
        if (this.board.round === 1) {
            const firstMoveMatch = move.match(/^(\d+\D *)?([wb][A-Z]\d?)( |$)/);
            if (!firstMoveMatch) {
                return "cant parse";
            }
            const from = this.#getPieceFromNotation(firstMoveMatch[2]);
            if (!from) {
                return "invalid piece..";
            }
            const to = from.getTargets()[0];
            this.play(from.id, to, time);
            return null;
        }
        if (move.match(/^(\d+\D *)?pass/)) {
            if (this.board.qtyMoves !== 0) {
                return "cant pass";
            }
            this.pass(time);
            return null;
        }
        const moveMatch = move.match(/^(\d+\D *)?([wb][A-Z]\d?) +([-/\\]?)([wb][A-Z]\d?)([-/\\]?)( |$)/);
        if (!moveMatch) {
            return "cant parse";
        }
        const from = this.#getPieceFromNotation(moveMatch[2]);
        const ref = this.#getPieceFromNotation(moveMatch[4]);
        if (!from) {
            return "invalid piece...";
        }
        if (!ref) {
            return "invalid position...";
        }
        let dx;
        let dy;
        if (moveMatch[3] === "/") {
            dx = -1;
            dy = -1;
        } else if (moveMatch[3] === "-") {
            dx = -2;
            dy = 0;
        } else if (moveMatch[3] === "\\") {
            dx = -1;
            dy = 1;
        } else if (moveMatch[5] === "/") {
            dx = 1;
            dy = 1;
        } else if (moveMatch[5] === "-") {
            dx = 2;
            dy = 0;
        } else if (moveMatch[5] === "\\") {
            dx = 1;
            dy = -1;
        } else if (moveMatch[3] === "" && moveMatch[5] === "") {
            dx = 0;
            dy = 0;
        } else {
            return "invalid direction";
        }
        const [rx, ry] = [ref.x + dx, ref.y + dy];
        const to = from.getTargets().find(p => p.x === rx && p.y === ry);
        if (!to) {
            return "invalid move";
        }
        this.play(from.id, to, time);
        return null;
    }
    undo() {
        const moveList = this.getMoveList();
        if (this.moveLists.length !== 1 || moveList.moves.length === 0) {
            this.#callbacks.undo(false);
        } else {
            this.gameOver = false;
            this.getPlayerPlaying().reset();
            this.#goTo(moveList.moves.length, (p, ) => p.transition = 1, 0);
            moveList.removeMove();
            this.#initRound();
            this.#callbacks.undo(true);
        }
    }
    play(pieceId, target, time = null, dragging = false, confirming = false) {
        let moveList = this.getMoveList();
        if (this.gameOver && (this.board.round <= moveList.moves.length || this.currentMoveListId === 0)) {
            // an alternative move happened. Create a new list
            const initialRound = this.currentMoveListId === 0 ? this.board.round : moveList.initialRound;
            moveList = new MoveList(0, 0, moveList, this.currentMoveListId, initialRound, this.board.round);
            this.moveLists.push(moveList);
            this.currentMoveListId = this.moveLists.length - 1;
        }
        // save the move
        moveList.addMove(pieceId, target, time);
        this.#playRound(dragging, confirming);
        const whiteLoses = this.board.isQueenDead(WHITE);
        const blackLoses = this.board.isQueenDead(BLACK);
        if (whiteLoses || blackLoses) {
            moveList.addGameOver(whiteLoses, blackLoses, 0);
            if (whiteLoses && !blackLoses) {
                this.#callbacks.gameOver(BLACK);
            } else if (!whiteLoses && blackLoses) {
                this.#callbacks.gameOver(WHITE);
            } else if (whiteLoses && blackLoses) {
                this.#callbacks.gameOver(null);
            }
            this.#playRound();
        } else if (!this.gameOver) {
            const boardStr = this.board.stringfy(false);
            let qty = this.#allBoards.get(boardStr);
            if (typeof qty === "undefined") {
                this.#allBoards.set(boardStr, 1);
            } else {
                this.#allBoards.set(boardStr, ++qty);
                if (qty >= 3 && this.whitePlayer instanceof AIPlayer && this.blackPlayer instanceof AIPlayer) {
                    this.draw();
                }
            }

        }
    }
    #goTo(round, callbackMove, moveListId) {
        this.#canvasPlayer.reset();
        if (this.currentMoveListId === moveListId) {
            // same list
            this.#goToSameMoveList(callbackMove, round);
            return;
        }
        // goes back to the root
        while (this.currentMoveListId > 0) {
            const moveList = this.getMoveList();
            this.#goToSameMoveList(callbackMove, moveList.initialRound);
            this.currentMoveListId = moveList.parentMoveListId;
        }
        if (moveListId > 0) {
            // go to the start of the new list
            this.#goToSameMoveList(callbackMove, this.moveLists[moveListId].initialRound);
        }
        this.currentMoveListId = moveListId;
        this.#goToSameMoveList(callbackMove, round);
    }
    #goToSameMoveList(callbackMove, round) {
        const moveList = this.getMoveList();
        round = Math.max(1, Math.min(round, moveList.moves.length + 1));
        if (this.board.round < round) {
            this.#forward(callbackMove, round);
        } else if (this.board.round > round) { // undo moves
            this.#backward(callbackMove, round);
        }
    }
    #forward(callbackMove, round) {
        const moveList = this.getMoveList();
        while (this.board.round < round) { // redo moves
            const move = moveList.moves[this.board.round - 1];
            if (move.pass) {
                this.board.pass();
            } else if (!move.timeout && !move.resign && !move.draw && !move.whiteLoses && !move.blackLoses) {
                const p = this.board.getPieces().find(p => p.id === move.pieceId);
                const [from, to] = [move.moveSteps[0], move.moveSteps[move.moveSteps.length - 1]];
                this.board.play(from, to, p, move.moveSteps, callbackMove);
            } else {
                this.board.round++;
            }
        }
    }
    #backward(callbackMove, round) {
        const moveList = this.getMoveList();
        while (this.board.round >= Math.max(2, round)) {
            if (this.board.round === round) {
                callbackMove = (_p, _extraPiece) => {};
            }
            const move = moveList.moves[this.board.round - 2];
            if (move.pass) {
                this.board.passBack();
            } else if (!move.timeout && !move.resign && !move.draw && !move.whiteLoses && !move.blackLoses) {
                const p = this.board.getInGameTopPieces().find(p => p.id === move.pieceId);
                const [from, to] = [move.moveSteps[0], move.moveSteps[move.moveSteps.length - 1]];
                this.board.playBack(from, to, p, move.moveSteps, callbackMove);
            } else {
                this.board.round--;
            }
        }
        // to compute last move
        if (round > 1) {
            this.#forward(callbackMove, round);
        }
    }
    setRound(round, moveListId) {
        this.#goTo(round, (p, ) => p.transition = 1, moveListId);
        this.#initRound();
    }
    #initRound(notifyOnlinePlayer = false) {
        this.board.computeLegalMoves(this.gameOver || this.getMoveList().moves.length < this.board.round);
        this.board.getPieces().forEach(p => p.getTargets().forEach(t => t.transition = 0));
        this.getPlayerPlaying(notifyOnlinePlayer).initPlayerTurn();
        this.camera.recenter(this);
    }
    #drawImage(id, r, x = 0, y = 0) {
        const img = document.getElementById(id);
        if (img.width > 0 && img.height > 0) {
            const ratio = img.width / img.height;
            const w = r * Math.min(1, ratio);
            const h = r * Math.min(1, 1 / ratio);
            this.ctx.drawImage(img, x - w, y - h, 2 * w, 2 * h);
        }
    }
}
class Camera {
    scale = 1;
    x = 0;
    y = 0;
    #toScale = 1;
    #toX = 0;
    #toY = 0;
    constructor() {
        this.reset();
    }
    reset() {
        [this.scale, this.x, this.y, this.#toScale, this.#toX, this.#toY] = [1, 0, 0, 1, 0, 0];
    }
    recenter(hive) {
        const [minX, maxX, minY, maxY] = hive.board.getMinMaxXY();
        const [rx, ry, ] = hive.getSize(1);
        const qtyX = 7 + maxX - minX; // number of pieces on x, adding extra piece space
        const qtyY = 7 + maxY - minY; // number of pieces on y, adding extra piece space
        const maxInX = hive.canvas.width / rx;
        const maxInY = hive.canvas.height / (3 * ry);
        this.#toScale = Math.min(maxInX / qtyX, maxInY / qtyY, 1);
        this.#toX = rx * this.#toScale * (maxX + minX) / 2;
        this.#toY = 3 * ry * this.#toScale * (maxY + minY) / 2;
    }
    update() {
        const diffX = (this.#toX - this.x) * CAMERA_SPEED;
        const diffY = (this.#toY - this.y) * CAMERA_SPEED;
        const diffScale = (this.#toScale - this.scale) * CAMERA_SPEED;
        if (Math.abs(diffX) > 1e-4 || Math.abs(diffY) > 1e-4 || Math.abs(diffScale) > 1e-4) {
            this.x += diffX;
            this.y += diffY;
            this.scale += diffScale;
        } else {
            this.x = this.#toX;
            this.y = this.#toY;
            this.scale = this.#toScale;
        }
    }
}
function scaleTimeFontHeight(txt, fh) {
    const qtyDigits = txt.replace(/[^0-9]/, "").length;
    const qtySeparators = txt.length - qtyDigits;
    return fh * 4.5 / Math.max(4.5, qtyDigits + qtySeparators / 2);
}