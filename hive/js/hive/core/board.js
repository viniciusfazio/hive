import Piece, {getPieceMoves, PieceColor, PieceType} from "./piece.js"
export default class Board {
    round;
    lastMovedPiecesId;
    standardRules;
    allPieces;

    pieces;
    inGame;
    inGameTopPieces;
    passRound;

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
        const queen = this.pieces.find(p =>
            p.inGame &&
            p.type.id === PieceType.queen.id &&
            p.color.id === colorId
        );
        return queen &&
            !Board.coordsAround(queen.x, queen.y).find(([x, y]) => !this.inGameTopPieces.find(p => p.x === x && p.y === y));
    }

    #computePieces() {
        this.pieces = this.allPieces.filter(p =>
            (!this.standardRules || p.type.standard) &&
            (
                this.standardRules ||
                p.type.linked === null ||
                !this.allPieces.find(l => // if linked piece is in game, can't play
                    l.inGame &&
                    l.type.id === PieceType[p.type.linked].id &&
                    l.number === p.number &&
                    l.color.id === p.color.id
                )
            )
    );
    }
    computeLegalMoves(canMove, computeOtherSide = false) {
        if (this.pieces) {
            this.pieces.forEach(p => {
                p.targetsB = [];
                p.targets = [];
            });
        }
        this.#computePieces();
        this.inGame = this.pieces.filter(p => p.inGame);
        this.inGameTopPieces = this.inGame.filter(p => !this.inGame.find(p2 => p2.z > p.z && p2.x === p.x && p2.y === p.y));
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
        if (!this.pieces.find(p =>
            p.inGame && p.type.id === PieceType.queen.id &&
            p.color.id === colorId
        )) {
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
    #computePiecePlacements(otherSide = false) {
        let colorPlayingId = this.getColorPlaying().id;
        if (otherSide) {
            colorPlayingId = colorPlayingId === PieceColor.white.id ? PieceColor.black.id : PieceColor.white.id;
        }
        let hudTopPieces = this.pieces.filter(p => p.color.id === colorPlayingId && !p.inGame);
        hudTopPieces = hudTopPieces.filter(p => !hudTopPieces.find(p2 => p2.z > p.z && p2.type.id === p.type.id));

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
            const queen = hudTopPieces.find(p => p.type.id === PieceType.queen.id);
            if (queen) {
                hudTopPieces = [queen];
            }
        }
        let total = 0;
        this.piecePlacement(colorPlayingId).forEach(([x, y]) => hudTopPieces.forEach(p => {
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
                if (this.inGameTopPieces.find(p => p.x === x && p.y === y)) {
                    return;
                }

                // check if empty space has only same color piece around
                const differentColorPieceAround = colorId !== null && Board.coordsAround(x, y).find(([x2, y2]) =>
                    (ignore_x !== x2 || ignore_y !== y2) &&
                    this.inGameTopPieces.find(p => p.x === x2 && p.y === y2 && p.color.id !== colorId)
                );
                if (!differentColorPieceAround) {
                    ret.push([x, y]);
                }
            });
        });
        return ret;
    }
    // noinspection JSUnusedLocalSymbols
    play(to, p, moveSteps = [], callbackMove = (piece, extraPieceMoving) => {}) {
        callbackMove(p, false);
        const [fromX, fromY, fromZ] = [p.x, p.y, p.z];
        const [toX, toY, toZ] = to;
        if (p.type.id === PieceType.mantis.id && fromZ === 0 && fromX !== null && fromY !== null && toZ === 1) {
            // mantis special move
            const p2 = this.inGame.find(p2 => p2.x === toX && p2.y === toY && p2.z === 0);
            callbackMove(p2, true);
            p2.play(fromX, fromY, 0);
            p.play(fromX, fromY, 1);
        } else if (p.type.id === PieceType.dragonfly.id && fromX !== null && fromY !== null && fromZ > 0 && toZ === 0) {
            // dragonfly special move
            const p2 = this.inGame.find(p2 => p2.x === fromX && p2.y === fromY && p2.z === p.z - 1);
            callbackMove(p2, true);
            p2.play(toX, toY, 0);
            p.play(toX, toY, 1);
        } else if (fromX !== null && fromY !== null && p.type.id === PieceType.centipede.id && toZ > 0) {
            // centipede special move
            const p2 = this.inGame.find(p2 => p2.x === toX && p2.y === toY && p2.z === 0);
            callbackMove(p2, true);
            p2.play(fromX, fromY, 0, [[p2.x, p2.y, p2.z], [toX, toY, 0], [fromX, fromY, 0]]);
            p.play(toX, toY, 0, [[p.x, p.y, p.z], [toX, toY, 1], [toX, toY, 0]]);
        } else {
            callbackMove(p, false);
            p.play(toX, toY, toZ, moveSteps);
        }
    }
    // noinspection JSUnusedLocalSymbols
    playBack(from, p, moveSteps = [], callbackMove = (piece, extraPieceMoving) => {}) {
        const [fromX, fromY, fromZ] = from;
        const [toX, toY, toZ] = [p.x, p.y, p.z];
        callbackMove(p, false);
        if (p.type.id === PieceType.mantis.id && fromZ === 0 && fromX !== null && fromY !== null && toZ === 1) {
            // mantis special move
            const p2 = this.inGame.find(p2 => p2.x === fromX && p2.y === fromY && p2.z === 0);
            callbackMove(p2, true);
            p2.play(toX, toY, 0);
            p.play(fromX, fromY, 0);
        } else if (p.type.id === PieceType.dragonfly.id && fromX !== null && fromY !== null && fromZ > 0 && toZ === 0) {
            // dragonfly special move
            const p2 = this.inGame.find(p2 => p2.x === toX && p2.y === toY && p2.z === p.z - 1);
            callbackMove(p2, true);
            p2.play(fromX, fromY, fromZ - 1);
            p.play(fromX, fromY, fromZ);
        } else if (p.type.id === PieceType.centipede.id && toZ > 0) {
            // centipede special move
            const p2 = this.inGame.find(p2 => p2.x === fromX && p2.y === fromY && p2.z === 0);
            callbackMove(p2, true);
            p2.play(toX, toY, 0, [[p2.x, p2.y, p2.z], [toX, toY, 0], [toX, toY, 0]]);
            p.play(fromX, fromY, 0, [[p.x, p.y, p.z], [toX, toY, 1], [fromX, fromY, 0]]);
        } else {
            p.play(fromX, fromY, fromZ, moveSteps.toReversed());
        }
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
    flyZ() {
        return Math.max.apply(0, this.inGameTopPieces.map(p => p.z)) + 1;
    }

    getColorPlaying() {
        return this.round % 2 === 1 ? PieceColor.white : PieceColor.black;
    }

}
