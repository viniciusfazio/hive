import Player from "./player.js";
import {PieceColor} from "../core/piece.js";
import Board from "../core/board.js";

// number of workers. Too little yields slow iterations per second. Too much yields fewer alpha beta pruning.
const QTY_WORKERS = 7;
// evaluation that indicate white wins
const MAX_EVALUATION = 999999;
// max depth to compute
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
    #completedMoves;
    #idle;
    #maximizing;
    #board;
    #moves;
    #movesSorted;

    initPlayerTurn() {
        if (this.#initTurnTime !== null) {
            // already running
            return;
        }

        // return if there is no decision to be made
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
        // start decision
        this.#initTurnTime = Date.now();
        this.#board = new Board(this.hive.board);
        this.#moves = this.#board.getMoves();
        this.#maximizing = this.#board.getColorPlaying().id === PieceColor.white.id;
        this.#movesSorted = [];
        // create a list of sorted moves by index, to evaluate them in order
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
        // keeps track of the last move evaluated
        this.#moveIndex = Math.min(this.#movesSorted.length, QTY_WORKERS);
        this.#completedMoves = 0;
        // keeps track of idle workers
        this.#idle = QTY_WORKERS - this.#moveIndex;
        if (this.#workers.length === 0) {
            // create all workers
            for (let i = 0; i < QTY_WORKERS; i++) {
                const worker = new Worker("js/hive/ai/aiminimax.js", {type: 'module'});
                worker.onmessage = e => {
                    // the worker responded
                    const s = e.data;
                    // keeps track of number of iterations done
                    this.#state.iterations += s.iterations;
                    if (!s.done) {
                        // the worker only updated the iteration count
                        return;
                    }

                    // get the evaluation that the worked computed
                    this.#movesSorted.find(m => m.moveId === s.moveId).evaluation = s.evaluation;
                    this.#completedMoves++;

                    // check if evaluation is the best
                    const newBestMove = this.#state.evaluation === null ||
                        this.#state.depth < s.maxDepth ||
                        this.#maximizing && s.evaluation > this.#state.evaluation ||
                        !this.#maximizing && s.evaluation < this.#state.evaluation;

                    if (newBestMove) {
                        // saves the evaluation and the move
                        const [, , p, t] = this.#moves[s.moveId];
                        this.#state.evaluation = s.evaluation;
                        this.pieceId = p.id;
                        this.target = t;
                        this.#state.depth = s.maxDepth;

                        // updates alpha and beta, and check victory
                        if (this.#maximizing) {
                            if (s.evaluation === MAX_EVALUATION) {
                                this.reset();
                                this.#computingEnded();
                                return;
                            } else {
                                this.#state.alpha = Math.max(this.#state.alpha, s.evaluation);
                            }
                        } else {
                            if (s.evaluation === -MAX_EVALUATION) {
                                this.reset();
                                this.#computingEnded();
                                return;
                            } else {
                                this.#state.beta = Math.min(this.#state.beta, s.evaluation);
                            }
                        }
                    }
                    if (this.#moveIndex >= this.#movesSorted.length) {
                        // all moves were computed
                        // if there is still other worker computing, wait them
                        if (++this.#idle >= QTY_WORKERS) {
                            // no more workers computing
                            if (this.#state.maxDepth === MAX_DEPTH) {
                                // max depth reached. Play it.
                                this.#computingEnded();
                            } else {
                                // max depth not reached
                                // resort moves by evaluation on this depth
                                if (this.#maximizing) {
                                    this.#movesSorted.sort((a, b) => b.evaluation - a.evaluation);
                                } else {
                                    this.#movesSorted.sort((a, b) => a.evaluation - b.evaluation);
                                }
                                this.#state.maxDepth++;
                                // restart
                                this.#minimax();
                            }
                        }
                    } else {
                        // there are moves not evaluated yet.

                        // if first QTY_WORKERS move has not been computed yet, wait, to increase chances for pruning
                        if (this.#completedMoves === QTY_WORKERS) {
                            // first QTY_WORKERS has been computed. Start all workers again
                            for (let i = 0; i < QTY_WORKERS && this.#moveIndex < this.#movesSorted.length; i++) {
                                this.#state.moveId = this.#movesSorted[this.#moveIndex++].moveId;
                                this.#workers[i].postMessage(this.#state);
                            }
                        } else if (this.#completedMoves > QTY_WORKERS) {
                            // evaluate next move.
                            this.#state.moveId = this.#movesSorted[this.#moveIndex++].moveId;
                            worker.postMessage(this.#state);

                        }
                    }
                };
                this.#workers.push(worker);
            }
        }
        if (this.#state === null) {
            // in the first run, send the state and evaluator to initialize workers
            this.#state = new EvaluationState();
            this.#state.board = this.#board;
            this.#state.evaluatorId = this.evaluatorId;
            this.#state.maxDepth = 1;
        }
        // reset alpha and beta on each run
        this.#state.alpha = -MAX_EVALUATION;
        this.#state.beta = MAX_EVALUATION;
        for (let i = 0; i < this.#moveIndex; i++) {
            // makes each worker start processing a move
            this.#state.moveId = this.#movesSorted[i].moveId;
            this.#workers[i].postMessage(this.#state);
        }
        // makes sure the board is not sent everytime
        this.#state.board = null;
        this.#state.evaluatorId = null;
    }
    #computingEnded() {
        this.#totalTime = Date.now() - this.#initTurnTime;
        this.#initTurnTime = null;
        this.hive.play(this.pieceId, this.target);
        this.pieceId = null;
        this.target = null;
    }
    getProgress() {
        const texts = [];
        if (this.#state !== null) {
            texts.push("Depth: " + this.#state.maxDepth + " / " + MAX_DEPTH);
            texts.push("Iterations: " + this.#getIterations());
            texts.push("Moves: " + this.#completedMoves + " / " + this.#board.qtyMoves);
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

    // indicates end of computing move
    done = false;
}

