import Board from "./board.js";

export default class Piece {
    // variable
    intermediateXYZs;
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
    insertTarget(x, y, z, intermediateXYZs = []) {
        const piece = new Piece(this.color, this.type, this.number, this.targets.length + 1);
        piece.x = x;
        piece.y = y;
        piece.z = z;
        piece.intermediateXYZs = intermediateXYZs;
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
        this.intermediateXYZs = [];
        this.inGame = false;
        this.targets = [];
    }
    play(x, y, z, intermediateXYZs = []) {
        this.x = x;
        this.y = y;
        if (z < 0) {
            this.reset();
        } else {
            this.inGame = true;
            this.z = z;
            this.intermediateXYZs = intermediateXYZs.map(xyz => [...xyz]);
        }
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

function *coordsAroundWithNeighbor(board, cx, cy, ignoreX = null, ignoreY = null) {
    let xyz = [];
    for (const [x, y] of Board.coordsAround(cx, cy)) {
        // get all pieces around
        const piece = board.inGameTopPieces.find(p => p.x === x && p.y === y);
        if (piece) {
            if (x === ignoreX && y === ignoreY) {
                xyz.push([x, y, piece.z - 1]);
            } else {
                xyz.push([x, y, piece.z]);
            }
        } else {
            xyz.push([x, y, -1]);
        }
    }
    for (let i = 1; i <= 6; i++) {
        // return z level of pieces around
        const [x, y, z] = xyz[i % 6];
        const [, , z1] = xyz[i - 1];
        const [, , z2] = xyz[(i + 1) % 6];
        yield [x, y, z, z1, z2];
    }
}

function stillOneHiveAfterRemoveOnXY(board, x, y) {
    const pCheck = board.inGameTopPieces.find(p => p.x === x && p.y === y);
    if (!pCheck || pCheck.z > 0) {
        return true;
    }

    let occupied = [];
    let piecesAround = [];
    for (const [ax, ay] of Board.coordsAround(x, y)) {
        const piece = board.inGameTopPieces.find(p => p.x === ax && p.y === ay);
        if (piece) {
            piecesAround.push(piece);
            occupied.push(true);
        } else {
            occupied.push(false);
        }
    }
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
            for (const [ax, ay] of Board.coordsAround(edge.x, edge.y)) {
                const piece = board.inGameTopPieces.find(p => p.x === ax && p.y === ay);
                if (piece && !marked.find(p => p.id === piece.id)) {
                    marked.push(piece);
                    newEdges.push(piece);
                }
            }
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
        play: (board, piece, standard, withAbility = true) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, piece.x, piece.y)) {
                const noPiece = z < 0;
                if (noPiece && onHiveAndNoGate(piece.z, z, z1, z2)) {
                    piece.insertTarget(x, y, 0);
                }
            }
        },
    }),
    beetle: Object.freeze({
        id: "B",
        qty: 2,
        linked: "mantis",
        standard: true,
        play: (board, piece, standard, withAbility = true) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, piece.x, piece.y)) {
                if (onHiveAndNoGate(piece.z, z, z1, z2)) {
                    piece.insertTarget(x, y, z + 1);
                }
            }
        },
    }),
    grasshopper: Object.freeze({
        id: "G",
        qty: 3,
        linked: "fly",
        standard: true,
        play: (board, piece, standard, withAbility = true) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            // look around
            for (const [dx, dy] of Board.coordsAround(0, 0)) {
                // if occupied, look for hole
                if (board.inGameTopPieces.find(p => p.x === piece.x + dx && p.y === piece.y + dy)) {
                    for (let i = 2; i <= board.inGameTopPieces.length; i++) {
                        const [x, y] = [piece.x + i * dx, piece.y + i * dy];
                        const f = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                        if (!f) { // found a hole
                            piece.insertTarget(x, y, 0);
                            break;
                        } else if (!standard && f.type.id === PieceType.scorpion.id) { // can't move over scorpion
                            break;
                        }
                    }
                }
            }
        },
    }),
    spider: Object.freeze({
        id: "S",
        qty: 2,
        linked: "scorpion",
        standard: true,
        play: (board, piece, standard, withAbility = true) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            let paths = [[[piece.x, piece.y, 0]]];
            // make exactly 3 moves
            for (let p = 0; p < 3; p++) {
                let newPaths = [];
                // test all paths possible
                paths.forEach(path => {
                    const [stepX, stepY, ] = path[p];
                    for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, stepX, stepY, piece.x, piece.y)) {
                        const noPiece = z < 0;
                        const unexplored = !path.find(([cx, cy, ]) => cx === x && cy === y);
                        if (noPiece && unexplored && onHiveAndNoGate(piece.z, z, z1, z2, -1)) {
                            // new step with no repetition
                            if (p < 2) {
                                let newPath = [...path];
                                newPath.push([x, y, 0]);
                                newPaths.push(newPath);
                            } else {
                                let intermediateXYZs = path.map(xyz => [...xyz]);
                                intermediateXYZs.shift();
                                piece.insertTarget(x, y, 0, intermediateXYZs);
                            }
                        }
                    }
                });
                paths = newPaths;
            }
            if (!standard) {
                // jump over 1 piece
                for (const [dx, dy] of Board.coordsAround(0, 0)) {
                    const neighbor = board.inGameTopPieces.find(p => p.x === piece.x + dx && p.y === piece.y + dy);
                    const hasHole = !board.inGameTopPieces.find(p => p.x === piece.x + 2 * dx && p.y === piece.y + 2 * dy);
                    if (neighbor && hasHole && neighbor.type.id !== PieceType.scorpion.id) {
                        piece.insertTarget(piece.x + 2 * dx, piece.y + 2 * dy, 0);
                    }
                }
            }

        }
    }),
    ant: Object.freeze({
        id: "A",
        qty: 3,
        linked: "wasp",
        standard: true,
        play: (board, piece, standard, withAbility = true) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            let paths = [[[piece.x, piece.y, 0]]];
            while (paths.length > 0) {
                let newPaths = [];
                // test all paths possible
                paths.forEach(path => {
                    const [stepX, stepY, ] = path[path.length - 1];
                    for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, stepX, stepY, piece.x, piece.y)) {
                        const noPiece = z < 0;
                        const unexplored = !path.find(([cx, cy, ]) => cx === x && cy === y);
                        if (noPiece && unexplored && onHiveAndNoGate(piece.z, z, z1, z2, -1)) {
                            // new step with no repetition
                            let newPath = [...path];
                            newPath.push([x, y, 0]);
                            newPaths.push(newPath);
                            let intermediateXYZs = path.map(xyz => [...xyz]);
                            intermediateXYZs.shift();
                            piece.insertTarget(x, y, 0, intermediateXYZs);
                        }
                    }
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
        play: (board, piece, standard, withAbility = true) => {
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
                    for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, stepX, stepY, piece.x, piece.y)) {
                        const unexplored = !path.find(([cx, cy, ]) => cx === x && cy === y);
                        if (p < 2) {
                            // move only over pieces
                            const hasPiece = z >= 0;
                            if (hasPiece && unexplored && onHiveAndNoGate(stepZ, z, z1, z2)) {
                                let newPath = [...path];
                                newPath.push([x, y, z + 1]);
                                newPaths.push(newPath);
                            }
                        } else {
                            // move only to empty spaces
                            const noPiece = z < 0;
                            if (noPiece && unexplored && onHiveAndNoGate(stepZ + 1, z, z1, z2)) {
                                let intermediateXYZs = path.map(xyz => [...xyz]);
                                intermediateXYZs.shift();
                                piece.insertTarget(x, y, 0, intermediateXYZs);
                            }
                        }
                    }
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
        play: (board, piece, standard, withAbility = true) => {
            if (piece.z > 0) {
                // on the top of other piece
                PieceType.beetle.play(board, piece, standard, standard);
            } else {
                for (const [x, y] of Board.coordsAround(piece.x, piece.y)) {
                    const p = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    if (p && p.type.id !== PieceType.mosquito.id) {
                        p.type.play(board, piece, standard, standard);
                    }
                }
            }
        }
    }),
    pillBug: Object.freeze({
        id: "P",
        qty: 1,
        linked: "centipede",
        standard: true,
        play: (board, piece, standard, withAbility = true) => {
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
            if (withAbility) {
                preys.forEach(([x, y]) => {
                    const prey = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    const noForbPieces = standard || prey.type.id !== PieceType.pillBug.id && prey.type.id !== PieceType.centipede.id;
                    const notLastMove = prey.id !== board.lastMovePieceId;
                    if (noForbPieces && notLastMove && stillOneHiveAfterRemoveOnXY(board, prey.x, prey.y)) {
                        noPieces.forEach(([tx, ty]) => {
                            prey.insertTarget(tx, ty, 0, [[piece.x, piece.y, piece.z + 1]]);
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
        play: (board, piece, standard, withAbility = true) => {
            if (piece.z > 0) {
                PieceType.beetle.play(board, piece, standard);
            } else if (withAbility) {
                for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(board, piece.x, piece.y)) {
                    const neighbor = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    const canEat = z === 0 && (z1 < 0 || z2 < 0);
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
        play: (board, piece, standard, withAbility = true) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }
            let isStuck = true;
            for (const [, , z, z1, z2] of coordsAroundWithNeighbor(board, piece.x, piece.y)) {
                if (z < 0 && (z1 < 0 || z2 < 0)) {
                    isStuck = false;
                    break;
                }
            }
            if (isStuck) {
                this.board.inGameTopPieces.forEach(p => {
                    for (const [x, y] of Board.coordsAround(p.x, p.y)) {
                        if (!this.board.inGameTopPieces.find(t => t.x === x && t.y === y)) {
                            piece.insertTarget(x, y, 0);
                        }
                    }
                });
            }
        }
    }),
    scorpion: Object.freeze({
        id: "N",
        qty: 2,
        linked: "spider",
        standard: false,
        play: (board, piece, standard, withAbility = true) => {
            if (!stillOneHiveAfterRemoveOnXY(board, piece.x, piece.y)) {
                return;
            }

        }
    }),
    wasp: Object.freeze({
        id: "W",
        qty: 3,
        linked: "ant",
        standard: false,
        play: (board, piece, standard, withAbility = true) => {

        }
    }),
    cockroach: Object.freeze({
        id: "R",
        qty: 1,
        linked: "ladybug",
        standard: false,
        play: (board, piece, standard, withAbility = true) => {

        }
    }),
    dragonfly: Object.freeze({
        id: "D",
        qty: 1,
        linked: "mosquito",
        standard: false,
        play: (board, piece, standard, withAbility = true) => {

        }
    }),
    centipede: Object.freeze({
        id: "C",
        qty: 1,
        linked: "pillBug",
        standard: false,
        play: (board, piece, standard, withAbility = true) => {

        }
    }),
});

export const PieceColor = Object.freeze({
    white: Object.freeze({
        id: "w",
    }),
    black: Object.freeze({
        id: "b",
    }),
});
