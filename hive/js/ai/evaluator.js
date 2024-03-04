import Board from "../core/board.js";
import {BLACK, WHITE, MOSQUITO, PIECE_TXT, PILL_BUG, CENTIPEDE} from "../core/piece.js";

const BITS_PER_PARAM = 1;
const MAX_PARAM = (1 << BITS_PER_PARAM) - 1;

export default class Evaluator {
    #id;
    #idSplit;
    constructor(id) {
        this.#id = id;
        this.#idSplit = id.split("");
    }
    evaluate(board) {
        let evaluation = 0;
        for (const g of this.#idSplit) {
            switch (g) {
                case 'z':
                    evaluation <<= BITS_PER_PARAM;
                    evaluation += normalize(piecesInHud(board));
                    break;
                case 'Z':
                    evaluation <<= BITS_PER_PARAM;
                    evaluation += normalize(piecesInGamePlayable(board));
                    break;
                case 'x':
                    evaluation <<= BITS_PER_PARAM;
                    evaluation += normalize(myPiecesAroundHisQueen(board));
                    break;
                case 'X':
                    evaluation <<= BITS_PER_PARAM;
                    evaluation += normalize(piecesAroundHisQueen(board));
                    break;
                default:
                    const type = PIECE_TXT.findIndex(v => g === v[0]);
                    if (type > 0) {
                        evaluation <<= BITS_PER_PARAM;
                        evaluation += normalize(piecesInGamePlayable(board, type));
                        break;
                    }
                    const typeAround = PIECE_TXT.findIndex(v => g === v[1]);
                    if (typeAround > 0) {
                        evaluation <<= BITS_PER_PARAM;
                        evaluation += normalize(myPiecesAroundMyQueen(board, type));
                        break;
                    }
                    console.log("Invalid evaluator id: " + this.#id);
            }
        }
        return evaluation;
    }
    getEvaluationSignificance() {
        return 1 << Math.floor(BITS_PER_PARAM * this.#id.length / 2);
    }
}
function normalize(diff) {
    return diff > MAX_PARAM ? MAX_PARAM : (diff < -MAX_PARAM ? -MAX_PARAM : diff);
}
function piecesInHud(board) {
    return board.getPieces().reduce((s, p) => p.inGame ? s : (p.color === WHITE ? s + 1 : s - 1), 0);
}
function piecesInGamePlayable(board, type = 0) {
    const pieces = type === 0 ?
        board.getInGameTopPieces() :
        (board.getPiecesByType(type).filter(p => p.inGame && (board.getPieceEncoded(p.x, p.y) & 0xff) === p.z + 1));
    return pieces.reduce((s, p) => {
        if (board.stillOneHiveAfterRemove(p)) {
            return p.color === WHITE ? s + 1 : s - 1;
        }
        const tryPillBug = p.type === PILL_BUG ||
                           board.standardRules && p.type === MOSQUITO &&
                           Board.coordsAround(p.x, p.y).find(([x, y]) =>
                           ((board.getPieceEncoded(x, y) >> 16) & 0xff) === PILL_BUG);
        if (tryPillBug) {
            let emptyMovableSpaces = board.coordsAroundWithNeighbor(p.x, p.y).find(([, , z, z1, z2]) =>
                z < 0 && Board.onHiveAndNoGate(p.z + 1, z, z1, z2)
            );
            if (emptyMovableSpaces) {
                const canMove = board.coordsAroundWithNeighbor(p.x, p.y).find(
                    ([x, y, z, z1, z2]) => z === 0 &&
                        (board.standardRules || ![PILL_BUG, CENTIPEDE].includes((board.getPieceEncoded(x, y) >> 16) & 0xff)) &&
                        Board.onHiveAndNoGate(z, p.z, z1, z2) &&
                        board.stillOneHiveAfterRemove(board.getInGamePiece(x, y)));
                if (canMove) {
                    return p.color === WHITE ? s + 1 : s - 1;
                }
            }
        }
        return s;
    }, 0);
}
function myPiecesAroundHisQueen(board) {
    return board.getQueens().reduce((s, q) => {
        if (!q.inGame) {
            return s;
        }
        const inc = q.color === BLACK ? 1 : -1;
        const myColor = q.color === BLACK ? WHITE : BLACK;
        return Board.coordsAround(q.x, q.y).reduce((s2, [x, y]) =>
            ((board.getPieceEncoded(x, y) >> 8) & 0xff) === myColor ? s2 + inc : s2, s);
    }, 0);
}
function myPiecesAroundMyQueen(board, type) {
    return board.getQueens().reduce((s, q) => {
        if (!q.inGame) {
            return s;
        }
        const inc = q.color === WHITE ? 1 : -1;
        const typeColor = (type << 8) | q.color;
        return Board.coordsAround(q.x, q.y).reduce((s2, [x, y]) =>
            ((board.getPieceEncoded(x, y) >> 8) & 0xffff) === typeColor ? s2 + inc : s2, s);
    }, 0);
}
function piecesAroundHisQueen(board) {
    return board.getQueens().reduce((s, q) => {
        if (!q.inGame) {
            return s;
        }
        const inc = q.color === BLACK ? 1 : -1;
        return Board.coordsAround(q.x, q.y).reduce((s2, [x, y]) => board.getPieceEncoded(x, y) !== 0 ? s2 + inc : s2, s);
    }, 0);
}

