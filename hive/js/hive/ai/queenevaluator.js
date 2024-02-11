import Board from "../core/board.js";
import {PieceColor, PieceType} from "../core/piece.js";


export default class QueenEvaluator {
    evaluate(board) {
        board.computeLegalMoves(true, true);
        return queenEval(board, PieceColor.white.id) - queenEval(board, PieceColor.black.id);
    }
    getSortedMoves(board) {
        const moves = board.getMoves();
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
        return moves.map(move => {
            let score = 0;
            const [from, to, p, ] = move;
            const [tx, ty, tz] = to;
            const [fx, fy, ] = from;
            const enteringQueen = queenZone.find(([qx, qy]) => tx === qx && ty === qy);
            const leavingQueen = p.inGame && queenZone.find(([qx, qy]) => fx === qx && fy === qy);
            if (enteringQueen && !leavingQueen) {
                score |= 2;
            } else if (enteringQueen || !leavingQueen) {
                score |= 1;
            }

            score <<= 1;
            score |= !p.inGame ? 1 : 0;

            score <<= 2;
            const enteringEnemy = enemyZone.find(([ex, ey]) => tx === ex && ty === ey);
            const leavingEnemy = p.inGame && enemyZone.find(([ex, ey]) => fx === ex && fy === ey);
            if (enteringEnemy && !leavingEnemy) {
                score |= 2;
            } else if (enteringEnemy || !leavingEnemy) {
                score |= 1;
            }

            score <<= 1;
            score |= tz > 0 ? 1 : 0;

            score <<= 6;
            score |= PRIORITY.indexOf(p.type.id);

            return {
                move: move,
                score: score,
            };
        }).sort((a, b) => b.score - a.score).map(m => m.move);
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