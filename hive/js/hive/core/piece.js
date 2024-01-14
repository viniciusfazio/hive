import Board from "./board.js";


export default class Piece {
    x = 0;
    y = 0;
    inGame = false;
    z;
    number;
    subNumber;
    type;
    color;
    targets = [];
    id

    constructor(color, type, z, number, subNumber = 0) {
        this.color = color;
        this.type = type;
        this.z = z;
        this.number = number;
        this.subNumber = subNumber;
        this.id = this.color.id + this.type.id + (this.number > 0 ? this.number : "")
                                               + (this.subNumber > 0 ? this.subNumber : "");
    }
    insertTarget(x, y, z) {
        const piece = new Piece(this.color, this.type, z, this.number, this.targets.length + 1);
        piece.x = x;
        piece.y = y;
        piece.inGame = true;
        if (!this.targets.find(p => p.x === x && p.y === y)) {
            this.targets.push(piece);
        }
        return piece;
    }
}

function *coordsAroundWithNeighbor(cx, cy, ignoreX = null, ignoreY = null) {
    let xyz = [];
    for (const [x, y] of Board.coordsAround(cx, cy)) {
        // get all pieces around
        const piece = this.inGameTopPieces.find(p => p.x === x && p.y === y);
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

function checkOneHive(board, x, y) {
    const pCheck = board.inGameTopPieces.find(p => p.x === x && p.y === y);
    if (!pCheck || pCheck.z > 0) {
        return true;
    }

    let occupied = [];
    let piecesAround = [];
    for (const [ax, ay] of Board.coordsAround(x, y)) {
        const piece = this.inGameTopPieces.find(p => p.x === ax && p.y === ay);
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
                const piece = this.inGameTopPieces.find(p => p.x === ax && p.y === ay);
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

function noGate(fromZ, toZ, z1, z2) {
    const onHive = z1 >= 0 || z2 >= 0 || toZ >= 0 || fromZ > 0;
    return onHive && Math.max(fromZ - 1, toZ) >= Math.min(z1, z2);
}

export const PieceType = Object.freeze({
    queen: Object.freeze({
        id: "Q",
        qty: 1,
        play: (board, piece) => {
            if (!checkOneHive(board, piece.x, piece.y)) {
                return;
            }
            for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(piece.x, piece.y)) {
                const noPiece = z < 0;
                if (noPiece && noGate(piece.z, z, z1, z2)) {
                    piece.insertTarget(x, y, 0);
                }
            }
        },
    }),
    beetle: Object.freeze({
        id: "B",
        qty: 2,
        play: (board, piece) => {
            if (!checkOneHive(board, piece.x, piece.y)) {
                return;
            }
            for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(piece.x, piece.y)) {
                if (noGate(piece.z, z, z1, z2)) {
                    piece.insertTarget(x, y, z + 1);
                }
            }
        },
    }),
    grasshopper: Object.freeze({
        id: "G",
        qty: 3,
        play: (board, piece) => {
            if (!checkOneHive(board, piece.x, piece.y)) {
                return;
            }
            // look around
            for (const [dx, dy] of Board.coordsAround(0, 0)) {
                // if occupied, look for hole
                if (board.inGameTopPieces.find(p => p.x === piece.x + dx && p.y === piece.y + dy)) {
                    for (let i = 2; i <= board.inGameTopPieces.length; i++) {
                        const [x, y] = [piece.x + i * dx, piece.y + i * dy];
                        if (!board.inGameTopPieces.find(p => p.x === x && p.y === y)) { // found a hole
                            piece.insertTarget(x, y, 0);
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
        play: (board, piece) => {
            if (!checkOneHive(board, piece.x, piece.y)) {
                return;
            }
            let paths = [[[piece.x, piece.y]]];
            // make exactly 3 moves
            for (let p = 0; p < 3; p++) {
                let newPaths = [];
                // test all pahts possible
                paths.forEach(path => {
                    const [stepX, stepY] = path[p];
                    for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(stepX, stepY, piece.x, piece.y)) {
                        const noPiece = z < 0;
                        const unexplored = !path.find(([cx, cy]) => cx === x && cy === y);
                        if (noPiece && unexplored && noGate(piece.z, z, z1, z2, -1)) {
                            // new step with no repetition
                            if (p < 2) {
                                let newPath = [...path];
                                newPath.push([x, y]);
                                newPaths.push(newPath);
                            } else {
                                // always check for repetition
                                piece.insertTarget(x, y, 0);
                            }
                        }
                    }
                });
                paths = newPaths;
            }

        }
    }),
    ant: Object.freeze({
        id: "A",
        qty: 3,
        play: (board, piece) => {
            if (!checkOneHive(board, piece.x, piece.y)) {
                return;
            }
            let edges = [piece];
            let marked = [piece];
            while (edges.length > 0) {
                let newEdges = [];
                edges.forEach(edge => {
                    for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(edge.x, edge.y, piece.x, piece.y)) {
                        const noPiece = z < 0;
                        if (noPiece && noGate(piece.z, z, z1, z2) &&!marked.find(p => p.x === x && p.y === y)) {
                            const p = piece.insertTarget(x, y, 0);
                            marked.push(p);
                            newEdges.push(p);
                        }
                    }
                });
                edges = newEdges;
            }
        }
    }),
    ladybug: Object.freeze({
        id: "L",
        qty: 1,
        play: (board, piece) => {
            if (!checkOneHive(board, piece.x, piece.y)) {
                return;
            }
            let paths = [[[piece.x, piece.y, piece.z]]];
            // make exactly 3 moves
            for (let p = 0; p < 3; p++) {
                let newPaths = [];
                // try all paths
                paths.forEach(path => {
                    const [stepX, stepY, stepZ] = path[p];
                    for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(stepX, stepY, piece.x, piece.y)) {
                        if (p < 2) {
                            // move only over pieces
                            const hasPiece = z >= 0;
                            const unexplored = !path.find(([cx, cy, cz]) => cx === x && cy === y && cz === z);
                            if (hasPiece && unexplored && noGate(stepZ, z, z1, z2)) {
                                let newPath = [...path];
                                newPath.push([x, y, z]);
                                newPaths.push(newPath);
                            }
                        } else {
                            // move only to empty spaces
                            const noPiece = z < 0;
                            if (noPiece && noGate(stepZ + 1, z, z1, z2)) {
                                piece.insertTarget(x, y, 0);
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
        play: (board, piece) => {
            if (piece.z > 0) {
                // on the top of other piece
                PieceType.beetle.play(board, piece);
            } else {
                for (const [x, y] of Board.coordsAround(piece.x, piece.y)) {
                    const p = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                    if (p && p.type.id !== PieceType.mosquito.id) {
                        p.tipo.jogadas(board, piece);
                    }
                }
            }
        }
    }),
    pillbug: Object.freeze({
        id: "P",
        qty: 1,
        play: (board, piece) => {
            const canMove = checkOneHive(board, piece.x, piece.y);
            let noPieces = [];
            let preys = [];
            for (const [x, y, z, z1, z2] of coordsAroundWithNeighbor(piece.x, piece.y)) {
                const noPiece = z < 0;
                const prey = z === 0;
                const isMoveableTarget = noPiece && noGate(piece.z + 1, z, z1, z2);
                if (isMoveableTarget) {
                    noPieces.push([x, y]);
                } else if (prey && noGate(z, piece.z, z1, z2)) {
                    preys.push([x, y]);
                }
                if (canMove && isMoveableTarget) {
                    piece.insertTarget(x, y, 0);
                }
            }
            // move preys
            preys.forEach(([x, y]) => {
                const prey = board.inGameTopPieces.find(p => p.x === x && p.y === y);
                if (prey.id !== board.lastMovePieceId && checkOneHive(board, prey.x, prey.y)) {
                    noPieces.forEach(([tx, ty]) => {
                        prey.insertTarget(tx, ty, 0);
                    });
                }
            });
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
