import {PieceColor} from "../core/piece.js";
import Board from "../core/board.js";
import QueenEvaluator from "./queenevaluator.js";

const ITERATION_STEP = 1000;

let board = null;
let lastMovedPiecesId = null;
let initialMoves = null;
let evaluator = null;
let state = null;
let visited = null
onmessage = e => {
    state = e.data;
    state.iterations = 0;
    if (state.board !== null) {
        board = new Board(state.board);
        lastMovedPiecesId = [...board.lastMovedPiecesId];
        state.board = null;
        switch (state.evaluatorId) {
            case "queenai":
                evaluator = new QueenEvaluator();
                break;
            default:
                throw new Error('Invalid evaluator');
        }
        state.evaluatorId = null;
        board.computeLegalMoves(true);
        initialMoves = board.getMoves();
    } else {
        board.lastMovedPiecesId = [...lastMovedPiecesId];
    }

    visited = new Map();
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
    if (moves === null) {
        board.computeLegalMoves(true);
        moves = evaluator.sortMoves(board);
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
        const str = board.stringfy();
        const depthVisited = visited.get(str);
        if (!depthVisited || depthVisited > depth) {
            visited.set(str, depth);
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
