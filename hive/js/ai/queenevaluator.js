import Board from "../core/board.js";
import {
    ANT,
    BEETLE,
    BLACK, CENTIPEDE,
    COCKROACH,
    DRAGONFLY, FLY, GRASSHOPPER, LADYBUG, MANTIS,
    MOSQUITO,
    PILL_BUG,
    QUEEN,
    SCORPION, SPIDER, WASP,
    WHITE
} from "../core/piece.js";


export default class QueenEvaluator {
    evaluate(board) {
        return queenEval(board, WHITE) - queenEval(board, BLACK);
    }
    getSortedMoves(board) {
        const moves = board.getMoves();
        const color = board.getColorPlaying();
        const enemyColor = color === WHITE ? BLACK : WHITE;
        const queen = board.queens.find(p => p.inGame && p.color !== color);
        const queenZone = queen ? Board.coordsAround(queen.x, queen.y, true) : [];
        const enemyZone = [];
        for (const p of board.inGameTopPiecesByColor[enemyColor]) {
            for (const [x, y] of Board.coordsAround(p.x, p.y, true)) {
                if (!enemyZone.find(([ex, ey]) => ex === x && ey === y)) {
                    enemyZone.push([x, y]);
                }
            }
        }
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
            score |= PRIORITY.indexOf(p.type);

            return {
                move: move,
                score: score,
            };
        }).sort((a, b) => b.score - a.score)
          .map(m => m.move);
    }
}

function queenEval(board, color) {
    const hisQueen = board.queens.find(p => p.inGame && p.color !== color);
    if (!hisQueen) {
        return 0;
    }
    let myPieceAboveHisQueen = board.getInGamePiece(hisQueen.x, hisQueen.y);
    if (myPieceAboveHisQueen.color !== color) {
        myPieceAboveHisQueen = false;
    }
    const piecesAroundHisQueen = [];
    for (const [x, y] of Board.coordsAround(hisQueen.x, hisQueen.y)) {
        const p = board.getInGamePiece(x, y);
        if (p) {
            piecesAroundHisQueen.push(p);
        }
    }

    const myPiecesAroundHisQueen = piecesAroundHisQueen.filter(p => p.color === color);

    const hisPiecesAroundHisQueen = piecesAroundHisQueen.filter(p => p.color !== color);

    const pillBugDefense = hisPiecesAroundHisQueen.find(p => p.type === PILL_BUG);
    const scorpionDefense = hisPiecesAroundHisQueen.find(p => p.type === SCORPION);

    let mosquitoPillBugDefense = false;
    if (board.standardRules) {
        const mosquito = hisPiecesAroundHisQueen.find(p => p.type === MOSQUITO && p.z === 0);
        mosquitoPillBugDefense = mosquito && Board.coordsAround(mosquito.x, mosquito.y).find(([x, y]) => {
            const p = board.getInGamePiece(x, y);
            return p && p.type === PILL_BUG;
        });
    }

    const pieceIdsAroundHisQueen = piecesAroundHisQueen.filter(p => p.z === 0).map(p => p.id);
    if (myPieceAboveHisQueen) {
        pieceIdsAroundHisQueen.push(myPieceAboveHisQueen.id);
    }

    const score1 = board.inGameTopPiecesByColor[color].reduce((qty, p) =>
        board.stillOneHiveAfterRemove(p) ? qty + 1 : qty
    , 0);
    const score100 =
        hisPiecesAroundHisQueen.length +
        (myPieceAboveHisQueen ? 2 : 0) +
        myPiecesAroundHisQueen.length * 2 +
        (pillBugDefense ? -1 : 0) +
        (scorpionDefense ? -1 : 0) +
        (mosquitoPillBugDefense ? -1 : 0) +
        (board.getColorPlaying() === color ? 1 : 0);

    return score100 * 100 + score1;
}

const PRIORITY = [
    QUEEN,
    PILL_BUG,
    ANT,
    DRAGONFLY,
    BEETLE,
    MOSQUITO,
    COCKROACH,
    LADYBUG,
    SCORPION,
    FLY,
    WASP,
    GRASSHOPPER,
    CENTIPEDE,
    MANTIS,
    SPIDER,
];