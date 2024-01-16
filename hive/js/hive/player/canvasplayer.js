import Player from "./player.js";

export default class CanvasPlayer extends Player {
    mouseX = 0;
    mouseY = 0;
    selectedPieceId = null;
    hoverPieceId = null;
    dragging = null;

    hover(x, y, dragging = false) {
        if (!this.hive || this.hive.board.round <= this.hive.getMoveList().moves.length || this.hive.gameOver) {
            return;
        }
        [this.dragging, this.mouseX, this.mouseY] = [dragging, x, y];
        const path = this.hive.getPiecePath2D();

        const pieceSelected = this.hive.board.pieces.find(p => p.id === this.selectedPieceId);
        const targets = pieceSelected?.targets ?? [];
        const allPieces = this.hive.board.pieces.concat(targets);
        let pieceHover = allPieces.find(p => {
            const [px, py] = this.hive.getPiecePosition(p);
            return this.hive.ctx.isPointInPath(path, px - x, py - y);
        });
        if (pieceHover) {
            pieceHover = CanvasPlayer.#getPieceOnTop(allPieces, pieceHover);
            if (pieceHover.subNumber === 0 && (pieceHover.targets.length === 0 || this.dragging)) {
                pieceHover = null;
            }
        }
        const pieceHoverId = pieceHover?.id ?? null;

        if (this.dragging || this.hoverPieceId !== pieceHoverId) {
            this.hoverPieceId = pieceHoverId;
            this.hive.redraw();
        }
    }

    static #getPieceOnTop(pieces, piece) {
        let piecesOnSpot;
        if (piece.inGame) {
            piecesOnSpot = pieces.filter(p => p.inGame && p.x === piece.x && p.y === piece.y);
        } else {
            piecesOnSpot = pieces.filter(p =>  !p.inGame && p.type.id === piece.type.id && p.color.id === piece.color.id);
        }
        return piecesOnSpot.sort((a, b) => a.z - b.z).pop();
    }


    click(x, y, automove) {
        this.hover(x, y);
        if (!this.hive || this.hive.gameOver) {
            return;
        }
        if (this.hive.board.passRound) {
            this.selectedPieceId = null;
            this.hoverPieceId = null;
            this.hive.pass();
        } else if (this.hoverPieceId === null) {
            // clicked on nothing
            this.selectedPieceId = null;
        } else if (this.selectedPieceId === null) {
            // clicked on a piece when no piece was selected
            this.selectedPieceId = this.hoverPieceId;
            if (this.hive.board.round <= 2 && automove) {
                const piece = this.hive.board.pieces.find(p => p.id === this.selectedPieceId);
                this.hive.play(piece, piece.targets[0]);
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
            this.hive.play(piece, target);
            this.selectedPieceId = null;
            this.hoverPieceId = null;
        }
        this.hive.redraw();

    }

}
