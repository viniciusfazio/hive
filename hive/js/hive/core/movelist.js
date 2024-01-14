
export default class Movelist {
    moves = [];
    totalTime;
    #increment;

    #lastMoveTimestamp = null;
    whitePiecesTimeLeft = null;
    blackPiecesTimeLeft = null;

    constructor(totalTime = 0, increment = 0) {
        this.totalTime = totalTime * 60;
        this.#increment = increment;
        this.whitePiecesTimeLeft = this.totalTime * 1000;
        this.blackPiecesTimeLeft = this.totalTime * 1000;
        if (totalTime > 0) {
            this.#lastMoveTimestamp = (new Date()).getTime();
        }
    }
    addMove(piece, target, time = null) {
        const move = new Move();
        move.id = piece.id;
        move.fromX = piece.x;
        move.fromY = piece.y;
        move.fromZ = piece.inGame ? piece.z : -1;
        move.toX = target.x;
        move.toY = target.y;
        move.toZ = target.z;
        if (this.totalTime > 0) {
            const now = (new Date()).getTime();
            if (time === null) {
                move.time = now - this.#lastMoveTimestamp;
            } else {
                move.time = time;
            }
            this.computeTime(time);
            move.whitePiecesTimeLeft = this.whitePiecesTimeLeft;
            move.blackPiecesTimeLeft = this.blackPiecesTimeLeft;
            this.#lastMoveTimestamp = now;
        }
        this.moves.push(move);
    }
    computeTime(time = null) {
        if (this.totalTime === 0 || this.whitePiecesTimeLeft === 0 || this.blackPiecesTimeLeft === 0) {
            return false;
        }
        let totalTime = (this.totalTime + Math.floor(this.moves.length / 2) * this.#increment) * 1000;
        let timePast = 0;
        this.moves.forEach((move, i) => {
            if (i % 2 === this.moves.length % 2) {
                timePast += move.time;
            }
        });
        if (time === null) {
            timePast += (new Date()).getTime() - this.#lastMoveTimestamp;
        } else {
            timePast += time;
        }
        const timeLeft = Math.max(0, totalTime - timePast);
        if (this.moves.length % 1 === 0) {
            this.whitePiecesTimeLeft = timeLeft;
        } else {
            this.blackPiecesTimeLeft = timeLeft;
        }
        return true;
    }
    goTo(board, round) {
        round = Math.max(1, Math.min(round, this.moves.length + 1));
        let result = null;
        if (Hive.rodada < rodada) {
            for (let r = Hive.rodada; r < rodada; r++) { // "joga"
                const j = Hive.jogadas[r - 1];
                if (j.passe) {
                    resultado = null;
                } else if (j.draw) {
                    resultado = {
                        msg: "Draw agreed!",
                        notacao: "draw",
                        pecasComX: [],
                    };
                } else if (j.timeout || j.resign) {
                    const win = Hive.corJogador === CorPeca.preto ? "White wins" : "Black wins";
                    const cor = Hive.corJogador === CorPeca.preto ? "Black" : "White";
                    resultado = {
                        msg: j.timeout ? "Time is over. " + win : cor + " resigns. " + win + "!",
                        notacao: win.toLowerCase(),
                        pecasComX: [],
                    };
                } else {
                    resultado = j.passe ? null : Hive.pecas.find(p => p.id === j.id).play(j.x2, j.y2, j.z2, j.emHud2);
                }
            }
        } else if (Hive.rodada > rodada) {
            for (let r = Hive.rodada - 1; r >= rodada; r--) { // "desjoga"
                const j = Hive.jogadas[r - 1];
                if (j.passe || j.timeout || j.resign || j.draw) {
                    resultado = null;
                } else {
                    resultado = Hive.pecas.find(p => p.id === j.id).play(j.x1, j.y1, j.z1, j.emHud1);
                }
            }
        } else { // pediu para ficar na mesma rodada
            Hive.draw();
            return;
        }
        // define a última jogada
        Hive.ultimaId = rodada < 2 ? null : Hive.jogadas[rodada - 2].id;
        if (Hive.ultimaId === null && rodada >= 2 && Hive.jogadas[rodada - 2].passe) {
            // se foi passe, marca o botão de passe como última jogada
            const cor = rodada % 2 === 0 ? CorPeca.branco : CorPeca.preto;
            Hive.ultimaId = Hive.pecas.find(p => p.tipo.nome === TipoPeca.pass.nome && p.cor === cor).id;
        }
        // inicia a rodada pedida
        console.log(resultado);
        //console.log(Hive.fimDeJogo ? "Fim" : "NAO FIM");
        Hive.iniciaRodada(rodada, resultado);
        if (insereJogada) {
            if (Hive.conn && Hive.corJogando !== Hive.corJogadorEmbaixo) {
                const jogada = Hive.jogadas[Hive.jogadas.length - 1];
                Hive.conn.send({
                    tipo: "jogada",
                    jogada: jogada.notacao(),
                    time: jogada.time,
                })
            }
            insertListaJogadas();
            if (Hive.fimDeJogo && resultado) {
                insertListaJogadas(resultado.notacao);
            }
        }

    }
}
class Move {
    piece = null;
    fromX = null;
    fromY = null;
    fromZ = null;
    toX = null;
    toY = null;
    toZ = null;
    pass = false;
    resign = false;
    timeout = false;
    time = null;
    whitePiecesTimeLeft = null;
    blackPiecesTimeLeft = null;
}

