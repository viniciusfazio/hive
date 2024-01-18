import Board from "./board.js";
import {PieceType} from "./piece.js";

export default class MoveList {
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
    #pushMoveWithTime(move, time) {
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
    addPass(time = null) {
        const move = new Move();
        move.pass = true;
        this.#pushMoveWithTime(move, time);
    }
    addDraw(time = null) {
        const move = new Move();
        move.draw = true;
        this.#pushMoveWithTime(move, time);
    }
    addResign(time = null) {
        const move = new Move();
        move.resign = true;
        this.#pushMoveWithTime(move, time);
    }
    addTimeout(time = null) {
        const move = new Move();
        move.timeout = true;
        this.#pushMoveWithTime(move, time);
    }
    addGameOver(whiteLoses, blackLoses, time = null) {
        const move = new Move();
        move.whiteLoses = whiteLoses;
        move.blackLoses = blackLoses;
        this.#pushMoveWithTime(move, time);
    }
    addMove(piece, target, time = null) {
        const move = new Move();
        move.pieceId = piece.id;
        move.fromX = piece.x;
        move.fromY = piece.y;
        move.fromZ = piece.inGame ? piece.z : -1;
        move.toX = target.x;
        move.toY = target.y;
        move.toZ = target.z;
        move.intermediateXYZs = target.intermediateXYZs.map(xyz => [...xyz]);
        this.#pushMoveWithTime(move, time);
    }
    timeControlToText(totalTime = null, increment = null) {
        totalTime = totalTime ?? this.totalTime;
        increment = increment ?? this.#increment;
        if (totalTime === 0) {
            return "no time control";
        } else {
            let txt = "";
            if (totalTime >= 60) {
                txt += Math.floor(totalTime / 60) + "m";
            }
            if (totalTime % 60 > 0) {
                const s = totalTime % 60;
                txt += s + "s";
            }
            return txt + "+" + increment + "s";
        }
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
        if (this.moves.length % 2 === 0) {
            this.whitePiecesTimeLeft = timeLeft;
        } else {
            this.blackPiecesTimeLeft = timeLeft;
        }
        return true;
    }
    goTo(board, round, callbackMove) {
        round = Math.max(1, Math.min(round, this.moves.length + 1));
        if (board.round < round) {
            for (; board.round < round; board.round++) { // redo moves
                const move = this.moves[board.round - 1];
                if (!move.pass && !move.timeout && !move.resign && !move.draw && !move.whiteLoses && !move.blackLoses) {
                    const p = board.pieces.find(p => p.id === move.pieceId);
                    callbackMove(p);
                    p.play(move.toX, move.toY, move.toZ, move.intermediateXYZs);
                }
            }
        } else if (board.round > round) { // undo moves
            for (board.round--; board.round >= round; board.round--) {
                const move = this.moves[board.round - 1];
                if (!move.pass && !move.timeout && !move.resign && !move.draw && !move.whiteLoses && !move.blackLoses) {
                    const p = board.pieces.find(p => p.id === move.pieceId);
                    callbackMove(p);
                    p.play(move.fromX, move.fromY, move.fromZ, move.intermediateXYZs.toReversed());
                }
            }
            board.round++;
        } else { // no moves asked
            return;
        }
        board.lastMovePieceId = round === 1 ? null : this.moves[round - 2].pieceId;
    }
    static timeToText(t) {
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

}
class Move {
    pieceId = null;
    fromX = null;
    fromY = null;
    fromZ = null;
    toX = null;
    toY = null;
    toZ = null;
    intermediateXYZs = [];
    pass = false;
    resign = false;
    timeout = false;
    draw = false;
    whiteLoses = false;
    blackLoses = false;
    time = null;
    whitePiecesTimeLeft = null;
    blackPiecesTimeLeft = null;
    notation(board) {
        if (this.pass) {
            return "pass";
        }
        if (this.timeout) {
            return "timeout";
        }
        if (this.draw) {
            return "draw by agreement";
        }
        if (this.resign) {
            return "resign";
        }
        if (this.whiteLoses && this.blackLoses) {
            return "draw";
        }
        if (this.whiteLoses) {
            return "black wins";
        }
        if (this.blackLoses) {
            return "white wins";
        }
        let move = this.pieceId;
        if (board.round > 2) {
            // not first move
            let p2 = null;
            if (this.toZ > 0) {
                // it indicates the piece below
                p2 = board.pieces.find(p => p.inGame && p.x === this.toX && p.y === this.toY && p.z === this.toZ - 1);
            } else {
                let p2Pref = 0;
                for (const [x, y] of Board.coordsAround(this.toX, this.toY)) {
                    // prefer unique pieces as reference, and to the queen, and pieces not on pile
                    const p = board.pieces.find(p => p.inGame && p.x === x && p.y === y);
                    if (p) {
                        let pref = 1;
                        if (p.type.id === PieceType.queen.id) {
                            pref += 8;
                        }
                        if (p.number === 0) {
                            pref += 4;
                        }
                        if (p.z === 0) {
                            pref += 2;
                        }
                        if (pref > p2Pref) {
                            p2Pref = pref;
                            p2 = p;
                        }
                    }
                }
            }
            if (!p2) {
                move += " invalid";
            } else if (this.toZ > 0) {
                move += " " + p2.id;
            } else if (this.toX - p2.x === -2) {
                move += " -" + p2.id;
            } else if (this.toX - p2.x === 2) {
                move += " " + p2.id + "-";
            } else if (this.toX - p2.x === -1) {
                if (this.toY - p2.y === 1) {
                    move += " \\" + p2.id;
                } else {
                    move += " /" + p2.id;
                }
            } else if (this.toY - p2.y === 1) {
                move += " " + p2.id + "/";
            } else {
                move += " " + p2.id + "\\";
            }
        }

        if (this.whitePiecesTimeLeft !== null && this.blackPiecesTimeLeft !== null) {
            if (board.round % 2 === 0) {
                move += " " + MoveList.timeToText(this.whitePiecesTimeLeft);
            } else {
                move += " " + MoveList.timeToText(this.blackPiecesTimeLeft);
            }
        }
        return move;
    }
}

