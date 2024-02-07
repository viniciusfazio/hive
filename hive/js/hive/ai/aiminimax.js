import {PieceColor} from "../core/piece.js";
import QueenEvaluator from "./queenevaluator.js";
import Board from "../core/board.js";


const ITERATION_STEP = 1000;
const MAX_EVALUATION = 999999;
const MAX_DEPTH = 4;

onmessage = e => {
    let evaluator = null;
    switch (e.data.evaluator) {
        case "queenai":
            evaluator = new QueenEvaluator();
            break;
        default:
            throw new Error('Invalid evaluator');
    }
    const board = new Board(e.data.board);
    board.computeLegalMoves(true, true);

    const state = e.data.state;

    const colorId = board.getColorPlaying().id;

    // send first evaluation
    state.evaluation = evaluator.evaluate(board, colorId);
    postMessage(state);

    alphaBeta(board, evaluator, state, colorId === PieceColor.white.id);
    state.done = true;
    postMessage(state);
};

function alphaBeta(board, evaluator, state, maximizing, depth = 0, alpha = null, beta = null) {
    // sort moves
    const moves = [];
    board.pieces.forEach(p => p.targets.forEach(t => moves.push([[p.x, p.y, p.z], [t.x, t.y, t.z], p, t])));
    evaluator.sortMoves(board, moves);

    // check terminal state or end depth
    const whiteDead = board.isQueenDead(PieceColor.white.id);
    const blackDead = board.isQueenDead(PieceColor.black.id);
    state.iterations++;
    if (state.iterations % ITERATION_STEP === 0) {
        postMessage(state);
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
                postMessage(state);
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
