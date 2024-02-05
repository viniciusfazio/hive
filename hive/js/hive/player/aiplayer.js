import Player from "./player.js";
import Board from "../core/board.js";
import {PieceColor, PieceType} from "../core/piece.js";

const MAX_PIECE_INDEX = 9999;
const ITERATION_STEP = 500;

export default class AIPlayer extends Player {
    #initTurnTime;
    iterations;
    #running;
    initPlayerTurn() {
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
        this.#run(this.#alphaBeta(4));
    }
    #run(generator) {
        const ret = generator.next();
        if (ret.done) {
            this.#running = false;
            const [pieceId, targetCoords] = ret.value;
            const [tx, ty, tz] = targetCoords;
            const piece = this.hive.board.pieces.find(p => p.id === pieceId);
            const target = piece.targets.find(t => t.x === tx && t.y === ty && t.z === tz);
            this.hive.play(piece, target);
        } else {
            setTimeout(() => this.#run(generator), 10);
        }
    }
    getIterationsPerSecond() {
        if (!this.#running) {
            return "-";
        }
        return Math.round(1000 * this.iterations / (Date.now() - this.#initTurnTime)) + "/s";
    }
    *#alphaBeta(maxDepth) {
        const colorId = this.hive.board.getColorPlaying().id;
        const board = new Board(this.hive.board);
        board.computeLegalMoves(true);

        let chosenPiece = null;
        let chosenTarget = null;
        let stack = [new MinimaxData(getMoves(board))];

        this.#initTurnTime = Date.now();
        this.#running = true;
        for (this.iterations = 0; stack.length > 0; this.iterations++) {
            if (this.iterations % ITERATION_STEP === 0) {
                yield;
            }
            const data = stack[stack.length - 1];
            if (stack.length > maxDepth) { // leaf node (max depth), evaluate
                data.evaluation = this.evaluate(board, colorId);
                data.moveId = MAX_PIECE_INDEX;
            } else if (data.moves.length === 0) { // leaf node (terminal) or pass round
                const queenDead = board.isQueenDead(colorId);
                const queenDefeated = board.isQueenDead(colorId === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id);
                if (queenDead && queenDefeated) {
                    data.evaluation = 0;
                } else if (queenDead) {
                    data.evaluation = -999999999;
                } else if (queenDefeated) {
                    data.evaluation = 999999999;
                }
                data.moveId = MAX_PIECE_INDEX;
            }
            if (++data.moveId >= data.moves.length && data.evaluation !== null) { // no more node to open
                if (stack.length === 1) { // ended
                    if (chosenPiece === null || chosenTarget === null) {
                        console.trace();
                        throw new Error('Invalid result');
                    }
                    return [chosenPiece.id, chosenTarget];
                }
                // send info to parent
                const parent = stack[stack.length - 2];
                let ended = false;
                if (parent.maximizing) {
                    if (parent.evaluation === null || data.evaluation > parent.evaluation) {
                        parent.evaluation = data.evaluation;
                        if (stack.length === 2) {
                            [, chosenTarget, chosenPiece] = parent.moves[parent.moveId];
                        }
                        if (parent.alpha === null || parent.evaluation > parent.alpha) {
                            parent.alpha = parent.evaluation;
                        }
                    }
                    if (parent.beta !== null && parent.evaluation >= parent.beta) {
                        ended = true;
                    }
                } else {
                    if (parent.evaluation === null || data.evaluation < parent.evaluation) {
                        parent.evaluation = data.evaluation;
                        if (parent.beta === null || parent.evaluation < parent.beta) {
                            parent.beta = parent.evaluation;
                        }
                    }
                    if (parent.alpha !== null && parent.evaluation <= parent.alpha) {
                        ended = true;
                    }
                }
                // move back
                if (parent.moves.length > 0) {
                    const [from, , p] = parent.moves[parent.moveId];
                    board.playBack(from, p);
                }
                stack.pop();
                board.round--;
                // skip if pruned
                if (ended) {
                    parent.moveId = MAX_PIECE_INDEX;
                }
                continue;
            }
            // move
            if (data.moves.length > 0) {
                const [, to, p] = data.moves[data.moveId];
                board.play(to, p);
            }
            board.round++;
            board.computeLegalMoves(true);
            stack.push(new MinimaxData(getMoves(board), data));
        }
        console.trace();
        throw new Error('Invalid end loop');
    }

    evaluate(board, colorId) {
        let otherColorId = PieceColor.white.id === colorId ? PieceColor.black.id : PieceColor.white.id;
        let evaluation = 10000 * (queenEval(board, colorId, otherColorId) - queenEval(board, otherColorId, colorId));
        const totalMoves = board.inGameTopPieces.reduce((total, p) => total + p.targets.length, 0);
        if (board.getColorPlaying().id === colorId) {
            evaluation += totalMoves;
        } else {
            evaluation -= totalMoves;
        }

        return evaluation;

    }


}
class MinimaxData {
    moves;
    evaluation;
    moveId;
    alpha = null;
    beta = null;
    maximizing = true;
    constructor(moves, data = null) {
        this.moves = moves;
        this.evaluation = null;
        this.moveId = -1;
        if (data !== null) {
            this.alpha = data.alpha;
            this.beta = data.beta;
            this.maximizing = !data.maximizing;
        }
    }
}
function getMoves(board) {
    let moves = [];
    board.pieces.forEach(p => p.targets.forEach(t => moves.push([[p.x, p.y, p.z], [t.x, t.y, t.z], p])));
    return moves;
}
function queenEval(board, colorId, otherColorId) {
    const queen = board.pieces.find(p => p.inGame && p.type.id === PieceType.queen.id && p.color.id === colorId);
    if (!queen) {
        return 6;
    }
    let qtdEmpty = Board.coordsAround(queen.x, queen.y).reduce((qtd, [x, y]) =>
        qtd + (board.inGameTopPieces.find(p => p.x === x && p.y === y && p.color.id === otherColorId) ? 0 : 1), 0);
    if (board.inGameTopPieces.find(p => p.x === queen.x && p.y === queen.y && p.color.id === otherColorId)) {
        qtdEmpty -= 3;
    }
    return qtdEmpty;

}
