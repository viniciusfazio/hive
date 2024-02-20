import Player from "./player.js";
import {WHITE} from "../core/piece.js";
import Board from "../core/board.js";
import QueenEvaluator from "../ai/queenevaluator.js";

// number of workers. Too little yields slow iterations per second. Too much yields fewer alpha beta pruning.
const QTY_WORKERS = 7;
// evaluation that indicate white wins
const MAX_EVALUATION = 999999;
// max depth to compute
const MAX_DEPTH = 5;
const COMPUTE_BEST_N_MOVES_FIRST = 4;

export default class AIPlayer extends Player {
    evaluatorId = "queenai";

    #initTurnTime = null;
    #totalTime = null;
    #workers = [];

    pieceId;
    target;

    #iterations;
    #evaluator;

    #idle;
    #board;

    #alpha;
    #beta;

    #color;
    #evaluation = null;
    #evaluationDepth;
    #moves;
    #moveIndex;
    #evaluatedMoves;


    #getMovesSortedByTime() {
        return this.#moves.filter(move => move.iterations > 0).map((move, idx) => {
            const moveTxt = this.#board.getMoveNotation(move.pieceId, move.targetCoords, this.#board.round === 1);
            const timeTxt = Math.round(move.time / 100) / 10 + "s";
            const iterTxt = Math.round(move.iterations / 100) / 10 + "k";
            const moveId = idx + 1;
            return {
                time: move.time,
                txt: moveId + ": " + moveTxt + " " + timeTxt + " " + iterTxt,
            }
        }).sort((a, b) => a.time - b.time).map(m => m.txt);
    }

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
        this.#evaluator = AIPlayer.getEvaluator(this.evaluatorId);
        this.#board = new Board(this.hive.board);

        this.#moves = [];
        const evaluation = this.#board.getColorPlaying() === WHITE ? -MAX_EVALUATION : MAX_EVALUATION;
        for (const [, , p, t] of AIPlayer.getSortedMovesPeekingNextMove(this.#board, this.#evaluator)) {
            this.#moves.push({
                pieceId: p.id,
                targetCoords: [t.x, t.y, t.z],
                time: 0,
                iterations: 0,
                target: t,
                evaluation: evaluation,
            });
        }

        this.#iterations = 0;

        this.#evaluation = null;
        this.#color = this.#board.getColorPlaying();
        this.#evaluationDepth = 0;
        this.pieceId = null;
        this.target = null;

        this.#alpha = -MAX_EVALUATION;
        this.#beta = MAX_EVALUATION;
        this.#initWorkers();
        this.#minimax();
    }
    #initWorkers() {
        if (this.#workers.length === 0) {
            // create all workers
            for (let i = 0; i < QTY_WORKERS; i++) {
                const worker = new Worker("js/ai/aiminimax.js", {type: 'module'});
                worker.onmessage = e => {
                    // the worker responded
                    const msg = e.data;
                    // keeps track of number of iterations done
                    const move = this.#moves.find(m =>
                        m.pieceId === msg.pieceId &&
                        m.targetCoords[0] === msg.targetCoords[0] &&
                        m.targetCoords[1] === msg.targetCoords[1] &&
                        m.targetCoords[2] === msg.targetCoords[2]
                    );
                    move.iterations += msg.iterations;
                    move.time = msg.time;
                    this.#iterations += msg.iterations;
                    if (!msg.done) {
                        // the worker only updated the iteration count
                        return;
                    }

                    this.#evaluatedMoves++;
                    move.evaluation = msg.evaluation;

                    const maximizing = this.#board.getColorPlaying() === WHITE;

                    // check if evaluation is the best
                    const newBestMove = this.#evaluation === null ||
                        this.#evaluationDepth < msg.maxDepth ||
                        maximizing && msg.evaluation > this.#evaluation ||
                        !maximizing && msg.evaluation < this.#evaluation;

                    if (newBestMove) {
                        // saves the evaluation and the move
                        this.#evaluation = msg.evaluation;
                        this.#evaluationDepth = msg.maxDepth;
                        if (this.#evaluationDepth > 2) {
                            this.pieceId = move.pieceId;
                            this.target = move.target;
                        }

                        // updates alpha and beta, and check victory
                        if (maximizing) {
                            if (msg.evaluation === MAX_EVALUATION) {
                                this.pieceId = move.pieceId;
                                this.target = move.target;
                                this.#play();
                                this.#resetWorkers();
                                return;
                            } else {
                                this.#alpha = Math.max(this.#alpha, msg.evaluation);
                            }
                        } else {
                            if (msg.evaluation === -MAX_EVALUATION) {
                                this.pieceId = move.pieceId;
                                this.target = move.target;
                                this.#play();
                                this.#resetWorkers();
                                return;
                            } else {
                                this.#beta = Math.min(this.#beta, msg.evaluation);
                            }
                        }
                    }
                    if (this.#moveIndex < this.#moves.length) {
                        msg.alpha = this.#alpha;
                        msg.beta = this.#beta;
                        if (this.#evaluatedMoves > COMPUTE_BEST_N_MOVES_FIRST) {
                            msg.pieceId = this.#moves[this.#moveIndex].pieceId;
                            msg.targetCoords = this.#moves[this.#moveIndex].targetCoords;
                            this.#moveIndex++;
                            worker.postMessage(msg);
                        } else if (this.#evaluatedMoves === COMPUTE_BEST_N_MOVES_FIRST) {
                            ++this.#idle;
                            for (let i = 0; i < QTY_WORKERS && this.#moveIndex < this.#moves.length; i++) {
                                msg.pieceId = this.#moves[this.#moveIndex].pieceId;
                                msg.targetCoords = this.#moves[this.#moveIndex].targetCoords;
                                this.#moveIndex++;
                                this.#idle--;
                                this.#workers[i].postMessage(msg);
                            }
                        } else {
                            ++this.#idle;
                        }
                    } else if (++this.#idle === QTY_WORKERS) {
                        if (msg.maxDepth < MAX_DEPTH) {
                            this.#minimax(msg.maxDepth + 1);
                        } else {
                            this.#play();
                        }
                    }
                };
                this.#workers.push(worker);
            }
        }
    }
    #minimax(maxDepth = null) {
        const msg = new WorkerMessage();
        msg.maxDepth = maxDepth;
        if (maxDepth === null) {
            msg.board = this.#board;
            msg.evaluatorId = this.evaluatorId;
            msg.maxDepth = 2;
        } else {
            if (this.#board.getColorPlaying() === WHITE) {
                this.#moves.sort((a, b) => b.evaluation - a.evaluation);
            } else {
                this.#moves.sort((a, b) => a.evaluation - b.evaluation);
            }
            this.#moves.forEach(move => {
                move.time = 0;
                move.iterations = 0;
            });
        }
        this.#alpha = -MAX_EVALUATION;
        this.#beta = MAX_EVALUATION;
        this.#moveIndex = Math.min(this.#moves.length, QTY_WORKERS, COMPUTE_BEST_N_MOVES_FIRST);
        this.#idle = QTY_WORKERS - this.#moveIndex;
        this.#evaluatedMoves = 0;
        for (let i = 0; i < Math.min(QTY_WORKERS, this.#moves.length); i++) {
            // makes each worker start processing a move
            if (i < this.#moveIndex) {
                msg.pieceId = this.#moves[i].pieceId;
                msg.targetCoords = this.#moves[i].targetCoords;
            } else {
                msg.pieceId = null;
                msg.targetCoords = null;
            }
            this.#workers[i].postMessage(msg);
        }
    }
    #play() {
        this.#totalTime = Date.now() - this.#initTurnTime;
        this.#initTurnTime = null;
        this.hive.play(this.pieceId, this.target);
        this.pieceId = null;
        this.target = null;
    }
    getEvaluation5Levels() {
        if (this.#evaluation === null) {
            return null;
        }
        let evaluation;
        if (this.#evaluation === -MAX_EVALUATION) {
            evaluation = -2;
        } else if (this.#evaluation < -1) {
            evaluation = -1;
        } else if (this.#evaluation <= 1) {
            evaluation = 0;
        } else if (this.#evaluation < MAX_EVALUATION) {
            evaluation = 1;
        } else {
            evaluation = 2;
        }
        return this.#color === WHITE ? evaluation : -evaluation;
    }
    getProgress() {
        const texts = [];
        if (this.#moves) {
            texts.push("Evaluation: " + this.#getEvaluation());
            texts.push("Depth: " + this.#evaluationDepth + " / " + MAX_DEPTH);
            texts.push("Iterations: " + this.#getIterations());
            texts.push("Moves: " + this.#evaluatedMoves + " / " + this.#moves.length);
            if (this.#evaluationDepth === MAX_DEPTH) {
                const movesSorted = this.#getMovesSortedByTime();
                const qty = Math.min(10, movesSorted.length);
                if (movesSorted.length === qty) {
                    texts.push("Moves:");
                } else {
                    texts.push("Fastest moves:");
                }
                for (let i = 0; i < qty; i++) {
                    texts.push(movesSorted[i]);
                }
                if (movesSorted.length > qty) {
                    texts.push("Slowest moves:");
                    for (let i = movesSorted.length - qty; i < movesSorted.length; i++) {
                        texts.push(movesSorted[i]);
                    }
                }
            }
        }
        return texts;
    }
    #getEvaluation() {
        if (this.#evaluation === MAX_EVALUATION) {
            return "+∞";
        } else if (this.#evaluation === -MAX_EVALUATION) {
            return "-∞";
        } else if (this.#evaluation > 0) {
            return "+" + this.#evaluation;
        }
        return this.#evaluation ?? "?";
    }

    reset() {
        this.#resetWorkers();
        this.#totalTime = null;
        this.#initTurnTime = null;
        this.pieceId = null;
        this.target = null;
        this.#moves = null;
    }
    #resetWorkers() {
        this.#workers.forEach(w => w.terminate());
        this.#workers = [];
        this.#idle = QTY_WORKERS;
    }
    #getIterations() {
        let speed = "";
        if (this.#initTurnTime !== null) {
            speed = " - " + Math.round(Math.round(this.#iterations / (Date.now() - this.#initTurnTime))) + "k/s";
            this.#totalTime = Date.now() - this.#initTurnTime;
        }
        let time = "";
        if (this.#totalTime !== null) {
            time = " - " + (Math.round(this.#totalTime / 100) / 10) + "s";
        }
        if (this.#iterations < 1000) {
            return this.#iterations + speed + time;
        }
        if (this.#iterations < 1000000) {
            return Math.round(this.#iterations / 1000) + "k" + speed + time;
        }
        return (Math.round(this.#iterations / 100000) / 10) + "M" + speed + time;
    }
    static getSortedMovesPeekingNextMove(board, evaluator) {
        // sort moves by evaluation the board of each move
        const movesWithScore = board.getMoves().map(move => {
            const [from, to, p, ] = move;
            board.play(from, to, p);
            const evaluation = AIPlayer.evaluate(board, evaluator);
            board.playBack(from, to, p);
            return {
                move: move,
                evaluation: evaluation,
            };
        });
        return board.getColorPlaying() === WHITE ?
            movesWithScore.sort((a, b) => b.evaluation - a.evaluation).map(m => m.move) :
            movesWithScore.sort((a, b) => a.evaluation - b.evaluation).map(m => m.move);
    }
    static evaluate(board, evaluator) {
        return Math.max(-MAX_EVALUATION + 1, Math.min(MAX_EVALUATION - 1, evaluator.evaluate(board)));
    }
    static getEvaluator(evaluatorId) {
        switch (evaluatorId) {
            case "queenai":
                return new QueenEvaluator();
            default:
                throw new Error('Invalid evaluator: ' + evaluatorId);
        }
    }

}
class WorkerMessage {

    // input to minimax
    maxEvaluation = MAX_EVALUATION;
    evaluatorId = null;
    board = null;
    alpha = -MAX_EVALUATION;
    beta = MAX_EVALUATION;
    maxDepth;
    pieceId = null;
    targetCoords = null;

    // output from minimax, and to the aiPlayer
    evaluation;
    time;
    iterations = 0;
    done = false;
}
