
export default class MoveNode {
    parentMove;
    nextMoves = [];
    move;
    constructor(move, parentMove = null) {
        this.move = move;
        this.parentMove = parentMove;
    }
}
