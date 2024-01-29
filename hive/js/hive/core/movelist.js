import Board from "./board.js";
import {PieceType} from "./piece.js";

export default class MoveList {
    moves = [];
    totalTime;
    #increment;

    #lastMoveTimestamp = null;
    whitePiecesTimeLeft = null;
    blackPiecesTimeLeft = null;
    initialRound = 0;
    parentMoveListId = null;

    constructor(totalTime = 0, increment = 0, moves = []) {
        this.totalTime = totalTime * 60;
        this.#increment = increment;
        this.whitePiecesTimeLeft = this.totalTime * 1000;
        this.blackPiecesTimeLeft = this.totalTime * 1000;
        this.moves = moves;
        if (totalTime > 0) {
            this.#lastMoveTimestamp = (new Date()).getTime();
        }
    }
    #pushMoveWithTime(move, time, withIncrement = false) {
        if (this.totalTime > 0) {
            const now = (new Date()).getTime();
            // first move doesn't compute time
            if (this.moves.length === 0) {
                move.time = 0;
            } else if (time === null) {
                move.time = now - this.#lastMoveTimestamp;
            } else {
                move.time = time;
            }
            this.computeTime(time, withIncrement);
            move.whitePiecesTimeLeft = this.whitePiecesTimeLeft;
            move.blackPiecesTimeLeft = this.blackPiecesTimeLeft;
            this.#lastMoveTimestamp = now;
        }
        this.moves.push(move);
    }
    addPass(time = null) {
        const move = new Move();
        move.pass = true;
        this.#pushMoveWithTime(move, time, true);
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
        move.moveSteps = target.moveSteps.map(xyz => [...xyz]);
        this.#pushMoveWithTime(move, time, true);
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
            return "time control: " + txt + "+" + increment + "s";
        }
    }
    computeTime(time = null, withIncrement = true) {
        if (this.totalTime === 0 || this.whitePiecesTimeLeft === 0 || this.blackPiecesTimeLeft === 0) {
            return false;
        }
        // first move doesn't have increment
        let totalTime = (this.totalTime + Math.floor(Math.max(0, this.moves.length - 1) / 2) * this.#increment) * 1000;
        if (!withIncrement) {
            totalTime -= this.#increment * 1000;
        }
        let timePast = 0;
        // first move doesn't compute time
        if (this.moves.length > 0) {
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
        }
        const timeLeft = Math.max(0, totalTime - timePast);
        if (this.moves.length % 2 === 0) {
            this.whitePiecesTimeLeft = timeLeft;
        } else {
            this.blackPiecesTimeLeft = timeLeft;
        }
        return true;
    }
    static timeToText(t, shortOnTime) {
        if (t >= shortOnTime) {
            t = Math.floor(t / 1000);
            const h = Math.floor(t / 3600);
            const m = Math.floor((t % 3600) / 60);
            const s = t % 60;
            let hm;
            if (h > 0) {
                hm = h + ":" + (m < 10 ? "0" : "") + m
            } else {
                hm = m;
            }
            return hm + ":" + (s < 10 ? "0" : "") + s;
        } else {
            t = Math.floor(t / 100);
            const m = Math.floor(t / 600);
            const s = Math.floor((t % 600) / 10);
            const ms = t % 10;
            return m + ":" + (s < 10 ? "0" : "") + s + "." + ms;
        }
    }

}
export class Move {
    pieceId = null;
    moveSteps = [];
    pass = false;
    resign = false;
    timeout = false;
    draw = false;
    whiteLoses = false;
    blackLoses = false;
    time = null;
    whitePiecesTimeLeft = null;
    blackPiecesTimeLeft = null;
    static notation(move, board) {
        let time = "";
        if (move.whitePiecesTimeLeft !== null && move.blackPiecesTimeLeft !== null) {
            if (board.round % 2 === 0) {
                time = " " + MoveList.timeToText(move.whitePiecesTimeLeft);
            } else {
                time = " " + MoveList.timeToText(move.blackPiecesTimeLeft);
            }
        }
        if (move.pass) {
            return "pass" + time;
        }
        if (move.timeout) {
            return "timeout";
        }
        if (move.draw) {
            return "draw by agreement";
        }
        if (move.resign) {
            return "resign";
        }
        if (move.whiteLoses && move.blackLoses) {
            return "draw";
        }
        if (move.whiteLoses) {
            return "black wins";
        }
        if (move.blackLoses) {
            return "white wins";
        }
        let ret = move.pieceId;
        if (board.round > 2) {
            const [fromX, fromY, fromZ] = move.moveSteps[0];
            const [toX, toY, toZ] = move.moveSteps[move.moveSteps.length - 1];
            // not first move
            const p1 = board.pieces.find(p => p.id === move.pieceId);
            let p2 = null;
            if (p1.type.id === PieceType.mantis.id && fromZ === 0) {
                // mantis special move
                p2 = board.pieces.find(p => p.inGame && p.x === fromX && p.y === fromY && p.z === fromZ);
            } else if (p1.type.id === PieceType.centipede.id && toZ > 0) {
                // centipede special move
                p2 = board.pieces.find(p => p.inGame && p.x === fromX && p.y === fromY && p.z === fromZ);
            } else if (toZ > 0) {
                // move over a piece
                p2 = board.pieces.find(p => p.inGame && p.x === toX && p.y === toY && p.z === toZ - 1);
            } else {
                // move to the ground
                let p2Pref = 0;
                Board.coordsAround(toX, toY).forEach(([x, y]) => {
                    // prefer unique pieces as reference, and to the queen, and pieces not on pile
                    const p = board.pieces.find(p => p.inGame && p.x === x && p.y === y);
                    if (!p) {
                        return;
                    }
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
                });
            }
            if (!p2) {
                ret += " invalid";
            } else if (toZ > 0) {
                ret += " " + p2.id;
            } else if (toX - p2.x === -2) {
                ret += " -" + p2.id;
            } else if (toX - p2.x === 2) {
                ret += " " + p2.id + "-";
            } else if (toX - p2.x === -1) {
                if (toY - p2.y === 1) {
                    ret += " \\" + p2.id;
                } else {
                    ret += " /" + p2.id;
                }
            } else if (toY - p2.y === 1) {
                ret += " " + p2.id + "/";
            } else {
                ret += " " + p2.id + "\\";
            }
        }

        return ret + time;
    }
}

