import Player from "./player.js";
import {PieceColor} from "../core/piece.js";
import QueenEvaluator from "../ai/queenevaluator.js";

const QTY_WORKERS = 7;
const MAX_EVALUATION = 999999;
const MAX_DEPTH = 5;

export default class AIPlayer extends Player {
    #initTurnTime;
    #running = false;
    #workers = [];
    state = new EvaluationState();
    evaluatorId = "queenai";

    #evaluator;
    qtyMoves;
    moveId;
    #maximizing;
    idle;
    #ended;

    initPlayerTurn() {
        if (this.#running) {
            return;
        }

        if (this.hive.board.passRound) {
            this.hive.pass();
            return;
        }
        const playable = this.hive.board.pieces.filter(p => p.targets.length > 0);
        if (playable.length === 0) {
            return;
        }
        if (playable.length === 1 && playable[0].targets.length === 1) {
            this.hive.play(playable[0], playable[0].targets[0]);
            return;
        }
        // minimax
        if (window.Worker) {
            this.#running = true;
            this.#initTurnTime = Date.now();
            this.#evaluator = getEvaluator(this.evaluatorId);
            this.qtyMoves = getMoves(this.hive.board, this.#evaluator).length;
            this.moveId = Math.min(this.qtyMoves, QTY_WORKERS);
            this.#maximizing = this.hive.board.getColorPlaying().id === PieceColor.white.id;
            this.idle = QTY_WORKERS - this.moveId;
            this.#ended = false;
            if (this.#workers.length === 0) {
                for (let i = 0; i < QTY_WORKERS; i++) {
                    const worker = new Worker("js/hive/ai/aiminimax.js", {type: 'module'});
                    worker.onmessage = e => {
                        const wState = e.data;
                        this.state.iterations += wState.iterations;
                        if (!wState.done) {
                            return;
                        }
                        if (this.state.evaluation === null ||
                            this.#maximizing && wState.evaluation > this.state.evaluation ||
                            !this.#maximizing && wState.evaluation < this.state.evaluation) {
                            this.state.evaluation = wState.evaluation;
                            this.state.pieceId = wState.pieceId;
                            const piece = this.hive.board.pieces.find(p => p.id === wState.pieceId);
                            this.state.target = piece.targets.find(t => t.id === wState.target.id);
                            if (this.#maximizing) {
                                if (wState.evaluation > this.state.alpha) {
                                    this.state.alpha = wState.evaluation;
                                }
                                if (wState.evaluation >= this.state.beta) {
                                    this.#ended = true;
                                }
                            } else {
                                if (wState.evaluation < this.state.beta) {
                                    this.state.beta = wState.evaluation;
                                }
                                if (wState.evaluation <= this.state.alpha) {
                                    this.#ended = true;
                                }
                            }
                        }
                        if (this.#ended || this.moveId >= this.qtyMoves) {
                            //console.log("worker " + i + " ended. " + this.#idle + " was idle.");
                            if (++this.idle >= QTY_WORKERS) {
                                //console.log("worker " + i + " apply");
                                this.#running = false;
                                const piece = this.hive.board.pieces.find(p => p.id === this.state.pieceId);
                                this.hive.play(piece, this.state.target);
                            }
                        } else {
                            this.state.moveId = this.moveId++;
                            //console.log("worker " + i + " resume");
                            worker.postMessage(this.state);
                        }
                    };
                    this.#workers.push(worker);
                }
            }
            const state = new EvaluationState();
            state.board = this.hive.board;
            state.evaluatorId = this.evaluatorId;
            for (let i = 0; i < this.moveId; i++) {
                state.moveId = i;
                //console.log("worker " + i + " start");
                this.#workers[i].postMessage(state);
            }
            state.board = null;
            state.evaluatorId = null;
            state.qtyMoves = this.qtyMoves;
            this.state = state;

        } else {
            throw Error("Can't create thread for AI player");
        }
    }
    reset() {
        this.#workers.forEach(w => w.terminate());
        this.#workers = [];
    }
    getIterationsPerSecond() {
        if (!this.#running) {
            return "-";
        }
        return Math.round(1000 * this.state.iterations / (Date.now() - this.#initTurnTime)) + "/s";
    }
}
export function getMoves(board, evaluator) {
    const moves = [];
    board.pieces.forEach(p => p.targets.forEach(t => moves.push([[p.x, p.y, p.z], [t.x, t.y, t.z], p, t])));
    return evaluator.sortMoves(board, moves);
}
export function getEvaluator(id) {
    switch (id) {
        case "queenai":
            return new QueenEvaluator();
        default:
            throw new Error('Invalid evaluator');
    }
}
class EvaluationState {
    maxEvaluation = MAX_EVALUATION;
    maxDepth = MAX_DEPTH;

    iterations = 0;

    pieceId = null;
    target = null;
    evaluation = null;
    alpha = -MAX_EVALUATION;
    beta = MAX_EVALUATION;

    board = null;
    evaluatorId = null;
    moveId = null;
    qtyMoves = null;
    done = false;
}

