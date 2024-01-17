import Board from "./core/board.js";
import Piece, {PieceColor, PieceType} from "./core/piece.js";
import CanvasPlayer from "./player/canvasplayer.js";
import MoveList from "./core/movelist.js";

const BACKGROUND_COLOR = "rgb(150, 150, 150)";
const PLAYING_HUD_COLOR = "rgb(0, 0, 0, .75)";
const WAITING_HUD_COLOR = "rgb(0, 0, 0, .25)";
const TIMER_HEIGHT = 20;

export default class HiveCanvas {
    board = new Board();

    #debug = false;
    #frame = 0;

    camera = new Camera();

    canvas;
    ctx;

    gameOver;

    #maxQtyPiecesOverOnHud;

    #bottomPlayerColor;
    #whitePlayer;
    #blackPlayer;

    #moveLists;
    #currentMoveListId;

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
        this.newGame(PieceColor.white, canvasPlayer, canvasPlayer, 0, 0);

        this.#update();
    }
    #update() {
        const moveList = this.getMoveList();
        if (!this.gameOver && moveList.computeTime()) {
            this.#drawTime();
            if (moveList.whitePiecesTimeLeft === 0 || moveList.blackPiecesTimeLeft === 0) {
                this.timeout();
            }
        }
        const inTransition = this.board.pieces.filter(p => p.transition > 0);
        let redraw = false;
        if (inTransition.length > 0) {
            inTransition.forEach(p => p.transition = p.transition < 1e-4 ? 0 : p.transition * .7);
            redraw = true;
        }
        redraw |= this.camera.update();
        if (redraw) {
            this.redraw();
        }
        setTimeout(() => this.#update(), 20);
    }
    newGame(bottomPlayerColor, whitePlayer, blackPlayer, totalTime, increment) {
        [this.#bottomPlayerColor, this.#whitePlayer, this.#blackPlayer] = [bottomPlayerColor, whitePlayer, blackPlayer];
        [this.#moveLists, this.#currentMoveListId] = [[new MoveList(totalTime, increment)], 0];
        this.camera.reset();
        this.gameOver = false;
        this.board.reset();


        this.#initRound();
        this.#callbacks.newGame(this.getMoveList().timeControlToText());

        this.#drawFirstFrames();
    }
    getPiecePosition(piece) {
        const [rx, ry, offset] = this.getSize();
        const [w, h] = [this.canvas.width, this.canvas.height];
        let x, y;
        if (piece.inGame) {
            x = w / 2 + piece.x * rx + offset * piece.z - this.camera.x;
            y = h / 2 - piece.y * ry * 3 - offset * piece.z + this.camera.y;
        } else {
            const timerHeight = this.getMoveList().totalTime > 0 ? TIMER_HEIGHT : 0;
            const marginX = w / 2 - (Object.keys(PieceType).length + 1) * rx;
            let position = 0;
            for (const key in PieceType) {
                position++;
                if (PieceType[key].id === piece.type.id) {
                    break;
                }
            }
            x = position * rx * 2 + marginX + offset * piece.z;
            if (this.#bottomPlayerColor.id === piece.color.id) {
                y = h - ry * 2 - timerHeight - offset * piece.z;
            } else {
                y = 2 * ry + (this.#maxQtyPiecesOverOnHud - piece.z) * offset + timerHeight;
            }
        }
        if (piece.transition > 0) {
            return [x + (piece.fromX - x) * piece.transition, y + (piece.fromY - y) * piece.transition];
        } else {
            return [x, y];
        }
    }
    getSize(scale = null) {
        const r = (scale ?? this.camera.scale) * this.canvas.width / 30;
        const offset = r / 4;
        return [r * Math.sqrt(3), r, offset];
    }
    #drawFirstFrames() {
        this.redraw();
        if (this.#frame < 10) {
            setTimeout(() => this.#drawFirstFrames(), 100);
        }
    }
    redraw() {
        this.#frame++;

        // clear screen
        this.ctx.fillStyle = BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // draw pieces in game
        this.#drawPieces(this.board.pieces.filter(p => p.inGame));

        const player = this.getPlayerPlaying();
        if (player instanceof CanvasPlayer) {
            const hoverPiece = this.board.pieces.find(p => p.id === player.hoverPieceId);
            if (player.selectedPieceId !== null && !hoverPiece) {
                // there is a selected piece and no other piece being hovered (except targets)
                // draw targets from selected piece
                this.#drawPieces(this.board.pieces.find(p => p.id === player.selectedPieceId).targets);
            } else if (hoverPiece) {
                // draw targets from hovered piece
                this.#drawPieces(hoverPiece.targets);
            }
        }

        // draw hud
        const moveList = this.getMoveList();
        const [, ry, offset] = this.getSize();
        const timerHeight = moveList.totalTime > 0 ? TIMER_HEIGHT : 0;
        const height = 4 * ry + this.#maxQtyPiecesOverOnHud * offset + 4 + timerHeight / 2;
        if (this.board.getColorPlaying().id === this.#bottomPlayerColor.id) {
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
        } else {
            this.ctx.fillStyle = WAITING_HUD_COLOR;
        }
        this.ctx.fillRect(0, timerHeight / 2, this.canvas.width, height);
        if (this.board.getColorPlaying().id === this.#bottomPlayerColor.id) {
            this.ctx.fillStyle = WAITING_HUD_COLOR;
        } else {
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
        }
        this.ctx.fillRect(0, this.canvas.height - height, this.canvas.width, height);

        if (this.#debug) {
            let text = [
                "Frame: " + this.#frame,
            ];
            if (player instanceof CanvasPlayer) {
                text.push("Selected: " + player.selectedPieceId);
                text.push("Hover: " + player.hoverPieceId);
                text.push("White: " + moveList.whitePiecesTimeLeft);
                text.push("Black: " + moveList.blackPiecesTimeLeft);
                text.push("Round: " + this.board.round);
                text.push("Last ID: " + this.board.lastMovePieceId);
                text.push("pass round: " + (this.board.passRound ? 1 : 0));
            }
            this.#drawText(text, 0, this.canvas.height / 2 - text.length * 6, "middle", "left", 12);
        }

        this.#drawPieces(this.board.pieces.filter(p => !p.inGame));
        if (this.board.passRound && !this.gameOver && this.getPlayerPlaying() instanceof CanvasPlayer) {
            const [w2, h2] = [this.canvas.width / 2, this.canvas.height / 2];
            const fh = Math.round(w2 / 10);
            this.ctx.fillStyle = "rgb(0, 0, 0, 0.5)";
            this.ctx.fillRect(0, h2 - fh, w2 * 2, fh * 2);
            this.#drawText(["Click anyware to pass"], w2, h2, "middle", "center", fh);
        }

        if (player instanceof CanvasPlayer && player.dragging && player.selectedPieceId !== null) {
            this.#drawPiece(this.board.pieces.find(p => p.id === player.selectedPieceId));
        }

        if (timerHeight > 0) {
            this.#drawTime();
        }
    }
    getMoveList() {
        return this.#moveLists[this.#currentMoveListId];
    }
    #drawTime() {
        const moveList = this.getMoveList();
        let [topTime, bottomTime] = [moveList.whitePiecesTimeLeft, moveList.blackPiecesTimeLeft];
        if (this.#bottomPlayerColor.id === PieceColor.white.id) {
            [topTime, bottomTime] = [bottomTime, topTime];
        }

        const [topTimeTxt, bottomTimeTxt] = [topTime, bottomTime].map(MoveList.timeToText);

        const [w, h, th] = [this.canvas.width, this.canvas.height, TIMER_HEIGHT]
        // swap hud color for timer
        this.ctx.fillStyle = BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, w, th);
        this.ctx.fillRect(0, h - th, w, th);
        if (this.board.getColorPlaying().id === this.#bottomPlayerColor.id) {
            this.ctx.fillStyle = WAITING_HUD_COLOR;
            this.ctx.fillRect(0, 0, w, th);
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
            this.ctx.fillRect(0, h - th, w, th);
        } else {
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
            this.ctx.fillRect(0, 0, w, th);
            this.ctx.fillStyle = WAITING_HUD_COLOR;
            this.ctx.fillRect(0, h - th, w, th);
        }

        // change color if time is short
        const topColor = topTime < 10000 ? "rgb(255, 0, 0)" : "rgb(255, 255, 255)";
        const bottomColor = bottomTime < 10000 ? "rgb(255, 0, 0)" : "rgb(255, 255, 255)";
        this.#drawText([topTimeTxt], w / 2, 1, "top", "center", th - 2, topColor);
        this.#drawText([bottomTimeTxt], w / 2, h + 2, "bottom", "center", th - 2, bottomColor);
    }

    #drawPieces(pieces, z = 0) {
        let piecesAbove = [];
        pieces.forEach(p => {
            if (p.z > z) {
                piecesAbove.push(p); // se for peça acima, guarda para próxima iteração
            } else {
                this.#drawPiece(p);
            }
        });
        if (piecesAbove.length > 0) {
            this.#drawPieces(piecesAbove, z + 1);
        }

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

    #drawPiece(piece, style = null) {
        if (style !== null) {
            let x, y;
            if (style.includes("hover")) {
                const player = this.getPlayerPlaying();
                [x, y] = [player.mouseX, player.mouseY];
            } else {
                [x, y] = this.getPiecePosition(piece);
            }
            const [rx, ry, ] = this.getSize();
            const path = this.getPiecePath2D();

            this.ctx.setTransform(1, 0, 0, 1, x, y);
            if (style.includes("transparent")) {
                this.ctx.globalAlpha = .25;
            }


            this.ctx.fillStyle = piece.color.id === "w" ? "rgb(250, 230, 210)" : "rgb(50, 70, 90)";
            this.ctx.fill(path);

            this.ctx.strokeStyle = "rgb(0, 0, 0)";
            this.ctx.lineWidth = 1;
            this.ctx.stroke(path);

            const r = Math.min(rx, ry);
            this.ctx.rotate(-Math.PI / 2 + (Math.max(1, piece.number) - 1) * Math.PI / 3);
            this.ctx.drawImage(document.getElementById("piece" + piece.type.id), -r, -r, 2 * r, 2 * r);
            this.ctx.setTransform(1, 0, 0, 1, x, y);

            this.ctx.globalAlpha = 1;

            if (this.#debug) {
                const h = Math.round(20 * this.camera.scale);
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

            if (style.includes("boarded")) {
                this.ctx.lineWidth = 2;
                if (style.includes("3")) {
                    this.ctx.strokeStyle = "rgb(0, 255, 255)";
                } else if (style.includes("4")) {
                    this.ctx.strokeStyle = "rgb(255, 128, 0)";
                } else {
                    this.ctx.strokeStyle = "rgb(255, 0, 0)";
                }
                if (style.includes("2") || style.includes("4")) {
                    this.ctx.setLineDash([4, 4]);
                    this.ctx.lineWidth = 4;
                }
                this.ctx.stroke(path);
                this.ctx.setLineDash([]);
            }

            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            return;
        }
        const player = this.getPlayerPlaying();
        const playable = this.board.round > this.getMoveList().moves.length;
        if (playable && player instanceof CanvasPlayer) {
            if (piece.id === player.selectedPieceId) {
                if (player.hoverPieceId === null) {
                    if (player.dragging) {
                        // drawing selected piece when not hovering target but dragging
                        this.#drawPiece(piece, ["transparent", "boarded", "2"]);
                        this.#drawPiece(piece, ["boarded", "2", "hover"]);
                    } else {
                        // drawing selected piece when not hovering target
                        this.#drawPiece(piece, ["boarded", "2"]);
                    }
                } else if (piece.targets.find(p => p.id === player.hoverPieceId)) {
                    // drawing selected piece when hovering target
                    this.#drawPiece(piece, ["transparent", "boarded", "2"]);
                } else {
                    // drawing selected piece when hovering another piece
                    this.#drawPiece(piece, ["boarded", "2"]);
                }
                return
            }
            if (piece.id === player.hoverPieceId) {
                if (piece.selectedPieceId !== null) {
                    if (this.board.pieces.find(p => p.id === player.hoverPieceId)) {
                        // drawing another piece being hovered while a piece has been selected
                        this.#drawPiece(piece, ["boarded", "2"]);
                    } else {
                        // drawing target being hovered
                        this.#drawPiece(piece, ["boarded", "1"]);
                    }
                } else {
                    // drawing piece being hovered while no piece has been selected
                    this.#drawPiece(piece, ["boarded", "2"]);
                }
                return
            }
            if (piece.subNumber > 0) {
                // drawing target not being hovered
                this.#drawPiece(piece, ["transparent"]);
                return
            }
        }
        if (this.board.lastMovePieceId === piece.id) {
            // drawing last piece moved
            this.#drawPiece(piece, ["boarded", "3"]);
            return;
        }
        if (playable && piece.targets.length > 0) {
            // drawing moveable piece
            this.#drawPiece(piece, ["boarded", "4"]);
            return;
        }
        // drawing piece in other cases
        this.#drawPiece(piece, []);
    }
    #drawText(text, x = 0, y = 0, valign = "middle", align = "center",
             height = 20, cor = "rgb(255, 255, 255)", corBorda = "rgb(0, 0, 0)") {
        this.ctx.font = height + "px Sans-serif";
        this.ctx.lineWidth = 2;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = valign;
        text.forEach(txt => {
            this.ctx.strokeStyle = corBorda;
            this.ctx.strokeText(txt, x, y);
            this.ctx.fillStyle = cor;
            this.ctx.fillText(txt, x, y);
            y += height;
        })
    }
    getPlayerPlaying() {
        return this.board.round % 2 === 1 ? this.#whitePlayer : this.#blackPlayer;
    }
    toggleDebug() {
        this.#debug = !this.#debug;
    }
    #playRound() {
        const moveList = this.getMoveList();
        this.board.pieces.forEach(p => [[p.fromX, p.fromY], p.transition] = [this.getPiecePosition(p), 1]);
        moveList.goTo(this.board, moveList.moves.length + 1);
        const lastMove = moveList.moves[moveList.moves.length - 1];
        this.#callbacks.move(this.board.round, (this.board.round - 1) + ". " + lastMove.notation(this.board));
        this.gameOver ||= lastMove.whiteLoses || lastMove.blackLoses || lastMove.draw || lastMove.resign || lastMove.timeout;
        this.#initRound();
    }
    pass(time = null) {
        if (this.gameOver) return;
        const moveList = this.getMoveList();
        moveList.addPass(time);
        this.#playRound();
    }
    resign(time = null) {
        if (this.gameOver) return;
        const moveList = this.getMoveList();
        moveList.addResign(time);
        this.#callbacks.resign(this.board.getColorPlaying().id);
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
        this.#callbacks.timeout(this.board.getColorPlaying().id);
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
            const piece = Piece.parse(matches[2]);
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
        const p1 = Piece.parse(matches[2]);
        const p2 = Piece.parse(matches[4]);
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
    play(piece, target, time = null) {
        if (this.gameOver) return;
        // save the move
        const moveList = this.getMoveList();
        moveList.addMove(piece, target, time);
        this.#playRound();
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
    setRound(round) {
        this.board.pieces.forEach(p => [[p.fromX, p.fromY], p.transition] = [this.getPiecePosition(p), 1]);
        this.getMoveList().goTo(this.board, round);
        this.#initRound();
    }
    #initRound() {
        this.board.computeLegalMoves(this.gameOver);
        if (!this.gameOver) {
            this.getPlayerPlaying().initPlayerTurn();
        }
        this.camera.recenter(this);
        this.redraw();
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
        const diffX = (this.#toX - this.x) * .2;
        const diffY = (this.#toY - this.y) * .2;
        const diffScale = (this.#toScale - this.scale) * .2;
        if (Math.abs(diffX) > 1e-4 || Math.abs(diffY) > 1e-4 || Math.abs(diffScale) > 1e-4) {
            this.x += diffX;
            this.y += diffY;
            this.scale += diffScale;
            return true;
        }
        return false;
    }
}