import Board from "../core/board.js";
import {PieceColor, PieceType} from "../core/piece.js";

const PRIORITY = [
    PieceType.queen.id,
    PieceType.pillBug.id,
    PieceType.ant.id,
    PieceType.beetle.id,
    PieceType.mosquito.id,
    PieceType.ladybug.id,
    PieceType.cockroach.id,
    PieceType.dragonfly.id,
    PieceType.scorpion.id,
    PieceType.fly.id,
    PieceType.wasp.id,
    PieceType.grasshopper.id,
    PieceType.centipede.id,
    PieceType.mantis.id,
    PieceType.spider.id,
];

export default class QueenEvaluator {
    evaluate(board) {
        return queenEval(board, PieceColor.white.id) - queenEval(board, PieceColor.black.id);
    }
    sortMoves(board, moves) {
        const colorId = board.getColorPlaying().id;
        const queen = board.pieces.find(p => p.inGame && p.type.id === PieceType.queen.id && p.color.id !== colorId);
        const queenZone = queen ? Board.coordsAround(queen.x, queen.y, true) : [];
        const enemyZone = [];
        board.inGameTopPieces.forEach(p => {
            if (p.color.id !== colorId) {
                Board.coordsAround(p.x, p.y, true).forEach(([x, y]) => {
                    if (!enemyZone.find(([ex, ey]) => ex === x && ey === y)) {
                        enemyZone.push([x, y]);
                    }
                });
            }
        });
        return moves.sort((a, b) => {
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
    }
}

function queenEval(board, colorId) {
    const queen = board.pieces.find(p => p.inGame && p.type.id === PieceType.queen.id && p.color.id !== colorId);
    if (!queen) {
        return 0;
    }
    const above = board.inGameTopPieces.find(p => p.x === queen.x && p.y === queen.y && p.color.id === colorId);
    const occupy = Board.coordsAround(queen.x, queen.y).map(([x, y]) =>
        board.inGameTopPieces.find(p => p.x === x && p.y === y)).filter(p => p);

    const allyOccupy = occupy.filter(p => p.color.id === colorId);

    const occupyIds = occupy.map(p => p.id);
    if (above) {
        occupyIds.push(above.id);
    }

    const qtyAttacked = board.getColorPlaying().id === colorId ?
        Board.coordsAround(queen.x, queen.y).reduce((qty, [x, y]) =>
            board.pieces.find(p => !occupyIds.includes(p.id) &&
                p.targets.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0) :
        Board.coordsAround(queen.x, queen.y).reduce((qty, [x, y]) =>
            board.pieces.find(p => !occupyIds.includes(p.id) &&
                p.targetsB.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0);

    const qtyAttacking = board.getColorPlaying().id === colorId ?
        board.pieces.reduce((qty, p) => !occupyIds.includes(p.id) && p.targets.length > 0 &&
        Board.coordsAround(queen.x, queen.y).find(([x, y]) => p.targets.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0) :
        board.pieces.reduce((qty, p) => !occupyIds.includes(p.id) && p.targetsB.length > 0 &&
        Board.coordsAround(queen.x, queen.y).find(([x, y]) => p.targetsB.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0);

    return occupyIds.length +
        allyOccupy.length +
        Math.min(qtyAttacked, qtyAttacking);
}

