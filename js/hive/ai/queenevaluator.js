import Board from "../core/board.js";
import {PieceType} from "../core/piece.js";
import {PieceColor} from "../../../hive.js";


export default class QueenEvaluator {
    evaluate(board) {
        board.computeLegalMoves(true, true);
        return queenEval(board, PieceColor.White) - queenEval(board, PieceColor.Black);
    }
    getSortedMoves(board) {
        const moves = board.getMoves();
        const color = board.getColorPlaying();
        const queen = board.queens.find(p => p.inGame && p.color !== color);
        const queenZone = queen ? Board.coordsAround(queen.x, queen.y, true) : [];
        const enemyZone = [];
        board.inGameTopPieces.forEach(p => {
            if (p.color !== color) {
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
    const freeSpacesAroundHisQueen = [];
    Board.coordsAround(hisQueen.x, hisQueen.y).forEach(([x, y]) => {
        const p = board.getInGamePiece(x, y);
        if (p) {
            piecesAroundHisQueen.push(p);
        } else {
            freeSpacesAroundHisQueen.push([x, y]);
        }
    });


    const myPiecesAroundHisQueen = piecesAroundHisQueen.filter(p => p.color === color);

    const hisPiecesAroundHisQueen = piecesAroundHisQueen.filter(p => p.color !== color);

    const pillBugDefense = hisPiecesAroundHisQueen.find(p => p.type.id === PieceType.pillBug.id);
    const scorpionDefense = hisPiecesAroundHisQueen.find(p => p.type.id === PieceType.scorpion.id);

    let mosquitoPillBugDefense = false;
    if (board.standardRules) {
        const mosquito = hisPiecesAroundHisQueen.find(p => p.type.id === PieceType.mosquito.id && p.z === 0);
        mosquitoPillBugDefense = mosquito && Board.coordsAround(mosquito.x, mosquito.y).find(([x, y]) => {
            const p = board.getInGamePiece(x, y);
            return p && p.type.id === PieceType.pillBug.id;
        });
    }


    const pieceIdsAroundHisQueen = piecesAroundHisQueen.filter(p => p.z === 0).map(p => p.id);
    if (myPieceAboveHisQueen) {
        pieceIdsAroundHisQueen.push(myPieceAboveHisQueen.id);
    } else {
        freeSpacesAroundHisQueen.push([hisQueen.x, hisQueen.y]);
    }

    const colorIsPlaying = board.getColorPlaying() === color;
    const freeSpaceAroundHisQueenBeingAttacked = colorIsPlaying ?
        freeSpacesAroundHisQueen.reduce((qty, [x, y]) =>
            board.pieces.find(p => !pieceIdsAroundHisQueen.includes(p.id) &&
                p.targets.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0) :
        freeSpacesAroundHisQueen.reduce((qty, [x, y]) =>
            board.pieces.find(p => !pieceIdsAroundHisQueen.includes(p.id) &&
                p.targetsB.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0);

    const qtyPiecesAttackingFreeSpaceAroundHisQueen = colorIsPlaying ?
        board.pieces.reduce((qty, p) => !pieceIdsAroundHisQueen.includes(p.id) && p.targets.length > 0 &&
            freeSpacesAroundHisQueen.find(([x, y]) => p.targets.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0) :
        board.pieces.reduce((qty, p) => !pieceIdsAroundHisQueen.includes(p.id) && p.targetsB.length > 0 &&
            freeSpacesAroundHisQueen.find(([x, y]) => p.targetsB.find(t => t.x === x && t.y === y)) ? qty + 1 : qty, 0);

    const qtyPieceMovable = colorIsPlaying ?
        board.pieces.reduce((qty, p) => p.targets.length > 0 ? qty + 1 : qty, 0) :
        board.pieces.reduce((qty, p) => p.targetsB.length > 0 ? qty + 1 : qty, 0);
    return  qtyPieceMovable +
        1000 * (hisPiecesAroundHisQueen.length +
        myPieceAboveHisQueen * 2 +
        myPiecesAroundHisQueen.length * 2 +
        (pillBugDefense ? -1 : 0) +
        (scorpionDefense ? -1 : 0) +
        (mosquitoPillBugDefense ? -1 : 0) +
        Math.min(freeSpaceAroundHisQueenBeingAttacked, qtyPiecesAttackingFreeSpaceAroundHisQueen) +
        (colorIsPlaying ? 1 : 0));
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