import Piece, {computePieceMoves, PieceColor, PieceType} from "./piece.js"
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
            for (const keyColor in PieceColor) {
                for (const keyType in PieceType) {
                    const type = PieceType[keyType];
                    for (let number = 1; number <= type.qty; number++) {
                        this.allPieces.push(new Piece(PieceColor[keyColor], type, type.qty === 1 ? 0 : number));
                    }
                }
            }
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
    isQueenDead(colorId) {
        const queen = this.queens.find(p => p.inGame && p.color.id === colorId);
        return queen &&
            !Board.coordsAround(queen.x, queen.y).find(([x, y]) => !this.getInGamePiece(x, y));
    }

    #computePieces() {
        this.inGamePieces = this.allPieces.filter(p => p.inGame);
        this.inGameTopPieces = this.inGamePieces.filter(p => !this.inGamePieces.find(p2 => p2.z > p.z && p2.x === p.x && p2.y === p.y));
        this.pieces = this.allPieces.filter(p =>
            // keep only usable pieces. For example, if wasp1 was played, ant1 will never be played, so it is removed
             (!this.standardRules || p.type.standard) && (
                this.standardRules || p.type.linked === null || p.inGame ||
                !this.inGamePieces.find(l => // if linked piece is in game, can't play
                    l.type.id === PieceType[p.type.linked].id && l.number === p.number && l.color.id === p.color.id
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

        this.queens = this.pieces.filter(p => p.type.id === PieceType.queen.id);
        const notInGame = this.pieces.filter(p => !p.inGame);
        this.hudTopPieces = notInGame.filter(p => !notInGame.find(p2 => p2.z > p.z && p2.type.id === p.type.id && p2.color.id === p.color.id));
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
        const colorPlayingId = this.getColorPlaying().id;
        let ret = colorPlayingId === "b" ? "!" : "";
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
                    p.type.id !== PieceType.scorpion.id &&  // scorpion is never affected
                    this.queens.find(q => q.inGame && q.color.id === colorPlayingId); // only with queen in game to make moves
                if (checkIfLastMoveMatter) {
                    Board.coordsAround(p.x, p.y).find(([x, y]) => {
                        const p2 = this.getInGamePiece(x, y);
                        if (!p2 || p2.z > 0 || p2.color.id !== colorPlayingId) {
                            return false;
                        }
                        const isPillBug = p2.type.id === PieceType.pillBug.id && (this.standardRules || p.id.type !== p2.type.id) ||
                            this.standardRules && p2.type.id === PieceType.mosquito.id && Board.coordsAround(p2.x, p2.y).find(([x, y]) => {
                                const p3 = this.getInGamePiece(x, y);
                                return p3 && p3.type.id === PieceType.pillBug.id;
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
                        if (p2.id.type === PieceType.mantis.id || p2.id.type === PieceType.centipede.id) {
                            const hasEmptySpace = this.coordsAroundWithNeighbor(p2.x, p2.y).find(([x, y, , z1, z2]) => {
                                return p.x === x && p.y === y && (z1 < 0 || z2 < 0);
                            });
                            if (hasEmptySpace) {
                                addMarker = p2.id.type === PieceType.mantis.id ?
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
            ret += p.color.id === "w" ? p.type.id : p.type.id2;
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
        if (this.isQueenDead(PieceColor.white.id) || this.isQueenDead(PieceColor.black.id)) {
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
        let colorId = this.getColorPlaying().id;
        if (otherSide) {
            colorId = colorId === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id;
        }
        // cant move if queen is not in game
        if (!this.queens.find(p => p.inGame && p.color.id === colorId)) {
            return 0;
        }
        this.inGameTopPieces.forEach(p => {
            if (p.color.id === colorId && (otherSide || !this.lastMovedPiecesId.includes(p.id))) {
                computePieceMoves(p.type.id, this, p, this.standardRules);
            }
        });
        return otherSide ? 0 : this.inGameTopPieces.reduce((qty, p) => qty + p.targets.length, 0);
    }

    #computePiecePlacements(otherSide = false) {
        let colorPlayingId = this.getColorPlaying().id;
        if (otherSide) {
            colorPlayingId = colorPlayingId === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id;
        }
        let myHudTopPieces = this.hudTopPieces.filter(p => p.color.id === colorPlayingId);

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
            const queen = myHudTopPieces.find(p => p.type.id === PieceType.queen.id);
            if (queen) {
                myHudTopPieces = [queen];
            }
        }
        const positions = this.piecePlacement(colorPlayingId);
        positions.forEach(([x, y]) => myHudTopPieces.forEach(p => p.insertTarget(x, y, 0)));
        return positions.length * myHudTopPieces.length;
    }
    piecePlacement(colorId, ignore_x = null, ignore_y = null) {
        let visited = [];
        let ret = [];
        this.inGameTopPieces.forEach(p => {
            if (colorId !== null && p.color.id !== colorId || ignore_x === p.x && ignore_y === p.y) {
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
                const differentColorPieceAround = colorId !== null && Board.coordsAround(x, y).find(([x2, y2]) => {
                    if (ignore_x === x2 && ignore_y === y2) {
                        return false;
                    }
                    const p = this.getInGamePiece(x2, y2);
                    return p && p.color.id !== colorId;
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
        if (p.type.id === PieceType.mantis.id && fromZ === 0 && fromX !== null && fromY !== null && toZ === 1) {
            // mantis special move
            p2 = this.getInGamePiece(toX, toY, 0);
            callbackMove(p2, true);
            p2.play(fromX, fromY, 0);
            p.play(fromX, fromY, 1);
        } else if (p.type.id === PieceType.dragonfly.id && fromX !== null && fromY !== null && fromZ > 0 && toZ === 0) {
            // dragonfly special move
            p2 = this.getInGamePiece(fromX, fromY, p.z - 1);
            callbackMove(p2, true);
            p2.play(toX, toY, 0);
            p.play(toX, toY, 1);
        } else if (fromX !== null && fromY !== null && p.type.id === PieceType.centipede.id && toZ > 0) {
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
        if (p.type.id === PieceType.mantis.id && fromZ === 0 && fromX !== null && fromY !== null && toZ === 1) {
            // mantis special move
            p2 = this.getInGamePiece(fromX, fromY, 0);
            callbackMove(p2, true);
            p2.play(toX, toY, 0);
            p.play(fromX, fromY, 0);
        } else if (p.type.id === PieceType.dragonfly.id && fromX !== null && fromY !== null && fromZ > 0 && toZ === 0) {
            // dragonfly special move
            p2 = this.getInGamePiece(toX, toY, p.z - 1);
            callbackMove(p2, true);
            p2.play(fromX, fromY, fromZ - 1);
            p.play(fromX, fromY, fromZ);
        } else if (p.type.id === PieceType.centipede.id && toZ > 0) {
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
        return this.round % 2 === 1 ? PieceColor.white : PieceColor.black;
    }
    getMoves() {
        this.computeLegalMoves(true);
        const moves = [];
        this.pieces.forEach(p => p.targets.forEach(t => moves.push([[p.x, p.y, p.z], [t.x, t.y, t.z], p, t])));
        return moves;
    }
}
