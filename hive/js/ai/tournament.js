import AIPlayer from "../player/aiplayer.js";
import {extractEvaluatorId, packEvaluatorId} from "./evaluator.js";
import {PIECE_STANDARD, PIECE_TXT, WHITE} from "../core/piece.js";


const CHAMPIONS = .33;
const MIN_QTD_PARAM = 3;
export default class Tournament {
    #standardRules;
    #hive;
    #whitePlayer;
    #blackPlayer;
    game;
    generation;

    players;
    #callbacks;

    #timeStart;
    constructor(hive, standardRules, callbacks) {
        this.#hive = hive;
        this.#callbacks = callbacks;
        this.#standardRules = standardRules;
        if (hive.whitePlayer) {
            hive.whitePlayer.reset();
        }
        if (hive.blackPlayer) {
            hive.blackPlayer.reset();
        }
        this.#whitePlayer = new AIPlayer(hive);
        this.#blackPlayer = new AIPlayer(hive);
        this.#whitePlayer.maxDepth = 4;
        this.#blackPlayer.maxDepth = 4;
    }
    start(qtyPlayers = 6) {
        this.players = [{
            evaluatorId: this.#whitePlayer.evaluatorId,
            score: 0,
            origin: "default player",
        }];
        for (let i = 1; i < qtyPlayers; i++) {
            let evaluatorId = this.#whitePlayer.evaluatorId.slice(0);
            do {
                evaluatorId = mutate(evaluatorId, this.#standardRules);
            } while (evaluatorId === null || Math.random() < .8);
            if (this.players.find(p => p.evaluatorId === evaluatorId)) {
                i--;
                continue;
            }
            this.players.push({
                evaluatorId: evaluatorId,
                score: 0,
                origin: "big mutation from default player",
            });
        }
        this.game = 0;
        this.generation = 1;
        this.#callbacks.generationStart(this.players, this.generation);
        this.proceed();
    }

    proceed(whiteDead = false, blackDead = false) {
        if (whiteDead || blackDead) {
            let [p1, p2] = getPlayersIndex(this.game, this.players);
            if (whiteDead && blackDead) {
                this.players[p1].score++;
                this.players[p2].score++;
            } else if (whiteDead) {
                this.players[p2].score += 2;
            } else {
                this.players[p1].score += 2;
            }
            this.#callbacks.gameResult(whiteDead, blackDead, Math.round((Date.now() - this.#timeStart) / 100) / 10);
        }
        let [p1, p2] = getPlayersIndex(++this.game, this.players);
        if (p1 === p2) {
            [p1, p2] = getPlayersIndex(++this.game, this.players);
        }
        if (p1 >= this.players.length) {
            this.#nextGeneration();
        } else {
            this.#whitePlayer.evaluatorId = this.players[p1].evaluatorId;
            this.#blackPlayer.evaluatorId = this.players[p2].evaluatorId;
            this.#timeStart = Date.now();
            this.#hive.newGame(WHITE, this.#whitePlayer, this.#blackPlayer, 0, 0, this.#standardRules, this);
        }
    }
    #nextGeneration() {
        this.players.sort((a, b) => b.score - a.score);
        this.#callbacks.generationResult(this.players, this.generation);

        const championCut = Math.round(CHAMPIONS * this.players.length);
        const newPlayers = [];
        for (let i = 0; i < this.players.length; i++) {
            let evaluatorId = null;
            let origin = null;
            if (i < championCut) {
                evaluatorId = this.players[i].evaluatorId;
                origin = "champion";
            } else if (Math.random() < .5) {
                const evaluatorIdToMutate = this.#selectEvaluatorId();
                evaluatorId = mutate(evaluatorIdToMutate, this.#standardRules);
                origin = "mutation of " + evaluatorIdToMutate;
            } else {
                const evaluatorId1 = this.#selectEvaluatorId();
                const evaluatorId2 = this.#selectEvaluatorId(evaluatorId1);
                evaluatorId = cross(evaluatorId1, evaluatorId2);
                origin = "crossover of " + evaluatorId1 + " and " + evaluatorId2;
            }
            if (evaluatorId === null || newPlayers.find(p => p.evaluatorId === evaluatorId)) {
                i--;
                continue;
            }
            newPlayers.push({
                evaluatorId: evaluatorId,
                score: 0,
                origin: origin,
            });
        }
        this.players = newPlayers;
        this.game = 0;
        this.generation++;
        this.#callbacks.generationStart(this.players, this.generation);
        this.proceed();
    }
    #selectEvaluatorId(ignore) {
        const total = this.players.reduce((s, p) => p.evaluatorId === ignore ? s : (p.score + s + 1), 0);
        let r = Math.floor(total * Math.random());
        for (const p of this.players) {
            if (p.evaluatorId !== ignore) {
                r -= p.score + 1;
                if (r < 0) {
                    return p.evaluatorId;
                }
            }
        }
        return null;
    }
}
export function getPlayersIndex(game, players) {
    return [Math.floor(game / players.length), game % players.length];
}

function mutate(evaluatorId, standardRules) {
    const [priority, maxParam, ] = extractEvaluatorId(evaluatorId);
    let newEvaluatorId = null;
    if (Math.random() < .2) { // change maxparam
        let newMaxParam = maxParam;
        if (maxParam <= MIN_QTD_PARAM) {
            newMaxParam++;
        } else if (maxParam >= 9 || Math.random() < .5) {
            newMaxParam--;
        } else {
            newMaxParam++;
        }
         newEvaluatorId = packEvaluatorId(priority, newMaxParam);
    }
    if (newEvaluatorId === null && Math.random() < .5) { // insert/delete
        const chosen = Math.floor(Math.random() * priority.length);
        const newPriority = [];
        if (priority.length > MIN_QTD_PARAM && Math.random() < .5) { // delete
            for (let i = 0; i < priority.length; i++) {
                if (i !== chosen) {
                    newPriority.push(priority[i]);
                }
            }
        }
        const piecesTxt = standardRules ? PIECE_TXT.filter((v, i) => PIECE_STANDARD[i]) : PIECE_TXT.slice(1);
        if (newPriority.length === 0) {
            for (let i = 0; i < priority.length; i++) {
                if (i === chosen) {
                    const decks = [];
                    includeToShuffle(evaluatorId, ["x", "X"], decks);
                    includeToShuffle(evaluatorId, ["x", "Z"], decks);
                    includeToShuffle(evaluatorId, piecesTxt.map(t => t[0]), decks);
                    includeToShuffle(evaluatorId, piecesTxt.map(t => t[1]), decks);

                    const deck = Math.floor(Math.random() * decks.length);
                    const letter = Math.floor(Math.random() * decks[deck].length);
                    newPriority.push(decks[deck][letter]);
                }
                newPriority.push(priority[i]);
            }
        }
        newEvaluatorId = packEvaluatorId(newPriority, maxParam);
    }
    if (newEvaluatorId === null) { // swap
        const from = Math.floor(Math.random() * (priority.length - 1)) + 1;
        let to = from - 1;
        while (to > 0 && Math.random() < .5) {
            to--;
        }
        const newPriority = [...priority];
        for (let i = to; i < from; i++) {
            newPriority[i + 1] = priority[i];
        }
        newPriority[to] = priority[from];
        newEvaluatorId = packEvaluatorId(newPriority, maxParam);
    }
    return newEvaluatorId;
}
function cross(evaluatorId1, evaluatorId2) {
    const [priority1, maxParam1, ] = extractEvaluatorId(evaluatorId1);
    const [priority2, maxParam2, ] = extractEvaluatorId(evaluatorId2);
    const priorities = Math.random() < .5 ? [priority1, priority2] : [priority2, priority1];
    const newPriority = [];
    const size = Math.ceil((priority1.length + priority2.length) / 2);
    for (let i = 1; newPriority.length < size; i++) {
        const turn = Math.floor(i / 2) % 2;
        while (priorities[turn].length > 0) {
            const letter = priorities[turn].shift();
            if (newPriority.indexOf(letter) < 0) {
                newPriority.push(letter);
                break;
            }
        }
    }
    const minParam = Math.min(maxParam1, maxParam2);
    const randomParam = minParam + Math.round(Math.random() * Math.abs(maxParam1 - maxParam2));
    return packEvaluatorId(newPriority, randomParam) ?? packEvaluatorId(newPriority, minParam);
}
function includeToShuffle(evaluatorId, items, decks) {
    const deck = [];
    for (const item of items) {
        if (evaluatorId.indexOf(item) < 0) {
            deck.push(item);
        }
    }
    if (deck.length > 0) {
        decks.push(deck);
    }
}