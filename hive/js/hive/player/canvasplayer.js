import Player from "./player.js";
import {PIECE_LINK, PIECE_STANDARD} from "../core/piece.js";

export default class CanvasPlayer extends Player {
    mouseX;
    mouseY;
    selectedPieceId;
    selectedTargetId;
    hoverPieceId;
    dragging;

    reset() {
        this.selectedPieceId = null;
        this.selectedTargetId = null;
        this.hoverPieceId = null;
        this.dragging = null;
        this.mouseX = -1;
        this.mouseY = -1;
    }

    overFlip() {
        // get coords to draw the button
        const [rx, ry, ] = this.hive.getSize();
        const r = (rx + ry) * 2 / 3;
        const [w, h] = [this.hive.canvas.width, this.hive.canvas.height];
        const hh = this.hive.getHudHeight();
        const [x, y] = [w - r, h - hh - r];

        // check if mouse is over
        const hover = !this.hive.standardRules &&
            (this.selectedPieceId === null || !this.dragging) &&
            this.selectedTargetId === null &&
            !(this.hive.board.passRound && this.hive.getMoveList().moves.length < this.board.round) &&
            this.mouseX >= x - r && this.mouseX <= x + r &&
            this.mouseY >= y - r && this.mouseY <= y + r;

        return [x, y, r, hover];
    }
    overConfirm() {
        // get coords to draw the button
        const [w, h] = [this.hive.canvas.width, this.hive.canvas.height];
        const hh = this.hive.getHudHeight() + this.hive.getTimerHeight();
        const y = this.hive.board.getColorPlaying() === this.hive.bottomPlayerColor ? h - hh : 0;
        const fh = Math.round(w / 12);

        // check if mouse is over
        const hover = this.selectedTargetId !== null && this.mouseY >= y && this.mouseY <= y + hh;

        return [0, y, w, hh, fh, hover];
    }
    hover(mouse = null, dragging = false) {
        this.dragging = dragging;
        [this.mouseX, this.mouseY] = mouse ?? [-1, -1];
        if (this.selectedTargetId !== null) {
            return true;
        }
        const path = this.hive.getPiecePath2D();

        const pieceSelected = this.hive.board.pieces.find(p => p.id === this.selectedPieceId);
        const targets = pieceSelected?.targets ?? [];
        const allPieces = this.hive.board.pieces.filter(p => p.inGame || PIECE_LINK[p.type] === 0 || !PIECE_STANDARD[p.type] === this.hive.flippedPieces)
            .concat(targets);
        let pieceHover = allPieces.find(p => {
            const [px, py] = this.hive.getPiecePixelPosition(p);
            return this.hive.ctx.isPointInPath(path, px - this.mouseX, py - this.mouseY);
        });
        if (pieceHover) {
            pieceHover = this.#getPieceOnTop(allPieces, pieceHover);
            if (pieceHover.subNumber === 0 && (pieceHover.targets.length === 0 || this.dragging)) {
                pieceHover = null;
            }
        }
        const pieceHoverId = pieceHover?.id ?? null;

        if (this.dragging || this.hoverPieceId !== pieceHoverId) {
            this.hoverPieceId = pieceHoverId;
        }
        return this.hive.gameOver || this.hive.board.round > this.hive.getMoveList().moves.length &&
            (this.hive.getPlayerPlaying() instanceof CanvasPlayer);
    }

    #getPieceOnTop(pieces, piece) {
        let piecesOnSpot;
        if (piece.inGame) {
            piecesOnSpot = pieces.filter(p => p.inGame && p.x === piece.x && p.y === piece.y);
        } else {
            piecesOnSpot = pieces.filter(p =>
                !p.inGame &&
                p.type === piece.type &&
                p.color === piece.color &&
                (PIECE_LINK[p.type] === 0 || !PIECE_STANDARD[p.type] === this.hive.flippedPieces));
        }
        return piecesOnSpot.sort((a, b) => a.z - b.z).pop();
    }


    click(mouse = null, autoMove = false, confirmMove = false, mouseUp = false) {
        const [, , , hoverFlip] = this.overFlip();
        if (!this.hover(mouse)) {
            if (hoverFlip) {
                if (!mouseUp) {
                    this.hive.flippedPieces = !this.hive.flippedPieces;
                }
            }
            return;
        }
        if (this.selectedTargetId !== null) {
            if (!mouseUp) {
                const [, , , , , hoverConfirm] = this.overConfirm();
                if (hoverConfirm) {
                    this.confirm();
                } else {
                    this.reset();
                }
            }
        } else if (this.hive.board.passRound) {
            this.hoverPieceId = null;
            if (!mouseUp) {
                this.selectedPieceId = null;
                this.hive.pass();
            }
        } else if (hoverFlip) {
            if (!mouseUp) {
                this.hive.flippedPieces = !this.hive.flippedPieces;
            }
        } else if (this.hoverPieceId === null) {
            // clicked on nothing
            this.reset();
        } else if (this.selectedPieceId === null) {
            // clicked on a piece when no piece was selected
            this.selectedPieceId = this.hoverPieceId;
            if (this.hive.board.round <= 2 && autoMove) {
                this.selectedTargetId = 0;
                if (!confirmMove || this.hive.gameOver) {
                    this.confirm(true);
                }
            }
            this.hoverPieceId = null;
        } else if (this.hive.board.pieces.find(p => p.id === this.hoverPieceId)) {
            // clicked on piece when another piece was selected
            this.selectedPieceId = this.hoverPieceId;
            this.hoverPieceId = null;
        } else {
            // clicked on target
            const piece = this.hive.board.pieces.find(p => p.id === this.selectedPieceId);
            this.selectedTargetId = piece.targets.findIndex(p => p.id === this.hoverPieceId);
            if (!confirmMove || this.hive.gameOver) {
                this.confirm(true, mouseUp);
            }
        }
    }
    confirm(autoConfirm = false, dragging = false) {
        const piece = this.hive.board.pieces.find(p => p.id === this.selectedPieceId);
        this.hive.play(piece.id, piece.targets[this.selectedTargetId], null, dragging, !autoConfirm);
        this.reset();
    }
}
