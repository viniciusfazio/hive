import Player from "./player.js";

export default class AIPlayer extends Player {
    #initTurnTime;
    #running = false;
    #worker = null;
    state = new EvaluationState();
    evaluator = "queenai";

    initPlayerTurn() {
        if (this.#running) {
            return;
        }

        if (this.hive.board.passRound) {
            this.hive.pass();
            return;
        }
        const playable = this.hive.board.pieces.filter(p => p.targets.length > 0);
        if (playable.length === 0) {
            return;
        }
        if (playable.length === 1 && playable[0].targets.length === 1) {
            this.hive.play(playable[0], playable[0].targets[0]);
            return;
        }
        // minimax
        if (window.Worker) {
            if (this.#worker === null) {
                this.#worker = new Worker("js/hive/ai/aiminimax.js", {type: 'module'});
                this.#worker.onmessage = e => {
                    this.state = e.data;
                    if (this.state.done) {
                        this.#running = false;
                        const piece = this.hive.board.pieces.find(p => p.id === this.state.pieceId);
                        this.hive.play(piece, this.state.target);
                    }
                };
            }
            this.#initTurnTime = Date.now();
            this.#running = true;
            this.state = new EvaluationState();
            this.#worker.postMessage({
                board: this.hive.board,
                evaluator: this.evaluator,
                state: this.state,
            });
        } else {
            throw Error("Can't create thread for AI player");
        }
    }
    reset() {
        if (this.#worker) {
            this.#worker.terminate();
            this.#worker = null;
        }
    }
    getIterationsPerSecond() {
        if (!this.#running) {
            return "-";
        }
        return Math.round(1000 * this.state.iterations / (Date.now() - this.#initTurnTime)) + "/s";
    }

}
class EvaluationState {
    pieceId = null;
    target = null;
    evaluation = null;
    iterations = 0;
    done = false;
}

