import {PieceColor} from "../core/piece.js";
import Board from "../core/board.js";
import {getEvaluator, getMoves} from "../player/aiplayer.js";

const ITERATION_STEP = 1000;
const MAX_EVALUATION = 999999;
const MAX_DEPTH = 6;

let board = null;
let initialMoves = null;
onmessage = e => {
    const state = e.data;
    state.iterations = 0;
    let evaluator = getEvaluator(state.evaluatorId);
    if (state.board !== null) {
        board = new Board(state.board);
        board.computeLegalMoves(true, true);
        initialMoves = getMoves(board, evaluator);
    }
    const maximizing = board.getColorPlaying().id === PieceColor.white.id;
    alphaBeta(board, evaluator, state, maximizing, 0, state.alpha, state.beta, [initialMoves[state.moveId]]);
    state.done = true;
    postMessage(state);
};

function alphaBeta(board, evaluator, state, maximizing, depth, alpha, beta, moves = null) {
    if (moves === null) {
        moves = getMoves(board, evaluator);
    }

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
        return -MAX_EVALUATION;
    } else if (blackDead) {
        return MAX_EVALUATION;
    } else if (depth >= MAX_DEPTH) {
        return evaluator.evaluate(board);
    } else if (moves.length === 0) {
        moves.push(null);
    }

    // iterate minimax
    let evaluation = null;
    for (const move of moves) {
        if (move !== null) {
            const [, to, p, ] = move;
            board.play(to, p);
        }
        board.round++;
        board.computeLegalMoves(true, true);
        const childEvaluation = alphaBeta(board, evaluator, state, !maximizing, depth + 1, alpha, beta);
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
            const [from, , p, ] = move;
            board.playBack(from, p);
        }
        board.round--;
        if (maximizing) {
            if (alpha === null || evaluation > alpha) {
                alpha = evaluation;
            }
            if (beta !== null && evaluation - beta > -1e-4) {
                break;
            }
        } else {
            if (beta === null || evaluation < beta) {
                beta = evaluation;
            }
            if (alpha !== null && evaluation - alpha < 1e-4) {
                break;
            }
        }
    }
    return evaluation;
}
