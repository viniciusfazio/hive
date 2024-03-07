import AIPlayer from "../player/aiplayer";
import {extractEvaluatorId, packEvaluatorId} from "./evaluator";
import {PIECE_TXT} from "../core/piece";


const QTY_CHAMPIONS = 2;
const QTY_MUTATION = 2;
const QTY_CROSSOVER = 2;
const MIN_QTD_PARAM = 3;
export default class Tournament {
    #standardRules;
    #hive;


    #players;
    constructor(hive, standardRules) {
        this.#hive = hive;
        this.#standardRules = standardRules;
        if (hive.whitePlayer) {
            hive.whitePlayer.reset();
        }
        if (hive.blackPlayer) {
            hive.blackPlayer.reset();
        }
        hive.whitePlayer = new AIPlayer(hive);
        hive.blackPlayer = new AIPlayer(hive);

        this.#players = [hive.whitePlayer.evaluatorId];
        for (let i = 1; i < QTY_CHAMPIONS + QTY_MUTATION + QTY_CROSSOVER; i++) {
            let id = hive.whitePlayer.evaluatorId;
            do {
                id = mutate(id);
            } while (Math.random() < .8);
            this.#players.push(id);
        }
        // play all tournament
        // next gen
        // mutate
        // cross
    }
}

function mutate(id) {
    const [priority, maxParam, ] = extractEvaluatorId(id);
    let newId = null;
    if (Math.random() < .2) { // change maxparam
        let newMaxParam = maxParam;
        if (maxParam <= MIN_QTD_PARAM) {
            newMaxParam++;
        } else if (maxParam >= 9 || Math.random() < .5) {
            newMaxParam--;
        } else {
            newMaxParam++;
        }
         newId = packEvaluatorId(priority, newMaxParam);
    }
    if (newId === null && Math.random() < .5) { // insert/delete
        const chosen = Math.random() * priority.length;
        const newPriority = [];
        if (priority.length > MIN_QTD_PARAM && Math.random() < .5) { // delete
            for (let i = 0; i < priority.length; i++) {
                if (i !== chosen) {
                    newPriority.push(priority[i]);
                }
            }
        }
        if (newPriority.length === 0) {
            for (let i = 0; i < priority.length; i++) {
                if (i === chosen) {
                    const decks = [];
                    includeToShuffle(id, ["x", "X"], decks);
                    includeToShuffle(id, ["x", "Z"], decks);
                    includeToShuffle(id, PIECE_TXT.map(t => t[0]).slice(1), decks);
                    includeToShuffle(id, PIECE_TXT.map(t => t[1]).slice(1), decks);

                    const deck = Math.random() * decks.length;
                    const letter = Math.random() * decks[deck].length;
                    newPriority.push(decks[deck][letter]);
                }
                newPriority.push(priority[i]);
            }
        }
        newId = packEvaluatorId(newPriority, maxParam);
    }
    if (newId === null) { // swap
        const from = Math.random() * (priority.length - 1) + 1;
        let to = from - 1;
        while (to > 0 && Math.random() < .5) {
            to--;
        }
        const newPriority = [...priority];
        for (let i = to; i < from; i++) {
            newPriority[i + 1] = priority[i];
        }
        newPriority[to] = priority[from];
        newId = packEvaluatorId(newPriority, maxParam);
    }
    return newId;
}
function cross(id1, id2) {
    const [priority1, maxParam1, ] = extractEvaluatorId(id1);
    const [priority2, maxParam2, ] = extractEvaluatorId(id2);
    const priorities = Math.random() < .5 ? [priority1, priority2] : [priority2, priority1];
    const newPriority = [];
    const size = Math.ceil((id1.length + id2.length) / 2);
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
function includeToShuffle(id, items, decks) {
    const deck = [];
    for (const item of items) {
        if (id.indexOf(item) < 0) {
            deck.push(item);
        }
    }
    if (deck.length > 0) {
        decks.push(deck);
    }
}