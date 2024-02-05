import Player from "./player.js";
import {PieceColor} from "../core/piece.js";
import {Move} from "../core/movelist.js";

const PING_CHECK = 3000;      // check ping every n milliseconds

export default class OnlinePlayer extends Player {
    #peer;
    #conn;
    #challenge;
    #pingSendTime;
    ping = 0;
    initPlayerTurn() {
        const moveList = this.hive.getMoveList();
        if (this.#conn && moveList.moves.length > 0) {
            const lastMove = moveList.moves[moveList.moves.length - 1];
            this.#conn.send({
                type: "move",
                move: Move.notation(lastMove, this.hive.board),
                time: lastMove.time,
            });
        }
    }
    disconnect(callbacks) {
        if (this.#conn) {
            this.#conn.send({type: "quit"});
            this.#peer.disconnect();
            this.#resetConnection(callbacks, false);
            callbacks.disconnect();
        }
    }
    connect(remote, callbacks) {
        if (!remote.match(/^[0-9a-z-]{36}$/)) {
            callbacks.error("Remote ID is not valid.");
            return;
        }
        this.#initPeer(callbacks);
        this.#peer.on("open", () => {
            this.#conn = null;
            this.#initConn(this.#peer.connect(remote), callbacks);
            this.#conn.on("open", () => this.#conn.send({type: "connect"}));
        });
        this.#peer.on("connection", conn => {
            conn.on("open", () => {
                conn.send("quit");
                setTimeout(() => { conn.close(); }, 500);
            });
        });
    }
    waitForConnection(callbacks) {
        this.#initPeer(callbacks);
        this.#peer.on('open', id => callbacks.waiting(id));
        this.#peer.on('connection', conn => {
            // Allow only a single connection
            if (this.#conn?.open) {
                conn.on('open', () => {
                    conn.send("quit");
                    setTimeout(() => { conn.close(); }, 500);
                });
                return;
            }
            this.#conn = null;
            this.#initConn(conn, callbacks);
        });

    }
    #initPeer(callbacks) {
        this.#peer = new peerjs.Peer();
        this.#peer.on("error", callbacks.error);
        this.#peer.on("disconnected", () => this.#resetConnection(callbacks));
        this.#peer.on("close", () => this.#resetConnection(callbacks));
    }
    #initConn(conn, callbacks) {
        this.#conn = conn;
        conn.on("data", data => {
            // console.log(data);
            switch (data.type) {
                case "connect":
                    this.#conn.send({type: "connected"});
                    this.hive.resign();
                    callbacks.connected();
                    break;
                case "connected":
                    this.hive.resign();
                    callbacks.connected();
                    break;
                case "quit":
                    callbacks.opponentDisconnects();
                    this.#resetConnection(callbacks, false);
                    break;
                case "draw":
                    callbacks.opponentOffersDraw();
                    break;
                case "new":
                    const color = data.color === "b" || data.color !== "w" && Math.random() < .5 ? "w" : "b";
                    const colorOpponent = color === "b" ? "w" : "b";
                    this.#challenge = {
                        type: "new_ok",
                        colorAccepted: color,
                        color: colorOpponent,
                        totalTime: data.totalTime,
                        increment: data.increment,
                        standardRules: data.standardRules,
                    };
                    callbacks.opponentOffersNewGame(data.color, data.totalTime, data.increment, data.standardRules);
                    break;
                case "new_ok":
                    const bottomColor = data.color === "w" ? PieceColor.white : PieceColor.black;
                    callbacks.newGame(bottomColor, data.totalTime, data.increment, data.standardRules);
                    break;
                case "draw_ok":
                    this.hive.draw();
                    break;
                case "move":
                    this.hive.playNotation(data.move, data.time);
                    break;
                case "ping":
                    this.#conn.send({type: "pong"});
                    break;
                case "pong":
                    this.#pong();
                    break;
            }
        }).on("close", () => this.#resetConnection(callbacks));
        setTimeout(() => this.#ping(), PING_CHECK);
    }
    newGame(color, totalTime, increment, standardRules) {
        this.#conn.send({
            type: "new",
            color: color,
            totalTime: totalTime,
            increment: increment,
            standardRules: standardRules,
        });
    }
    draw() {
        this.#conn.send({type: "draw"});
    }
    acceptNewGame(callbacks) {
        if (this.#conn) {
            this.#conn.send(this.#challenge);
            const bottomColor = this.#challenge.colorAccepted === "w" ? PieceColor.white : PieceColor.black;
            callbacks.newGame(bottomColor, this.#challenge.totalTime, this.#challenge.increment, this.#challenge.standardRules);
        }
    }
    acceptDraw() {
        if (this.#conn) {
            this.#conn.send({type: "draw_ok"});
            this.hive.draw();
        }
    }
    #resetConnection(callbacks, showNotification = true) {
        callbacks.connectionBroken(showNotification);
        this.#conn = null;
    }
    #ping() {
        if (this.#conn) {
            this.#pingSendTime = Date.now();
            this.#conn.send({type: "ping"});
        }
    }
    #pong() {
        this.ping = Math.ceil((Date.now() - this.#pingSendTime) / 2);
        setTimeout(() => this.#ping(), PING_CHECK);
    }

}
