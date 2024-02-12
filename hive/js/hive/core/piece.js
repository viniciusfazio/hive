
import Board from "./board.js";

export default class Piece {
    // variable
    moveSteps = [];
    x;
    y;
    inGame;
    targets;
    targetsB;
    z;

    // constant
    color;
    type;
    number;
    subNumber;
    id;

    constructor(color, type, number, subNumber = 0, id = null) {
        this.color = color;
        this.type = type;
        this.number = number;
        this.subNumber = subNumber;
        if (id === null) {
            this.id = this.color.id + this.type.id + (this.number > 0 ? this.number : "")
                                                   + (this.subNumber > 0 ? "-" + this.subNumber : "");
            this.reset();
        } else {
            this.id = id;
        }
    }
    static clone(p) {
        const piece = new Piece(p.color, p.type, p.number, p.subNumber, p.id);
        [piece.x, piece.y, piece.z, piece.inGame] = [p.x, p.y, p.z, p.inGame];
        piece.targets = [];
        piece.targetsB = [];
        return piece;
    }
    insertTarget(x, y, z, moveSteps = []) {
        const piece = new Piece(this.color, this.type, this.number, this.targets.length + 1);
        piece.x = x;
        piece.y = y;
        piece.z = z;
        piece.moveSteps = [[this.x, this.y, this.z]].concat(moveSteps).concat([[x, y, z]]);
        piece.inGame = true;
        if (!this.targets.find(p => p.x === x && p.y === y)) {
            this.targets.push(piece);
        }
        return piece;
    }
    reset() {
        this.x = null;
        this.y = null;
        this.z = this.type.qty - Math.max(1, this.number);
        this.moveSteps = [[this.x, this.y, this.z]];
        this.inGame = false;
        this.targets = [];
        this.targetsB = [];
    }
    play(x, y, z, moveSteps = []) {
        if (moveSteps.length === 0) {
            moveSteps =  [[this.x, this.y, this.z], [x, y, z]];
        }
        this.x = x;
        this.y = y;
        this.z = z;
        this.moveSteps = moveSteps.map(xyz => [...xyz]);
        this.inGame = x !== null;
        this.targets = [];
        this.targetsB = [];
    }
    static parse(p, standardRules) {
        if (p.length < 2 || p.length > 3) {
            return null;
        }
        let color = null;
        let type = null;
        let number = 0;
        for (const key in PieceColor) {
            if (p[0] === PieceColor[key].id) {
                color = PieceColor[key];
            }
        }
        for (const key in PieceType) {
            if (p[1] === PieceType[key].id && (!standardRules || PieceType[key].standard)) {
                type = PieceType[key];
                if (type.qty === 1 && p.length === 3 || type.qty > 1 && p.length === 2) {
                    return null;
                }
                if (type.qty > 1) {
                    number = parseInt(p[2]);
                    if (number < 1 || number > type.qty) {
                        return null;
                    }
                }
            }
        }
        if (color === null || type === null) {
            return null;
        }
        return [color.id, type.id, number];
    }
}




export const PieceType = Object.freeze({
    queen: Object.freeze({
        id: "Q",
        id2: "q",
        qty: 1,
        linked: null,
        standard: true,
    }),
    beetle: Object.freeze({
        id: "B",
        id2: "b",
        qty: 2,
        linked: "mantis",
        standard: true,
    }),
    grasshopper: Object.freeze({
        id: "G",
        id2: "g",
        qty: 3,
        linked: "fly",
        standard: true,
    }),
    spider: Object.freeze({
        id: "S",
        id2: "s",
        qty: 2,
        linked: "scorpion",
        standard: true,
    }),
    ant: Object.freeze({
        id: "A",
        id2: "a",
        qty: 3,
        linked: "wasp",
        standard: true,
    }),
    ladybug: Object.freeze({
        id: "L",
        id2: "l",
        qty: 1,
        linked: "cockroach",
        standard: true,
    }),
    mosquito: Object.freeze({
        id: "M",
        id2: "m",
        qty: 1,
        linked: "dragonfly",
        standard: true,
    }),
    pillBug: Object.freeze({
        id: "P",
        id2: "p",
        qty: 1,
        linked: "centipede",
        standard: true,
    }),
    mantis: Object.freeze({
        id: "T",
        id2: "t",
        qty: 2,
        linked: "beetle",
        standard: false,
    }),
    fly: Object.freeze({
        id: "F",
        id2: "f",
        qty: 3,
        linked: "grasshopper",
        standard: false,
    }),
    scorpion: Object.freeze({
        id: "N",
        id2: "n",
        qty: 2,
        linked: "spider",
        standard: false,
    }),
    wasp: Object.freeze({
        id: "W",
        id2: "w",
        qty: 3,
        linked: "ant",
        standard: false,
    }),
    cockroach: Object.freeze({
        id: "R",
        id2: "r",
        qty: 1,
        linked: "ladybug",
        standard: false,
    }),
    dragonfly: Object.freeze({
        id: "D",
        id2: "d",
        qty: 1,
        linked: "mosquito",
        standard: false,
    }),
    centipede: Object.freeze({
        id: "C",
        id2: "c",
        qty: 1,
        linked: "pillBug",
        standard: false,
    }),
});
export function computePieceMoves(pieceType, board, piece, standard) {
    switch (pieceType) {
        case PieceType.queen.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            move1Around(board, piece);
            break;
        case PieceType.beetle.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            move1(board, piece);
            break;
        case PieceType.grasshopper.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            jumpOver(board, piece);
            break;
        case PieceType.spider.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            moveAround(board, piece, 3);
            if (!standard) {
                jumpOver(board, piece, 1);
            }
            break;
        case PieceType.ant.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            const otherColorId = piece.color.id === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id;
            moveAround(board, piece, null, standard ? null : otherColorId);
            break;
        case PieceType.ladybug.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            moveOver(board, piece, 3);
            break;
        case PieceType.mosquito.id:
            if (piece.z > 0) {
                if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                    return;
                }
                move1(board, piece);
            } else {
                Board.coordsAround(piece.x, piece.y).forEach(([x, y]) => {
                    const p = board.getInGamePiece(x, y);
                    if (p && p.type.id !== PieceType.mosquito.id) {
                        computePieceMoves(p.type.id, board, piece, standard);
                    }
                });
            }
            break;
        case PieceType.pillBug.id:
            if (board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                move1Around(board, piece);
            }
            // move preys
            if (standard || piece.type.id !== PieceType.mosquito.id) {
                let noPieces = [];
                let preys = [];
                board.coordsAroundWithNeighbor(piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                    const noPiece = z < 0;
                    const isPrey = z === 0;
                    const isMovableTarget = noPiece && Board.onHiveAndNoGate(piece.z + 1, z, z1, z2);
                    if (isMovableTarget) {
                        noPieces.push([x, y]);
                    } else if (isPrey && Board.onHiveAndNoGate(z, piece.z, z1, z2)) {
                        preys.push([x, y]);
                    }
                });
                preys.forEach(([x, y]) => {
                    const prey = board.getInGamePiece(x, y);
                    const canMove = standard
                        || ![PieceType.pillBug.id, PieceType.centipede.id, PieceType.scorpion.id].includes(prey.type.id);
                    const notLastMove = !board.lastMovedPiecesId.includes(prey.id);
                    if (canMove && notLastMove && board.stillOneHiveAfterRemoveOnXY(prey.x, prey.y)) {
                        noPieces.forEach(([tx, ty]) => {
                            prey.insertTarget(tx, ty, prey.z, [[piece.x, piece.y, piece.z + 1]]);
                        });
                    }
                });
            }
            break;
        case PieceType.mantis.id:
            if (piece.z > 0) {
                if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                    return;
                }
                move1(board, piece);
            } else if (piece.type.id !== PieceType.mosquito.id) {
                board.coordsAroundWithNeighbor(piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                    const hasSpace = z === 0 && (z1 < 0 || z2 < 0);
                    const prey = board.getInGamePiece(x, y);
                    const canEat = prey && prey.type.id !== PieceType.scorpion.id && !board.lastMovedPiecesId.includes(prey.id);
                    if (canEat && hasSpace && board.stillOneHiveAfterRemoveOnXY(prey.x, prey.y)) {
                        piece.insertTarget(x, y, z + 1);
                    }
                });
            }
            break;
        case PieceType.fly.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            if (move1Around(board, piece) === 0) {
                fly(board, piece);
            }
            break;
        case PieceType.scorpion.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            moveAround(board, piece, 3);
            break;
        case PieceType.wasp.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            fly(board, piece, piece.color.id === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id);
            break;
        case PieceType.cockroach.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            moveOver(board, piece, null, piece.color.id);
            break;
        case PieceType.dragonfly.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            let around = board.coordsAroundWithNeighbor(piece.x, piece.y);
            for (let i = 1; i <= 6; i++) {
                const [ix, iy, iz, iz1, iz2] = around[i % 6];
                const pBelow = board.getInGamePiece(ix, iy);
                if (pBelow && pBelow.type.id === PieceType.scorpion.id || !Board.onHiveAndNoGate(piece.z, iz, iz1, iz2)) {
                    continue;
                }
                const moveSteps = [[ix, iy, iz + 1]];
                const destiny = board.coordsAroundWithNeighbor(ix, iy);
                [destiny[i - 1], destiny[(i + 1) % 6]].forEach(([x, y, z, z1, z2]) => {
                    const target = board.getInGamePiece(x, y);
                    if (target && target.type.id === PieceType.scorpion.id || !Board.onHiveAndNoGate(iz + 1, z, z1, z2)) {
                        return;
                    }
                    const isFromGround = piece.z === 0;
                    const isToGround = z < 0;
                    if (isFromGround || !isToGround) {
                        piece.insertTarget(x, y, z + 1, moveSteps);
                    } else {
                        const prey = board.getInGamePiece(piece.x, piece.y, piece.z - 1);
                        const isPrey = prey && prey.type.id !== PieceType.dragonfly.id;
                        if (isPrey && board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y, 2)) {
                            piece.insertTarget(x, y, 0, moveSteps);
                        }
                    }
                });
            }
            break;
        case PieceType.centipede.id:
            if (!board.stillOneHiveAfterRemoveOnXY(piece.x, piece.y)) {
                return;
            }
            move1Around(board, piece);
            if (piece.type.id === PieceType.mosquito.id) {
                return;
            }
            board.coordsAroundWithNeighbor(piece.x, piece.y).filter(([, , z, z1, z2]) => z === 0 && (z1 < 0 || z2 < 0))
                .forEach(([x, y, , , ]) => {
                    const prey = board.getInGamePiece(x, y);
                    const lastMove = prey && !board.lastMovedPiecesId.includes(prey.id);
                    if (lastMove && ![PieceType.pillBug.id, PieceType.centipede.id, PieceType.scorpion.id].includes(prey.type.id)) {
                        if (![PieceType.pillBug.id, PieceType.centipede.id, PieceType.scorpion.id].includes(prey.type.id)) {
                            piece.insertTarget(x, y, piece.z + 1);
                        }
                    }
                });
            break;
    }

}
function move1Around(board, piece) {
    let qty = 0;
    board.coordsAroundWithNeighbor(piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
        const noPiece = z < 0;
        if (noPiece && Board.onHiveAndNoGate(piece.z, z, z1, z2)) {
            piece.insertTarget(x, y, piece.z);
            qty++;
        }
    });
    return qty;
}
function move1(board, piece) {
    board.coordsAroundWithNeighbor(piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
        const p = board.getInGamePiece(x, y);
        const canMoveOver = !p || p.type.id !== PieceType.scorpion.id;
        if (canMoveOver && Board.onHiveAndNoGate(piece.z, z, z1, z2)) {
            piece.insertTarget(x, y, z + 1);
        }
    });

}
function moveAround(board, piece, n = null, colorId = null) {
    let paths = [[[piece.x, piece.y, 0]]];
    while (paths.length > 0) {
        let newPaths = [];
        const visitedInThisStep = [];
        for (const path of paths) {
            const [fromX, fromY, fromZ] = path[path.length - 1];
            for (const [x, y, z, z1, z2] of board.coordsAroundWithNeighbor(fromX, fromY, piece.x, piece.y)) {
                // if path repeats, continue
                if (path.find(([cx, cy,]) => cx === x && cy === y) || visitedInThisStep.find(([cx, cy]) => cx === x && cy === y)) {
                    continue;
                }
                visitedInThisStep.push([x, y]);
                const noPiece = z < 0;
                if (noPiece && Board.onHiveAndNoGate(fromZ, z, z1, z2)) {
                    // new step with no repetition
                    if (n === null || path.length < n) {
                        let newPath = [...path];
                        newPath.push([x, y, 0]);
                        newPaths.push(newPath);
                    }
                    const validColor = colorId === null || Board.coordsAround(x, y).find(([ax, ay]) => {
                        const p = board.getInGamePiece(ax, ay);
                        return p && p.color.id === colorId;
                    });
                    const validMoveCount = n === null || path.length === n;
                    if (validColor && validMoveCount) {
                        let moveSteps = path.map(xyz => [...xyz]);
                        moveSteps.shift();
                        piece.insertTarget(x, y, 0, moveSteps);
                    }
                }
            }
        }
        paths = newPaths;
    }
}
function fly(board, piece, colorId = null) {
    const maxZ = board.inGameTopPieces.reduce((maxZ, p) => Math.max(maxZ, p.z), 0);
    board.piecePlacement(colorId, piece.x, piece.y).forEach(([x, y]) => {
        piece.insertTarget(x, y, 0, [[piece.x, piece.y, maxZ + 1]]);
    });
}
function moveOver(board, piece, n = null, colorId = null) {
    let paths = [[[piece.x, piece.y, piece.z]]];
    let visitedEver = [];
    while (paths.length > 0) {
        let newPaths = [];
        const visitedInThisStep = [];
        for (const path of paths) {
            const [fromX, fromY, fromZ] = path[path.length - 1];
            for (const [x, y, z, z1, z2] of board.coordsAroundWithNeighbor(fromX, fromY, piece.x, piece.y)) {
                // if path repeats, continue
                if (visitedEver.find(([cx, cy]) => cx === x && cy === y)) {
                    continue;
                } else if (path.find(([cx, cy, ]) => cx === x && cy === y) ||
                    visitedInThisStep.find(([cx, cy]) => cx === x && cy === y)) {
                    continue;
                }
                if (n !== null) {
                    visitedInThisStep.push([x, y]);
                }  else if (path.length > 1) {
                    visitedEver.push([x, y]);
                }
                const pBelow = board.getInGamePiece(x, y);
                const canGoUp = z >= 0 && pBelow && pBelow.type.id !== PieceType.scorpion.id &&
                    (colorId === null || pBelow.color.id === colorId);
                const canGoDown = z < 0 && path.length > 1 && (n === null || path.length === n);
                if ((canGoUp || canGoDown) && Board.onHiveAndNoGate(fromZ, z, z1, z2)) {
                    // new step with no repetition
                    if (canGoUp) {
                        let newPath = path.map(xyz => [...xyz]);
                        newPath.push([x, y, z + 1]);
                        newPaths.push(newPath);
                    } else {
                        let moveSteps = path.map(xyz => [...xyz]);
                        moveSteps.shift();
                        piece.insertTarget(x, y, piece.z, moveSteps);
                    }
                }
            }
        }
        paths = newPaths;
    }
}
function jumpOver(board, piece, n = null) {
    // look around
    Board.coordsAround(0, 0).forEach(([dx, dy]) => {
        let pBelow = board.getInGamePiece(piece.x + dx, piece.y + dy);
        let moveSteps = [];
        while (pBelow && pBelow.type.id !== PieceType.scorpion.id) {
            moveSteps.push([pBelow.x, pBelow.y, pBelow.z + 1]);
            const [tx, ty] = [pBelow.x + dx, pBelow.y + dy];
            pBelow = board.getInGamePiece(tx, ty);
            if (!pBelow) { // found a hole
                piece.insertTarget(tx, ty, 0, moveSteps);
                break;
            }
            if (n !== null && --n <= 0) {
                break;
            }
        }
    });
}
export const PieceColor = Object.freeze({
    white: Object.freeze({
        id: "w",
    }),
    black: Object.freeze({
        id: "b",
    }),
});
