
import Board from "./board.js";

export const WHITE = 1;
export const BLACK = 2;

export const COLORS = [WHITE, BLACK];

export const COLOR_TXT = [null];
COLOR_TXT[WHITE] = 'w';
COLOR_TXT[BLACK] = 'b';


export const QUEEN = 1;
export const BEETLE = 2;
export const GRASSHOPPER = 3;
export const SPIDER = 4;
export const ANT = 5;
export const LADYBUG = 6;
export const MOSQUITO = 7;
export const PILL_BUG = 8;
export const MANTIS = 9;
export const FLY = 10;
export const SCORPION = 11;
export const WASP = 12;
export const COCKROACH = 13;
export const DRAGONFLY = 14;
export const CENTIPEDE = 15;

export const PIECES = new Uint32Array([
    QUEEN,
    BEETLE, GRASSHOPPER,   SPIDER,  ANT,   LADYBUG,  MOSQUITO,  PILL_BUG,
    MANTIS,         FLY, SCORPION, WASP, COCKROACH, DRAGONFLY, CENTIPEDE,
]);

const MAX_PIECE_TYPE_ID = PIECES.length;

export const PIECE_STANDARD = new Uint32Array(MAX_PIECE_TYPE_ID + 1);
PIECE_STANDARD[QUEEN] = 1;
PIECE_STANDARD[BEETLE] = 1;
PIECE_STANDARD[GRASSHOPPER] = 1;
PIECE_STANDARD[SPIDER] = 1;
PIECE_STANDARD[ANT] = 1;
PIECE_STANDARD[LADYBUG] = 1;
PIECE_STANDARD[MOSQUITO] = 1;
PIECE_STANDARD[PILL_BUG] = 1;

export const PIECE_LINK = new Uint32Array(MAX_PIECE_TYPE_ID + 1);
PIECE_LINK[BEETLE] = MANTIS;
PIECE_LINK[GRASSHOPPER] = FLY;
PIECE_LINK[SPIDER] = SCORPION;
PIECE_LINK[ANT] = WASP;
PIECE_LINK[LADYBUG] = COCKROACH;
PIECE_LINK[MOSQUITO] = DRAGONFLY;
PIECE_LINK[PILL_BUG] = CENTIPEDE;
PIECE_LINK[MANTIS] = BEETLE;
PIECE_LINK[FLY] = GRASSHOPPER;
PIECE_LINK[SCORPION] = SPIDER;
PIECE_LINK[WASP] = ANT;
PIECE_LINK[COCKROACH] = LADYBUG;
PIECE_LINK[DRAGONFLY] = MOSQUITO;
PIECE_LINK[CENTIPEDE] = PILL_BUG;

export const PIECE_QTY = new Uint32Array(MAX_PIECE_TYPE_ID + 1);
PIECE_QTY[QUEEN] = 1;
PIECE_QTY[BEETLE] = 2;
PIECE_QTY[GRASSHOPPER] = 3;
PIECE_QTY[SPIDER] = 2;
PIECE_QTY[ANT] = 3;
PIECE_QTY[LADYBUG] = 1;
PIECE_QTY[MOSQUITO] = 1;
PIECE_QTY[PILL_BUG] = 1;
PIECE_QTY[MANTIS] = 2;
PIECE_QTY[FLY] = 3;
PIECE_QTY[SCORPION] = 2;
PIECE_QTY[WASP] = 3;
PIECE_QTY[COCKROACH] = 1;
PIECE_QTY[DRAGONFLY] = 1;
PIECE_QTY[CENTIPEDE] = 1;

export const MAX_PIECE_QTY = Math.max.apply(null, PIECE_QTY);

export const PIECE_TXT = [".."];
PIECE_TXT[QUEEN] = "Qq";
PIECE_TXT[BEETLE] = "Bb";
PIECE_TXT[GRASSHOPPER] = "Gg";
PIECE_TXT[SPIDER] = "Ss";
PIECE_TXT[ANT] = "Aa";
PIECE_TXT[LADYBUG] = "Ll";
PIECE_TXT[MOSQUITO] = "Mm";
PIECE_TXT[PILL_BUG] = "Pp";
PIECE_TXT[MANTIS] = "Tt";
PIECE_TXT[FLY] = "Ff";
PIECE_TXT[SCORPION] = "Nn";
PIECE_TXT[WASP] = "Ww";
PIECE_TXT[COCKROACH] = "Rr";
PIECE_TXT[DRAGONFLY] = "Dd";
PIECE_TXT[CENTIPEDE] = "Cc";

export default class Piece {
    // essential
    x;
    y;
    inGame;
    z;

    // for animation
    #moveSteps = [];

    // pos move calc
    #targets = [];

    // constant
    color;
    type;
    number;
    subNumber;
    id;
    txt;

    constructor(color, type, number, subNumber = 0, id = null, txt = null) {
        this.color = color;
        this.type = type;
        this.number = number;
        this.subNumber = subNumber;
        if (id === null || txt === null) {
            if (this.subNumber === 0) {
                this.txt = COLOR_TXT[this.color];
                this.txt += PIECE_TXT[this.type][0];
                if (this.number > 0) {
                    this.txt += this.number;
                }
                /*
            } else {
                this.txt = COLOR_TXT[this.color];
                this.txt += PIECE_TXT[this.type][0];
                if (this.number > 0) {
                    this.txt += this.number;
                }
                this.txt += "-" + this.subNumber;
                 */
            }
            this.id = this.subNumber;
            this.id *= COLORS.length + 1;
            this.id |= this.color;
            this.id *= MAX_PIECE_TYPE_ID + 1;
            this.id |= this.type;
            this.id *= MAX_PIECE_QTY + 1;
            this.id |= this.number;
            this.reset();
        } else {
            this.id = id;
            this.txt = txt;
        }
    }
    static clone(p) {
        const piece = new Piece(p.color, p.type, p.number, p.subNumber, p.id, p.txt);
        [piece.x, piece.y, piece.z, piece.inGame] = [p.x, p.y, p.z, p.inGame];
        return piece;
    }
    getTargets() {
        return this.#targets;
    }
    getMoveSteps() {
        return this.#moveSteps;
    }
    insertTarget(x, y, z, moveSteps = []) {
        const piece = new Piece(this.color, this.type, this.number, this.#targets.length + 1);
        piece.x = x;
        piece.y = y;
        piece.z = z;
        piece.#moveSteps = [[this.x, this.y, this.z], ...moveSteps, [x, y, z]];
        piece.inGame = true;
        if (!this.#targets.find(p => p.x === x && p.y === y)) {
            this.#targets.push(piece);
        }
        return piece;
    }
    resetTargets() {
        this.#targets = [];
    }
    reset() {
        this.x = null;
        this.y = null;
        this.z = PIECE_QTY[this.type] - Math.max(1, this.number);
        this.#moveSteps = [[this.x, this.y, this.z]];
        this.inGame = false;
        this.#targets = [];
    }
    play(x, y, z, moveSteps = []) {
        if (moveSteps.length === 0) {
            moveSteps =  [[this.x, this.y, this.z], [x, y, z]];
        }
        this.x = x;
        this.y = y;
        this.z = z;
        this.#moveSteps = moveSteps.map(xyz => [...xyz]);
        this.inGame = x !== null;
        this.#targets = [];
    }
}

export function getMaxZ() {
    return (PIECE_QTY[BEETLE] + PIECE_QTY[MOSQUITO]) << 1;
}

export function computePieceMoves(pieceType, board, piece, standard) {
    if (pieceType !== PILL_BUG && (!standard || pieceType !== MOSQUITO) && board.lastMovedPiecesId.includes(piece.id)) {
        return 0;
    }
    switch (pieceType) {
        case QUEEN:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            return move1Around(board, piece);
        case BEETLE:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            return move1(board, piece);
        case GRASSHOPPER:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            return jumpOver(board, piece);
        case SPIDER:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            return moveAround(board, piece, 3) + (standard ? 0 : jumpOver(board, piece, 1));
        case ANT:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            const otherColor = piece.color === WHITE ? BLACK : WHITE;
            return moveAround(board, piece, null, standard ? null : otherColor);
        case LADYBUG:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            return moveOver(board, piece, 3);
        case MOSQUITO:
            if (piece.z > 0) {
                if (!board.lastMovedPiecesId.includes(piece.id) && !board.stillOneHiveAfterRemove(piece)) {
                    return 0;
                }
                return move1(board, piece);
            } else {
                return Board.coordsAround(piece.x, piece.y).reduce((s, [x, y]) => {
                    const p = board.getPieceEncoded(x, y);
                    if (p !== 0 && ((p >> 16) & 0xff) !== MOSQUITO) {
                        return s + computePieceMoves((p >> 16) & 0xff, board, piece, standard);
                    }
                    return s;
                }, 0);
            }
        case PILL_BUG:
            let qtyPillBug = 0;
            if (!board.lastMovedPiecesId.includes(piece.id) && board.stillOneHiveAfterRemove(piece)) {
                qtyPillBug = move1Around(board, piece);
            }
            // move preys
            if (standard || piece.type !== MOSQUITO) {
                let noPieces = [];
                let preys = [];
                for (const [x, y, z, z1, z2] of board.coordsAroundWithNeighbor(piece.x, piece.y)) {
                    const noPiece = z < 0;
                    const isPrey = z === 0;
                    const isMovableTarget = noPiece && Board.onHiveAndNoGate(piece.z + 1, z, z1, z2);
                    if (isMovableTarget) {
                        noPieces.push([x, y]);
                    } else if (isPrey && Board.onHiveAndNoGate(z, piece.z, z1, z2)) {
                        preys.push([x, y]);
                    }
                }
                for (const [x, y] of preys) {
                    const prey = board.getInGamePiece(x, y);
                    const canMove = standard || ![PILL_BUG, CENTIPEDE, SCORPION].includes(prey.type);
                    if (canMove && !board.lastMovedPiecesId.includes(prey.id) && board.stillOneHiveAfterRemove(prey)) {
                        noPieces.forEach(([tx, ty]) => {
                            prey.insertTarget(tx, ty, prey.z, [[piece.x, piece.y, piece.z + 1]]);
                            qtyPillBug++;
                        });
                    }
                }
            }
            return qtyPillBug;
        case MANTIS:
            if (piece.z > 0) {
                if (!board.stillOneHiveAfterRemove(piece)) {
                    return 0;
                }
                return move1(board, piece);
            } else if (piece.type !== MOSQUITO) {
                return board.coordsAroundWithNeighbor(piece.x, piece.y).reduce((s, [x, y, z, z1, z2]) => {
                    const hasSpace = z === 0 && (z1 < 0 || z2 < 0);
                    const prey = board.getInGamePiece(x, y);
                    const canEat = prey && prey.type !== SCORPION && !board.lastMovedPiecesId.includes(prey.id);
                    if (canEat && hasSpace && board.stillOneHiveAfterRemove(prey)) {
                        piece.insertTarget(x, y, z + 1);
                        return s + 1;
                    }
                    return s;
                }, 0);
            }
            break;
        case FLY:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            let qtyFly = move1Around(board, piece);
            return qtyFly === 0 ? fly(board, piece) : qtyFly;
        case SCORPION:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            return moveAround(board, piece, 3);
        case WASP:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            return fly(board, piece, piece.color === WHITE ? BLACK : WHITE);
        case COCKROACH:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            return moveOver(board, piece, null, piece.color);
        case DRAGONFLY:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            let around = board.coordsAroundWithNeighbor(piece.x, piece.y);
            let qtyDragonfly = 0;
            for (let i = 1; i <= 6; i++) {
                const [ix, iy, iz, iz1, iz2] = around[i % 6];
                const isScorpion = ((board.getPieceEncoded(ix, iy) >> 16) & 0xff) === SCORPION;
                if (isScorpion || !Board.onHiveAndNoGate(piece.z, iz, iz1, iz2)) {
                    continue;
                }
                const moveSteps = [[ix, iy, iz + 1]];
                const destiny = board.coordsAroundWithNeighbor(ix, iy);
                for (const [x, y, z, z1, z2] of [destiny[i - 1], destiny[(i + 1) % 6]]) {
                    const isScorpion = ((board.getPieceEncoded(x, y) >> 16) & 0xff) === SCORPION;
                    if (isScorpion || !Board.onHiveAndNoGate(iz + 1, z, z1, z2)) {
                        continue;
                    }
                    const isFromGround = piece.z === 0;
                    const isToGround = z < 0;
                    if (isFromGround || !isToGround) {
                        piece.insertTarget(x, y, z + 1, moveSteps);
                        qtyDragonfly++;
                    } else {
                        const prey = board.getInGamePieceWithZ(piece.x, piece.y, piece.z - 1);
                        const isPrey = prey && prey.type !== DRAGONFLY;
                        if (isPrey && board.stillOneHiveAfterRemove(piece, 2)) {
                            piece.insertTarget(x, y, 0, moveSteps);
                            qtyDragonfly++;
                        }
                    }
                }
            }
            return qtyDragonfly;
        case CENTIPEDE:
            if (!board.stillOneHiveAfterRemove(piece)) {
                return 0;
            }
            let qtyCentipede = move1Around(board, piece);
            if (piece.type === MOSQUITO) {
                return qtyCentipede;
            }
            return board.coordsAroundWithNeighbor(piece.x, piece.y).filter(([, , z, z1, z2]) => z === 0 && (z1 < 0 || z2 < 0))
                .reduce((s, [x, y, , , ]) => {
                    const prey = board.getInGamePiece(x, y);
                    const lastMove = prey && !board.lastMovedPiecesId.includes(prey.id);
                    if (lastMove && ![PILL_BUG, CENTIPEDE, SCORPION].includes(prey.type)) {
                        piece.insertTarget(x, y, piece.z + 1);
                        return s + 1;
                    }
                    return s;
                }, qtyCentipede);
    }
    return 0;
}
function move1Around(board, piece) {
    let qty = 0;
    for (const [x, y, z, z1, z2] of board.coordsAroundWithNeighbor(piece.x, piece.y)) {
        const noPiece = z < 0;
        if (noPiece && Board.onHiveAndNoGate(piece.z, z, z1, z2)) {
            piece.insertTarget(x, y, piece.z);
            qty++;
        }
    }
    return qty;
}
function move1(board, piece) {
    let qty = 0;
    for (const [x, y, z, z1, z2] of board.coordsAroundWithNeighbor(piece.x, piece.y)) {
        const canMoveOver = ((board.getPieceEncoded(x, y) >> 16) & 0xff) !== SCORPION;
        if (canMoveOver && Board.onHiveAndNoGate(piece.z, z, z1, z2)) {
            piece.insertTarget(x, y, z + 1);
            qty++;
        }
    }
    return qty;
}
function moveAround(board, piece, n = null, color = null) {
    let qty = 0;
    let paths = [[[piece.x, piece.y, 0]]];
    while (paths.length > 0) {
        let newPaths = [];
        const visitedInThisStep = [];
        for (const path of paths) {
            const [fromX, fromY, fromZ] = path[path.length - 1];
            for (const [x, y, z, z1, z2] of board.coordsAroundWithNeighbor(fromX, fromY, piece.x, piece.y)) {
                // if path repeats, continue
                const xy = board.coordsToXY(x, y);
                if (visitedInThisStep.includes(xy) || path.find(([cx, cy,]) => cx === x && cy === y)) {
                    continue;
                }
                const noPiece = z < 0;
                if (noPiece && Board.onHiveAndNoGate(fromZ, z, z1, z2)) {
                    visitedInThisStep.push(xy);
                    // new step with no repetition
                    if (n === null || path.length < n) {
                        let newPath = [...path];
                        newPath.push([x, y, 0]);
                        newPaths.push(newPath);
                    }
                    const validColor = color === null || Board.coordsAround(x, y).find(([ax, ay]) =>
                        color === ((board.getPieceEncoded(ax, ay) >> 8) & 0xff)
                    );
                    const validMoveCount = n === null || path.length === n;
                    if (validColor && validMoveCount) {
                        let moveSteps = path.map(xyz => [...xyz]);
                        moveSteps.shift();
                        piece.insertTarget(x, y, 0, moveSteps);
                        qty++;
                    }
                }
            }
        }
        paths = newPaths;
    }
    return qty;
}
function fly(board, piece, color = null) {
    let qty = 0;
    for (const [x, y] of board.piecePlacement(color, piece.x, piece.y)) {
        piece.insertTarget(x, y, 0, [[piece.x, piece.y, getMaxZ() + 1]]);
        qty++;
    }
    return qty;
}
function moveOver(board, piece, n = null, color = null) {
    let qty = 0;
    let paths = [[[piece.x, piece.y, piece.z]]];
    let visitedEver = [];
    while (paths.length > 0) {
        let newPaths = [];
        const visitedInThisStep = [];
        for (const path of paths) {
            const [fromX, fromY, fromZ] = path[path.length - 1];
            for (const [x, y, z, z1, z2] of board.coordsAroundWithNeighbor(fromX, fromY, piece.x, piece.y)) {
                // if path repeats, continue
                const xy = board.coordsToXY(x, y);
                if (visitedEver.includes(xy) ||
                    visitedInThisStep.includes(xy) ||
                    path.find(([cx, cy, ]) => cx === x && cy === y)) {
                    continue;
                }
                const pBelow = board.getPieceEncoded(x, y);
                const canGoUp = z >= 0 && ((pBelow >> 16) & 0xff) !== SCORPION &&
                    (color === null || ((pBelow >> 8) & 0xff) === color);
                const canGoDown = z < 0 && path.length > 1 && (n === null || path.length === n);
                if ((canGoUp || canGoDown) && Board.onHiveAndNoGate(fromZ, z, z1, z2)) {
                    if (n !== null) {
                        visitedInThisStep.push(xy);
                    }  else if (path.length > 1) {
                        visitedEver.push(xy);
                    }
                    // new step with no repetition
                    if (canGoUp) {
                        let newPath = path.map(xyz => [...xyz]);
                        newPath.push([x, y, z + 1]);
                        newPaths.push(newPath);
                    } else {
                        let moveSteps = path.map(xyz => [...xyz]);
                        moveSteps.shift();
                        piece.insertTarget(x, y, piece.z, moveSteps);
                        qty++;
                    }
                }
            }
        }
        paths = newPaths;
    }
    return qty;
}
function jumpOver(board, piece, n = null) {
    let qty = 0;
    // look around
    for (const [dx, dy] of Board.coordsAround(0, 0)) {
        let x = piece.x + dx;
        let y = piece.y + dy;
        let pBelow = board.getPieceEncoded(x, y);
        let moveSteps = [];
        while (pBelow !== 0 && ((pBelow >> 16) & 0xff) !== SCORPION) {
            moveSteps.push([x, y, pBelow & 0xff]);
            x += dx;
            y += dy;
            pBelow = board.getPieceEncoded(x, y);
            if (pBelow === 0) { // found a hole
                piece.insertTarget(x, y, 0, moveSteps);
                qty++;
                break;
            }
            if (n !== null && --n <= 0) {
                break;
            }
        }
    }
    return qty;
}

