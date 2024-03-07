import Board from "../core/board.js";
import {BLACK, WHITE, MOSQUITO, PIECE_TXT, PILL_BUG, CENTIPEDE} from "../core/piece.js";


export default class Evaluator {
    #id;
    #priority;
    #maxParam;
    #bitsPerParam;
    constructor(id) {
        this.#id = id;
        [this.#priority, this.#maxParam, this.#bitsPerParam] = extractEvaluatorId(id);
    }

    evaluate(board) {
        const bits = this.#bitsPerParam;
        let evaluation = 0;
        for (const g of this.#priority) {
            switch (g) {
                case 'z':
                    evaluation <<= bits;
                    evaluation += this.#normalize(piecesInHud(board));
                    break;
                case 'Z':
                    evaluation <<= bits;
                    evaluation += this.#normalize(piecesInGamePlayable(board));
                    break;
                case 'x':
                    evaluation <<= bits;
                    evaluation += this.#normalize(myPiecesAroundHisQueen(board));
                    break;
                case 'X':
                    evaluation <<= bits;
                    evaluation += this.#normalize(piecesAroundHisQueen(board));
                    break;
                default:
                    const type = PIECE_TXT.findIndex(v => g === v[0]);
                    if (type > 0) {
                        evaluation <<= bits;
                        evaluation += this.#normalize(piecesInGamePlayable(board, type));
                        break;
                    }
                    const typeAround = PIECE_TXT.findIndex(v => g === v[1]);
                    if (typeAround > 0) {
                        evaluation <<= bits;
                        evaluation += this.#normalize(myPiecesAroundMyQueen(board, type));
                        break;
                    }
                    console.log("Invalid evaluator id: " + this.#id);
            }
        }
        return evaluation;
    }
    getEvaluationSignificance() {
        return 1 << Math.floor(this.#bitsPerParam * this.#id.length / 2);
    }
    #normalize(diff) {
        return diff > this.#maxParam ? this.#maxParam : (diff < -this.#maxParam ? -this.#maxParam : diff);
    }
}
export function extractEvaluatorId(id) {
    const priority = id.split("");
    const maxParam = parseInt(priority.shift());
    const bitsPerParam = Math.floor(Math.log2(maxParam)) + 1;
    return [priority, maxParam, bitsPerParam];
}
export function packEvaluatorId(priority, maxParam) {
    const bitsPerParam = Math.floor(Math.log2(maxParam)) + 1;
    if (bitsPerParam * priority.length > 28) {
        return null;
    }
    return maxParam + priority.join("");
}
function piecesInHud(board) {
    return board.getInHudPieces().reduce((s, p) => p.color === WHITE ? s + 1 : s - 1, 0);
}
function piecesInGamePlayable(board, type = 0) {
    const pieces = type === 0 ?
        board.getInGameTopPieces() :
        (board.getInGamePiecesByType(type).filter(p => (board.getPieceEncoded(p.x, p.y) & 0xff) === p.z + 1));
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

