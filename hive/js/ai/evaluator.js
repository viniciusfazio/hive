import Board from "../core/board.js";
import {BLACK, WHITE, MOSQUITO, PIECE_TXT, PILL_BUG} from "../core/piece.js";

export default class Evaluator {
    #id;
    constructor(id) {
        this.#id = id;
    }
    evaluate(board) {
        let evaluation = 0;
        for (const g of this.#id.split("")) {
            switch (g) {
                case "z":
                    evaluation <<= 1;
                    evaluation += normalize(piecesInHud(board, WHITE) - piecesInHud(board, BLACK));
                    break;
                case "Z":
                    evaluation <<= 1;
                    evaluation += normalize(piecesInGamePlayable(board, WHITE) - piecesInGamePlayable(board, BLACK));
                    break;
                case "x":
                    evaluation <<= 1;
                    evaluation += normalize(myPiecesAroundHisQueen(board, WHITE) - myPiecesAroundHisQueen(board, BLACK));
                    break;
                case "X":
                    evaluation <<= 1;
                    evaluation += normalize(piecesAroundHisQueen(board, WHITE) - piecesAroundHisQueen(board, BLACK));
                    break;
                default:
                    const type = PIECE_TXT.findIndex(v => g === v[0]);
                    if (type > 0) {
                        evaluation <<= 1;
                        evaluation += normalize(piecesInGamePlayable(board, WHITE, type) - piecesInGamePlayable(board, BLACK, type));
                        break;
                    }
                    const typeAround = PIECE_TXT.findIndex(v => v.length === 2 && g === v[1]);
                    if (typeAround > 0) {
                        evaluation <<= 1;
                        evaluation += normalize(myPiecesAroundMyQueen(board, WHITE, type) - myPiecesAroundMyQueen(board, BLACK, type));
                        break;
                    }
                    console.log("Invalid evaluator id: " + this.#id);
            }
        }
        return evaluation; // evalColor(board, WHITE) - evalColor(board, BLACK);
    }
    getEvaluationSignificance() {
        return 1 << Math.floor(this.#id.length / 2);
    }
}
function normalize(diff) {
    return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
}
function piecesInHud(board, color) {
    return board.pieces.reduce((s, p) => !p.inGame && p.color === color ? s + 1 : s, 0);
}
function piecesInGamePlayable(board, color, type = 0) {
    return board.inGameTopPiecesByColor[color].reduce((s, p) => {
        if ((type === 0 || type === p.type) && board.stillOneHiveAfterRemove(p)) {
            return s + 1;
        }
        const tryPillBug = (type === 0 || p.type === type) && (
                p.type === PILL_BUG ||
                board.standardRules && p.type === MOSQUITO &&
                Board.coordsAround(p.x, p.y).find(([x, y]) =>
                    ((board.getPieceEncoded(x, y) >> 16) & 0xff) === PILL_BUG)
            );
        if (tryPillBug) {
            let emptyMovableSpaces = board.coordsAroundWithNeighbor(p.x, p.y).find(([, , z, z1, z2]) =>
                z < 0 && Board.onHiveAndNoGate(p.z + 1, z, z1, z2)
            );
            if (emptyMovableSpaces) {
                const canMove = board.coordsAroundWithNeighbor(p.x, p.y).find(
                    ([x, y, z, z1, z2]) => z >= 0 && Board.onHiveAndNoGate(z, p.z + 1, z1, z2) &&
                                                     board.stillOneHiveAfterRemove(board.getInGamePiece(x, y)));
                return canMove ? s + 1 : s;
            }
        }
        return s;
    }, 0);
}
function myPiecesAroundHisQueen(board, color) {
    const queen = board.queens.find(q => q.color !== color && q.inGame);
    if (!queen) {
        return 0;
    }
    return (board.getColorPlaying() === color ? 1 : 0) +
        Board.coordsAround(queen.x, queen.y).reduce((s, [x, y]) =>
            ((board.getPieceEncoded(x, y) >> 8) & 0xff) === color ? s + 1 : s, 0);
}
function myPiecesAroundMyQueen(board, color, type) {
    const queen = board.queens.find(q => q.color === color && q.inGame);
    if (!queen) {
        return 0;
    }
    return Board.coordsAround(queen.x, queen.y).reduce((s, [x, y]) => {
            const p = board.getPieceEncoded(x, y);
            return ((p >> 16) & 0xff) === type && ((p >> 8) & 0xff) === color ? s + 1 : s;
        }, 0);
}
function piecesAroundHisQueen(board, color) {
    const queen = board.queens.find(q => q.color !== color && q.inGame);
    if (!queen) {
        return 0;
    }
    return (board.getColorPlaying() === color ? 1 : 0) +
        Board.coordsAround(queen.x, queen.y).reduce((s, [x, y]) => board.getPieceEncoded(x, y) > 0 ? s + 1 : s, 0);
}

