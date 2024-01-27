import Piece, {PieceColor, PieceType} from "./piece.js"
class Board {
    round;
    pieces;
    allPieces;
    lastMovedPiecesId;
    passRound;

    inGame;
    inGameTopPieces;
    #sameColorInGameTopPieces;

    #standardRules;

    constructor(board = null) {
        if (board) {
            this.round = board.round;
            this.lastMovedPiecesId = [...board.lastMovedPiecesId];
            this.passRound = board.passRound;
            this.allPieces = board.allPieces.map(piece => {
                const p = {...piece};
                // noinspection JSPrimitiveTypeWrapperUsage
                p.targets = [];
                return p;
            });
        } else {
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
        }
    }
    reset(standardRules) {
        this.round = 1;
        this.lastMovedPiecesId = [];
        this.passRound = false;
        this.#standardRules = standardRules;
        this.allPieces.forEach(p => p.reset());
        this.#computePieces();
    }
    isQueenDead(colorId) {
        const queen = this.pieces.find(p =>
            p.inGame &&
            p.type.id === PieceType.queen.id &&
            p.color.id === colorId
        );
        if (queen) {
            for (const [x, y] of Board.coordsAround(queen.x, queen.y)) {
                if (!this.inGameTopPieces.find(p => p.x === x && p.y === y)) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    #computePieces() {
        this.pieces = this.allPieces.filter(p =>
            (!this.#standardRules || p.type.standard) &&
            (
                this.#standardRules ||
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
    computeLegalMoves(canMove) {
        this.pieces.forEach(p => p.targets = []);
        this.#computePieces();
        this.inGame = this.pieces.filter(p => p.inGame);
        this.inGameTopPieces = this.inGame.filter(p => !this.inGame.find(p2 => p2.z > p.z && p2.x === p.x && p2.y === p.y));
        const colorPlayingId = this.getColorPlaying().id;
        this.#sameColorInGameTopPieces = this.inGameTopPieces.filter(p => p.color.id === colorPlayingId);
        this.passRound = false;
        if (this.isQueenDead(PieceColor.white.id) || this.isQueenDead(PieceColor.black.id)) {
            return;
        }
        if (canMove) {
            this.passRound = this.#computePiecePlacements() + this.#computeMoves() === 0;
        }
    }
    #computeMoves() {
        // cant move if queen is not in game
        if (!this.pieces.find(p =>
            p.inGame && p.type.id === PieceType.queen.id &&
            p.color.id === this.getColorPlaying().id
        )) {
            return 0;
        }
        let total = 0;
        this.#sameColorInGameTopPieces.forEach(p => {
            if (!this.lastMovedPiecesId.includes(p.id)) {
                p.type.play(this, p, this.#standardRules);
                total += p.targets.length;
            }
        });
        return total;
    }
    #computePiecePlacements() {
        const colorPlayingId = this.getColorPlaying().id;
        let piecesToBePlaced = this.pieces.filter(p => p.color.id === colorPlayingId && !p.inGame);

        // first and second moves are special cases
        if (this.round === 1) {
            piecesToBePlaced.forEach(p => p.insertTarget(0, 0, 0));
            return piecesToBePlaced.length;
        }
        if (this.round === 2) {
            for (const [x, y] of Board.coordsAround(0, 0)) {
                piecesToBePlaced.forEach(p => p.insertTarget(x, y, 0));
            }
            return 6 * piecesToBePlaced.length;
        }

        if (piecesToBePlaced.length === 0) {
            return 0;
        }

        // must place queen in 4th move
        if (this.round === 7 || this.round === 8) {
            const queen = piecesToBePlaced.find(p => p.type.id === PieceType.queen.id);
            if (queen) {
                piecesToBePlaced = [queen];
            }
        }

        return this.piecePlacement(colorPlayingId, piecesToBePlaced);
    }
    piecePlacement(colorId, piecesToBePlaced, ignore_x = null, ignore_y = null) {
        let visited = [];
        let total = 0;
        this.inGameTopPieces.filter(p => p.color.id === colorId).forEach(p => {
            // look for empty space around same color in game piece
            for (const [x, y] of Board.coordsAround(p.x, p.y)) {
                // skip if already visited
                if (visited.find(([rx, ry]) => rx === x && ry === y)) {
                    continue;
                }
                visited.push([x, y]);

                // skip if not empty
                if (this.inGameTopPieces.find(p => p.x === x && p.y === y)) {
                    continue;
                }

                // check if empty space has only same color piece around
                let ok = true;
                for (const [x2, y2] of Board.coordsAround(x, y)) {
                    if (ignore_x === x2 && ignore_y === y2) {
                        continue;
                    }
                    if (this.inGameTopPieces.find(p => p.x === x2 && p.y === y2 && p.color.id !== colorId)) {
                        ok = false;
                        break;
                    }
                }
                if (ok) {
                    piecesToBePlaced.forEach(piece => {
                        total++;
                        piece.insertTarget(x, y, 0);
                    });
                }
            }
        });
        return total;
    }
    static *coordsAround(x, y) {
        yield [x + 2, y + 0];
        yield [x + 1, y + 1];
        yield [x - 1, y + 1];
        yield [x - 2, y + 0];
        yield [x - 1, y - 1];
        yield [x + 1, y - 1];
    }

    getColorPlaying() {
        return this.round % 2 === 1 ? PieceColor.white : PieceColor.black;
    }

}
export default Board;
