import Board from "./core/board.js";
import Piece, {PieceColor, PieceType} from "./core/piece.js";
import CanvasPlayer from "./player/canvasplayer.js";
import MoveList, {Move} from "./core/movelist.js";
import OnlinePlayer from "./player/onlineplayer.js";
import AIPlayer from "./player/aiplayer.js";

const CAMERA_SPEED = .2;   // between 0 and 1, higher is faster
const PIECE_SPEED = .15;   // between 0 and 1, higher is faster
const UPDATE_IN_MS = 20;   // update frame time. Every speed depends of it
const REDRAW_IN_MS = 10;   // draw frame time. Affects FPS only
const MIN_FPS = 40;        // below MIN_FPS, it prints FPS on screen
const MAX_PING = 100;      // above MAX_PING, it prints PING on screen
const GLOWING_SPEED = .1;  // between 0 and 1, higher is faster
const BORDER_SPEED = .05;  // between 0 and 1, higher is faster

export default class HiveCanvas {
    board = new Board();

    #debug = false;
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

    #maxQtyPiecesOverOnHud;

    bottomPlayerColor;
    whitePlayer;
    blackPlayer;
    #canvasPlayer;
    standardRules;
    flippedPieces;

    moveLists;
    currentMoveListId;

    #callbacks;

    constructor(callbacks, shortOnTime) {
        this.#callbacks = callbacks;
        this.#shortOnTime = shortOnTime;
    }

    init($canvas, canvasPlayer) {
        this.canvas = $canvas.get(0);
        this.ctx = this.canvas.getContext("2d");
        this.#maxQtyPiecesOverOnHud = 0;
        for (const keyType in PieceType) {
            this.#maxQtyPiecesOverOnHud = Math.max(this.#maxQtyPiecesOverOnHud, PieceType[keyType].qty - 1);
        }
        this.#canvasPlayer = canvasPlayer;
        this.newGame(PieceColor.white, canvasPlayer, new AIPlayer(this), 0, 0, true);
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
                if (moveList.moves.length % 2 === 0 && moveList.whitePiecesTimeLeft <= this.#shortOnTime * 1000 ||
                    moveList.moves.length % 2 === 1 && moveList.blackPiecesTimeLeft <= this.#shortOnTime * 1000) {
                    this.#canvasPlayer.confirm(true);
                }
            }
        }

        // update piece animation
        const inAnimation = this.board.pieces.filter(p => p.transition > 0);
        inAnimation.forEach(p => p.transition = p.transition < 1e-4 ? 0 : p.transition * (1 - PIECE_SPEED));

        // update camera animation
        this.camera.update();

        // setup next update
        const waitTime = UPDATE_IN_MS - (Date.now() - start);
        this.#tooSlow = waitTime < 1;
        setTimeout(() => this.#update(), Math.max(1, waitTime));
    }
    newGame(bottomPlayerColor, whitePlayer, blackPlayer, totalTime, increment, standardRules) {
        [this.bottomPlayerColor, this.whitePlayer, this.blackPlayer] = [bottomPlayerColor, whitePlayer, blackPlayer];
        [this.moveLists, this.currentMoveListId] = [[new MoveList(totalTime, increment)], 0];
        this.whitePlayer.reset();
        this.blackPlayer.reset();
        this.camera.reset();
        this.gameOver = false;
        this.standardRules = standardRules;
        this.flippedPieces = false;
        this.board.reset(standardRules);
        this.board.pieces.forEach(p => {
            p.transition = 0;
        });

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
        const animationPosition = (piece.moveSteps.length - 1) * (1 - piece.transition);
        const animationFrame = Math.floor(animationPosition);
        const transitionOnFrame = 1 - (animationPosition - animationFrame);

        const [fx, fy, fz] = piece.moveSteps[animationFrame];
        const [tx, ty, tz] = piece.moveSteps[animationFrame + 1];
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
        let qtyPiecesPositionOnHud = 0;
        for (const key in PieceType) {
            if (PieceType[key].standard) {
                qtyPiecesPositionOnHud++;
            }
        }
        let positionOnHud = 0;
        for (const key in PieceType) {
            positionOnHud++;
            const isLinkedPiece = piece.type.linked !== null && PieceType[piece.type.linked].id === PieceType[key].id;
            if (PieceType[key].id === piece.type.id || isLinkedPiece) {
                break;
            }
        }
        const marginX = w / 2 - (qtyPiecesPositionOnHud + 1) * rx;
        const px = positionOnHud * rx * 2 + marginX + offset * piece.z;
        let py;
        if (this.bottomPlayerColor.id === piece.color.id) {
            py = h - ry * 2 - offset * piece.z;
        } else {
            py = 2 * ry + (this.#maxQtyPiecesOverOnHud - piece.z) * offset;
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

        this.#drawPerformance();

        this.#drawPieces();

        this.#drawFlip();

        this.#drawXOverFallenQueens();

        this.#drawPassAlert();

        this.#drawConfirm();

        this.#drawDebug();

        const waitTime = REDRAW_IN_MS - (Date.now() - this.#frameTime);
        setTimeout(() => this.#redraw(), Math.max(1, waitTime));
    }
    #drawPassAlert() {
        const isLastRound = this.getMoveList().moves.length < this.board.round;
        if (this.board.passRound && isLastRound && this.getPlayerPlaying() instanceof CanvasPlayer) {
            const [w2, h2] = [this.canvas.width / 2, this.canvas.height / 2];
            const fh = Math.round(w2 / 6);
            this.ctx.fillStyle = "rgb(0, 0, 0, 0.5)";
            this.ctx.fillRect(0, 0, w2 * 2, h2 * 2);
            this.#drawText(["Click anywhere to pass"], w2, h2, "middle", "center", fh, "rgb(255, 255, 0)");
        }
    }
    #drawPerformance() {
        let texts = [];
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
            let totalMoves = 0;
            this.board.pieces.forEach(p => totalMoves += p.targets.length);
            let onlinePlayer = null;
            if (this.whitePlayer instanceof OnlinePlayer) {
                onlinePlayer = this.whitePlayer;
            } else if (this.blackPlayer instanceof OnlinePlayer) {
                onlinePlayer = this.blackPlayer;
            }
            let aiPlayer = null;
            if (this.whitePlayer instanceof AIPlayer) {
                aiPlayer = this.whitePlayer;
            } else if (this.blackPlayer instanceof AIPlayer) {
                aiPlayer = this.blackPlayer;
            }
            let text = [
                "hover: " + this.#canvasPlayer.hoverPieceId,
                "selected: " + this.#canvasPlayer.selectedPieceId,
                "target: " + this.#canvasPlayer.selectedTargetId,
                "mouse: " + Math.round(this.#canvasPlayer.mouseX) + "," + Math.round(this.#canvasPlayer.mouseY),
                "canvas: " + this.canvas.width + " x " + this.canvas.height + " : " + Math.round(window.devicePixelRatio * 100) / 100,
                "time left: " + moveList.whitePiecesTimeLeft + " / " + moveList.blackPiecesTimeLeft,
                "round: " + this.board.round + " / " + moveList.moves.length,
                "moves available: " + totalMoves,
                "white player: " + this.whitePlayer.constructor.name,
                "black player: " + this.blackPlayer.constructor.name,
                "ping: " + (onlinePlayer === null ? "-" : onlinePlayer.ping),
                "ai iter.: " + (aiPlayer === null ? "-" : aiPlayer.iterations),
                "ai IPS.: " + (aiPlayer === null ? "-" : aiPlayer.getIterationsPerSecond()),
                "fps: " + this.#framesPerSecond,
            ];
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
        this.board.pieces.filter(p => p.inGame && p.type.id === PieceType.queen.id && this.board.isQueenDead(p.color.id)).forEach(p => {
            const pieceOnTop = this.board.inGameTopPieces.find(tp => tp.x === p.x && tp.y === p.y);
            const [x, y] = this.getPiecePixelPosition(pieceOnTop);
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
        return 4 * ry + this.#maxQtyPiecesOverOnHud * offset + 1;
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
        const colorPlaying = ((this.gameOver ? this.board.round + 1 : this.getMoveList().moves.length) % 2) === 0 ?
            PieceColor.white.id : PieceColor.black.id;
        const bottomPlaying = colorPlaying === this.bottomPlayerColor.id;
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
        if (this.bottomPlayerColor.id === PieceColor.white.id) {
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
        let targets = [];
        const player = this.getPlayerPlaying();
        let selectedPieceId = this.#canvasPlayer.selectedPieceId;
        let selectedTargetId = this.#canvasPlayer.selectedTargetId;
        let hoverPieceId = this.#canvasPlayer.hoverPieceId;
        const id = selectedPieceId ?? hoverPieceId;
        if (id !== null) {
            targets = this.board.pieces.find(p => p.id === id).targets;
        }
        // sort pieces to draw in correct order
        const dragId = player?.dragging ? player.selectedPieceId : null;
        const targetPiece = this.#canvasPlayer.selectedPieceId === null || this.#canvasPlayer.selectedTargetId === null ? null :
            this.board.pieces.find(p => p.id === this.#canvasPlayer.selectedPieceId).targets[this.#canvasPlayer.selectedTargetId];

        let specialPieces = [];
        if (targetPiece) {
            if (targetPiece.type.id === PieceType.mantis.id) {
                const [x, y, z] = targetPiece.moveSteps[0];
                if (x !== null && y !== null && z === 0) {
                    specialPieces.push([targetPiece.id, x, y, 1]);
                    const prey = this.board.inGameTopPieces.find(p => p.x === targetPiece.x && p.y === targetPiece.y);
                    specialPieces.push([prey.id, x, y, 0]);
                }
            } else if (targetPiece.type.id === PieceType.dragonfly.id) {
                const [x, y, z] = targetPiece.moveSteps[0];
                if (x !== null && y !== null && z > 0 && targetPiece.z === 0) {
                    specialPieces.push([targetPiece.id, targetPiece.x, targetPiece.y, 1]);
                    const prey = this.board.pieces.find(p => p.inGame && p.x === x && p.y === y && p.z === z - 1);
                    specialPieces.push([prey.id, targetPiece.x, targetPiece.y, 0]);
                }
            } else if (targetPiece.type.id === PieceType.centipede.id) {
                const [x, y, z] = targetPiece.moveSteps[0];
                if (x !== null && y !== null && z > 0) {
                    specialPieces.push([targetPiece.id, targetPiece.x, targetPiece.y, 0]);
                    const prey = this.board.inGameTopPieces.find(p => p.x === targetPiece.x && p.y === targetPiece.y);
                    specialPieces.push([prey.id, x, y, 0]);
                }
            }
        }

        this.board.pieces.filter(p => p.inGame || p.type.linked === null || p.transition > 0 ||
                            p.type.standard === !this.flippedPieces && !this.#linkedPieceInAnimation(p))
            .concat(targets).sort((a, b) => {
            // dragging pieces draw at the end
            if (a.id === dragId) {
                return 1;
            }
            if (b.id === dragId) {
                return -1;
            }
            // draw top pieces at the end
            const az = this.getPieceZ(a);
            const bz = this.getPieceZ(b);
            if (az !== bz) {
                return az - bz;
            }
            // draw hover pieces at the end
            if (a.id === hoverPieceId) {
                return 1;
            }
            if (b.id === hoverPieceId) {
                return -1;
            }
            // draw selected pieces at the end
            if (a.id === selectedPieceId) {
                return 1;
            }
            if (b.id === selectedPieceId) {
                return -1;
            }
            // draw targets at the end
            if (a.subNumber !== b.subNumber) {
                return a.subNumber - b.subNumber;
            }
            // draw pieces in animation at the end
            if (Math.abs(a.transition - b.transition) > 1e-4) {
                return a.transition - b.transition;
            }
            // draw movable pieces at the end
            if (a.targets.length !== b.targets.length && selectedTargetId === null) {
                return a.targets.length - b.targets.length;
            }
            // draw last moved piece at the end
            if (this.board.lastMovedPiecesId.includes(a.id) && !this.board.lastMovedPiecesId.includes(b.id)) {
                return 1;
            }
            if (this.board.lastMovedPiecesId.includes(b.id) && !this.board.lastMovedPiecesId.includes(a.id)) {
                return -1;
            }
            return 0;
        }).forEach(p => this.#drawPiece(p, path, targetPiece, specialPieces));

        this.#drawBorderOverStackedQueen(path);
    }
    #linkedPieceInAnimation(p) {
        return this.board.pieces.find(l => l.type.id === PieceType[p.type.linked].id && l.color.id === p.color.id && l.number === p.number && l.transition > 0);
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

    #drawPiece(piece, path, targetPiece, specialPieces) {
        let specialPiece = specialPieces.find(([id, , , ]) => id === piece.id);
        if (piece.id === this.#canvasPlayer.selectedPieceId) {
            if (this.#canvasPlayer.hoverPieceId === null && this.#canvasPlayer.dragging) {
                if (this.#canvasPlayer.selectedTargetId === null) {
                    // drawing selected piece dragging
                    this.#drawPieceWithStyle(piece, path, "drag");
                }
            } else if (this.#canvasPlayer.selectedTargetId === null &&
                !piece.targets.find(p => p.id === this.#canvasPlayer.hoverPieceId)) {
                // drawing selected piece only if not hovering target or confirming
                this.#drawPieceWithStyle(piece, path, "selected");
            }
        } else if (specialPiece) {
            // drawing special cases of target being confirmed
            specialPiece.shift();
            this.#drawPieceWithStyle(piece, path, "selected", specialPiece);
        } else if (targetPiece && targetPiece.id === piece.id) {
            // drawing target being confirmed
            this.#drawPieceWithStyle(piece, path, "selected");
        } else if (piece.id === this.#canvasPlayer.hoverPieceId) {
            if (piece.selectedPieceId !== null) {
                if (this.board.pieces.find(p => p.id === this.#canvasPlayer.hoverPieceId)) {
                    // drawing another piece being hovered while a piece has been selected
                    this.#drawPieceWithStyle(piece, path, "hover");
                } else {
                    // drawing target being hovered
                    this.#drawPieceWithStyle(piece, path, "selected");
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
        } else if (piece.targets.length > 0) {
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
        if (style === "drag") {
            const player = this.getPlayerPlaying();
            [x, y] = [player.mouseX, player.mouseY];
        } else if (pos !== null) {
            const [px, py, pz] = pos;
            [x, y] = this.positionToPixel(px, py, pz);
        } else {
            [x, y] = this.getPiecePixelPosition(piece);
        }

        const [rx, ry, offset] = this.getSize();

        this.ctx.setTransform(1, 0, 0, 1, x, y);
        if (style === "target") {
            this.ctx.globalAlpha = .25;
        }

        // fill color
        this.ctx.fillStyle = piece.color.id === "w" ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
        this.ctx.fill(path);

        // draw piece image, rotating according to the number identification
        this.ctx.rotate(-Math.PI / 2 + Math.max(0, piece.number - 1) * Math.PI / 3);
        this.#drawImage("piece" + piece.type.id, .75 * (rx + ry) / 2);
        this.ctx.setTransform(1, 0, 0, 1, x, y);

        // draw border
        let borderColor = "rgb(128, 128, 128)";
        let border = offset / 4;
        let dash = false;
        if (style === "last-piece") {
            borderColor = "rgb(255, 0, 0)";
            border = offset / 2;
        } else if (style === "hover") {
            borderColor = "rgb(128, 0, 0)";
            dash = true;
        } else if (style === "movable") {
            dash = true;
        } else if (style === "selected" || style === "target" || style === "drag") {
            borderColor = "rgb(255, 0, 0)";
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

        if (this.#debug) {
            const h = Math.round(26 * this.camera.scale * this.canvas.width / 1000);
            if (piece.inGame) {
                let text = [piece.x + "," + piece.y + "," + piece.z, piece.id];
                this.#drawText(text, 0, 0, "middle", "center", h);
            } else {
                this.#drawText(["", piece.id], 0, 0, "middle", "center", h);
            }
        }
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    #drawBorderOverStackedQueen(path) {
        let from0to1to0 = Math.round((this.#frameTime % 10000) * GLOWING_SPEED) % 200;
        if (from0to1to0 >= 100) {
            from0to1to0 = 200 - from0to1to0;
        }
        from0to1to0 /= 100;
        this.ctx.globalAlpha = from0to1to0 * from0to1to0;
        this.board.inGame.filter(q => q.type.id === PieceType.queen.id && !this.board.inGameTopPieces.find(p => p.id === q.id)).forEach(p => {
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
    getPlayerPlaying(forcePlayerPlaying = false) {
        return this.gameOver && !forcePlayerPlaying ? this.#canvasPlayer :
            (this.board.round % 2 === 1 ? this.whitePlayer : this.blackPlayer);
    }
    toggleDebug() {
        this.#debug = !this.#debug;
    }
    #playRound(dragging = false, confirming = false, forcePlayerPlaying = false) {
        const moveList = this.getMoveList();
        this.#goTo(moveList.moves.length + 1, (p, extraPieceMoving) => {
            if (!confirming && (extraPieceMoving || !dragging)) {
                p.transition = 1;
            }
        }, this.currentMoveListId);
        const lastMove = moveList.moves[moveList.moves.length - 1];
        const moveText = (this.board.round - 1) + ". " + Move.notation(lastMove, this.board, this.#shortOnTime);
        this.#callbacks.move(this.board.round, moveText, this.currentMoveListId);
        this.gameOver ||= lastMove.whiteLoses || lastMove.blackLoses || lastMove.draw || lastMove.resign || lastMove.timeout;
        this.#initRound(forcePlayerPlaying);
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
        this.#callbacks.resign(moveList.moves.length % 2 === 1 ? PieceColor.white.id : PieceColor.black.id);
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
        this.#callbacks.timeout(moveList.moves.length % 2 === 1 ? PieceColor.white.id : PieceColor.black.id);
        this.#playRound(false, false, true);
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
            const matches = move.match(/^(\d+\D *)?([wb][A-Z]\d?)( |$)/);
            if (!matches) {
                return "cant parse";
            }
            const piece = Piece.parse(matches[2], this.standardRules);
            if (piece === null) {
                return "invalid piece..";
            }
            const [colorId, typeId, number] = piece;
            const from = this.board.pieces.find(p => p.type.id === typeId && p.color.id === colorId && p.number === number);
            const to = from.targets[0];
            this.play(from, to, time);
            return null;
        }
        if (move.match(/^(\d+\D *)?pass/)) {
            if (!this.board.passRound) {
                return "cant pass";
            }
            this.pass(time);
            return null;
        }
        const matches = move.match(/^(\d+\D *)?([wb][A-Z]\d?) +([-/\\]?)([wb][A-Z]\d?)([-/\\]?)( |$)/);
        if (!matches) {
            return "cant parse";
        }
        const p1 = Piece.parse(matches[2], this.standardRules);
        const p2 = Piece.parse(matches[4], this.standardRules);
        if (p1 === null || p2 === null) {
            return "invalid piece...";
        }
        let dx;
        let dy;
        if (matches[3] === "/") {
            dx = -1;
            dy = -1;
        } else if (matches[3] === "-") {
            dx = -2;
            dy = 0;
        } else if (matches[3] === "\\") {
            dx = -1;
            dy = 1;
        } else if (matches[5] === "/") {
            dx = 1;
            dy = 1;
        } else if (matches[5] === "-") {
            dx = 2;
            dy = 0;
        } else if (matches[5] === "\\") {
            dx = 1;
            dy = -1;
        } else if (matches[3] === "" && matches[5] === "") {
            dx = 0;
            dy = 0;
        } else {
            return "invalid direction";
        }
        const [colorId1, typeId1, number1] = p1;
        const [colorId2, typeId2, number2] = p2;
        const from = this.board.pieces.find(p => p.type.id === typeId1 && p.color.id === colorId1 && p.number === number1);
        if (!from) {
            return "invalid piece";
        }
        const ref = this.board.pieces.find(p => p.inGame && p.type.id === typeId2 && p.color.id === colorId2 && p.number === number2);
        if (!ref) {
            return "invalid position";
        }
        const [rx, ry] = [ref.x + dx, ref.y + dy];
        const to = from.targets.find(p => p.x === rx && p.y === ry);
        if (!to) {
            return "invalid move";
        }
        this.play(from, to, time);
        return null;
    }
    play(piece, target, time = null, dragging = false, confirming = false) {
        let moveList = this.getMoveList();
        if (this.gameOver && (this.board.round <= moveList.moves.length || this.currentMoveListId === 0)) {
            // an alternative move happened. Create a new list
            const initialRound = this.currentMoveListId === 0 ? this.board.round : moveList.initialRound;
            moveList = new MoveList(0, 0, moveList, this.currentMoveListId, initialRound, this.board.round);
            this.moveLists.push(moveList);
            this.currentMoveListId = this.moveLists.length - 1;
        }
        // save the move
        moveList.addMove(piece, target, time);
        this.#playRound(dragging, confirming);
        const whiteLoses = this.board.isQueenDead(PieceColor.white.id);
        const blackLoses = this.board.isQueenDead(PieceColor.black.id);
        if (whiteLoses || blackLoses) {
            moveList.addGameOver(whiteLoses, blackLoses, 0);
            if (whiteLoses && !blackLoses) {
                this.#callbacks.gameOver("b");
            } else if (!whiteLoses && blackLoses) {
                this.#callbacks.gameOver("w");
            } else if (whiteLoses && blackLoses) {
                this.#callbacks.gameOver("d");
            }
            this.#playRound();
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
        } else { // no moves to be done
            return;
        }

        if (round === 1 || this.board.passRound) {
            this.board.lastMovedPiecesId = [];
        } else {
            const move = moveList.moves[round - 2];
            if (move.pieceId === null) {
                this.board.lastMovedPiecesId = [];
            } else {
                this.board.lastMovedPiecesId = [move.pieceId];
                const p1 = this.board.pieces.find(p => p.id === move.pieceId);
                const [fromX, fromY, fromZ] = move.moveSteps[0];
                const [toX, toY, toZ] = move.moveSteps[move.moveSteps.length - 1];
                if (p1.type.id === PieceType.mantis.id && fromX !== null && fromY !== null && fromZ === 0 && toZ === 1) {
                    // mantis special move has 2 last move piece
                    const p2 = this.board.pieces.find(p => p.x === fromX && p.y === fromY && p.z === 0);
                    this.board.lastMovedPiecesId.push(p2.id);
                } else if (p1.type.id === PieceType.dragonfly.id && fromX !== null && fromY !== null && fromZ > 0 && toZ === 0) {
                    // dragonfly special move has 2 last move piece
                    const p2 = this.board.pieces.find(p => p.x === toX && p.y === toY && p.z === 0);
                    this.board.lastMovedPiecesId.push(p2.id);
                } else if (p1.type.id === PieceType.centipede.id && toZ > 0) {
                    // centipede special move has 2 last move piece
                    const p2 = this.board.inGameTopPieces.find(p => p.x === fromX && p.y === fromY);
                    this.board.lastMovedPiecesId.push(p2.id);
                }
            }
        }
    }
    #forward(callbackMove, round) {
        const moveList = this.getMoveList();
        for (; this.board.round < round; this.board.round++) { // redo moves
            const move = moveList.moves[this.board.round - 1];
            if (!move.pass && !move.timeout && !move.resign && !move.draw && !move.whiteLoses && !move.blackLoses) {
                const p = this.board.pieces.find(p => p.id === move.pieceId);
                this.board.play(move.moveSteps[move.moveSteps.length - 1], p, move.moveSteps, callbackMove);
            }
        }
    }
    #backward(callbackMove, round) {
        const moveList = this.getMoveList();
        for (this.board.round--; this.board.round >= round; this.board.round--) {
            const move = moveList.moves[this.board.round - 1];
            if (!move.pass && !move.timeout && !move.resign && !move.draw && !move.whiteLoses && !move.blackLoses) {
                const p = this.board.pieces.find(p => p.id === move.pieceId);
                this.board.playBack(move.moveSteps[0], p, move.moveSteps, callbackMove);
            }
        }
        this.board.round++;
    }
    setRound(round, moveListId) {
        this.#goTo(round, (p, ) => p.transition = 1, moveListId);
        this.#initRound();
    }
    #initRound(forcePlayerPlaying = false) {
        this.board.computeLegalMoves(this.gameOver || this.getMoveList().moves.length < this.board.round);
        this.board.pieces.forEach(p => p.targets.forEach(t => t.transition = 0));
        this.getPlayerPlaying(forcePlayerPlaying).initPlayerTurn();
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
        let minX = null;
        let maxX = null;
        let minY = null;
        let maxY = null;
        hive.board.inGameTopPieces.forEach(p => {
            minX = Math.min(p.x, minX);
            maxX = Math.max(p.x, maxX);
            minY = Math.min(p.y, minY);
            maxY = Math.max(p.y, maxY);
        });
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
        }
    }
}
function scaleTimeFontHeight(txt, fh) {
    const qtyDigits = txt.replace(/[^0-9]/, "").length;
    const qtySeparators = txt.length - qtyDigits;
    return fh * 4.5 / Math.max(4.5, qtyDigits + qtySeparators / 2);
}