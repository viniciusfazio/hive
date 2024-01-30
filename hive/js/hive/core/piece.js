
// noinspection JSUnusedLocalSymbols

import Board from "./board.js";

export default class Piece {
    // variable
    moveSteps;
    x;
    y;
    inGame;
    targets;
    z;

    // constant
    color;
    type;
    number;
    subNumber;
    id;

    constructor(color, type, number, subNumber = 0) {
        this.color = color;
        this.type = type;
        this.number = number;
        this.subNumber = subNumber;
        this.id = this.color.id + this.type.id + (this.number > 0 ? this.number : "")
                                               + (this.subNumber > 0 ? "-" + this.subNumber : "");
        this.reset();
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

function coordsAroundWithNeighbor(board, cx, cy, ignoreX = null, ignoreY = null) {
    let xyz = Board.coordsAround(cx, cy).map(([x, y]) => {
        // get all pieces around
        const piece = board.inGameTopPieces.find(p => p.x === x && p.y === y);
        if (!piece) {
            return [x, y, -1];
        } else if (x === ignoreX && y === ignoreY) {
            return [x, y, piece.z - 1];
        } else {
            return [x, y, piece.z];
        }
    });
    let ret = [];
    for (let i = 1; i <= 6; i++) {
        // return z level of pieces around
        const [, , z1] = xyz[i - 1];
        const [x, y, z] = xyz[i % 6];
        const [, , z2] = xyz[(i + 1) % 6];
        ret.push([x, y, z, z1, z2]);
    }
    return ret;
}

function stillOneHiveAfterRemoveOnXY(board, x, y, levels = 1) {
    const pCheck = board.inGameTopPieces.find(p => p.x === x && p.y === y);
    if (!pCheck || pCheck.z >= levels) {
        return true;
    }

    let piecesAround = [];
    const occupied = Board.coordsAround(x, y).map(([ax, ay]) => {
        const piece = board.inGameTopPieces.find(p => p.x === ax && p.y === ay);
        if (piece) {
            piecesAround.push(piece);
            return true;
        }
        return false;
    });
    if (piecesAround.length < 2 || piecesAround.length > 4) {
        return true;
    }
    // with 2 or 3 pieces around and no isolated pieces, it is one hive.
    if (piecesAround.length < 4) {
        let isolatedPiece = false;
        for (let i = 1; i <= 6; i++) {
            if (!occupied[i - 1] && occupied[i % 6] && !occupied[(i + 1) % 6]) {
                isolatedPiece = true;
                break;
            }
        }
        if (!isolatedPiece) {
            return true;
        }
    }
    // with 4 straight pieces around, it is one hive.
    if (piecesAround.length === 4) {
        for (let i = 1; i <= 6; i++) {
            if (!occupied[i - 1] && !occupied[i % 6]) {
                return true;
            }
        }
    }
    // try "paint the hive" in an edge. If all pieces around get painted, it is one hive
    let marked = [pCheck, piecesAround[0]];
    let edges = [piecesAround[0]];
    while (edges.length > 0) {
        let newEdges = [];
        edges.forEach(edge => {
            Board.coordsAround(edge.x, edge.y).forEach(([ax, ay]) => {
                const piece = board.inGameTopPieces.find(p => p.x === ax && p.y === ay);
                if (piece && !marked.find(p => p.id === piece.id)) {
                    marked.push(piece);
                    newEdges.push(piece);
                }
            });
        });
        edges = newEdges;
    }
    // true if it cant find piece around nor marked
    return !piecesAround.find(p => !marked.find(p2 => p2.id === p.id));
}

function onHiveAndNoGate(fromZ, toZ, z1, z2) {
    const onHive = z1 >= 0 || z2 >= 0 || toZ >= 0 || fromZ > 0;
    const noGate = Math.max(fromZ - 1, toZ) >= Math.min(z1, z2);
    return onHive && noGate;
}

export const PieceType = Object.freeze({
    queen: Object.freeze({
        id: "Q",
        qty: 1,
        linked: null,
        standard: true,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            move1(board, piece);
        },
    }),
    beetle: Object.freeze({
        id: "B",
        qty: 2,
        linked: "mantis",
        standard: true,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            coordsAroundWithNeighbor(board, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                const canMoveOver = !board.inGameTopPieces.find(p => p.x === x && p.y === y && p.type.id === PieceType.scorpion.id);
                if (canMoveOver && onHiveAndNoGate(piece.z, z, z1, z2)) {
                    piece.insertTarget(x, y, z + 1);
                }
            });
        },
    }),
    grasshopper: Object.freeze({
        id: "G",
        qty: 3,
        linked: "fly",
        standard: true,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            jumpOver(board, piece);
        },
    }),
    spider: Object.freeze({
        id: "S",
        qty: 2,
        linked: "scorpion",
        standard: true,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            moveAround(board, piece, 3);
            if (!standard) {
                jumpOver(board, piece, 1);
            }
        }
    }),
    ant: Object.freeze({
        id: "A",
        qty: 3,
        linked: "wasp",
        standard: true,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            const otherColorId = piece.color.id === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id;
            moveAround(board, piece, null, standard ? null : otherColorId);
        }
    }),
    ladybug: Object.freeze({
        id: "L",
        qty: 1,
        linked: "cockroach",
        standard: true,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            moveOver(board, piece, 3);
        },
    }),
    mosquito: Object.freeze({
        id: "M",
        qty: 1,
        linked: "dragonfly",
        standard: true,
        play: (board, piece, standard) => {
            if (piece.z > 0) {
                PieceType.beetle.play(board, piece, standard);
            } else {
                Board.coordsAround(piece.x, piece.y).forEach(([x, y]) => {
                    const p = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    if (p && p.type.id !== PieceType.mosquito.id) {
                        p.type.play(board, piece, standard);
                    }
                });
            }
        }
    }),
    pillBug: Object.freeze({
        id: "P",
        qty: 1,
        linked: "centipede",
        standard: true,
        play: (board, piece, standard) => {
            if (stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                move1(board, piece);
            }
            // move preys
            if (standard || piece.type.id !== PieceType.mosquito.id) {
                let noPieces = [];
                let preys = [];
                coordsAroundWithNeighbor(board, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                    const noPiece = z < 0;
                    const isPrey = z === 0;
                    const isMovableTarget = noPiece && onHiveAndNoGate(piece.z + 1, z, z1, z2);
                    if (isMovableTarget) {
                        noPieces.push([x, y]);
                    } else if (isPrey && onHiveAndNoGate(z, piece.z, z1, z2)) {
                        preys.push([x, y]);
                    }
                });
                preys.forEach(([x, y]) => {
                    const prey = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    const canMove = standard
                        || ![PieceType.pillBug.id, PieceType.centipede.id, PieceType.scorpion.id].includes(prey.type.id);
                    const notLastMove = !board.lastMovedPiecesId.includes(prey.id);
                    if (canMove && notLastMove && stillOneHiveAfterRemoveOnXY(board, prey.x, prey.y)) {
                        noPieces.forEach(([tx, ty]) => {
                            prey.insertTarget(tx, ty, prey.z, [[piece.x, piece.y, piece.z + 1]]);
                        });
                    }
                });
            }
        }
    }),
    mantis: Object.freeze({
        id: "T",
        qty: 2,
        linked: "beetle",
        standard: false,
        play: (board, piece, standard) => {
            if (piece.z > 0) {
                PieceType.beetle.play(board, piece, standard);
            } else if (piece.type.id !== PieceType.mosquito.id) {
                coordsAroundWithNeighbor(board, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                    const hasSpace = z === 0 && (z1 < 0 || z2 < 0);
                    const prey = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    const canEat = prey && prey.type.id !== PieceType.scorpion.id && !board.lastMovedPiecesId.includes(prey.id);
                    if (canEat && hasSpace && stillOneHiveAfterRemoveOnXY(board, prey.x, prey.y)) {
                        piece.insertTarget(x, y, z + 1);
                    }
                });
            }
        }
    }),
    fly: Object.freeze({
        id: "F",
        qty: 3,
        linked: "grasshopper",
        standard: false,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            if (move1(board, piece) === 0) {
                fly(board, piece);
            }
        }
    }),
    scorpion: Object.freeze({
        id: "N",
        qty: 2,
        linked: "spider",
        standard: false,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            moveAround(board, piece, 3);
        },
    }),
    wasp: Object.freeze({
        id: "W",
        qty: 3,
        linked: "ant",
        standard: false,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            const otherColorId = piece.color.id === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id;
            fly(board, piece, otherColorId);
        }
    }),
    cockroach: Object.freeze({
        id: "R",
        qty: 1,
        linked: "ladybug",
        standard: false,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            moveOver(board, piece, null, piece.color.id);
        }
    }),
    dragonfly: Object.freeze({
        id: "D",
        qty: 1,
        linked: "mosquito",
        standard: false,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            let around = coordsAroundWithNeighbor(board, piece.x, piece.y);
            for (let i = 1; i <= 6; i++) {
                const [ix, iy, iz, iz1, iz2] = around[i % 6];
                const pBelow = board.inGameTopPieces.find(p => p.x === ix && p.y === iy);
                if (pBelow && pBelow.type.id === PieceType.scorpion.id || !onHiveAndNoGate(piece.z, iz, iz1, iz2)) {
                    continue;
                }
                const moveSteps = [[ix, iy, iz + 1]];
                const destiny = coordsAroundWithNeighbor(board, ix, iy);
                [destiny[i - 1], destiny[(i + 1) % 6]].forEach(([x, y, z, z1, z2]) => {
                    const target = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    if (target && target.type.id === PieceType.scorpion.id || !onHiveAndNoGate(iz + 1, z, z1, z2)) {
                        return;
                    }
                    const isFromGround = piece.z === 0;
                    const isToGround = z < 0;
                    if (isFromGround || !isToGround) {
                        piece.insertTarget(x, y, z + 1, moveSteps);
                    } else {
                        const prey = board.pieces.find(p =>
                            p.x === piece.x && p.y === piece.y && p.z === piece.z - 1 && p.type.id !== PieceType.dragonfly.id
                        );
                        if (prey && stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y, 2)) {
                            piece.insertTarget(x, y, 0, moveSteps);
                        }
                    }
                });
            }
        }
    }),
    centipede: Object.freeze({
        id: "C",
        qty: 1,
        linked: "pillBug",
        standard: false,
        play: (board, piece, standard) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            move1(board, piece);
            if (piece.type.id === PieceType.mosquito.id) {
                return;
            }
            coordsAroundWithNeighbor(board, piece.x, piece.y).filter(([, , z, z1, z2]) => z === 0 && (z1 < 0 || z2 < 0))
                .forEach(([x, y, , , ]) => {
                const prey = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                const isPrey = prey && !board.lastMovedPiecesId.includes(prey.id);
                if (isPrey && ![PieceType.pillBug.id, PieceType.centipede.id, PieceType.scorpion.id].includes(prey.type.id)) {
                    if (![PieceType.pillBug.id, PieceType.centipede.id, PieceType.scorpion.id].includes(prey.type.id)) {
                        piece.insertTarget(x, y, piece.z + 1);
                    }
                }
            });
        }
    }),
});
function move1(board, piece) {
    let qty = 0;
    coordsAroundWithNeighbor(board, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
        const noPiece = z < 0;
        if (noPiece && onHiveAndNoGate(piece.z, z, z1, z2)) {
            piece.insertTarget(x, y, piece.z);
            qty++;
        }
    });
    return qty;
}
function moveAround(board, piece, n = null, colorId = null) {
    let paths = [[[piece.x, piece.y, 0]]];
    while (paths.length > 0) {
        let newPaths = [];
        // test all paths possible
        paths.forEach(path => {
            const [stepX, stepY, stepZ] = path[path.length - 1];
            coordsAroundWithNeighbor(board, stepX, stepY, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                const noPiece = z < 0;
                const unexplored = !path.find(([cx, cy, ]) => cx === x && cy === y);
                if (noPiece && unexplored && onHiveAndNoGate(stepZ, z, z1, z2)) {
                    // new step with no repetition
                    if (n === null || path.length < n) {
                        let newPath = [...path];
                        newPath.push([x, y, 0]);
                        newPaths.push(newPath);
                    }
                    const validColor = colorId === null || Board.coordsAround(x, y).find(([ax, ay]) =>
                        board.inGameTopPieces.find(p => p.x === ax && p.y === ay && p.color.id === colorId));
                    const validMoveCount = n === null || path.length === n;
                    if (validColor && validMoveCount) {
                        let moveSteps = path.map(xyz => [...xyz]);
                        moveSteps.shift();
                        piece.insertTarget(x, y, 0, moveSteps);
                    }
                }
            });
        });
        paths = newPaths;
    }
}
function fly(board, piece, colorId = null) {
    board.piecePlacement(colorId, piece.x, piece.y).forEach(([x, y]) => {
        piece.z = board.flyZ();
        piece.insertTarget(x, y, 0);
        piece.z = 0;
    });
}
function moveOver(board, piece, n = null, colorId = null) {
    let paths = [[[piece.x, piece.y, piece.z]]];
    while (paths.length > 0) {
        let newPaths = [];
        // test all paths possible
        paths.forEach(path => {
            const [stepX, stepY, stepZ] = path[path.length - 1];
            coordsAroundWithNeighbor(board, stepX, stepY, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                const pBelow = board.inGameTopPieces.find(p => p.x === x && p.y === y && p.type.id !== PieceType.scorpion.id);
                const canGoUp = z >= 0 && pBelow && (colorId === null || pBelow.color.id === colorId);
                const canGoDown = z < 0 && path.length > 1 && (n === null || path.length === n);
                const unexplored = !path.find(([cx, cy, ]) => cx === x && cy === y);
                if (unexplored && (canGoUp || canGoDown) && onHiveAndNoGate(stepZ, z, z1, z2)) {
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
            });
        });
        paths = newPaths;
    }
}
function jumpOver(board, piece, n = null) {
    // look around
    Board.coordsAround(0, 0).forEach(([dx, dy]) => {
        let pBelow = board.inGameTopPieces.find(p => p.x === piece.x + dx && p.y === piece.y + dy);
        let moveSteps = [];
        while (pBelow && pBelow.type.id !== PieceType.scorpion.id) {
            moveSteps.push([pBelow.x, pBelow.y, pBelow.z + 1]);
            const [tx, ty] = [pBelow.x + dx, pBelow.y + dy];
            pBelow = board.inGameTopPieces.find(p => p.x === tx && p.y === ty);
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
