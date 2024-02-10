import Player from "./player.js";
import {PieceColor} from "../core/piece.js";
import Board from "../core/board.js";

const QTY_WORKERS = 7;
const MAX_EVALUATION = 999999;
const MAX_DEPTH = 5;

export default class AIPlayer extends Player {
    #initTurnTime;
    #running = false;
    #workers = [];
    state = new EvaluationState();
    evaluatorId = "queenai";

    #moveIndex = null;
    #idle = null;
    #qtyMoves;
    #depth = null;
    #maximizing;
    #ended;
    #board;
    #movesScore;


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
            this.hive.play(playable[0].id, playable[0].targets[0]);
            return;
        }

        if (!window.Worker) {
            throw Error("Can't create thread for AI player");
        }
        this.#running = true;
        this.#initTurnTime = Date.now();
        this.#board = new Board(this.hive.board);
        this.#board.computeLegalMoves(true);
        this.#maximizing = this.#board.getColorPlaying().id === PieceColor.white.id;
        this.#qtyMoves = this.#board.getMoves().length;
        this.#movesScore = [];
        for (let i = 0; i < this.#qtyMoves; i++) {
            this.#movesScore.push({
                moveId: i,
                score: -MAX_EVALUATION,
            });
        }
        this.#depth = 1;
        this.#minimax();
    }
    #minimax() {
        this.#moveIndex = Math.min(this.#movesScore.length, QTY_WORKERS);
        this.#idle = QTY_WORKERS - this.#moveIndex;
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
                    this.#movesScore.find(s => s.moveId === wState.moveId).score = this.#maximizing ? wState.evaluation : -wState.evaluation;
                    const breakthrough = this.state.evaluation === null ||
                        this.#maximizing && wState.evaluation > this.state.evaluation ||
                        !this.#maximizing && wState.evaluation < this.state.evaluation;
                    if (breakthrough) {
                        this.state.evaluation = wState.evaluation;
                        this.state.pieceId = wState.pieceId;
                        const piece = this.#board.pieces.find(p => p.id === wState.pieceId);
                        this.state.target = piece.targets.find(t => t.id === wState.target.id);
                        if (this.#maximizing) {
                            if (wState.evaluation >= this.state.beta) {
                                this.#ended = true;
                            } else if (wState.evaluation > this.state.alpha) {
                                this.state.alpha = wState.evaluation;
                            }
                        } else {
                            if (wState.evaluation <= this.state.alpha) {
                                this.#ended = true;
                            } else if (wState.evaluation < this.state.beta) {
                                this.state.beta = wState.evaluation;
                            }
                        }
                    }
                    if (this.#ended || this.#moveIndex >= this.#movesScore.length) {
                        if (this.#ended && this.#depth === MAX_DEPTH) {
                            this.#moveIndex = this.#movesScore.length;
                            this.reset(false);
                        }
                        if (++this.#idle === QTY_WORKERS) {
                            if (this.#depth === MAX_DEPTH) {
                                this.#running = false;
                                this.hive.play(this.state.pieceId, this.state.target);
                            } else {
                                this.#running = true;
                                for (;this.#moveIndex < this.#movesScore.length; this.#moveIndex++) {
                                    this.#movesScore[this.#moveIndex].score = -MAX_EVALUATION;
                                }
                                this.#movesScore.sort((a, b) => b.score - a.score);
                                this.#depth++;
                                this.#minimax();
                            }
                        }
                    } else {
                        this.state.moveId = this.#movesScore[this.#moveIndex++].moveId;
                        worker.postMessage(this.state);
                    }
                };
                this.#workers.push(worker);
            }
        }
        if (this.#depth === 1) {
            this.state = new EvaluationState();
            this.state.board = this.#board;
            this.state.evaluatorId = this.evaluatorId;
        }
        this.state.evaluation = null;
        this.state.pieceId = null;
        this.state.target = null;
        this.state.alpha = -MAX_EVALUATION;
        this.state.beta = MAX_EVALUATION;
        this.state.maxDepth = this.#depth;
        for (let i = 0; i < this.#moveIndex; i++) {
            this.state.moveId = this.#movesScore[i].moveId;
            this.#workers[i].postMessage(this.state);
        }
        this.state.board = null;
        this.state.evaluatorId = null;

    }
    getProgress() {
        const texts = [];
        if (this.#depth >= 1) {
            texts.push("Depth: " + this.#depth + " / " + MAX_DEPTH);
            texts.push("Iterations: " + this.#getIterationsPerSecond());
        }
        if (this.#depth === MAX_DEPTH) {
            texts.push("Moves: " + (this.#moveIndex - QTY_WORKERS + this.#idle) + " / " + this.#qtyMoves);
            texts.push("Evaluation: " + this.#getEvaluation());
        }
        return texts;
    }
    #getEvaluation() {
        if (this.state.evaluation === MAX_EVALUATION) {
            return "+∞";
        } else if (this.state.evaluation === -MAX_EVALUATION) {
            return "-∞";
        } else if (this.state.evaluation > 0) {
            return "+" + this.state.evaluation;
        }
        return this.state.evaluation ?? "?";
    }

    reset(resetState = true) {
        this.#workers.forEach(w => w.terminate());
        this.#workers = [];
        this.#running = false;
        this.#idle = QTY_WORKERS;
        if (resetState) {
            this.state = new EvaluationState();
            this.#moveIndex = null;
        }
    }
    #getIterationsPerSecond() {
        if (!this.#running) {
            return "-";
        }
        return Math.round(Math.round(this.state.iterations / (Date.now() - this.#initTurnTime))) + "k/s";
    }
}
class EvaluationState {
    maxEvaluation = MAX_EVALUATION;

    iterations = 0;
    alpha;
    beta;
    maxDepth;

    pieceId;
    target;
    evaluation;

    board;
    evaluatorId;
    moveId;
    done = false;
}

