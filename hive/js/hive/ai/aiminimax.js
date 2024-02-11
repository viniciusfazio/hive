import {PieceColor} from "../core/piece.js";
import Board from "../core/board.js";
import QueenEvaluator from "./queenevaluator.js";

// how many iterations until report iteration count
const ITERATION_STEP = 1000;
// max depth to sort moves by computing board evaluation of the move. It is the best sort, but too slow
const MAX_DEPTH_TO_PEEK_NEXT_MOVE = 2;

// last moved pieces are reset on play back, so keep them saved
let lastMovedPiecesId = null;
// keep track of the evaluation of all visited moves, to rapidly respond if any repeat
let visited = null
let board = null;
let initialMaximizing = null;
let evaluator = null;
let state = null;
let initialMoves = null;
onmessage = e => {
    state = e.data;
    state.iterations = 0;
    state.evaluation = null;
    if (state.board !== null) {
        // new board received
        board = new Board(state.board);
        lastMovedPiecesId = [...board.lastMovedPiecesId];
        initialMoves = board.getMoves();
        initialMaximizing = board.getColorPlaying().id === PieceColor.white.id;
        // clean board to not send it back
        state.board = null;
        switch (state.evaluatorId) {
            case "queenai":
                evaluator = new QueenEvaluator();
                break;
            default:
                throw new Error('Invalid evaluator');
        }
        state.evaluatorId = null;
    } else {
        // the board has no last moves as it ended by playing back in previous depth computing
        board.lastMovedPiecesId = [...lastMovedPiecesId];
    }
    // reset visited moves
    visited = new Map();
    alphaBeta(0, state.alpha, state.beta, initialMaximizing, [initialMoves[state.moveId]]);
    state.done = true;
    postMessage(state);
};
function evaluate(board) {
    return Math.max(-state.maxEvaluation + 1, Math.min(state.maxEvaluation - 1, evaluator.evaluate(board)));
}

function getSortedMovesPeekingNextMove(board, maximizing) {
    // sort moves by evaluation the board of each move
    const movesWithScore = board.getMoves().map(move => {
        const [from, to, p, ] = move;
        board.play(from, to, p);
        const evaluation = evaluate(board);
        board.playBack(from, to, p);
        return {
            move: move,
            evaluation: evaluation,
        };
    });
    return maximizing ?
        movesWithScore.sort((a, b) => b.evaluation - a.evaluation).map(m => m.move) :
        movesWithScore.sort((a, b) => a.evaluation - b.evaluation).map(m => m.move);
}
function alphaBeta(depth, alpha, beta, maximizing, moves = null) {
    // count iterations
    if (++state.iterations % ITERATION_STEP === 0) {
        postMessage(state);
        state.iterations = 0;
    }
    // check terminal state or max depth reached
    const whiteDead = board.isQueenDead(PieceColor.white.id);
    const blackDead = board.isQueenDead(PieceColor.black.id);
    if (whiteDead && blackDead) {
        return 0;
    } else if (whiteDead) {
        return -state.maxEvaluation;
    } else if (blackDead) {
        return state.maxEvaluation;
    } else if (depth >= state.maxDepth) {
        return evaluate(board);
    }

    // get sorted moves to be computed
    if (moves === null) {
        if (depth <= Math.min(MAX_DEPTH_TO_PEEK_NEXT_MOVE, state.maxDepth - 2)) {
            moves = getSortedMovesPeekingNextMove(board, maximizing);
        } else {
            moves = evaluator.getSortedMoves(board);
        }
        if (moves.length === 0) {
            moves.push(null);
        }
    }
    let evaluation = null;
    for (const move of moves) {
        // check the move
        if (move !== null) {
            const [from, to, p, ] = move;
            board.play(from, to, p);
        } else {
            board.pass();
        }
        // if it is a repeated move, it is already computed
        const str = depth + board.stringfy();
        let childEvaluation = visited.get(str);
        if (typeof childEvaluation === "undefined") {
            // if not, compute it and save it for later
            childEvaluation = alphaBeta(depth + 1, alpha, beta, !maximizing);
            visited.set(str, childEvaluation);
        }
        // undo the move
        if (move !== null) {
            const [from, to, p, ] = move;
            board.playBack(from, to, p);
        } else {
            board.passBack();
        }
        // check if evaluation is the best
        const newBestMove = evaluation === null ||
            maximizing && childEvaluation > evaluation ||
            !maximizing && childEvaluation < evaluation;
        if (newBestMove) {
            evaluation = childEvaluation;
            if (depth === 0) {
                state.evaluation = evaluation;
            }
            // updates alpha and beta, and prune if necessary
            if (maximizing) {
                if (evaluation >= beta) {
                    break;
                }
                alpha = Math.max(alpha, evaluation);
            } else {
                if (evaluation <= alpha) {
                    break;
                }
                beta = Math.min(beta, evaluation);
            }
        }
    }
    return evaluation;
}
