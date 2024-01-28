import Player from "./player.js";

export default class CanvasPlayer extends Player {
    mouseX = 0;
    mouseY = 0;
    selectedPieceId = null;
    hoverPieceId = null;
    dragging = null;

    reset() {
        this.selectedPieceId = null;
        this.hoverPieceId = null;
        this.dragging = null;
        this.mouseX = 0;
        this.mouseY = 0;
    }

    overFlip() {
        // get coords to draw the button
        const [rx, ry, ] = this.hive.getSize();
        const r = (rx + ry) * 2 / 3;
        const [w, h] = [this.hive.canvas.width, this.hive.canvas.height];
        const hh = this.hive.getHudHeight();
        const [x, y] = [w - r, h - hh - r];

        // check if mouse is over
        const hover = !this.dragging && this.mouseX >= x - r && this.mouseX <= x + r &&
            this.mouseY >= y - r && this.mouseY <= y + r;

        return [x, y, r, hover];
    }
    hover(x, y, dragging = false) {
        [this.dragging, this.mouseX, this.mouseY] = [dragging, x, y];
        const path = this.hive.getPiecePath2D();

        const pieceSelected = this.hive.board.pieces.find(p => p.id === this.selectedPieceId);
        const targets = pieceSelected?.targets ?? [];
        const allPieces = this.hive.board.pieces.filter(p => p.inGame || p.type.linked === null || p.type.standard === !this.hive.flippedPieces)
            .concat(targets);
        let pieceHover = allPieces.find(p => {
            const [px, py] = this.hive.getPiecePosition(p);
            return this.hive.ctx.isPointInPath(path, px - x, py - y);
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
                p.type.id === piece.type.id &&
                p.color.id === piece.color.id &&
                (p.type.linked === null || p.type.standard === !this.hive.flippedPieces));
        }
        return piecesOnSpot.sort((a, b) => a.z - b.z).pop();
    }


    click(x, y, autoMove, dragging = false) {
        const [, , , hoverFlip] = this.overFlip();
        if (hoverFlip && !dragging) {
            this.hive.flippedPieces = !this.hive.flippedPieces;
            this.hoverPieceId = null;
            this.selectedPieceId = null;
        } else if (this.hover(x, y)) {
            if (this.hive.board.passRound) {
                this.hoverPieceId = null;
                if (!dragging) {
                    this.selectedPieceId = null;
                    this.hive.pass();
                }
            } else if (this.hoverPieceId === null) {
                // clicked on nothing
                this.selectedPieceId = null;
            } else if (this.selectedPieceId === null) {
                // clicked on a piece when no piece was selected
                this.selectedPieceId = this.hoverPieceId;
                if (this.hive.board.round <= 2 && autoMove) {
                    const piece = this.hive.board.pieces.find(p => p.id === this.selectedPieceId);
                    this.hive.play(piece, piece.targets[0], null, true, !this.hive.gameOver);
                    this.selectedPieceId = null;
                }
                this.hoverPieceId = null;
            } else if (this.hive.board.pieces.find(p => p.id === this.hoverPieceId)) {
                // clicked on piece when another piece was selected
                this.selectedPieceId = this.hoverPieceId;
                this.hoverPieceId = null;
            } else {
                // clicked on target
                const piece = this.hive.board.pieces.find(p => p.id === this.selectedPieceId);
                const target = piece.targets.find(p => p.id === this.hoverPieceId);
                this.hive.play(piece, target, null, !dragging, null, true, !this.hive.gameOver);
                this.selectedPieceId = null;
                this.hoverPieceId = null;
            }
        }
    }
}
