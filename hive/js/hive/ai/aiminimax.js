import {PieceColor} from "../core/piece.js";
import Board from "../core/board.js";
import {getEvaluator, getMoves} from "../player/aiplayer.js";

const ITERATION_STEP = 1000;

let board = null;
let initialMoves = null;
let evaluator = null;
let state = null;

onmessage = e => {
    state = e.data;
    state.iterations = 0;
    if (state.board !== null) {
        board = new Board(state.board);
        state.board = null;
        evaluator = getEvaluator(state.evaluatorId);
        state.evaluatorId = null;
        board.computeLegalMoves(true);
        initialMoves = getMoves(board, evaluator);
    }
    const maximizing = board.getColorPlaying().id === PieceColor.white.id;
    alphaBeta(0, state.alpha, state.beta, maximizing, [initialMoves[state.moveId]]);
    state.done = true;
    postMessage(state);
};

function alphaBeta(depth, alpha, beta, maximizing, moves = null) {
    // check terminal state or end depth
    const whiteDead = board.isQueenDead(PieceColor.white.id);
    const blackDead = board.isQueenDead(PieceColor.black.id);
    state.iterations++;
    if (state.iterations % ITERATION_STEP === 0) {
        postMessage(state);
        state.iterations = 0;
    }
    if (whiteDead && blackDead) {
        return 0;
    } else if (whiteDead) {
        return -state.maxEvaluation;
    } else if (blackDead) {
        return state.maxEvaluation;
    } else if (depth >= state.maxDepth) {
        board.computeLegalMoves(true, true);
        return Math.max(-state.maxEvaluation + 1, Math.min(state.maxEvaluation - 1, evaluator.evaluate(board)));
    }

    // iterate minimax
    if (depth > 0) {
        board.computeLegalMoves(true);
        moves = getMoves(board, evaluator);
        if (moves.length === 0) {
            moves.push(null);
        }
    }
    let evaluation = null;
    for (const move of moves) {
        if (move !== null) {
            const [from, to, p, ] = move;
            board.play(from, to, p);
        } else {
            board.pass();
        }
        const childEvaluation = alphaBeta(depth + 1, alpha, beta, !maximizing);
        if (evaluation === null || maximizing && childEvaluation > evaluation || !maximizing && childEvaluation < evaluation) {
            evaluation = childEvaluation;
            if (depth === 0) {
                const [, , p, t] = move;
                state.pieceId = p.id;
                state.target = t;
                state.evaluation = evaluation;
            }
        }
        if (move !== null) {
            const [from, to, p, ] = move;
            board.playBack(from, to, p);
        } else {
            board.passBack();
        }
        if (maximizing) {
            if (evaluation >= beta) {
                break;
            }
            if (evaluation > alpha) {
                alpha = evaluation;
            }
        } else {
            if (evaluation <= alpha) {
                break;
            }
            if (evaluation < beta) {
                beta = evaluation;
            }
        }
    }
    return evaluation;
}
