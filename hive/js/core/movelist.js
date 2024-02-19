export default class MoveList {
    moves = [];
    totalTime;
    increment;

    #lastMoveTimestamp = null;
    whitePiecesTimeLeft = null;
    blackPiecesTimeLeft = null;
    parentMoveListId;
    depth = 0;
    initialRound;
    variationRound;

    constructor(totalTime, increment, parentMoveList = null, parentMoveListId = null, initialRound = 1, variationRound = 1) {
        this.totalTime = totalTime * 60;
        this.increment = increment;
        this.whitePiecesTimeLeft = this.totalTime * 1000;
        this.blackPiecesTimeLeft = this.totalTime * 1000;
        if (parentMoveList !== null) {
            this.moves = parentMoveList.moves.map(m => {return {...m};});
            this.depth = parentMoveList.depth + 1;
        }
        this.parentMoveListId = parentMoveListId;
        this.initialRound = initialRound;
        this.variationRound = variationRound;
        this.moves = this.moves.slice(0, variationRound - 1);
        if (totalTime > 0) {
            this.#lastMoveTimestamp = Date.now();
        }
    }
    #pushMoveWithTime(move, time, withIncrement = false) {
        if (this.totalTime > 0) {
            const now = Date.now();
            move.time = time ?? (this.moves.length === 0 ? 0 : now - this.#lastMoveTimestamp);
            this.computeTime(time, withIncrement);
            move.whitePiecesTimeLeft = this.whitePiecesTimeLeft;
            move.blackPiecesTimeLeft = this.blackPiecesTimeLeft;
            this.#lastMoveTimestamp = now;
        }
        this.moves.push(move);
    }
    removeMove() {
        if (this.moves.length > 0) {
            const move = this.moves.pop();
            if (this.totalTime > 0) {
                this.#lastMoveTimestamp = Date.now() - move.time;
                this.whitePiecesTimeLeft = move.whitePiecesTimeLeft;
                this.blackPiecesTimeLeft = move.blackPiecesTimeLeft;
            }
        }
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
    addMove(pieceId, target, time = null) {
        const move = new Move();
        move.pieceId = pieceId;
        move.moveSteps = target.moveSteps.map(xyz => [...xyz]);
        this.#pushMoveWithTime(move, time, true);
    }
    timeControlToText(totalTime = null, increment = null) {
        totalTime = totalTime ?? (this.totalTime / 60);
        increment = increment ?? this.increment;
        if (totalTime === 0) {
            return "no time control";
        } else {
            return "time control: " + (Math.round(totalTime * 10) / 10) + "m+" + increment + "s";
        }
    }
    computeTime(time = null, withIncrement = true) {
        if (this.totalTime === 0 || this.whitePiecesTimeLeft === 0 || this.blackPiecesTimeLeft === 0) {
            return false;
        }
        // first move doesn't have increment
        let totalTime = (this.totalTime + Math.floor((this.moves.length + 1) / 2) * this.increment) * 1000;
        if (!withIncrement) {
            totalTime -= this.increment * 1000;
        }
        let timePast = 0;
        // first move doesn't compute time
        if (this.moves.length > 0 || time !== null) {
            this.moves.forEach((move, i) => {
                if ((i & 1) === (this.moves.length & 1)) {
                    timePast += move.time;
                }
            });
            if (time === null) {
                timePast += Date.now() - this.#lastMoveTimestamp;
            } else {
                timePast += time;
            }
        }
        const timeLeft = Math.max(0, totalTime - timePast);
        if ((this.moves.length & 1) === 0) {
            this.whitePiecesTimeLeft = timeLeft;
        } else {
            this.blackPiecesTimeLeft = timeLeft;
        }
        return true;
    }
    static timeToText(t, shortOnTime) {
        if (t >= shortOnTime * 1000) {
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
    static notation(move, board, shortOnTime = null) {
        let time = "";
        if (shortOnTime !== null && move.whitePiecesTimeLeft !== null && move.blackPiecesTimeLeft !== null) {
            if ((board.round & 1) === 0) {
                time = " " + MoveList.timeToText(move.whitePiecesTimeLeft, shortOnTime);
            } else {
                time = " " + MoveList.timeToText(move.blackPiecesTimeLeft, shortOnTime);
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
        return board.getMoveNotation(move.pieceId, move.moveSteps[move.moveSteps.length - 1], board.round <= 2) + time;
    }
}

