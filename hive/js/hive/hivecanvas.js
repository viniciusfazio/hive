import Board from "./core/board.js";
import Piece, {PieceColor, PieceType} from "./core/piece.js";
import CanvasPlayer from "./player/canvasplayer.js";
import MoveList, {Move} from "./core/movelist.js";

const CAMERA_SPEED = .2;   // between 0 and 1, higher is faster
const PIECE_SPEED = .15;   // between 0 and 1, higher is faster
const UPDATE_IN_MS = 20;   // update frame time. Every speed depends of it
const REDRAW_IN_MS = 10;   // draw frame time. Affects FPS only
const MIN_FPS = 40;        // below MIN_FPS, it prints FPS on screen
const GLOWING_SPEED = .6; // positive floating number, higher is faster

const PLAYING_HUD_COLOR = "rgb(0, 0, 0, .75)";
const WAITING_HUD_COLOR = "rgb(0, 0, 0, .25)";

export default class HiveCanvas {
    board = new Board();

    #debug = false;
    #frameQtd = 0;
    #frameTime;
    #framesPerSecond = null;
    #tooSlow = false;

    camera = new Camera();

    canvas;
    ctx;

    gameOver;

    #maxQtyPiecesOverOnHud;

    #bottomPlayerColor;
    whitePlayer;
    blackPlayer;
    #canvasPlayer;
    #standardRules;
    flippedPieces;

    moveLists;
    currentMoveListId;

    #callbacks;

    constructor(callbacks) {
        this.#callbacks = callbacks;
    }

    init($canvas, canvasPlayer) {
        this.canvas = $canvas.get(0);
        this.ctx = this.canvas.getContext("2d");
        this.#maxQtyPiecesOverOnHud = 0;
        for (const keyType in PieceType) {
            this.#maxQtyPiecesOverOnHud = Math.max(this.#maxQtyPiecesOverOnHud, PieceType[keyType].qty - 1);
        }
        this.#canvasPlayer = canvasPlayer;
        this.newGame(PieceColor.white, canvasPlayer, canvasPlayer, 0, 0, true);
        this.gameOver = true;
        this.#frameTime = (new Date()).getTime();
        this.#update();
        this.#redraw();
    }

    #update() {
        const start = (new Date()).getTime();

        // update timer
        const moveList = this.getMoveList();
        if (moveList.computeTime()) {
            if (moveList.whitePiecesTimeLeft === 0 || moveList.blackPiecesTimeLeft === 0) {
                this.timeout();
            }
        }

        // update piece animation
        const inAnimation = this.board.pieces.filter(p => p.transition > 0);
        inAnimation.forEach(p => p.transition = p.transition < 1e-4 ? 0 : p.transition * (1 - PIECE_SPEED));

        // update camera animation
        this.camera.update();

        // setup next update
        const waitTime = UPDATE_IN_MS - ((new Date()).getTime() - start);
        this.#tooSlow = waitTime < 1;
        setTimeout(() => this.#update(), Math.max(1, waitTime));
    }
    newGame(bottomPlayerColor, whitePlayer, blackPlayer, totalTime, increment, standardRules) {
        [this.#bottomPlayerColor, this.whitePlayer, this.blackPlayer] = [bottomPlayerColor, whitePlayer, blackPlayer];
        [this.moveLists, this.currentMoveListId] = [[new MoveList(totalTime, increment)], 0];
        this.whitePlayer.reset();
        this.blackPlayer.reset();
        this.camera.reset();
        this.gameOver = false;
        this.#standardRules = standardRules;
        this.flippedPieces = false;
        this.board.reset(standardRules);
        this.board.pieces.forEach(p => {
            p.fromX = null;
            p.fromY = null;
            p.fromZ = null;
            p.transition = 0;
        });

        this.#initRound();
        this.#callbacks.newGame(this.getMoveList().timeControlToText());
    }
    getPiecePosition(piece) {
        const [rx, ry, offset] = this.getSize();
        const [w, h] = [this.canvas.width, this.canvas.height];
        let x, y;
        let transition = piece.transition;
        let [fromX, fromY] = [piece.fromX, piece.fromY];
        if (piece.inGame) {
            let [px, py, pz] = [piece.x, piece.y, piece.z];
            if (piece.intermediateXYZs.length > 0) {
                if (transition > 0) {
                    const totalAnimation = (piece.intermediateXYZs.length + 1) * (1 - piece.transition);
                    const partAnimation = Math.floor(totalAnimation);
                    transition = 1 - (totalAnimation - partAnimation);

                    if (partAnimation < piece.intermediateXYZs.length) {
                        [px, py, pz] = piece.intermediateXYZs[partAnimation];
                    }
                    if (partAnimation > 0) {
                        const [fx, fy, ] = piece.intermediateXYZs[partAnimation - 1];
                        fromX = w / 2 + fx * rx + offset * pz - this.camera.x;
                        fromY = h / 2 - fy * ry * 3 - offset * pz + this.camera.y;
                    }
                }
            }
            x = w / 2 + px * rx + offset * pz - this.camera.x;
            y = h / 2 - py * ry * 3 - offset * pz + this.camera.y;
        } else {
            let qtdPieces = 0;
            for (const key in PieceType) {
                if (PieceType[key].standard) {
                    qtdPieces++;
                }
            }
            const marginX = w / 2 - (qtdPieces + 1) * rx;
            let position = 0;
            for (const key in PieceType) {
                position++;
                const isLinkedPiece = piece.type.linked !== null && PieceType[piece.type.linked].id === PieceType[key].id;
                if (PieceType[key].id === piece.type.id || isLinkedPiece) {
                    break;
                }
            }
            x = position * rx * 2 + marginX + offset * piece.z;
            if (this.#bottomPlayerColor.id === piece.color.id) {
                y = h - ry * 2 - offset * piece.z;
            } else {
                y = 2 * ry + (this.#maxQtyPiecesOverOnHud - piece.z) * offset;
            }
        }
        if (transition > 0) {
            [x, y] = [x + (fromX - x) * transition, y + (fromY - y) * transition];
        }
        return [x, y];
    }
    getSize(scale = null) {
        const r = (scale ?? this.camera.scale) * this.canvas.width / 30;
        const offset = r / 4;
        return [r * Math.sqrt(3), r, offset];
    }
    #redraw() {
        const start = (new Date()).getTime();
        this.#updateFPS();

        this.#drawHud();

        this.#drawTime();

        this.#drawFPS();

        this.#drawPieces();

        this.#drawFlip();

        this.#drawXOverFallenQueens();

        this.#drawPassAlert();

        this.#drawDebug();

        const waitTime = REDRAW_IN_MS - ((new Date()).getTime() - start);
        setTimeout(() => this.#redraw(), Math.max(1, waitTime));
    }
    #drawPassAlert() {
        const isLastRound = this.getMoveList().moves.length < this.board.round;
        if (this.board.passRound && isLastRound && this.getPlayerPlaying() instanceof CanvasPlayer) {
            const [w2, h2] = [this.canvas.width / 2, this.canvas.height / 2];
            const fh = Math.round(w2 / 6);
            this.ctx.fillStyle = "rgb(0, 0, 0, 0.5)";
            this.ctx.fillRect(0, h2 - fh, w2 * 2, fh * 2);
            this.#drawText(["Click anywhere to pass"], w2, h2, "middle", "center", fh);
        }
    }
    #drawFPS() {
        if (this.#tooSlow || this.#framesPerSecond !== null && this.#framesPerSecond < MIN_FPS) {
            const hudHeight = this.getHudHeight();
            const fh = Math.ceil(20 * this.canvas.width / 1000);
            const color = "rgb(255, 0, 0)";
            let texts = [];
            if (this.#framesPerSecond !== null && this.#framesPerSecond < MIN_FPS) {
                texts.push(this.#framesPerSecond + " FPS");
            }
            if (this.#tooSlow) {
                texts.push("SLOW PERFORMANCE");
            }
            this.#drawText(texts, this.canvas.width - 2, hudHeight + 2, "top", "right", fh, color);
        }
    }
    #updateFPS() {
        const CALCULATE_FPS_EVERY_N_FRAMES = 20;
        this.#frameQtd++;
        if (this.#frameQtd % CALCULATE_FPS_EVERY_N_FRAMES === 0) {
            const now = (new Date()).getTime();
            this.#framesPerSecond = Math.round(1 / ((now - this.#frameTime) / (CALCULATE_FPS_EVERY_N_FRAMES * 1000)));
            this.#frameTime = now;
        }
    }
    #drawDebug() {
        if (this.#debug) {
            const player = this.getPlayerPlaying();
            const moveList = this.getMoveList();
            let text = [
                "Selected: " + player.selectedPieceId,
                "Hover: " + player.hoverPieceId,
                "White: " + moveList.whitePiecesTimeLeft,
                "Black: " + moveList.blackPiecesTimeLeft,
                "Round: " + this.board.round,
                "moves: " + moveList.moves.length,
                "pass round: " + (this.board.passRound ? 1 : 0),
                "white player: " + this.whitePlayer.constructor.name,
                "black player: " + this.blackPlayer.constructor.name,
            ];
            const fh = Math.ceil(16 * this.canvas.width / 1000);
            this.#drawText(text, 0, this.canvas.height / 2, "middle", "left", fh);
        }
    }
    #drawHud() {
        // clear screen
        this.ctx.fillStyle = "rgb(150, 150, 150)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const hudHeight = this.getHudHeight();
        if (this.board.getColorPlaying().id === this.#bottomPlayerColor.id) {
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
        } else {
            this.ctx.fillStyle = WAITING_HUD_COLOR;
        }
        this.ctx.fillRect(0, 0, this.canvas.width, hudHeight);

        if (this.board.getColorPlaying().id === this.#bottomPlayerColor.id) {
            this.ctx.fillStyle = WAITING_HUD_COLOR;
        } else {
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
        }
        this.ctx.fillRect(0, this.canvas.height - hudHeight, this.canvas.width, hudHeight);
    }
    #drawXOverFallenQueens() {
        if (!this.gameOver) {
            return;
        }
        const [rx, ry, ] = this.getSize();
        const r = (rx + ry) / 2;
        this.board.pieces.filter(p => p.inGame && p.type.id === PieceType.queen.id && this.board.isQueenDead(p.color.id)).forEach(p => {
            const pieceOnTop = this.board.inGameTopPieces.find(tp => tp.x === p.x && tp.y === p.y);
            const [x, y] = this.getPiecePosition(pieceOnTop);
            this.ctx.setTransform(1, 0, 0, 1, x, y);
            let path = new Path2D();
            path.moveTo(-r, -r);
            path.lineTo(r, r);
            path.moveTo(r, -r);
            path.lineTo(-r, r);
            path.closePath();
            this.ctx.lineWidth = ry / 2;
            this.ctx.strokeStyle = "rgb(0, 0, 0)";
            this.ctx.stroke(path);
            this.ctx.lineWidth = ry / 3;
            this.ctx.strokeStyle = "rgb(255, 0, 0)";
            this.ctx.stroke(path);
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        });
    }
    getHudHeight() {
        const [, ry, offset] = this.getSize();
        return 4 * ry + this.#maxQtyPiecesOverOnHud * offset + 1;
    }
    getMoveList() {
        return this.moveLists[this.currentMoveListId];
    }

    #drawTime() {
        const moveList = this.getMoveList();
        if (moveList.totalTime === 0) {
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
        if (this.#bottomPlayerColor.id === PieceColor.white.id) {
            [topTime, bottomTime] = [bottomTime, topTime];
        }
        const [topTimeTxt, bottomTimeTxt] = [topTime, bottomTime].map(MoveList.timeToText);

        // get coords to draw the timers
        const [w, h] = [this.canvas.width, this.canvas.height]
        const hh = this.getHudHeight();
        const fh = Math.round(w / 10);
        const fx = Math.round(w / 7);
        const [tyTop, twTop, thTop] = [hh, 2 * fx, fh];
        const [tyBottom, twBottom, thBottom] = [h - hh - fh, 2 * fx, fh];

        // get the background color of each timer
        let color = this.#getColorPlaying();
        if (color === this.#bottomPlayerColor.id) {
            this.ctx.fillStyle = WAITING_HUD_COLOR;
            this.ctx.fillRect(0, tyTop, twTop, thTop);
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
            this.ctx.fillRect(0, tyBottom, twBottom, thBottom);
        } else {
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
            this.ctx.fillRect(0, tyTop, twTop, thTop);
            this.ctx.fillStyle = WAITING_HUD_COLOR;
            this.ctx.fillRect(0, tyBottom, twBottom, thBottom);
        }

        // change font color if time is short
        const topColor = topTime < 10000 ? "rgb(255, 0, 0)" : "rgb(255, 255, 255)";
        const bottomColor = bottomTime < 10000 ? "rgb(255, 0, 0)" : "rgb(255, 255, 255)";

        // change font size if time is too long
        const tfh = scaleTimeFontHeight(topTimeTxt, fh);
        const bfh = scaleTimeFontHeight(bottomTimeTxt, fh);

        // draw timer
        this.#drawText([topTimeTxt], fx, tyTop + fh / 2 + 1, "middle", "center", tfh, topColor);
        this.#drawText([bottomTimeTxt], fx, tyBottom + fh / 2 + 1, "middle", "center", bfh, bottomColor);
    }
    #getColorPlaying() {
        return (this.gameOver ? this.board.round + 1 : this.getMoveList().moves.length) % 2 === 1 ?
            PieceColor.white.id : PieceColor.black.id;
    }
    #drawFlip() {
        if (this.#standardRules) {
            return;
        }

        const [tx, ty, tw, th, fh, hover] = this.#canvasPlayer.overFlip();

        // fill background
        this.ctx.fillStyle = hover ? PLAYING_HUD_COLOR : WAITING_HUD_COLOR;
        this.ctx.fillRect(tx, ty, tw, th);

        const color = hover ? "rgb(255, 255, 0)" : "rgb(255, 255, 255)";
        this.#drawText(["FLIP"], tx + tw / 2, ty + fh / 2 + 1, "middle", "center", fh, color);
    }

    #drawPieces() {
        // get targets to draw
        let targets = [];
        const player = this.getPlayerPlaying();
        let selectedPieceId = null;
        let hoverPieceId = null;
        if (player instanceof CanvasPlayer) {
            selectedPieceId = player.selectedPieceId;
            hoverPieceId = player.hoverPieceId;
            const id = player.selectedPieceId ?? player.hoverPieceId;
            if (id !== null) {
                targets = this.board.pieces.find(p => p.id === id).targets;
            }
        }
        // sort pieces to draw in correct order
        const dragId = player?.dragging ? player.selectedPieceId : null;
        const queensCovered = this.board.pieces.filter(p => p.type.id === PieceType.queen.id && p.inGame
            && !this.board.inGameTopPieces.find(t => t.id === p.id)).map(p => p.id);
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
            if (a.z !== b.z) {
                return a.z - b.z;
            }
            // draw targets at the end
            if (a.subNumber !== b.subNumber) {
                return a.subNumber - b.subNumber;
            }
            // draw pieces in animation at the end
            if (Math.abs(a.transition - b.transition) > 1e-4) {
                return a.transition - b.transition;
            }
            // draw queens covered at the end
            const aCovered = queensCovered.includes(a.id);
            const bCovered = queensCovered.includes(b.id);
            if (aCovered && !bCovered) {
                return 1;
            }
            if (bCovered && !aCovered) {
                return -1;
            }
            // draw selected pieces at the end
            if (a.id === selectedPieceId) {
                return 1;
            }
            if (b.id === selectedPieceId) {
                return -1;
            }
            // draw hover pieces at the end
            if (a.id === hoverPieceId) {
                return 1;
            }
            if (b.id === hoverPieceId) {
                return -1;
            }
            // draw movable pieces at the end
            if (a.targets.length !== b.targets.length) {
                return a.targets.length - b.targets.length;
            }
            // draw last moved piece at the end
            if (this.board.lastMovedPiecesId.includes(a.id) && !this.board.lastMovedPiecesId.includes(b.id)) {
                return 1;
            }
            if (this.board.lastMovedPiecesId.includes(b.id) && !this.board.lastMovedPiecesId.includes(a.id)) {
                return -1;
            }
            // draw mantis at the end to better move animation
            if (a.type.id === PieceType.mantis.id && b.type.id !== PieceType.mantis.id) {
                return 1;
            }
            if (b.type.id === PieceType.mantis.id && a.type.id !== PieceType.mantis.id) {
                return -1;
            }
            return 0;
        }).forEach(p => this.#drawPiece(p));
    }
    #linkedPieceInAnimation(p) {
        return this.board.pieces.find(l => l.type.id === PieceType[p.type.linked].id && l.color.id === p.color.id && l.number === p.number && l.transition > 0);
    }
    getPiecePath2D() {
        let path = new Path2D();
        const [rx, ry, ] = this.getSize();

        let [px, py] = [null, null];
        for (const [x, y] of Board.coordsAround(0, 0)) {
            const [cx, cy] = [rx * y, ry * x];
            if (px === null && py === null) {
                [px, py] = [cx, cy];
                path.moveTo(cx, cy);
            } else {
                path.lineTo(cx, cy);
            }
        }
        path.lineTo(px, py);
        path.closePath();
        return path;
    }

    #drawPiece(piece) {
        if (piece.id === this.#canvasPlayer.selectedPieceId) {
            if (this.#canvasPlayer.hoverPieceId === null && this.#canvasPlayer.dragging) {
                // drawing selected piece dragging
                this.#drawPieceWithStyle(piece, "drag");
            } else if (!piece.targets.find(p => p.id === this.#canvasPlayer.hoverPieceId)) {
                // drawing selected piece only if not hovering target
                this.#drawPieceWithStyle(piece, "selected");
            }
        } else if (piece.id === this.#canvasPlayer.hoverPieceId) {
            if (piece.selectedPieceId !== null) {
                if (this.board.pieces.find(p => p.id === this.#canvasPlayer.hoverPieceId)) {
                    // drawing another piece being hovered while a piece has been selected
                    this.#drawPieceWithStyle(piece, "hover");
                } else {
                    // drawing target being hovered
                    this.#drawPieceWithStyle(piece, "selected");
                }
            } else {
                // drawing piece being hovered while no piece has been selected
                this.#drawPieceWithStyle(piece, "hover");
            }
        } else if (piece.subNumber > 0) {
            // drawing target not being hovered
            this.#drawPieceWithStyle(piece, "target");
        } else if (this.board.lastMovedPiecesId.includes(piece.id)) {
            // drawing last piece moved
            this.#drawPieceWithStyle(piece, "last-piece");
        } else if (piece.targets.length > 0) {
            // drawing movable piece
            this.#drawPieceWithStyle(piece, "movable");
        } else if (piece.type.id === PieceType.queen.id && piece.inGame && !this.board.inGameTopPieces.find(p => p.id === piece.id)) {
            // there are pieces above queen
            this.#drawPieceWithStyle(piece, "queen");
        } else {
            // drawing piece in other cases
            this.#drawPieceWithStyle(piece);
        }
    }
    #drawPieceWithStyle(piece, style = "") {
        // get position
        let x, y;
        if (style === "drag") {
            const player = this.getPlayerPlaying();
            [x, y] = [player.mouseX, player.mouseY];
        } else {
            [x, y] = this.getPiecePosition(piece);
        }

        const [rx, ry, offset] = this.getSize();
        const path = this.getPiecePath2D();

        this.ctx.setTransform(1, 0, 0, 1, x, y);
        if (style === "target") {
            this.ctx.globalAlpha = .25;
        }


        let from0to50to0 = Math.round(this.#frameQtd * GLOWING_SPEED) % 100;
        if (from0to50to0 >= 50) {
            from0to50to0 = 100 - from0to50to0;
        }

        // fill color
        let r, g, b;
        let glow = style === "movable" ? -(from0to50to0 * from0to50to0) / 50 : 0;
        if (piece.color.id === "w") {
            [r, g, b] = [230 + glow, 210 + glow, 190 + glow];
        } else {
            [r, g, b] = [50 + glow, 70 + glow, 90 + glow];
        }
        this.ctx.fillStyle = "rgb(" + r + ", " + g + ", " + b + ")";
        this.ctx.fill(path);

        // draw piece image, rotating according to the number identification
        const rxy = Math.min(rx, ry);
        this.ctx.rotate(-Math.PI / 2 + (Math.max(1, piece.number) - 1) * Math.PI / 3);
        this.ctx.drawImage(document.getElementById("piece" + piece.type.id), -rxy, -rxy, 2 * rxy, 2 * rxy);
        this.ctx.setTransform(1, 0, 0, 1, x, y);

        // draw border
        let borderColor;
        let border = offset / 2;
        if (style === "last-piece") {
            borderColor = "rgb(255, 0, 0)";
        } else if (style === "queen") {
            const c = 205 + from0to50to0;
            borderColor = "rgb(" + c + ", " + c + ", 0)";
        } else if (style === "hover") {
            borderColor = "rgb(128, 0, 0)";
        } else if (style === "movable") {
            borderColor = "rgb(0, 0, 0)";
        } else if (style === "selected" || style === "target" || style === "drag") {
            borderColor = "rgb(255, 0, 0)";
        } else {
            borderColor = "rgb(0, 0, 0)";
            border = offset / 4;
        }
        this.ctx.lineWidth = Math.max(1, border);
        this.ctx.strokeStyle = borderColor;
        this.ctx.stroke(path);

        // reset
        this.ctx.lineDashOffset = 0;
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1;

        if (this.#debug) {
            const h = Math.round(26 * this.camera.scale * this.canvas.width / 1000);
            if (piece.inGame) {
                let text = [piece.x + "," + piece.y + "," + piece.z];
                if (piece.subNumber === 0) {
                    text.push(piece.id);
                }
                this.#drawText(text, 0, 0, "middle", "center", h);
            } else {
                this.#drawText(["", piece.id], 0, 0, "middle", "center", h);
            }
        }
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    #drawText(texts, x = 0, y = 0, valign = "middle", align = "center",
             height, cor = "rgb(255, 255, 255)", corBorda = "rgb(0, 0, 0)") {
        this.ctx.font = height + "px Sans-serif";
        this.ctx.lineWidth = 2;
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
            this.ctx.strokeStyle = corBorda;
            this.ctx.strokeText(text, x, y);
            this.ctx.fillStyle = cor;
            this.ctx.fillText(text, x, y);
            y += height;
        })
    }
    getPlayerPlaying() {
        return this.gameOver ? this.#canvasPlayer : (this.board.round % 2 === 1 ? this.whitePlayer : this.blackPlayer);
    }
    toggleDebug() {
        this.#debug = !this.#debug;
    }
    #playRound(withAnimation = true) {
        const moveList = this.getMoveList();
        this.#goTo(this.board, moveList.moves.length + 1, (p, forceAnimation) => (forceAnimation || withAnimation) && this.#resetPieceAnimation(p), this.currentMoveListId);
        const lastMove = moveList.moves[moveList.moves.length - 1];
        this.#callbacks.move(this.board.round, (this.board.round - 1) + ". " + Move.notation(lastMove, this.board), this.currentMoveListId);
        this.gameOver ||= lastMove.whiteLoses || lastMove.blackLoses || lastMove.draw || lastMove.resign || lastMove.timeout;
        this.#initRound();
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
        this.#playRound();
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
        this.#playRound();
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
            const piece = Piece.parse(matches[2], this.#standardRules);
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
        const p1 = Piece.parse(matches[2], this.#standardRules);
        const p2 = Piece.parse(matches[4], this.#standardRules);
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
    play(piece, target, time = null, withAnimation = true, lastMove = true) {
        let moveList = this.getMoveList();
        if (!lastMove && this.board.round <= moveList.moves.length) {
            // an alternative move happened. Create a new list
            const initialRound = this.currentMoveListId === 0 ? this.board.round : moveList.initialRound;
            moveList = moveList.clone();
            this.moveLists.push(moveList);
            moveList.parentMoveListId =this.currentMoveListId;
            this.currentMoveListId = this.moveLists.length - 1;
            moveList.moves = moveList.moves.slice(0, this.board.round - 1);
            moveList.initialRound = initialRound;
        }
        // save the move
        moveList.addMove(piece, target, time);
        this.#playRound(withAnimation);
        const whiteLoses = this.board.isQueenDead(PieceColor.white.id);
        const blackLoses = this.board.isQueenDead(PieceColor.black.id);
        if (whiteLoses || blackLoses) {
            moveList.addGameOver(whiteLoses, blackLoses, time);
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
    #goTo(board, round, callbackMove, moveListId) {
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
                if (p1.type.id === PieceType.mantis.id && move.fromZ === 0) {
                    // mantis special move has 2 last move piece
                    const p2 = this.board.pieces.find(p => p.x === move.fromX && p.y === move.fromY && p.z === 0);
                    this.board.lastMovedPiecesId.push(p2.id);
                } else if (p1.type.id === PieceType.dragonfly.id && move.fromZ > 0 && move.toZ === 0) {
                    // dragonfly special move has 2 last move piece
                    const p2 = this.board.pieces.find(p => p.x === move.toX && p.y === move.toY && p.z === 0);
                    this.board.lastMovedPiecesId.push(p2.id);
                } else if (p1.type.id === PieceType.centipede.id && move.toZ > 0) {
                    // centipede special move has 2 last move piece
                    const p2 = this.board.inGameTopPieces.find(p => p.x === move.fromX && p.y === move.fromY);
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
                callbackMove(p, false);
                if (p.type.id === PieceType.mantis.id && move.fromZ === 0) {
                    // mantis special move
                    const p2 = this.board.inGame.find(p2 => p2.x === move.toX && p2.y === move.toY && p2.z === 0);
                    callbackMove(p2, true);
                    p2.play(move.fromX, move.fromY, p2.z);
                    p.play(move.fromX, move.fromY, move.toZ);
                } else if (p.type.id === PieceType.dragonfly.id && move.fromZ > 0 && move.toZ === 0) {
                    // dragonfly special move
                    const p2 = this.board.inGame.find(p2 => p2.x === move.fromX && p2.y === move.fromY && p2.z === p.z - 1);
                    callbackMove(p2, true);
                    p2.play(move.toX, move.toY, 0);
                    p.play(move.toX, move.toY, 1);
                } else if (p.type.id === PieceType.centipede.id && move.toZ > 0) {
                    // centipede special move
                    const p2 = this.board.inGame.find(p2 => p2.x === move.toX && p2.y === move.toY && p2.z === 0);
                    callbackMove(p2, true);
                    p2.play(move.fromX, move.fromY, p2.z);
                    p.play(move.toX, move.toY, p.z);
                } else {
                    callbackMove(p, false);
                    p.play(move.toX, move.toY, move.toZ, move.intermediateXYZs);
                }
            }
        }
    }
    #backward(callbackMove, round) {
        const moveList = this.getMoveList();
        for (this.board.round--; this.board.round >= round; this.board.round--) {
            const move = moveList.moves[this.board.round - 1];
            if (!move.pass && !move.timeout && !move.resign && !move.draw && !move.whiteLoses && !move.blackLoses) {
                const p = this.board.pieces.find(p => p.id === move.pieceId);
                callbackMove(p, false);
                if (p.type.id === PieceType.mantis.id && move.fromZ === 0) {
                    // mantis special move
                    const p2 = this.board.inGame.find(p2 => p2.x === move.fromX && p2.y === move.fromY && p2.z === 0);
                    callbackMove(p2, true);
                    p2.play(move.toX, move.toY, p2.z);
                    p.play(move.fromX, move.fromY, move.fromZ);
                } else if (p.type.id === PieceType.dragonfly.id && move.fromZ > 0 && move.toZ === 0) {
                    // dragonfly special move
                    const p2 = this.board.inGame.find(p2 => p2.x === move.toX && p2.y === move.toY && p2.z === p.z - 1);
                    callbackMove(p2, true);
                    p2.play(move.fromX, move.fromY, move.fromZ - 1);
                    p.play(move.fromX, move.fromY, move.fromZ);
                } else if (p.type.id === PieceType.centipede.id && move.toZ > 0) {
                    // centipede special move
                    const p2 = this.board.inGame.find(p2 => p2.x === move.fromX && p2.y === move.fromY && p2.z === 0);
                    callbackMove(p2, true);
                    p2.play(move.toX, move.toY, p2.z);
                    p.play(move.fromX, move.fromY, p.z);
                } else {
                    p.play(move.fromX, move.fromY, move.fromZ, move.intermediateXYZs.toReversed());
                }
            }
        }
        this.board.round++;
    }
    setRound(round, moveListId) {
        this.#goTo(this.board, round, p => this.#resetPieceAnimation(p), moveListId);
        this.#initRound();
    }
    #initRound() {
        this.board.computeLegalMoves(this.gameOver || this.getMoveList().moves.length < this.board.round);
        this.board.pieces.forEach(p => p.targets.forEach(t => t.transition = 0));
        this.getPlayerPlaying().initPlayerTurn();
        this.camera.recenter(this);
    }
    #resetPieceAnimation(piece) {
        [piece.fromX, piece.fromY] = this.getPiecePosition(piece);
        piece.transition = 1;
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
        const qtdX = 5 + maxX - minX; // number of pieces on x, adding extra piece space
        const qtdY = 7 + maxY - minY; // number of pieces on y, adding extra piece space and hud
        const maxInX = hive.canvas.width / rx;
        const maxInY = hive.canvas.height / (3 * ry);
        this.#toScale = Math.min(maxInX / qtdX, maxInY / qtdY, 1);
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
    let tfh = fh;
    for (let i = 6; i < txt.length; i++) {
        tfh *= 1 - 1 / i;
    }
    return tfh;
}

