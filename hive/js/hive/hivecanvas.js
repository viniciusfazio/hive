
import Board from "./core/board.js";
import {PieceColor, PieceType} from "./core/piece.js";
import CanvasPlayer from "./player/canvasplayer.js";
import Movelist from "./core/movelist.js";

const BACKGROUND_COLOR = "rgb(150, 150, 150)";
const PLAYING_HUD_COLOR = "rgb(0, 0, 0, .75)";
const WAITING_HUD_COLOR = "rgb(0, 0, 0, .25)";
const TIMER_HEIGHT = 20;

export default class Hivecanvas {
    canvas;
    ctx;
    board = new Board();

    #maxQtyPiecesOverOnHud;

    #debug = true;
    #frame = 0;

    #bottomPlayerColor;
    #whitePlayer;
    #blackPlayer;

    #moveLists;
    #currentMoveListId;

    #scale;
    #cameraX;
    #cameraY;

    constructor($canvas, canvasPlayer) {
        this.canvas = $canvas.get(0);
        this.ctx = this.canvas.getContext("2d");
        this.#maxQtyPiecesOverOnHud = 0;
        for (const keyType in PieceType) {
            this.#maxQtyPiecesOverOnHud = Math.max(this.#maxQtyPiecesOverOnHud, PieceType[keyType].qty - 1);
        }
        this.newGame(PieceColor.white, canvasPlayer, canvasPlayer, 1, 5);

        this.#update();

    }
    #update() {
        if (this.#moveLists[0].computeTime()) {
            this.#drawTime();
        }
        const inTransition = this.board.pieces.filter(p => p.transition > 0);
        if (inTransition.length > 0) {
            inTransition.forEach(p => p.transition = p.transition < 1e-4 ? 0 : p.transition * .8);
            this.redraw();
        }
        setTimeout(() => this.#update(), 50);
    }
    newGame(bottomPlayerColor, whitePlayer, blackPlayer, totalTime, increment) {
        [this.#bottomPlayerColor, this.#whitePlayer, this.#blackPlayer] = [bottomPlayerColor, whitePlayer, blackPlayer];
        [this.#moveLists, this.#currentMoveListId] = [[new Movelist(totalTime, increment)], 0];
        [this.#scale, this.#cameraX, this.#cameraY] = [1, 0, 0];

        // reset moves
        this.board.pieces.forEach(p => {
            p.reset();
            this.#setPiecePosition(p, 0);
        });


        this.board.computeLegalMoves();
        this.board.pieces.forEach(p => p.targets.forEach(t => this.#setPiecePosition(t, 0)));
        this.#whitePlayer.initPlayerTurn(this);

        this.#drawFirstFrames();
    }
    #setPiecePosition(piece, transition = 1) {
        if (transition === 0) {
            piece.fromX = 0;
            piece.fromY = 0;
        } else {
            piece.fromX = piece.toX + (piece.fromX - piece.toX) * piece.transition;
            piece.fromY = piece.toY + (piece.fromY - piece.toY) * piece.transition;
        }
        piece.transition = transition;
        const [rx, ry, offset] = this.#getSize();
        const [w, h] = [this.canvas.width, this.canvas.height];
        if (piece.inGame) {
            piece.toX = w / 2 - this.#cameraX + piece.x * rx + offset * piece.z;
            piece.toY = h / 2 + this.#cameraY - piece.y * ry * 3 - offset * piece.z;
        } else {
            const timerHeight = this.#moveLists[0].totalTime > 0 ? TIMER_HEIGHT : 0;
            const marginX = w / 2 - (Object.keys(PieceType).length + 1) * rx;
            let position = 0;
            for (const key in PieceType) {
                position++;
                if (PieceType[key].id === piece.type.id) {
                    break;
                }
            }
            piece.toX = position * rx * 2 + marginX + offset * piece.z;
            if (this.#bottomPlayerColor.id === piece.color.id) {
                piece.toY = h - ry * 2 - timerHeight - offset * piece.z;
            } else {
                piece.toY = 2 * ry + (this.#maxQtyPiecesOverOnHud - piece.z) * offset + timerHeight;
            }
        }
    }
    #getSize(scale = null) {
        const r = (scale ?? this.#scale) * this.canvas.width / 30;
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

        const player = this.#getPlayerPlaying();
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
        const [, ry, offset] = this.#getSize();
        const timerHeight = this.#moveLists[0].totalTime > 0 ? TIMER_HEIGHT : 0;
        const height = 4 * ry + this.#maxQtyPiecesOverOnHud * offset + 4 + timerHeight / 2;
        if (this.board.getColorPlaying().id === this.#bottomPlayerColor.id) {
            this.ctx.fillStyle = WAITING_HUD_COLOR;
        } else {
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
        }
        this.ctx.fillRect(0, timerHeight / 2, this.canvas.width, height);
        this.ctx.fillStyle = this.ctx.fillStyle === WAITING_HUD_COLOR ? PLAYING_HUD_COLOR : WAITING_HUD_COLOR;
        this.ctx.fillRect(0, this.canvas.height - height, this.canvas.width, height);

        this.#drawPieces(this.board.pieces.filter(p => !p.inGame));

        if (timerHeight > 0) {
            this.#drawTime();
        }



        if (this.#debug) {
            let text = [
                "Frame: " + this.#frame,
            ];
            if (player instanceof CanvasPlayer) {
                text.push("Selected: " + player.selectedPieceId);
                text.push("Hover: " + player.hoverPieceId);
                text.push("White: " + this.#moveLists[0].whitePiecesTimeLeft);
                text.push("Black: " + this.#moveLists[0].blackPiecesTimeLeft);
                text.push("Round: " + this.board.round);
                text.push("Last ID: " + this.board.lastMovePieceId);
            }
            this.#drawText(text, 0, this.canvas.height / 2 - text.length * 6, "middle", "left", 12);
        }
    }
    #drawTime() {
        let [topTime, bottomTime] = [this.#moveLists[0].whitePiecesTimeLeft, this.#moveLists[0].blackPiecesTimeLeft];
        if (this.#bottomPlayerColor.id === PieceColor.white.id) {
            [topTime, bottomTime] = [bottomTime, topTime];
        }

        const [topTimeTxt, bottomTimeTxt] = [topTime, bottomTime].map(Hivecanvas.#timeToText);

        const [w, h, th] = [this.canvas.width, this.canvas.height, TIMER_HEIGHT]
        // swap hud color for timer
        this.ctx.fillStyle = BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, w, th);
        this.ctx.fillRect(0, h - th, w, th);
        if (this.board.getColorPlaying().id === this.#bottomPlayerColor.id) {
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
            this.ctx.fillRect(0, 0, w, th);
            this.ctx.fillStyle = WAITING_HUD_COLOR;
            this.ctx.fillRect(0, h - th, w, th);
        } else {
            this.ctx.fillStyle = WAITING_HUD_COLOR;
            this.ctx.fillRect(0, 0, w, th);
            this.ctx.fillStyle = PLAYING_HUD_COLOR;
            this.ctx.fillRect(0, h - th, w, th);
        }

        // change color if time is short
        const topColor = topTime < 10000 ? "rgb(255, 0, 0)" : "rgb(255, 255, 255)";
        const bottomColor = bottomTime < 10000 ? "rgb(255, 0, 0)" : "rgb(255, 255, 255)";
        this.#drawText([topTimeTxt], w / 2, 1, "top", "center", th - 2, topColor);
        this.#drawText([bottomTimeTxt], w / 2, h + 2, "bottom", "center", th - 2, bottomColor);
    }
    static #timeToText(t) {
        if (t >= 10000) {
            t = Math.floor(t / 1000);
            const m = Math.floor(t / 60);
            const s = t % 60;
            return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        } else {
            t = Math.floor(t / 100);
            const s = Math.floor(t / 10);
            const ms = t % 10;
            return "00:0" + s + "." + ms;
        }
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
        const [rx, ry, ] = this.#getSize();

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
                const player = this.#getPlayerPlaying();
                [x, y] = [player.mouseX, player.mouseY];
            } else {
                x = piece.toX + (piece.fromX - piece.toX) * piece.transition;
                y = piece.toY + (piece.fromY - piece.toY) * piece.transition;
            }
            const [rx, ry, ] = this.#getSize();
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
                if (piece.inGame) {
                    let text = [piece.x + "," + piece.y + "," + piece.z];
                    if (piece.subNumber === 0) {
                        text.push(piece.id);
                    }
                    this.#drawText(text, 0, 0);
                } else {
                    this.#drawText(["", piece.id], 0, 0);
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
        const player = this.#getPlayerPlaying();
        if (player instanceof CanvasPlayer) {
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
        if (piece.targets.length > 0) {
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
    #getPlayerPlaying() {
        return this.board.round % 2 === 1 ? this.#whitePlayer : this.#blackPlayer;
    }
    toggleDebug() {
        this.#debug = !this.#debug;
    }
    play(piece, target, time = null) {
        // save the move
        const moveList = this.#moveLists[this.#currentMoveListId];
        moveList.addMove(piece, target, time);

        moveList.goTo(this.board, moveList.moves.length + 1);
    }

}