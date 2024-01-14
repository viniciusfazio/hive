
export default class Movelist {
    moves = [];
    totalTime;
    #increment;

    #lastMoveTimestamp = null;
    whitePiecesTimeLeft = null;
    blackPiecesTimeLeft = null;

    constructor(totalTime = 0, increment = 0) {
        this.totalTime = totalTime * 60;
        this.#increment = increment;
        this.whitePiecesTimeLeft = this.totalTime * 1000;
        this.blackPiecesTimeLeft = this.totalTime * 1000;
        if (totalTime > 0) {
            this.#lastMoveTimestamp = (new Date()).getTime();
        }
    }
    addMove(piece, target, time = null) {
        const move = new Move();
        move.id = piece.id;
        move.fromX = piece.x;
        move.fromY = piece.y;
        move.fromZ = piece.inGame ? piece.z : -1;
        move.toX = target.x;
        move.toY = target.y;
        move.toZ = target.z;
        if (this.totalTime > 0) {
            const now = (new Date()).getTime();
            if (time === null) {
                move.time = now - this.#lastMoveTimestamp;
            } else {
                move.time = time;
            }
            this.computeTime(time);
            move.whitePiecesTimeLeft = this.whitePiecesTimeLeft;
            move.blackPiecesTimeLeft = this.blackPiecesTimeLeft;
            this.#lastMoveTimestamp = now;
        }
        this.moves.push(move);
    }
    computeTime(time = null) {
        if (this.totalTime === 0 || this.whitePiecesTimeLeft === 0 || this.blackPiecesTimeLeft === 0) {
            return false;
        }
        let totalTime = (this.totalTime + Math.floor(this.moves.length / 2) * this.#increment) * 1000;
        let timePast = 0;
        this.moves.forEach((move, i) => {
            if (i % 2 === this.moves.length % 2) {
                timePast += move.time;
            }
        });
        if (time === null) {
            timePast += (new Date()).getTime() - this.#lastMoveTimestamp;
        } else {
            timePast += time;
        }
        const timeLeft = Math.max(0, totalTime - timePast);
        if (this.moves.length % 1 === 0) {
            this.whitePiecesTimeLeft = timeLeft;
        } else {
            this.blackPiecesTimeLeft = timeLeft;
        }
        return true;
    }
    goTo(board, round) {
        round = Math.max(1, Math.min(round, this.moves.length + 1));
        if (board.round < round) {
            for (; board.round < round; board.round++) { // redo moves
                const move = this.moves[board.round - 1];
                if (!move.pass && !move.timeout && !move.resign && !move.draw) {
                    board.pieces.find(p => p.id === move.id).play(move.toX, move.toY, move.toZ);
                }
            }
        } else if (board.round > round) { // undo moves
            for (board.round--; board.round >= round; board.round--) {
                const move = this.moves[board.round - 1];
                if (!move.pass && !move.timeout && !move.resign && !move.draw) {
                    board.pieces.find(p => p.id === move.id).play(move.fromX, move.fromY, move.fromZ);
                }
            }
        } else { // no moves asked
            return;
        }
        board.lastMovePieceId = round === 1 ? null : this.moves[round - 2].id;
    }
}
class Move {
    piece = null;
    fromX = null;
    fromY = null;
    fromZ = null;
    toX = null;
    toY = null;
    toZ = null;
    pass = false;
    resign = false;
    timeout = false;
    draw = false;
    time = null;
    whitePiecesTimeLeft = null;
    blackPiecesTimeLeft = null;
}

