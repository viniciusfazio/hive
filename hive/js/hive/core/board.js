import Piece, {
    BLACK, CENTIPEDE,
    computePieceMoves, DRAGONFLY, MANTIS, MOSQUITO,
    PIECE_LINK,
    PIECE_QTY,
    PIECE_STANDARD, PIECE_TXT,
    PIECES, PILL_BUG,
    QUEEN,
    SCORPION,
    WHITE
} from "./piece.js"
export default class Board {
    round;
    lastMovedPiecesId;
    standardRules;
    allPieces;

    pieces;
    inGamePieces;
    inGameTopPieces;
    hudTopPieces;
    passRound;

    queens;
    qtyMoves;

    maxZ;
    minX;
    minY;
    maxX;
    maxY;

    constructor(board = null) {
        if (board === null) {
            this.allPieces = [];
            [WHITE, BLACK].forEach(color => PIECES.forEach(type => {
                for (let number = 1; number <= PIECE_QTY[type]; number++) {
                    this.allPieces.push(new Piece(color, type, PIECE_QTY[type] === 1 ? 0 : number));
                }
            }));
            this.reset(true);
        } else {
            this.round = board.round;
            this.lastMovedPiecesId = [...board.lastMovedPiecesId];
            this.standardRules = board.standardRules;
            this.allPieces = board.allPieces.map(p => Piece.clone(p));
            this.#computePieces();
        }
    }
    reset(standardRules) {
        this.round = 1;
        this.lastMovedPiecesId = [];
        this.passRound = false;
        this.standardRules = standardRules;
        this.allPieces.forEach(p => p.reset());
        this.#computePieces();
    }
    isQueenDead(color) {
        const queen = this.queens.find(p => p.inGame && p.color === color);
        return queen &&
            !Board.coordsAround(queen.x, queen.y).find(([x, y]) => !this.getInGamePiece(x, y));
    }

    getMoveNotation(pieceId, to, firstMove) {
        const p1 = this.pieces.find(p => p.id === pieceId);
        let ret = p1.txt;
        if (!firstMove) {
            const [fromX, fromY, fromZ] = [p1.x, p1.y, p1.z];
            const [toX, toY, toZ] = to;
            // not first move
            let p2 = null;
            if (p1.type === MANTIS && fromX !== null && fromY !== null && fromZ === 0 && toZ === 1) {
                // mantis special move
                p2 = this.getInGamePiece(fromX, fromY, fromZ);
            } else if (p1.type === CENTIPEDE && toZ > 0) {
                // centipede special move
                p2 = this.getInGamePiece(fromX, fromY, fromZ);
            } else if (toZ > 0) {
                // move over a piece
                p2 = this.getInGamePiece(toX, toY, toZ - 1);
            } else {
                // move to the ground
                let p2Pref = 0;
                Board.coordsAround(toX, toY).forEach(([x, y]) => {
                    // prefer unique pieces as reference, and to the queen, and pieces not on pile
                    const p = this.getInGamePiece(x, y);
                    if (!p) {
                        return;
                    }
                    let pref = 1;
                    if (p.type === QUEEN) {
                        pref += 8;
                    }
                    if (p.number === 0) {
                        pref += 4;
                    }
                    if (p.z === 0) {
                        pref += 2;
                    }
                    if (pref > p2Pref) {
                        p2Pref = pref;
                        p2 = p;
                    }
                });
            }
            if (!p2) {
                ret += " invalid";
            } else if (toZ > 0) {
                ret += " " + p2.txt;
            } else if (toX - p2.x === -2) {
                ret += " -" + p2.txt;
            } else if (toX - p2.x === 2) {
                ret += " " + p2.txt + "-";
            } else if (toX - p2.x === -1) {
                if (toY - p2.y === 1) {
                    ret += " \\" + p2.txt;
                } else {
                    ret += " /" + p2.txt;
                }
            } else if (toY - p2.y === 1) {
                ret += " " + p2.txt + "/";
            } else {
                ret += " " + p2.txt + "\\";
            }
        }
        return ret;
    }
    #computePieces() {
        this.inGamePieces = this.allPieces.filter(p => p.inGame);
        this.inGameTopPieces = this.inGamePieces.filter(p => !this.inGamePieces.find(p2 => p2.z > p.z && p2.x === p.x && p2.y === p.y));
        this.pieces = this.allPieces.filter(p =>
            // keep only usable pieces. For example, if wasp1 was played, ant1 will never be played, so it is removed
             (!this.standardRules || PIECE_STANDARD[p.type]) && (
                this.standardRules || PIECE_LINK[p.type] === null || p.inGame ||
                !this.inGamePieces.find(l => // if linked piece is in game, can't play
                    l.type === PIECE_LINK[p.type] && l.number === p.number && l.color === p.color
                )
            ));
        this.maxZ = null;
        this.minX = null;
        this.maxX = null;
        this.minY = null;
        this.maxY = null;
        this.inGameTopPieces.forEach(p => {
            if (this.maxX === null || this.maxX < p.x) this.maxX = p.x;
            if (this.maxY === null || this.maxY < p.y) this.maxY = p.y;
            if (this.maxZ === null || this.maxZ < p.z) this.maxZ = p.z;
            if (this.minX === null || this.minX > p.x) this.minX = p.x;
            if (this.minY === null || this.minY > p.y) this.minY = p.y;
        });

        this.queens = this.pieces.filter(p => p.type === QUEEN);
        const notInGame = this.pieces.filter(p => !p.inGame);
        this.hudTopPieces = notInGame.filter(p => !notInGame.find(p2 => p2.z > p.z && p2.type === p.type && p2.color === p.color));
    }
    coordsAroundWithNeighbor(cx, cy, ignoreX = null, ignoreY = null) {
        let xyz = Board.coordsAround(cx, cy).map(([x, y]) => {
            // get all pieces around
            const piece = this.getInGamePiece(x, y);
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
    static onHiveAndNoGate(fromZ, toZ, z1, z2) {
        const onHive = z1 >= 0 || z2 >= 0 || toZ >= 0 || fromZ > 0;
        const noGate = Math.max(fromZ - 1, toZ) >= Math.min(z1, z2);
        return onHive && noGate;
    }

    stillOneHiveAfterRemoveOnXY(x, y, levels = 1) {
        // if not in game of piece is stacked, it is one hive
        const pCheck = this.getInGamePiece(x, y);
        if (!pCheck || pCheck.z >= levels) {
            return true;
        }

        // get pieces around and count how many groups of piece there are
        let fistPosition = null;
        let lastPosition = null;
        let groupsAround = 0;
        let piecesAround = [];
        Board.coordsAround(x, y).forEach(([ax, ay]) => {
            const piece = this.getInGamePiece(ax, ay);
            if (lastPosition === null) {
                lastPosition = piece;
                fistPosition = piece;
            } else if (!lastPosition && piece) {
                groupsAround++;
            }
            if (piece) {
                piecesAround.push(piece);
            }
            lastPosition = piece;
        });
        if (!lastPosition && fistPosition) {
            groupsAround++;
        }
        if (groupsAround <= 1) {
            // if there is only 1 ou 0 group of pieces around, it is one hive
            return true;
        }
        // try "paint the hive" in an edge. If all pieces around get painted, it is one hive
        let marked = [pCheck, piecesAround[0]];
        let edges = [piecesAround[0]];
        while (edges.length > 0) {
            let newEdges = [];
            edges.forEach(edge => {
                Board.coordsAround(edge.x, edge.y).forEach(([ax, ay]) => {
                    const piece = this.getInGamePiece(ax, ay);
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

    stringfy(onlyLastMovesThatMatter = true) {
        this.inGamePieces.sort((a, b) =>
            a.y !== b.y ? a.y - b.y : (a.x !== b.x ? a.x - b.x : (a.z - b.z)));

        let lastP = null;
        const colorPlaying = this.getColorPlaying();
        let ret = colorPlaying === BLACK ? "!" : "";
        this.inGamePieces.forEach(p => {
            if (lastP !== null) {
                const diff = p.x - lastP.x;
                if (diff === 0) {
                    ret += "+";
                } else if (diff !== 2) {
                    ret += diff;
                }
            }
            if (this.lastMovedPiecesId.includes(p.id)) {
                let addMarker = !onlyLastMovesThatMatter;
                // only not stacked pieces can be moved
                const checkIfLastMoveMatter =
                    onlyLastMovesThatMatter &&
                    p.z === 0 && this.getInGamePiece(p.x, p.y).id === p.id && // only ground pieces matter for last move
                    p.type !== SCORPION &&  // scorpion is never affected
                    this.queens.find(q => q.inGame && q.color === colorPlaying); // only with queen in game to make moves
                if (checkIfLastMoveMatter) {
                    Board.coordsAround(p.x, p.y).find(([x, y]) => {
                        const p2 = this.getInGamePiece(x, y);
                        if (!p2 || p2.z > 0 || p2.color !== colorPlaying) {
                            return false;
                        }
                        const isPillBug = p2.type === PILL_BUG && (this.standardRules || p.type !== p2.type) ||
                            this.standardRules && p2.type === MOSQUITO && Board.coordsAround(p2.x, p2.y).find(([x, y]) => {
                                const p3 = this.getInGamePiece(x, y);
                                return p3 && p3.type === PILL_BUG;
                            });
                        if (isPillBug) {
                            let hasDestiny = false;
                            let validPrey = false;
                            this.coordsAroundWithNeighbor(p2.x, p2.y).forEach(([x, y, z, z1, z2]) => {
                                const noPiece = z < 0;
                                const isPrey = x === p.x && y === p.y;
                                const isMovableTarget = noPiece && Board.onHiveAndNoGate(p2.z + 1, z, z1, z2);
                                if (isMovableTarget) {
                                    hasDestiny = true;
                                } else if (isPrey && Board.onHiveAndNoGate(z, p2.z, z1, z2)) {
                                    validPrey = true;
                                }
                            });
                            addMarker = hasDestiny && validPrey && this.stillOneHiveAfterRemoveOnXY(p.x, p.y);
                        }
                        if ([MANTIS, CENTIPEDE].includes(p2.type)) {
                            const hasEmptySpace = this.coordsAroundWithNeighbor(p2.x, p2.y).find(([x, y, , z1, z2]) => {
                                return p.x === x && p.y === y && (z1 < 0 || z2 < 0);
                            });
                            if (hasEmptySpace) {
                                addMarker = p2.type === MANTIS ?
                                    this.stillOneHiveAfterRemoveOnXY(p.x, p.y) :
                                    this.stillOneHiveAfterRemoveOnXY(p2.x, p2.y);
                            }
                        }
                        return addMarker;
                    });
                }
                if (addMarker) {
                    ret += "_";
                }
            }
            ret += PIECE_TXT[p.type][p.color === WHITE ? 0 : 1];
            lastP = p;
        });
        return ret;
    }


    getInGamePiece(x, y, z = null) {
        return z === null ?
            this.inGameTopPieces.find(p => p.x === x && p.y === y) :
            this.inGamePieces.find(p => p.x === x && p.y === y && p.z === z);
    }
    computeLegalMoves(canMove, computeOtherSide = false) {
        this.pieces.forEach(p => {
            p.targetsB = [];
            p.targets = [];
        });
        this.passRound = false;
        this.qtyMoves = 0;
        if (this.isQueenDead(WHITE) || this.isQueenDead(BLACK)) {
            return;
        }
        if (canMove) {
            if (computeOtherSide) {
                this.#computePiecePlacements(true);
                this.#computeMoves(true);
                this.pieces.forEach(p => {
                    p.targetsB = p.targets;
                    p.targets = [];
                });
            }
            this.qtyMoves = this.#computePiecePlacements() + this.#computeMoves();
            this.passRound = this.qtyMoves === 0;
        }
    }
    #computeMoves(otherSide = false) {
        let color = this.getColorPlaying();
        if (otherSide) {
            color = color === WHITE ? BLACK : WHITE;
        }
        // cant move if queen is not in game
        if (!this.queens.find(p => p.inGame && p.color === color)) {
            return 0;
        }
        this.inGameTopPieces.forEach(p => {
            if (p.color === color && (otherSide || !this.lastMovedPiecesId.includes(p.id))) {
                computePieceMoves(p.type, this, p, this.standardRules);
            }
        });
        return otherSide ? 0 : this.inGameTopPieces.reduce((qty, p) => qty + p.targets.length, 0);
    }

    #computePiecePlacements(otherSide = false) {
        let colorPlaying = this.getColorPlaying();
        if (otherSide) {
            colorPlaying = colorPlaying === WHITE ? BLACK : WHITE;
        }
        let myHudTopPieces = this.hudTopPieces.filter(p => p.color === colorPlaying);

        // first and second moves are special cases
        if (this.round === 1) {
            myHudTopPieces.forEach(p => p.insertTarget(0, 0, 0));
            return myHudTopPieces.length;
        }
        if (this.round === 2) {
            Board.coordsAround(0, 0).forEach(([x, y]) => myHudTopPieces.forEach(p => p.insertTarget(x, y, 0)));
            return 6 * myHudTopPieces.length;
        }

        if (myHudTopPieces.length === 0) {
            return 0;
        }

        // must place queen in 4th move
        if (this.round === 7 || this.round === 8) {
            const queen = myHudTopPieces.find(p => p.type === QUEEN);
            if (queen) {
                myHudTopPieces = [queen];
            }
        }
        const positions = this.piecePlacement(colorPlaying);
        positions.forEach(([x, y]) => myHudTopPieces.forEach(p => p.insertTarget(x, y, 0)));
        return positions.length * myHudTopPieces.length;
    }
    piecePlacement(color, ignore_x = null, ignore_y = null) {
        let visited = [];
        let ret = [];
        this.inGameTopPieces.forEach(p => {
            if (color !== null && p.color !== color || ignore_x === p.x && ignore_y === p.y) {
                return;
            }
            Board.coordsAround(p.x, p.y).forEach(([x, y]) => {
                // skip if already visited
                if (visited.find(([rx, ry]) => rx === x && ry === y)) {
                    return;
                }
                visited.push([x, y]);

                // skip if not empty
                if (this.getInGamePiece(x, y)) {
                    return;
                }

                // check if empty space has only same color piece around
                const differentColorPieceAround = color !== null && Board.coordsAround(x, y).find(([x2, y2]) => {
                    if (ignore_x === x2 && ignore_y === y2) {
                        return false;
                    }
                    const p = this.getInGamePiece(x2, y2);
                    return p && p.color !== color;
                });
                if (!differentColorPieceAround) {
                    ret.push([x, y]);
                }
            });
        });
        return ret;
    }
    pass() {
        this.lastMovedPiecesId = [];
        this.round++;
    }
    passBack() {
        this.lastMovedPiecesId = [];
        this.round--;
    }
    play(from, to, p, moveSteps = [], callbackMove = (_piece, _extraPieceMoving) => {}) {
        callbackMove(p, false);
        const [fromX, fromY, fromZ] = from;
        const [toX, toY, toZ] = to;
        let p2 = null;
        if (p.type === MANTIS && fromZ === 0 && fromX !== null && fromY !== null && toZ === 1) {
            // mantis special move
            p2 = this.getInGamePiece(toX, toY, 0);
            callbackMove(p2, true);
            p2.play(fromX, fromY, 0);
            p.play(fromX, fromY, 1);
        } else if (p.type === DRAGONFLY && fromX !== null && fromY !== null && fromZ > 0 && toZ === 0) {
            // dragonfly special move
            p2 = this.getInGamePiece(fromX, fromY, p.z - 1);
            callbackMove(p2, true);
            p2.play(toX, toY, 0);
            p.play(toX, toY, 1);
        } else if (fromX !== null && fromY !== null && p.type === CENTIPEDE && toZ > 0) {
            // centipede special move
            p2 = this.getInGamePiece(toX, toY, 0);
            callbackMove(p2, true);
            p2.play(fromX, fromY, 0, [[p2.x, p2.y, p2.z], [toX, toY, 0], [fromX, fromY, 0]]);
            p.play(toX, toY, 0, [[p.x, p.y, p.z], [toX, toY, 1], [toX, toY, 0]]);
        } else {
            callbackMove(p, false);
            p.play(toX, toY, toZ, moveSteps);
        }
        this.lastMovedPiecesId = [p.id];
        if (p2 !== null) {
            this.lastMovedPiecesId.push(p2.id);
        }
        this.round++;
        this.#computePieces();
    }
    playBack(from, to, p, moveSteps = [], callbackMove = (_piece, _extraPieceMoving) => {}) {
        const [fromX, fromY, fromZ] = from;
        const [toX, toY, toZ] = to;
        callbackMove(p, false);
        let p2 = null;
        if (p.type === MANTIS && fromZ === 0 && fromX !== null && fromY !== null && toZ === 1) {
            // mantis special move
            p2 = this.getInGamePiece(fromX, fromY, 0);
            callbackMove(p2, true);
            p2.play(toX, toY, 0);
            p.play(fromX, fromY, 0);
        } else if (p.type === DRAGONFLY && fromX !== null && fromY !== null && fromZ > 0 && toZ === 0) {
            // dragonfly special move
            p2 = this.getInGamePiece(toX, toY, p.z - 1);
            callbackMove(p2, true);
            p2.play(fromX, fromY, fromZ - 1);
            p.play(fromX, fromY, fromZ);
        } else if (p.type === CENTIPEDE && toZ > 0) {
            // centipede special move
            p2 = this.getInGamePiece(fromX, fromY, 0);
            callbackMove(p2, true);
            p2.play(toX, toY, 0, [[p2.x, p2.y, p2.z], [toX, toY, 0], [toX, toY, 0]]);
            p.play(fromX, fromY, 0, [[p.x, p.y, p.z], [toX, toY, 1], [fromX, fromY, 0]]);
        } else {
            p.play(fromX, fromY, fromZ, moveSteps.toReversed());
        }
        this.lastMovedPiecesId = [];
        this.round--;
        this.#computePieces();
    }
    static coordsAround(x, y, includePoint = false) {
        if (includePoint) {
            return [
                [x + 2, y + 0],
                [x + 1, y + 1],
                [x - 1, y + 1],
                [x - 2, y + 0],
                [x - 1, y - 1],
                [x + 1, y - 1],
                [x, y],
            ];
        }
        return [
            [x + 2, y + 0],
            [x + 1, y + 1],
            [x - 1, y + 1],
            [x - 2, y + 0],
            [x - 1, y - 1],
            [x + 1, y - 1],
        ];
    }

    getColorPlaying() {
        return this.round % 2 === 1 ? WHITE : BLACK;
    }
    getMoves() {
        this.computeLegalMoves(true);
        const moves = [];
        this.pieces.forEach(p => p.targets.forEach(t => moves.push([[p.x, p.y, p.z], [t.x, t.y, t.z], p, t])));
        return moves;
    }
}
