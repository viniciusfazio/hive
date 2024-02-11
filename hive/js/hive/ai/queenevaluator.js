import Board from "../core/board.js";
import {PieceColor, PieceType} from "../core/piece.js";


export default class QueenEvaluator {
    evaluate(board) {
        return queenEval(board, PieceColor.white.id) - queenEval(board, PieceColor.black.id);
    }
    getSortedMoves(board) {
        const colorId = board.getColorPlaying().id;
        const queen = board.queens.find(p => p.inGame && p.color.id !== colorId);
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
        return board.getMoves().sort((a, b) => {
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
    const queen = board.queens.find(p => p.inGame && p.color.id !== colorId);
    if (!queen) {
        return 0;
    }
    let aboveQueen = board.getInGamePiece(queen.x, queen.y);
    if (aboveQueen.color.id !== colorId) {
        aboveQueen = false;
    }
    const occupy = [];
    const freeCoords = [];
    Board.coordsAround(queen.x, queen.y).forEach(([x, y]) => {
        const p = board.getInGamePiece(x, y);
        if (p) {
            occupy.push(p);
        } else {
            freeCoords.push([x, y]);
        }
    });


    const allyOccupy = occupy.filter(p => p.color.id === colorId);
    const aboveAround = allyOccupy.find(p => p.z > 0);

    const enemyOccupy = occupy.filter(p => p.color.id !== colorId);

    const pillBugDefense = enemyOccupy.find(p => p.type.id === PieceType.pillBug.id);
    const scorpionDefense = enemyOccupy.find(p => p.type.id === PieceType.scorpion.id);

    let mosquitoPillBugDefense = false;
    if (board.standardRules) {
        const mosquito = enemyOccupy.find(p => p.type.id === PieceType.mosquito.id && p.z === 0);
        mosquitoPillBugDefense = mosquito && Board.coordsAround(mosquito.x, mosquito.y).find(([x, y]) => {
            const p = board.getInGamePiece(x, y);
            return p && p.type.id === PieceType.pillBug.id;
        });
    }


    const occupyIds = occupy.filter(p => p.z === 0).map(p => p.id);
    if (aboveQueen) {
        occupyIds.push(aboveQueen.id);
    } else {
        freeCoords.push([queen.x, queen.y]);
    }

    const colorIsPlaying = board.getColorPlaying().id === colorId;
    const qtyAttacked = colorIsPlaying ?
        freeCoords.reduce((qty, [x, y]) =>
            board.pieces.find(p => !occupyIds.includes(p.id) &&
                p.targets.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0) :
        freeCoords.reduce((qty, [x, y]) =>
            board.pieces.find(p => !occupyIds.includes(p.id) &&
                p.targetsB.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0);

    const qtyAttacking = colorIsPlaying ?
        board.pieces.reduce((qty, p) => !occupyIds.includes(p.id) && p.targets.length > 0 &&
            freeCoords.find(([x, y]) => p.targets.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0) :
        board.pieces.reduce((qty, p) => !occupyIds.includes(p.id) && p.targetsB.length > 0 &&
            freeCoords.find(([x, y]) => p.targetsB.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0);

    return -enemyOccupy.length +
        (aboveQueen ? 3 : 0) +
        (aboveAround ? 1 : 0) +
        allyOccupy.length * 2 +
        (pillBugDefense ? -1 : 0) +
        (scorpionDefense ? -1 : 0) +
        (mosquitoPillBugDefense ? -1 : 0) +
        Math.min(qtyAttacked, qtyAttacking) +
        (colorIsPlaying ? 1 : 0);
}

const PRIORITY = [
    PieceType.queen.id,
    PieceType.pillBug.id,
    PieceType.ant.id,
    PieceType.dragonfly.id,
    PieceType.beetle.id,
    PieceType.mosquito.id,
    PieceType.cockroach.id,
    PieceType.ladybug.id,
    PieceType.scorpion.id,
    PieceType.fly.id,
    PieceType.wasp.id,
    PieceType.grasshopper.id,
    PieceType.centipede.id,
    PieceType.mantis.id,
    PieceType.spider.id,
];