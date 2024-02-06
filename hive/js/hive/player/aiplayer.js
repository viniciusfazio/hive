import Player from "./player.js";
import Board from "../core/board.js";
import {PieceColor, PieceType} from "../core/piece.js";

const MAX_PIECE_INDEX = 9999;
const ITERATION_STEP = 250;

export default class AIPlayer extends Player {
    #initTurnTime;
    iterations;
    #running = false;
    pieceId;
    target;
    evaluation;
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
        this.#run(this.#alphaBeta(4));
    }
    #run(generator) {
        if (generator.next().done) {
            this.#running = false;
            const piece = this.hive.board.pieces.find(p => p.id === this.pieceId);
            this.hive.play(piece, this.target);
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
        board.computeLegalMoves(true, true);

        let stack = [new MinimaxData(getMoves(board))];

        this.#initTurnTime = Date.now();
        this.#running = true;
        this.pieceId = null;
        this.target = null;
        this.evaluation = null;
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
                    if (this.pieceId === null || this.target === null) {
                        console.trace();
                        throw new Error('Invalid result');
                    }
                    return;
                }
                // send info to parent
                const parent = stack[stack.length - 2];
                let ended = false;
                if (parent.maximizing) {
                    if (parent.evaluation === null || data.evaluation > parent.evaluation) {
                        parent.evaluation = data.evaluation;
                        if (stack.length === 2) {
                            const [, , p, t] = parent.moves[parent.moveId];
                            this.pieceId = p.id;
                            this.target = t;
                            this.evaluation = data.evaluation;
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
                    const [from, , p, ] = parent.moves[parent.moveId];
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
                const [, to, p, ] = data.moves[data.moveId];
                board.play(to, p);
            }
            board.round++;
            board.computeLegalMoves(true, true);
            stack.push(new MinimaxData(getMoves(board), data));
        }
        console.trace();
        throw new Error('Invalid end loop');
    }

    evaluate(board, colorId) {
        let otherColorId = PieceColor.white.id === colorId ? PieceColor.black.id : PieceColor.white.id;
        return queenEval(board, colorId) - queenEval(board, otherColorId);
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
const PRIORITY = [
    PieceType.queen.id,
    PieceType.beetle.id,
    PieceType.ladybug.id,
    PieceType.cockroach.id,
    PieceType.mosquito.id,
    PieceType.dragonfly.id,
    PieceType.ant.id,
    PieceType.scorpion.id,
    PieceType.fly.id,
    PieceType.pillBug.id,
    PieceType.wasp.id,
    PieceType.grasshopper.id,
    PieceType.centipede.id,
    PieceType.mantis.id,
    PieceType.spider.id,
];
function getMoves(board) {
    let moves = [];
    const colorId = board.getColorPlaying().id;
    const queen = board.pieces.find(p => p.inGame && p.type.id === PieceType.queen.id && p.color.id !== colorId);
    const queenZone = queen ? Board.coordsAround(queen.x, queen.y, true) : [];
    board.pieces.forEach(p => p.targets.forEach(t => moves.push([[p.x, p.y, p.z], [t.x, t.y, t.z], p, t])));
    const enemyZone = [];
    board.inGameTopPieces.forEach(p => {
        if (p.color.id !== colorId) {
            Board.coordsAround(p.x, p.y, true).forEach(([ax, ay]) => {
                if (!enemyZone.find(([ex, ey]) => ex === ax && ey === ay)) {
                    enemyZone.push([ax, ay]);
                }
            });
        }
    });
    moves.sort((a, b) => {
        const [, to1, p1, ] = a;
        const [, to2, p2, ] = b;
        const [x1, y1, ] = to1;
        const [x2, y2, ] = to2;
        const p1Queen = queenZone.find(([x, y]) => x === x1 && y === y1);
        const p2Queen = queenZone.find(([x, y]) => x === x2 && y === y2);
        if (p1Queen && !p2Queen) {
            return -1;
        }
        if (p2Queen && !p1Queen) {
            return 1;
        }
        const touchEnemy1 = p1.inGame && enemyZone.find(([x, y]) => x === x1 && y === y1);
        const touchEnemy2 = p2.inGame && enemyZone.find(([x, y]) => x === x2 && y === y2);
        if (touchEnemy1 && !touchEnemy2) {
            return -1;
        }
        if (touchEnemy2 && !touchEnemy1) {
            return 1;
        }
        return PRIORITY.indexOf(p1.type.id) - PRIORITY.indexOf(p2.type.id);
    });
    return moves;
}
function queenEval(board, colorId) {
    const queen = board.pieces.find(p => p.inGame && p.type.id === PieceType.queen.id && p.color.id !== colorId);
    if (!queen) {
        return 0;
    }
    const above = board.inGameTopPieces.find(p => p.x === queen.x && p.y === queen.y && p.color.id !== queen.color.id) ? 1 : 0;
    const qtyOcuppied = Board.coordsAround(queen.x, queen.y).reduce((qty, [x, y]) =>
        board.inGameTopPieces.find(p => p.x === x && p.y === y) ? qty + 1 : qty, 0);

    const qtyAttacked = board.getColorPlaying().id === colorId ?
        Board.coordsAround(queen.x, queen.y).reduce((qty, [x, y]) =>
            board.inGameTopPieces.find(p => p.targets.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0) :
        Board.coordsAround(queen.x, queen.y).reduce((qty, [x, y]) =>
            board.inGameTopPieces.find(p => p.targetsB.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0);

    const qtyAttacking = board.getColorPlaying().id === colorId ?
        board.inGameTopPieces.reduce((qty, p) =>
            Board.coordsAround(queen.x, queen.y).find(([x, y]) => p.targets.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0) :
        board.inGameTopPieces.reduce((qty, p) =>
            Board.coordsAround(queen.x, queen.y).find(([x, y]) => p.targetsB.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0);

    return above * 2 + qtyOcuppied * 2 + Math.min(qtyAttacked, qtyAttacking);
}
