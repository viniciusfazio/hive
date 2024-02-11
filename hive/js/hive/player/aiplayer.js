import Player from "./player.js";
import {PieceColor} from "../core/piece.js";
import Board from "../core/board.js";

const QTY_WORKERS = 7;
const MAX_EVALUATION = 999999;
const MAX_DEPTH = 5;

export default class AIPlayer extends Player {
    evaluatorId = "queenai";

    #initTurnTime = null;
    #totalTime = null;
    #workers = [];

    pieceId;
    target;

    #state = null;

    #moveIndex;
    #idle;
    #maximizing;
    #ended;
    #board;
    #moves;
    #movesSorted;

    initPlayerTurn() {
        if (this.#initTurnTime !== null) {
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
            this.hive.play(playable[0].id, playable[0].targets[0]);
            return;
        }

        if (!window.Worker) {
            throw Error("Can't create thread for AI player");
        }
        this.#initTurnTime = Date.now();
        this.#board = new Board(this.hive.board);
        this.#moves = this.#board.getMoves();
        this.#maximizing = this.#board.getColorPlaying().id === PieceColor.white.id;
        this.#movesSorted = [];
        for (let i = 0; i < this.#moves.length; i++) {
            this.#movesSorted.push({
                moveId: i,
                evaluation: this.#maximizing ? -MAX_EVALUATION : MAX_EVALUATION,
            });
        }
        this.#state = null;
        this.#minimax();
    }
    #minimax() {
        this.#moveIndex = Math.min(this.#movesSorted.length, QTY_WORKERS);
        this.#idle = QTY_WORKERS - this.#moveIndex;
        this.#ended = false;
        if (this.#workers.length === 0) {
            for (let i = 0; i < QTY_WORKERS; i++) {
                const worker = new Worker("js/hive/ai/aiminimax.js", {type: 'module'});
                worker.onmessage = e => {
                    const wState = e.data;
                    this.#state.iterations += wState.iterations;
                    if (!wState.done) {
                        return;
                    }
                    this.#movesSorted.find(m => m.moveId === wState.moveId).evaluation = wState.evaluation;

                    const breakthrough = this.#state.evaluation === null || this.#state.depth < wState.maxDepth ||
                        this.#maximizing && wState.evaluation > this.#state.evaluation ||
                        !this.#maximizing && wState.evaluation < this.#state.evaluation;

                    if (breakthrough) {
                        const [, , p, t] = this.#moves[wState.moveId];
                        this.#state.evaluation = wState.evaluation;
                        this.pieceId = p.id;
                        this.target = t;
                        this.#state.depth = wState.maxDepth;
                        if (this.#maximizing) {
                            if (wState.evaluation >= this.#state.beta) {
                                this.#ended = true;
                            } else if (wState.evaluation > this.#state.alpha) {
                                this.#state.alpha = wState.evaluation;
                            }
                        } else {
                            if (wState.evaluation <= this.#state.alpha) {
                                this.#ended = true;
                            } else if (wState.evaluation < this.#state.beta) {
                                this.#state.beta = wState.evaluation;
                            }
                        }
                    }
                    if (this.#ended || this.#moveIndex >= this.#movesSorted.length) {
                        if (this.#ended && this.#state.maxDepth === MAX_DEPTH) {
                            this.#moveIndex = this.#movesSorted.length;
                            this.reset(false);
                        }
                        if (++this.#idle === QTY_WORKERS) {
                            if (this.#state.maxDepth === MAX_DEPTH) {
                                this.#totalTime = Date.now() - this.#initTurnTime;
                                this.#initTurnTime = null;
                                this.hive.play(this.pieceId, this.target);
                                this.pieceId = null;
                                this.target = null;
                            } else {
                               for (;this.#moveIndex < this.#movesSorted.length; this.#moveIndex++) {
                                    this.#movesSorted[this.#moveIndex].evaluation = this.#maximizing ?
                                        -MAX_EVALUATION + this.#board.qtyMoves - this.#moveIndex :
                                        MAX_EVALUATION - this.#board.qtyMoves + this.#moveIndex;
                                }
                                if (this.#maximizing) {
                                    this.#movesSorted.sort((a, b) => b.evaluation - a.evaluation);
                                } else {
                                    this.#movesSorted.sort((a, b) => a.evaluation - b.evaluation);
                                }
                                this.#state.maxDepth++;
                                this.#minimax();
                            }
                        }
                    } else {
                        this.#state.moveId = this.#movesSorted[this.#moveIndex++].moveId;
                        worker.postMessage(this.#state);
                    }
                };
                this.#workers.push(worker);
            }
        }
        if (this.#state === null) {
            this.#state = new EvaluationState();
            this.#state.board = this.#board;
            this.#state.evaluatorId = this.evaluatorId;
            this.#state.maxDepth = 2;
        }
        this.#state.alpha = -MAX_EVALUATION;
        this.#state.beta = MAX_EVALUATION;
        for (let i = 0; i < this.#moveIndex; i++) {
            this.#state.moveId = this.#movesSorted[i].moveId;
            this.#workers[i].postMessage(this.#state);
        }
        this.#state.board = null;
        this.#state.evaluatorId = null;

    }
    getProgress() {
        const texts = [];
        if (this.#state !== null) {
            texts.push("Depth: " + this.#state.maxDepth + " / " + MAX_DEPTH);
            texts.push("Iterations: " + this.#getIterations());
            texts.push("Moves: " + (this.#moveIndex - QTY_WORKERS + this.#idle) + " / " + this.#board.qtyMoves);
            texts.push("Evaluation: " + this.#getEvaluation());
        }
        return texts;
    }
    #getEvaluation() {
        if (this.#state.evaluation === MAX_EVALUATION) {
            return "+∞";
        } else if (this.#state.evaluation === -MAX_EVALUATION) {
            return "-∞";
        } else if (this.#state.evaluation > 0) {
            return "+" + this.#state.evaluation;
        }
        return this.#state.evaluation ?? "?";
    }

    reset(resetState = true) {
        this.#workers.forEach(w => w.terminate());
        this.#workers = [];
        this.#idle = QTY_WORKERS;
        if (resetState) {
            this.#totalTime = null;
            this.#initTurnTime = null;
            this.#state = null;
            this.#moveIndex = null;
        }
    }
    #getIterations() {
        let speed = "";
        if (this.#initTurnTime !== null) {
            speed = " - " + Math.round(Math.round(this.#state.iterations / (Date.now() - this.#initTurnTime))) + "k/s";
            this.#totalTime = Date.now() - this.#initTurnTime;
        }
        let time = "";
        if (this.#totalTime !== null) {
            time = " - " + Math.round(this.#totalTime / 1000) + "s";
        }
        if (this.#state.iterations < 1000) {
            return this.#state.iterations + speed + time;
        }
        if (this.#state.iterations < 1000000) {
            return Math.round(this.#state.iterations / 1000) + "k" + speed + time;
        }
        return (Math.round(this.#state.iterations / 100000) / 10) + "M" + speed + time;
    }
}
class EvaluationState {

    // qty iterations
    iterations = 0;

    // input to minimax
    maxEvaluation = MAX_EVALUATION;
    evaluatorId;
    board;
    alpha;
    beta;
    maxDepth;
    moveId;

    // output from minimax, and to the aiPlayer
    evaluation;
    depth = null; // depth associated with output

    // if false, only keep track of iteration qty
    done = false;
}

