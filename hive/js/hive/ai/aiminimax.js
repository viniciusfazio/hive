import {BLACK, WHITE} from "../core/piece.js";
import Board from "../core/board.js";
import AIPlayer from "../player/aiplayer.js";

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
let msg = null;
let initialMoves = null;
let initTime = null;
onmessage = e => {
    msg = e.data;
    msg.iterations = 0;
    msg.evaluation = null;
    msg.done = false;
    if (msg.board !== null) {
        // new board received
        evaluator = AIPlayer.getEvaluator(msg.evaluatorId);
        board = new Board(msg.board);
        lastMovedPiecesId = [...board.lastMovedPiecesId];
        initialMoves = board.getMoves();
        initialMaximizing = board.getColorPlaying() === WHITE;
        // clean board to not send it back
        msg.board = null;
        msg.evaluatorId = null;
    } else {
        // the board has no last moves as it ended by playing back in previous depth computing
        board.lastMovedPiecesId = [...lastMovedPiecesId];
    }
    if (msg.pieceId !== null && msg.targetCoords !== null) {
        const [x, y, z] = msg.targetCoords;
        const move = initialMoves.find(([, , p, t]) => p.id === msg.pieceId && t.x === x && t.y === y && t.z === z);
        if (!move) {
            throw Error("Invalid move on minimax");
        }
        visited = new Map();
        initTime = Date.now();
        alphaBeta(0, msg.alpha, msg.beta, initialMaximizing, [move]);
        msg.time = Date.now() - initTime;
        msg.done = true;
        postMessage(msg);
    }
};

function alphaBeta(depth, alpha, beta, maximizing, moves = null) {
    // count iterations
    if (++msg.iterations % ITERATION_STEP === 0) {
        msg.time = Date.now() - initTime;
        postMessage(msg);
        msg.iterations = 0;
    }
    // check terminal state or max depth reached
    const whiteDead = board.isQueenDead(WHITE);
    const blackDead = board.isQueenDead(BLACK);
    if (whiteDead && blackDead) {
        return 0;
    } else if (whiteDead) {
        return -msg.maxEvaluation;
    } else if (blackDead) {
        return msg.maxEvaluation;
    } else if (depth >= msg.maxDepth) {
        return AIPlayer.evaluate(board, evaluator);
    }

    // get sorted moves to be computed
    if (moves === null) {
        if (depth <= Math.min(MAX_DEPTH_TO_PEEK_NEXT_MOVE, msg.maxDepth - 2)) {
            moves = AIPlayer.getSortedMovesPeekingNextMove(board, evaluator);
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
        const boardStr = depth + board.stringfy();
        let childEvaluation = visited.get(boardStr);
        if (typeof childEvaluation === "undefined") {
            // if not, compute it and save it for later
            childEvaluation = alphaBeta(depth + 1, alpha, beta, !maximizing);
            visited.set(boardStr, childEvaluation);
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
                msg.evaluation = evaluation;
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
