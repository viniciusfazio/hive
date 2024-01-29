
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
                                               + (this.subNumber > 0 ? this.subNumber : "");
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
            moveSteps = [[this.x, this.y, this.z]];
        }
        this.x = x;
        this.y = y;
        this.z = z < 0 ? this.type.qty - Math.max(1, this.number) : z;
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
            for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, piece.x, piece.y)) {
                const noPiece = z < 0;
                if (noPiece && onHiveAndNoGate(piece.z, z, z1, z2)) {
                    piece.insertTarget(x, y, piece.z);
                }
            }
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
            // look around
            Board.coordsAround(0, 0).forEach(([dx, dy]) => {
                let pBelow = board.inGameTopPieces.find(p => p.x === piece.x + dx && p.y === piece.y + dy);
                if (!pBelow) {
                    // no piece to jump over
                    return;
                }
                let moveSteps = [];
                for (let i = 0; i < board.inGameTopPieces.length; i++) {
                    moveSteps.push([pBelow.x, pBelow.y, pBelow.z + 1]);
                    const [tx, ty] = [pBelow.x + dx, pBelow.y + dy];
                    pBelow = board.inGameTopPieces.find(p => p.x === tx && p.y === ty);
                    if (!pBelow) { // found a hole
                        piece.insertTarget(tx, ty, 0, moveSteps);
                        break;
                    }
                    if (pBelow.type.id === PieceType.scorpion.id) {
                        break;
                    }
                }
            });
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
            move3(board, piece);
            if (standard) {
                return;
            }
            // jump over 1 piece
            Board.coordsAround(0, 0).forEach(([dx, dy]) => {
                const n = board.inGameTopPieces.find(p => p.x === piece.x + dx && p.y === piece.y + dy);
                if (!n || n.type.id === PieceType.scorpion.id) {
                    return;
                }
                const [tx, ty] = [n.x + dx, n.y + dy];
                if (!board.inGameTopPieces.find(p => p.x === tx && p.y === ty)) {
                    piece.insertTarget(tx, ty, 0, [[n.x, n.y, n.z + 1]]);
                }
            });
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
            let paths = [[[piece.x, piece.y, 0]]];
            const otherColorId = piece.color.id === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id;
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
                            let newPath = [...path];
                            newPath.push([x, y, z + 1]);
                            newPaths.push(newPath);
                            let moveSteps = path.map(xyz => [...xyz]);
                            moveSteps.shift();
                            const canMove = standard || Board.coordsAround(x, y).find(([ax, ay]) =>
                                board.inGameTopPieces.find(p => p.x === ax && p.y === ay && p.color.id === otherColorId));
                            if (canMove) {
                                piece.insertTarget(x, y, z + 1, moveSteps);
                            }
                        }
                    });
                });
                paths = newPaths;
            }
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
            let paths = [[[piece.x, piece.y, 0]]];
            // make exactly 3 moves
            for (let p = 0; p < 3; p++) {
                let newPaths = [];
                // try all paths
                paths.forEach(path => {
                    const [stepX, stepY, stepZ] = path[p];
                    coordsAroundWithNeighbor(board, stepX, stepY, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                        const unexplored = !path.find(([cx, cy, ]) => cx === x && cy === y);
                        if (p < 2) {
                            // move only over pieces
                            const hasPiece = z >= 0;
                            const canMoveOver = !board.inGameTopPieces.find(t => t.x === x && t.y === y && t.type.id === PieceType.scorpion.id);
                            if (hasPiece && canMoveOver && unexplored && onHiveAndNoGate(stepZ, z, z1, z2)) {
                                let newPath = [...path];
                                newPath.push([x, y, z + 1]);
                                newPaths.push(newPath);
                            }
                        } else {
                            // move only to empty spaces
                            const noPiece = z < 0;
                            if (noPiece && unexplored && onHiveAndNoGate(stepZ, z, z1, z2)) {
                                let moveSteps = path.map(xyz => [...xyz]);
                                moveSteps.shift();
                                piece.insertTarget(x, y, z + 1, moveSteps);
                            }
                        }
                    });
                });
                paths = newPaths;
            }
        },
    }),
    mosquito: Object.freeze({
        id: "M",
        qty: 1,
        linked: "dragonfly",
        standard: true,
        play: (board, piece, standard) => {
            if (piece.z > 0) {
                PieceType.beetle.play(board, piece, standard, standard);
            } else {
                Board.coordsAround(piece.x, piece.y).forEach(([x, y]) => {
                    const p = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    if (p && p.type.id !== PieceType.mosquito.id) {
                        p.type.play(board, piece, standard, standard);
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
            const canMove = stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y);
            let noPieces = [];
            let preys = [];
            for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, piece.x, piece.y)) {
                const noPiece = z < 0;
                const prey = z === 0;
                const isMovableTarget = noPiece && onHiveAndNoGate(piece.z + 1, z, z1, z2);
                if (isMovableTarget) {
                    noPieces.push([x, y]);
                } else if (prey && onHiveAndNoGate(z, piece.z, z1, z2)) {
                    preys.push([x, y]);
                }
                if (canMove && noPiece && onHiveAndNoGate(piece.z, z, z1, z2)) {
                    piece.insertTarget(x, y, 0);
                }
            }
            // move preys
            if (standard || piece.type.id !== PieceType.mosquito.id) {
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
                for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, piece.x, piece.y)) {
                    const neighbor = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    const canEat = z === 0 && (z1 < 0 || z2 < 0) && neighbor.type.id !== PieceType.scorpion.id;
                    if (canEat && stillOneHiveAfterRemoveOnXY(board, neighbor.x, neighbor.y)) {
                        piece.insertTarget(x, y, z + 1);
                    }
                }
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
            let isStuck = true;
            coordsAroundWithNeighbor(board, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                const movable = z < 0 && (z1 < 0 || z2 < 0);
                if (movable) {
                    const onHive = z1 >= 0 || z2 >= 0;
                    if (onHive) {
                        piece.insertTarget(x, y, 0);
                    }
                    isStuck = false;
                }
            });
            if (isStuck) {
                board.inGameTopPieces.forEach(p => {
                    Board.coordsAround(p.x, p.y).forEach(([x, y]) => {
                        if (!board.inGameTopPieces.find(t => t.x === x && t.y === y)) {
                            piece.z = board.flyZ();
                            piece.insertTarget(x, y, 0);
                            piece.z = 0;
                        }
                    });
                });
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
            move3(board, piece);
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
            const color = piece.color.id === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id;
            board.piecePlacement(color, piece.x, piece.y).forEach(([x, y]) => {
                piece.z = board.flyZ();
                piece.insertTarget(x, y, 0);
                piece.z = 0;
            });
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
            let paths = [[[piece.x, piece.y, piece.z]]];
            while (paths.length > 0) {
                let newPaths = [];
                // test all paths possible
                paths.forEach(path => {
                    const [stepX, stepY, stepZ] = path[path.length - 1];
                    coordsAroundWithNeighbor(board, stepX, stepY, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                        const validPieceUnder = board.inGameTopPieces.find(p => p.x === x && p.y === y && p.color.id === piece.color.id && p.type.id !== PieceType.scorpion.id);
                        const canGoUp = z >= 0 && validPieceUnder;
                        const canGoDown = z < 0 && path.length > 1;
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
            let directions = Board.coordsAround(0, 0);
            for (let i = 1; i <= 6; i++) {
                const [idx, idy] = directions[i % 6];
                const [ix, iy] = [piece.x + idx, piece.y + idy];
                const pBelow = board.inGameTopPieces.find(p => p.x === piece.x + idx && p.y === piece.y + idy);
                if (pBelow && pBelow.type.id === PieceType.scorpion.id) {
                    continue;
                }
                const moveSteps = [[ix, iy, pBelow ? pBelow.z + 1 : 0]];
                [directions[i - 1], directions[(i + 1) % 6]].forEach(([dx, dy]) => {
                    const [tx, ty] = [ix + dx, iy + dy];
                    const target = board.inGameTopPieces.find(p => p.x === tx && p.y === ty);
                    if (target) {
                        if (target.type.id !== PieceType.scorpion.id) {
                            piece.insertTarget(tx, ty, target.z + 1, moveSteps);
                        }
                        return;
                    }
                    let outsideHive = !Board.coordsAround(tx, ty).find(([x, y]) =>
                        board.inGameTopPieces.find(p => p.x === x && p.y === y)
                    );
                    if (outsideHive) {
                        return;
                    }
                    const isFromGround = piece.z === 0;
                    if (isFromGround) {
                        piece.insertTarget(tx, ty, 0, moveSteps);
                    } else {
                        const prey = board.pieces.find(p =>
                            p.x === piece.x && p.y === piece.y && p.z === piece.z - 1 && p.type.id !== PieceType.dragonfly.id
                        );
                        if (prey && stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y, 2)) {
                            piece.insertTarget(tx, ty, 0, moveSteps);
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
            const canMove = stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y);
            for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, piece.x, piece.y)) {
                const prey = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                if (!prey && canMove && onHiveAndNoGate(piece.z, z, z1, z2)) {
                    piece.insertTarget(x, y, piece.z);
                } else if (prey && piece.type.id !== PieceType.mosquito.id) {
                    const isPrey = ![PieceType.pillBug.id, PieceType.centipede.id, PieceType.scorpion.id].includes(prey.type.id);
                    const canSwitch = z === 0 && (z1 < 0 || z2 < 0);
                    if (isPrey && canSwitch) {
                        piece.insertTarget(x, y, piece.z + 1);
                    }
                }
            }
        }
    }),
});
function move3(board, piece) {
    let paths = [[[piece.x, piece.y, 0]]];
    // make exactly 3 moves
    for (let p = 0; p < 3; p++) {
        let newPaths = [];
        // test all paths possible
        paths.forEach(path => {
            const [stepX, stepY, stepZ] = path[p];
            coordsAroundWithNeighbor(board, stepX, stepY, piece.x, piece.y).forEach(([x, y, z, z1, z2]) => {
                const noPiece = z < 0;
                const unexplored = !path.find(([cx, cy, ]) => cx === x && cy === y);
                if (noPiece && unexplored && onHiveAndNoGate(stepZ, z, z1, z2)) {
                    // new step with no repetition
                    if (p < 2) {
                        let newPath = [...path];
                        newPath.push([x, y, z + 1]);
                        newPaths.push(newPath);
                    } else {
                        let moveSteps = path.map(xyz => [...xyz]);
                        moveSteps.shift();
                        piece.insertTarget(x, y, z + 1, moveSteps);
                    }
                }
            });
        });
        paths = newPaths;
    }
}
export const PieceColor = Object.freeze({
    white: Object.freeze({
        id: "w",
    }),
    black: Object.freeze({
        id: "b",
    }),
});
