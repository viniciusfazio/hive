import Piece, {
    BLACK, CENTIPEDE, COLORS,
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
    // essential
    round;
    lastMovedPiecesId;
    standardRules;
    allPiecesByType;

    // pre-calc
    #pieces;
    #inGamePieces;
    #inHudPieces;
    #inGameTopPieces;
    #piecesByType;
    #inGamePiecesByType;
    #piecesOnBoard;
    #minX;
    #minY;
    #maxX;
    #maxY;

    // pos compute moves
    qtyMoves;

    constructor(board = null) {
        this.#piecesByType = [[]];
        this.#inGamePiecesByType = [[]];
        for (const type of PIECES) {
            this.#piecesByType[type] = [];
            this.#inGamePiecesByType[type] = [];
        }
        if (board === null) {
            this.allPiecesByType = [[]];
            for (const type of PIECES) {
                this.allPiecesByType[type] = [];
                for (const color of COLORS) {
                    for (let number = 1; number <= PIECE_QTY[type]; number++) {
                        this.allPiecesByType[type].push(new Piece(color, type, PIECE_QTY[type] === 1 ? 0 : number));
                    }
                }
            }
            this.reset(true);
        } else {
            this.round = board.round;
            this.lastMovedPiecesId = [...board.lastMovedPiecesId];
            this.standardRules = board.standardRules;
            this.allPiecesByType = board.allPiecesByType.map(pieces => pieces.map(p => Piece.clone(p)));
            this.#computePieces();
        }
    }

    reset(standardRules) {
        this.round = 1;
        this.lastMovedPiecesId = [];
        this.standardRules = standardRules;
        this.allPiecesByType.forEach(pieces => pieces.forEach(p => p.reset()));
        this.#computePieces();
    }
    isQueenDead(color) {
        const queen = this.allPiecesByType[QUEEN].find(p => p.inGame && p.color === color);
        return queen &&
            !Board.coordsAround(queen.x, queen.y).find(([x, y]) => this.getPieceEncoded(x, y) === 0);
    }

    getMoveNotation(pieceId, to, firstMove) {
        const p1 = this.getPieces().find(p => p.id === pieceId);
        let ret = p1.txt;
        if (!firstMove) {
            const [fromX, fromY, fromZ] = [p1.x, p1.y, p1.z];
            const [toX, toY, toZ] = to;
            // not first move
            let p2 = null;
            if (p1.type === MANTIS && fromX !== null && fromY !== null && fromZ === 0 && toZ === 1) {
                // mantis special move
                p2 = this.getInGamePieceWithZ(fromX, fromY, fromZ);
            } else if (p1.type === CENTIPEDE && toZ > 0) {
                // centipede special move
                p2 = this.getInGamePieceWithZ(fromX, fromY, fromZ);
            } else if (toZ > 0) {
                // move over a piece
                p2 = this.getInGamePieceWithZ(toX, toY, toZ - 1);
            } else {
                // move to the ground
                let p2Pref = 0;
                for (const [x, y] of Board.coordsAround(toX, toY)) {
                    // prefer unique pieces as reference, and to the queen, and pieces not on pile
                    const p = this.getInGamePiece(x, y);
                    if (!p) {
                        continue;
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
                }
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
        this.#pieces = [];
        this.#inGamePieces = [];
        this.#inHudPieces = [];
        this.#inGameTopPieces = [];
        this.#minX = null;
        this.#maxX = null;
        this.#minY = null;
        this.#maxY = null;

        for (const type of PIECES) {
            // keep only usable pieces. For example, if wasp1 was played, ant1 will never be played, so it is removed
            this.#piecesByType[type] = [];
            this.#inGamePiecesByType[type] = [];
            for (const p of this.allPiecesByType[type]) {
                const usable = (!this.standardRules || PIECE_STANDARD[p.type]) && // piece is usable if included in rules
                    (
                        this.standardRules ||         // for standard rule, it doesn't matter
                        PIECE_LINK[p.type] === 0 ||   // if piece can't be flipped, it doesn't matter
                        p.inGame ||                   // if it was played, pieced is usable
                        !this.allPiecesByType[PIECE_LINK[p.type]].find(l => // if flipped piece is in game, it is not usable
                            l.inGame && l.number === p.number && l.color === p.color)
                    );
                if (usable) {
                    this.#piecesByType[type].push(p);
                    this.#pieces.push(p);
                    if (p.inGame) {
                        this.#inGamePiecesByType[type].push(p);
                        this.#inGamePieces.push(p);
                        if (this.#maxX === null || this.#maxX < p.x) this.#maxX = p.x;
                        if (this.#maxY === null || this.#maxY < p.y) this.#maxY = p.y;
                        if (this.#minX === null || this.#minX > p.x) this.#minX = p.x;
                        if (this.#minY === null || this.#minY > p.y) this.#minY = p.y;
                    } else {
                        this.#inHudPieces.push(p);
                    }
                }
            }
        }
        this.#maxX += (this.#maxX - this.#minX) & 1;

        const sizeX = ((this.#maxX - this.#minX) >> 1) + 1;
        this.#piecesOnBoard = new Uint32Array(sizeX * (this.#maxY - this.#minY + 1));
        for (const p of this.#inGamePieces) {
            const key = sizeX * (p.y - this.#minY) + ((p.x - this.#minX) >> 1);
            if (p.z + 1 > (this.#piecesOnBoard[key] & 0xff)) {
                this.#piecesOnBoard[key] = (p.number << 24) | (p.type << 16) | (p.color << 8) | (p.z + 1);
            }
        }
        this.#inGameTopPieces = this.#inGamePieces.filter(p => p.z + 1 === (this.getPieceEncoded(p.x, p.y) & 0xff));
    }
    getInGameTopPieces() {
        return this.#inGameTopPieces;
    }
    getQueens() {
        return this.#piecesByType[QUEEN];
    }
    getPieces() {
        return this.#pieces;
    }
    getInHudPieces() {
        return this.#inHudPieces;
    }
    getPiecesByType(type) {
        return this.#piecesByType[type];
    }
    getInGamePiecesByType(type) {
        return this.#inGamePiecesByType[type];
    }

    getMinMaxXY() {
        return [this.#minX, this.#maxX, this.#minY, this.#maxY];
    }

    /**
     * @return z where 0 is no piece, 1 is white piece on z=0, 2 is white piece on z=1, -1 is black piece on z=0, and so on
     */

    getPieceEncoded(x, y) {
        if (x < this.#minX || x > this.#maxX || y < this.#minY || y > this.#maxY) {
            return 0;
        }
        const sizeX = ((this.#maxX - this.#minX) >> 1) + 1;
        const key = sizeX * (y - this.#minY) + ((x - this.#minX) >> 1);
        return this.#piecesOnBoard[key];
    }
    coordsAroundWithNeighbor(cx, cy, ignoreX = null, ignoreY = null) {
        let xyz;
        if (ignoreX !== null && ignoreY !== null) {
            xyz = Board.coordsAround(cx, cy).map(([x, y]) =>
                [x, y, Math.max(-1, (this.getPieceEncoded(x, y) & 0xff) - (x === ignoreX && y === ignoreY ? 2 : 1))]
            );
        } else {
            xyz = Board.coordsAround(cx, cy).map(([x, y]) => [x, y, (this.getPieceEncoded(x, y) & 0xff) - 1]);
        }
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

    coordsToXY(x, y) {
        return ((x - this.#minX + 2) << 8) | (y - this.#minY + 1);
    }
    XYToCoords(xy) {
        return [((xy >> 8) & 0xff) + this.#minX - 2, (xy & 0xff) + this.#minY - 1];
    }
    stillOneHiveAfterRemove(p, levels = 1) {
        if ((this.getPieceEncoded(p.x, p.y) & 0xff) - 1 > p.z) {
            return false;
        }
        if (p.z >= levels) {
            return true;
        }

        // get pieces around and count how many groups of piece there are
        let fistPosition = null;
        let lastPosition = null;
        let groupsAround = 0;
        let coordsWithPieceAround = [];
        for (const [ax, ay] of Board.coordsAround(p.x, p.y)) {
            const piece = this.getPieceEncoded(ax, ay);
            if (lastPosition === null) {
                lastPosition = piece;
                fistPosition = piece;
            } else if (lastPosition === 0 && piece !== 0) {
                groupsAround++;
            }
            if (piece !== 0) {
                coordsWithPieceAround.push(this.coordsToXY(ax, ay));
            }
            lastPosition = piece;
        }
        if (lastPosition === 0 && fistPosition !== 0) {
            groupsAround++;
        }
        if (groupsAround <= 1) {
            // if there is only 1 ou 0 group of pieces around, it is one hive
            return true;
        }
        // try "paint the hive" in an edge. If all pieces around get painted, it is one hive
        let marked = [this.coordsToXY(p.x, p.y), coordsWithPieceAround[0]];
        let edges = [coordsWithPieceAround[0]];
        while (edges.length > 0) {
            let newEdges = [];
            for (const edge of edges) {
                const [ex, ey] = this.XYToCoords(edge);
                for (const [ax, ay] of Board.coordsAround(ex, ey)) {
                    if (this.getPieceEncoded(ax, ay) !== 0) {
                        const axy = this.coordsToXY(ax, ay);
                        if (!marked.includes(axy)) {
                            marked.push(axy);
                            newEdges.push(axy);
                        }
                    }
                }
            }
            edges = newEdges;
        }
        // true if it cant find piece around not marked
        return !coordsWithPieceAround.find(p => !marked.includes(p));
    }

    toString(onlyLastMovesThatMatter = true) {
        this.#inGamePieces.sort((a, b) => a.y !== b.y ? a.y - b.y : (a.x !== b.x ? a.x - b.x : (a.z - b.z)));
        let lastP = null;
        const colorPlaying = this.getColorPlaying();
        let ret = colorPlaying === BLACK ? "!" : "";
        for (const p of this.#inGamePieces) {
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
                    p.z === 0 && (this.getPieceEncoded(p.x, p.y) & 0xff) - 1 === p.z && // only ground pieces matter for last move
                    p.type !== SCORPION &&  // scorpion is never affected
                    this.#piecesByType[QUEEN].find(q => q.inGame && q.color === colorPlaying); // only with queen in game to make moves
                if (checkIfLastMoveMatter) {
                    for (const [x2, y2] of Board.coordsAround(p.x, p.y)) {
                        const p2 = this.getPieceEncoded(x2, y2);
                        if (p2 === 0 || (p2 & 0xff) > 1 || ((p2 >> 8) & 0xff) !== colorPlaying) {
                            continue;
                        }
                        const pillBugCanMoveIt = (this.standardRules || ![PILL_BUG, CENTIPEDE].includes(p.type)) && p.z === 0 && (
                                ((p2 >> 16) & 0xff) === PILL_BUG ||
                                    this.standardRules && ((p2 >> 16) & 0xff) === MOSQUITO &&
                                    Board.coordsAround(x2, y2).find(([x3, y3]) =>
                                        ((this.getPieceEncoded(x3, y3) >> 16) & 0xff) === PILL_BUG)
                        );
                        if (pillBugCanMoveIt) {
                            let hasFreeSpaceAroundPillBug = false;
                            let canMoveToPillBug = false;
                            for (const [x, y, z, z1, z2] of this.coordsAroundWithNeighbor(x2, y2)) {
                                const noPiece = z < 0;
                                const itsMe = x === p.x && y === p.y;
                                hasFreeSpaceAroundPillBug ||= noPiece && Board.onHiveAndNoGate((p2 & 0xff), z, z1, z2);
                                canMoveToPillBug ||= itsMe && Board.onHiveAndNoGate(z, (p2 & 0xff) - 1, z1, z2);
                            }
                            addMarker = hasFreeSpaceAroundPillBug && canMoveToPillBug && this.stillOneHiveAfterRemove(p);
                        }
                        if ([MANTIS, CENTIPEDE].includes((p2 >> 16) & 0xff)) {
                            const hasEmptySpace = this.coordsAroundWithNeighbor(x2, y2).find(([x, y, , z1, z2]) => {
                                return p.x === x && p.y === y && (z1 < 0 || z2 < 0);
                            });
                            if (hasEmptySpace) {
                                addMarker = ((p2 >> 16) & 0xff) === MANTIS ?
                                    this.stillOneHiveAfterRemove(p) :
                                    this.stillOneHiveAfterRemove(this.getInGamePiece(x2, y2));
                            }
                        }
                        if (addMarker) {
                            break;
                        }
                    }
                }
                if (addMarker) {
                    ret += "_";
                }
            }
            ret += PIECE_TXT[p.type][p.color === WHITE ? 0 : 1];
            lastP = p;
        }
        return ret;
    }

    getInGamePiece(x, y) {
        const p = this.getPieceEncoded(x, y);
        if (p === 0) {
            return false;
        } else {
            const z = (p & 0xff) - 1;
            return this.#inGamePiecesByType[(p >> 16) & 0xff].find(p => p.x === x && p.y === y && p.z === z);
        }
    }
    getInGamePieceWithZ(x, y, z) {
        const p = this.getPieceEncoded(x, y);
        if (p === 0) {
            return false;
        } else {
            return this.#inGamePieces.find(p => p.x === x && p.y === y && p.z === z);
        }
    }
    computeLegalMoves(canMove) {
        this.allPiecesByType.forEach(pieces => pieces.forEach(p => p.resetTargets()));
        this.qtyMoves = 0;
        if (this.isQueenDead(WHITE) || this.isQueenDead(BLACK)) {
            return;
        }
        if (canMove) {
            this.qtyMoves = this.#computePiecePlacements() + this.#computeMoves();
        }
    }
    #computeMoves() {
        let color = this.getColorPlaying();
        // cant move if queen is not in game
        if (!this.#piecesByType[QUEEN].find(p => p.inGame && p.color === color)) {
            return 0;
        }
        return this.#inGameTopPieces.reduce((s, p) => {
            if (p.color === color) {
                return s + computePieceMoves(p.type, this, p, this.standardRules);
            }
            return s;
        }, 0);
    }

    #computePiecePlacements() {
        let colorPlaying = this.getColorPlaying();
        let hudTopPieces = [];
        for (const type of PIECES) {
            let piece = null;
            for (const p of this.#piecesByType[type]) {
                if (p.color === colorPlaying && !p.inGame && (piece === null || piece.z < p.z)) {
                    piece = p;
                }
            }
            if (piece !== null) {
                hudTopPieces.push(piece);
            }
        }

        // first and second moves are special cases
        if (this.round === 1) {
            hudTopPieces.forEach(p => p.insertTarget(0, 0, 0));
            return hudTopPieces.length;
        }
        if (this.round === 2) {
            Board.coordsAround(0, 0).forEach(([x, y]) => hudTopPieces.forEach(p => p.insertTarget(x, y, 0)));
            return 6 * hudTopPieces.length;
        }

        if (hudTopPieces.length === 0) {
            return 0;
        }

        // must place queen in 4th move
        if (this.round === 7 || this.round === 8) {
            const queen = hudTopPieces.find(p => p.type === QUEEN);
            if (queen) {
                hudTopPieces = [queen];
            }
        }
        const positions = this.piecePlacement(colorPlaying);
        positions.forEach(([x, y]) => hudTopPieces.forEach(p => p.insertTarget(x, y, 0)));
        return positions.length * hudTopPieces.length;
    }

    piecePlacement(color = null, ignore_x = null, ignore_y = null) {
        let visited = [];
        let ret = [];
        const otherColor = color === null ? null : (color === WHITE ? BLACK : WHITE);
        for (const p of this.#inGameTopPieces) {
            if (color !== null && color !== p.color || ignore_x === p.x && ignore_y === p.y) {
                continue;
            }
            for (const [x, y] of Board.coordsAround(p.x, p.y)) {
                // skip if already visited
                const xy = this.coordsToXY(x, y);
                if (visited.includes(xy)) {
                    continue;
                }
                visited.push(xy);

                // skip if not empty
                if (this.getPieceEncoded(x, y) !== 0) {
                    continue;
                }

                // check if empty space has only same color piece around
                const differentColorAround = color !== null && Board.coordsAround(x, y).find(([x2, y2]) =>
                    (ignore_x !== x2 || ignore_y !== y2) && ((this.getPieceEncoded(x2, y2) >> 8) & 0xff) === otherColor
                );
                if (!differentColorAround) {
                    ret.push([x, y]);
                }
            }
        }
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
            p2 = this.getInGamePiece(toX, toY);
            callbackMove(p2, true);
            p2.play(fromX, fromY, 0);
            p.play(fromX, fromY, 1);
        } else if (p.type === DRAGONFLY && fromX !== null && fromY !== null && fromZ > 0 && toZ === 0) {
            // dragonfly special move
            p2 = this.getInGamePieceWithZ(fromX, fromY, p.z - 1);
            callbackMove(p2, true);
            p2.play(toX, toY, 0);
            p.play(toX, toY, 1);
        } else if (fromX !== null && fromY !== null && p.type === CENTIPEDE && toZ > 0) {
            // centipede special move
            p2 = this.getInGamePiece(toX, toY);
            callbackMove(p2, true);
            p2.play(fromX, fromY, 0, [[p2.x, p2.y, p2.z], [toX, toY, 0], [fromX, fromY, 0]]);
            p.play(toX, toY, 0, [[p.x, p.y, p.z], [toX, toY, 1], [toX, toY, 0]]);
        } else {
            callbackMove(p, false);
            p.play(toX, toY, toZ, moveSteps);
        }
        if (p2 === null) {
            this.lastMovedPiecesId = new Uint32Array([p.id]);
        } else {
            this.lastMovedPiecesId = new Uint32Array([p.id, p2.id]);
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
            p2 = this.getInGamePieceWithZ(fromX, fromY, 0);
            callbackMove(p2, true);
            p2.play(toX, toY, 0);
            p.play(fromX, fromY, 0);
        } else if (p.type === DRAGONFLY && fromX !== null && fromY !== null && fromZ > 0 && toZ === 0) {
            // dragonfly special move
            p2 = this.getInGamePieceWithZ(toX, toY, p.z - 1);
            callbackMove(p2, true);
            p2.play(fromX, fromY, fromZ - 1);
            p.play(fromX, fromY, fromZ);
        } else if (p.type === CENTIPEDE && toZ > 0) {
            // centipede special move
            p2 = this.getInGamePiece(fromX, fromY);
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
        return (this.round & 1) === 1 ? WHITE : BLACK;
    }
    getMoves() {
        this.computeLegalMoves(true);
        const moves = [];
        this.#piecesByType.forEach(pieces => pieces.forEach((p => p.getTargets().forEach(t => moves.push([[p.x, p.y, p.z], [t.x, t.y, t.z], p, t])))));
        return moves;
    }
}
