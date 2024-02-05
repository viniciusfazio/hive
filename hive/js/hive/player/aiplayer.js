import Player from "./player.js";
import Board from "../core/board.js";
import {PieceColor, PieceType} from "../core/piece.js";

const MAX_PIECE_INDEX = 9999;
const ITERATION_STEP = 100;

export default class AIPlayer extends Player {
    #initTurnTime;
    iterations;
    stackSize;
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
        const colorId = this.hive.board.getColorPlaying().id;

        const data = new MinimaxData(this.hive.board, playable.map(p => p.clone(true)));
        this.#run(this.#alphaBeta(data, 4, colorId));
    }
    #run(generator) {
        const ret = generator.next();
        if (ret.done) {
            this.#running = false;
            const [pieceId, targetId] = ret.value;
            const piece = this.hive.board.pieces.find(p => p.id === pieceId);
            const target = piece.targets.find(t => t.id === targetId);
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
    *#alphaBeta(minimaxData, maxDepth, colorId) {
        minimaxData.depth = maxDepth;
        let chosenPiece = null;
        let chosenTarget = null;
        let stack = [minimaxData];
        this.#initTurnTime = Date.now();
        this.#running = true;
        for (this.iterations = 0; stack.length > 0; this.iterations++) {
            this.stackSize = stack.length;
            if (this.iterations % ITERATION_STEP === 0) {
                yield;
            }
            const data = stack[stack.length - 1];
            if (data.depth === 0) { // leaf node (depth 0), evaluate
                data.evaluation = this.evaluate(data.board, colorId);
                data.ip = MAX_PIECE_INDEX;
            } else if (data.board.passRound) { // node with only 1 branch
                const newBoard = new Board(data.board);
                newBoard.round++;
                newBoard.computeLegalMoves(true);
                const newPlayable = newBoard.pieces.filter(p => p.targets.length > 0);
                stack.push(new MinimaxData(newBoard, newPlayable, data));
                continue;
            } else if (data.playable.length === 0) { // leaf node (terminal), evaluate
                const queenDead = data.board.isQueenDead(colorId);
                const queenDefeated = data.board.isQueenDead(colorId === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id);
                if (queenDead && queenDefeated) {
                    data.evaluation = 0;
                } else if (queenDead) {
                    data.evaluation = -999999;
                } else if (queenDefeated) {
                    data.evaluation = 999999;
                } else {
                    console.trace();
                    throw new Error('Invalid state');
                }
            }
            data.it++;
            if (data.ip < data.playable.length && data.it >= data.playable[data.ip].targets.length) {
                data.it = 0;
                data.ip++;
            }
            if (data.ip >= data.playable.length) { // no more node to open
                if (stack.length === 1) { // ended
                    if (chosenPiece === null || chosenTarget === null) {
                        console.trace();
                        throw new Error('Invalid result');
                    }
                    return [chosenPiece.id, chosenTarget.id];
                }
                // send info to parent
                const parent = stack[stack.length - 2];
                if (parent.maximizing) {
                    if (parent.evaluation === null || data.evaluation > parent.evaluation) {
                        parent.evaluation = data.evaluation;
                        if (parent.depth === maxDepth) {
                            chosenPiece = parent.playable[parent.ip];
                            chosenTarget = chosenPiece.targets[parent.it];
                        }
                        if (parent.alpha === null || parent.evaluation > parent.alpha) {
                            parent.alpha = parent.evaluation;
                        }
                    }
                    if (parent.beta !== null && parent.evaluation >= parent.beta) {
                        parent.ip = MAX_PIECE_INDEX;
                    }
                } else {
                    if (parent.evaluation === null || data.evaluation < parent.evaluation) {
                        parent.evaluation = data.evaluation;
                        if (parent.beta === null || parent.evaluation < parent.beta) {
                            parent.beta = parent.evaluation;
                        }
                    }
                    if (parent.alpha !== null && parent.evaluation <= parent.alpha) {
                        parent.ip = MAX_PIECE_INDEX;
                    }
                }
                stack.pop();
                continue;
            }

            const piece = data.playable[data.ip];
            const target = piece.targets[data.it];
            const newBoard = new Board(data.board);
            const p = newBoard.allPieces.find(p => piece.id === p.id);
            newBoard.play([target.x, target.y, target.z], p);
            newBoard.round++;
            newBoard.computeLegalMoves(true);
            const newPlayable = newBoard.pieces.filter(p => p.targets.length > 0);
            let newData = new MinimaxData(newBoard, newPlayable, data);
            stack.push(newData);
        }
        console.trace();
        throw new Error('Invalid end loop');
    }

    evaluate(board, colorId) {
        let otherColor = PieceColor.white.id === colorId ? PieceColor.black.id : PieceColor.white.id;
        let evaluation = 10000 * (queenEmptyAround(board, colorId) - queenEmptyAround(board, otherColor));
        const totalMoves = board.pieces.reduce((total, p) => total + p.targets.length, 0);
        if (board.getColorPlaying().id === colorId) {
            evaluation += totalMoves;
        } else {
            evaluation -= totalMoves;
        }
        return evaluation;
    }


}
class MinimaxData {
    board;
    playable;
    depth;
    evaluation = null;
    ip = 0;
    it = -1;
    alpha = null;
    beta = null;
    maximizing = true;
    constructor(board, playable, data = null) {
        this.board = board;
        this.playable = playable;
        if (data !== null) {
            this.depth = data.depth - 1;
            this.alpha = data.alpha;
            this.beta = data.beta;
            this.maximizing = !data.maximizing;
        }
    }
}
function queenEmptyAround(board, color) {
    const queen = board.pieces.find(p =>
        p.inGame &&
        p.type.id === PieceType.queen.id &&
        p.color.id === color
    );
    if (!queen) {
        return 6;
    }
    return Board.coordsAround(queen.x, queen.y).filter(([x, y]) => !board.inGameTopPieces.find(p => p.x === x && p.y === y)).length;

}