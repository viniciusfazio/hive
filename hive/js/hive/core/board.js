import Piece, {getPieceMoves, PieceColor, PieceType} from "./piece.js"
export default class Board {
    round;
    lastMovedPiecesId;
    standardRules;
    allPieces;

    pieces;
    inGame;
    inGameTopPieces;
    hudTopPieces;
    passRound;

    queens;

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
            this.lastMovedPiecesId = board.lastMovedPiecesId;
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
        this.inGame = this.allPieces.filter(p => p.inGame);
        this.inGameTopPieces = this.inGame.filter(p => !this.inGame.find(p2 => p2.z > p.z && p2.x === p.x && p2.y === p.y));
        this.pieces = this.allPieces.filter(p =>
            (!this.standardRules || p.type.standard) && (
                this.standardRules || p.type.linked === null || p.inGame ||
                !this.inGame.find(l => // if linked piece is in game, can't play
                    l.type.id === PieceType[p.type.linked].id && l.number === p.number && l.color.id === p.color.id
                )
            )
        );
        this.queens = this.pieces.filter(p => p.type.id === PieceType.queen.id);
        const notInGame = this.pieces.filter(p => !p.inGame);
        this.hudTopPieces = notInGame.filter(p => !notInGame.find(p2 => p2.z > p.z && p2.type.id === p.type.id && p2.color.id === p.color.id));

    }

    stringfy() {
        this.inGame.sort((a, b) =>
            a.y !== b.y ? a.y - b.y : (a.x !== b.x ? a.x - b.x : (a.z - b.z)));

        let lastP = null;
        let ret = this.getColorPlaying().id === "b" ? "!" : "";
        this.inGame.forEach(p => {
            if (lastP !== null) {
                const diff = p.x - lastP.x;
                if (diff === 0) {
                    ret += "+";
                } else if (diff !== 2) {
                    ret += diff;
                }
            }
            if (this.lastMovedPiecesId.includes(p.id)) {
                ret += "_";
            }
            ret += p.color.id === "w" ? p.type.id : p.type.id2;
            lastP = p;
        });
        return ret;
    }


    getInGamePiece(x, y, z = null) {
        return z === null ? this.inGameTopPieces.find(p => p.x === x && p.y === y) :
            this.inGame.find(p => p.x === x && p.y === y && p.z === z);
    }
    computeLegalMoves(canMove, computeOtherSide = false) {
        this.pieces.forEach(p => {
            p.targetsB = [];
            p.targets = [];
        });
        this.passRound = false;
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
            this.passRound = this.#computePiecePlacements() + this.#computeMoves() === 0;
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
        let total = 0;
        this.inGameTopPieces.forEach(p => {
            if (p.color.id === colorId && (otherSide || !this.lastMovedPiecesId.includes(p.id))) {
                getPieceMoves(p.type.id, this, p, this.standardRules);
                total += p.targets.length;
            }
        });
        return total;
    }
    getMoves() {
        const moves = [];
        this.pieces.forEach(p => p.targets.forEach(t => moves.push([[p.x, p.y, p.z], [t.x, t.y, t.z], p, t])));
        return moves;
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
        let total = 0;
        this.piecePlacement(colorPlayingId).forEach(([x, y]) => myHudTopPieces.forEach(p => {
            p.insertTarget(x, y, 0);
            total++;
        }));
        return total;
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

}
