
const CorPeca = {
  branco: "rgb(140, 140, 140)",
  preto: "rgb(50, 50, 50)",
}
const TipoPeca = {
  queen: {
    nome: "queen",
    posicao: 1,
    quantidade: 1,
  },
  ant: {
    nome: "ant",
    posicao: 2,
    quantidade: 3,
  },
  mosquito: {
    nome: "mosquito",
    posicao: 3,
    quantidade: 1,
  },
  ladybug: {
    nome: "ladybug",
    posicao: 4,
    quantidade: 1,
  },
  grasshopper: {
    nome: "grasshopper",
    posicao: 5,
    quantidade: 3,
  },
  pillbug: {
    nome: "pillbug",
    posicao: 6,
    quantidade: 1,
  },
  spider: {
    nome: "spider",
    posicao: 7,
    quantidade: 2,
  },
  beetle: {
    nome: "beetle",
    posicao: 8,
    quantidade: 2,
  },
};

class Hive {
  // id da peça selecionada
  static selectedId;

  // id da casa/peça em que o mouse está em cima
  static hoverId;

  // id da última peça movida
  static ultimaId;

  static corJogadorEmbaixo;

  // todas peças
  static pecas;

  // rodada, começando em 1. Jogada 1 é do branco, 2 é do preto, etc.
  static #rodada;

  // marca o frame atual (DEBUG)
  static #frame;

  static init(corJogadorEmbaixo) {
    Hive.corJogadorEmbaixo = corJogadorEmbaixo;
    Hive.#rodada = 0;
    Hive.#frame = 0;
    Hive.pecas = [];
    Hive.ultimaId = null;
    for (const keyCor in CorPeca) {
      for (const keyTipo in TipoPeca) {
        const tipo = TipoPeca[keyTipo];
        for (let z = 0; z < tipo.quantidade; z++) {
          Hive.pecas.push(new Peca(CorPeca[keyCor], tipo, z));
        }
      }
    }
    Hive.#updateJogadas();
  }
  static draw() {
    Hive.#frame++;
    const canvas = document.getElementById("hive");
    const ctx = canvas.getContext("2d");

    // limpa tela
    ctx.fillStyle = "rgb(100, 100, 60)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // desenha peças em jogo
    Hive.#drawPecas(ctx, canvas.width, canvas.height, false, Hive.pecas);
    if (Hive.selectedId !== null) {
      const hover = Hive.hoverId === null ? null : Hive.pecas.find(peca => peca.id === Hive.hoverId) ?? null;
      const destinos = hover === null ? null : hover.destinos;
      if (destinos !== null) {
        // desenha as jogadas possíveis da nova peça a ser selecionada
        Hive.#drawPecas(ctx, canvas.width, canvas.height, false, destinos);
      } else {
        // peça já selecionada, desenha as jogadas possíveis dela
        const destinos = Hive.pecas.find(peca => peca.id === Hive.selectedId).destinos;
        Hive.#drawPecas(ctx, canvas.width, canvas.height, false, destinos);
      }
    } else if (Hive.hoverId !== null) {
      // desenha as jogadas possíveis da peça sob o mouse
      const destinos = Hive.pecas.find(peca => peca.id === Hive.hoverId).destinos;
      Hive.#drawPecas(ctx, canvas.width, canvas.height, false, destinos);
    }

    // desenha hud
    ctx.fillStyle = "rgb(0, 0, 0, .5)";
    ctx.fillStyle = "rgb(" + (Hive.#frame % 256) + ", " + (Hive.#frame % 256) + ", " + (Hive.#frame % 256) + ", .5)"; // DEBUG
    const height = 6 * Peca.RAIO;
    ctx.fillRect(0, 0, canvas.width, height);
    ctx.fillRect(0, canvas.height - height, canvas.width, height);

    // desenha peças no hud
    Hive.#drawPecas(ctx, canvas.width, canvas.height, true, Hive.pecas);
  }
  static #drawPecas(ctx, width, height, emHud, pecas, z = 0) {
    let pecasAcima = [];
    pecas.forEach(peca => {
      if (peca.emHud === emHud) {
        if (peca.z > z) {
          // se for peça acima, guarda para depois
          pecasAcima.push(peca);
        } else {
          peca.draw(ctx, width, height);
        }
      }
    });
    // redesenha última peça jogada, para borda não ficar por baixo
    pecas.filter(peca => peca.id === Hive.ultimaId).forEach(peca => {
      peca.draw(ctx, width, height);
    });
    // caso tenha peças acima, desenha elas
    if (pecasAcima.length > 0) {
      Hive.#drawPecas(ctx, width, height, emHud, pecasAcima, z + 1);
    }
  }
  static hover(mouseX, mouseY) {
    const canvas = document.getElementById("hive");
    const ctx = canvas.getContext("2d");

    // obtém a peça em cima do mouse
    let pecaHover = Hive.pecas.find(peca => peca.isOver(ctx, canvas.width, canvas.height, mouseX, mouseY)) ?? null;
    if (pecaHover === null) {
      if (Hive.selectedId !== null) {
        const destinos = Hive.pecas.find(peca => peca.id === Hive.selectedId).destinos;
        pecaHover = destinos.find(peca => peca.isOver(ctx, canvas.width, canvas.height, mouseX, mouseY)) ?? null;
      }
    } else {
      // caso tenha selecionado uma peça embaixo de outra, seleciona a peça de cima
      Hive.pecas.forEach(peca => {
        if (peca.x === pecaHover.x && peca.y === pecaHover.y && peca.z > pecaHover.z) {
          pecaHover = peca;
        }
      });
    }
    const hoverId = pecaHover === null ? null : pecaHover.id;

    // se não mudou, ignora
    if (Hive.hoverId === hoverId) {
      return;
    }

    Hive.hoverId = null;
    if (hoverId !== null) {
      if (Hive.selectedId !== null) {
        // já foi selecionada uma peça, então faz hover se for um destino possível
        const selected = Hive.pecas.find(peca => peca.id === Hive.selectedId);
        if (typeof selected.destinos.find(peca => peca.id === hoverId) !== "undefined") {
          Hive.hoverId = hoverId;
        }
      }
      // faz hover se for peça jogável
      if (pecaHover.destinos !== null && pecaHover.destinos.length > 0) {
        Hive.hoverId = hoverId;
      }
      if (Hive.hoverId === null) {
        return;
      }
    }
    Hive.draw();
  }
  static click(mouseX, mouseY) {
    Hive.hover(mouseX, mouseY);
    if (Hive.hoverId === null) {
      // clicou em jogada inválida
       Hive.selectedId = null;
    } else if (Hive.selectedId === null) {
      // selecionou um peça
      Hive.selectedId = Hive.hoverId;
      Hive.hoverId = null;
    } else {
      // verifica se selecionou um destino ou outra peça
      if (Hive.pecas.find(peca => peca.id === Hive.hoverId)) {
        Hive.selectedId = Hive.hoverId;
        Hive.hoverId = null;
      } else {
        Hive.pecas.find(peca => Hive.selectedId === peca.id).play(Hive.hoverId);
        Hive.ultimaId = Hive.selectedId;
        Hive.#updateJogadas();
      }
    }
    Hive.draw();
  }
  static #updateJogadas() {
    Hive.selectedId = null;
    Hive.hoverId = null;
    Hive.#rodada++;
    Hive.pecas.forEach(peca => {
      peca.updateJogadas(Hive.#rodada);
    });
    Camera.recenter();
  }
  static getRetangulo() {
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    Hive.pecas.forEach(peca => {
      if (!peca.emHud) {
        minX = Math.min(peca.x, minX);
        maxX = Math.max(peca.x, maxX);
        minY = Math.min(peca.y, minY);
        maxY = Math.max(peca.y, maxY);
      }
    });
    return [minX, maxX, minY, maxY];
  }
}
class Camera {
  static scale = 1;
  static x = 0;
  static y = 0;
  static #newX = 0;
  static #newY = 0;
  static #newScale = 1;
  static recenter() {
    const canvas = document.getElementById("hive");
    const [minX, maxX, minY, maxY] = Hive.getRetangulo();
    // reposiciona Camera
    Camera.#newX = (maxX - minX) / 2;
    Camera.#newY = (maxY - minY) / 2;
    const qtdX = 2 + maxX - minX;
    const qtdY = 2 + maxY - minY;
    const maxEmX = canvas.width / (Peca.RAIO * 3) - 1;
    const maxEmY = canvas.height / (Peca.RAIO * Math.sqrt(3)) - 8;
    const scaleX = qtdX <= maxEmX ? 1 : maxEmX / qtdX;
    const scaleY = qtdY <= maxEmY ? 1 : maxEmY / qtdY;
    Camera.#newScale = Math.min(scaleX, scaleY);
    Camera.#recenterAnimation();
  }
  static #recenterAnimation() {
    const thresholdX = 1;
    const thresholdY = 1;
    const thresholdScale = .01;
    const diffX = Camera.#newX - Camera.x;
    const diffY = Camera.#newY - Camera.y;
    const diffScale = Camera.#newScale - Camera.scale;
    if (Math.abs(diffX) <= thresholdX) {
      Camera.x = Camera.#newX;
    } else {
      Camera.x += diffX / 5;
    }
    if (Math.abs(diffY) <= thresholdY) {
      Camera.y = Camera.#newY;
    } else {
      Camera.y += diffY / 5;
    }
    if (Math.abs(diffScale) <= thresholdScale) {
      Camera.scale = Camera.#newScale;
    } else {
      Camera.scale += diffScale / 5;
    }
    Hive.draw();
    if (Math.abs(diffX) > thresholdX || Math.abs(diffY) > thresholdY || Math.abs(diffScale) > thresholdScale) {
      setTimeout(Camera.#recenterAnimation, 20);
    }
  }
}
class Peca {
  static RAIO = 18;
  static #OFFSET_LEVEL = 3;

  // guarda o último id usado, para criar novos ids
  static #id = 0;

  // id único da peça
  id;

  x;
  y;
  fromX;
  fromY;
  transicao;
  z;
  emHud;
  tipo;
  cor;

  destinos;

  constructor(cor, tipo, z, emHud = true, x = 0, y = 0, destinos = []) {
    this.id = ++Peca.#id;
    this.x = x;
    this.y = y;
    this.z = z;
    this.transicao = 0;
    this.emHud = emHud;
    if (emHud) {
      // posiciona para poder comparar se tem mais de uma peça do mesmo tipo no hud
      this.x = tipo.posicao;
      this.y = cor === CorPeca.branco ? 0 : 10;
    }
    this.tipo = tipo;
    this.cor = cor;
    this.destinos = destinos;
  }
  play(destinoId) {
    const canvas = document.getElementById("hive");
    const destino = this.destinos.find(peca => destinoId === peca.id);
    const [x, y] = this.#getPosicao(canvas.width, canvas.height);
    this.fromX = x;
    this.fromY = y;
    this.transicao = 1;
    this.x = destino.x;
    this.y = destino.y;
    this.z = destino.z;
    this.emHud = false;
    Peca.transicao();
  }
  static transicao() {
    let fezTransicao = false;
    Hive.pecas.forEach(peca => {
      if (peca.transicao > 1e-3) {
        fezTransicao = true;
        peca.transicao /= 2;
      } else {
        peca.transicao = 0;
      }
    });
    Hive.draw();
    if (fezTransicao) {
      setTimeout(Peca.transicao, 20);
    }
  }
  draw(ctx, width, height) {
    if (this.id === Hive.selectedId) {
      if (Hive.hoverId === null) {
        // peça selecionada (mas não está escolhendo nada)
        this.#draw(ctx, width, height, ["tracejado", "2"]);
      } else {
        if (Hive.pecas.find(peca => peca.id === Hive.hoverId)) {
          // peça selecionada (mas está escolhendo outra peça)
          this.#draw(ctx, width, height, ["tracejado", "2"]);
        } else {
          // peça selecionada (mas está escolhendo destino)
          this.#draw(ctx, width, height, ["transparente", "tracejado", "2"]);
        }
      }
    } else if (this.id === Hive.hoverId) {
      if (Hive.selectedId !== null) {
        if (Hive.pecas.find(peca => peca.id === Hive.hoverId)) {
          // escolhendo outra peça
          this.#draw(ctx, width, height, ["tracejado", "2"]);
        } else {
          // escolhendo jogada
          this.#draw(ctx, width, height, ["tracejado", "1"]);
        }
      } else {
        // escolhendo peça
        this.#draw(ctx, width, height, ["tracejado", "2"]);
      }
    } else if (this.destinos === null) {
      // possível jogada
      this.#draw(ctx, width, height, ["transparente"]);
    } else if (this.id === Hive.ultimaId) {
      // peça jogada por último
      this.#draw(ctx, width, height, ["tracejado", "3"]);
    } else if (this.destinos.length > 0) {
      // peça movível
      this.#draw(ctx, width, height, ["tracejado", "4"]);
    } else {
      // outras peças
      this.#draw(ctx, width, height);
    }
  }
  #draw(ctx, width, height, estilo = []) {
    let [x, y] = this.#getPosicao(width, height);
    if (this.transicao > 0) {
      x = x + (this.fromX - x) * this.transicao;
      y = y + (this.fromY - y) * this.transicao;
    }
    const raio = Peca.RAIO * (this.emHud ? 1 : Camera.scale);
    const path = Peca.#getPath(this.emHud);

    ctx.setTransform(1, 0, 0, 1, x, y);
    if (estilo.includes("transparente")) {
      ctx.globalAlpha = .25;
    }

    // pinta o fundo da peça
    ctx.fillStyle = this.cor;
    ctx.fill(path);

    // desenha a borda
    ctx.strokeStyle = "rgb(0, 0, 0)";
    ctx.lineWidth = 1;
    ctx.stroke(path);

    // desenha o tipo
    ctx.drawImage(document.getElementById(this.tipo.nome), -raio, -raio, 2 * raio, 2 * raio);

    if (estilo.includes("claro")) {
      ctx.fillStyle = "rgb(255, 255, 255, .25)";
      ctx.fill(path);
    }

    ctx.globalAlpha = 1;

    if (estilo.includes("tracejado")) {
      ctx.lineWidth = 2;
      if (estilo.includes("3")) {
        ctx.strokeStyle = "rgb(0, 255, 255)";
      } else if (estilo.includes("4")) {
        ctx.strokeStyle = "rgb(0, 0, 0)";
      } else {
        ctx.strokeStyle = "rgb(255, 0, 0)";
      }
      if (estilo.includes("2") || estilo.includes("4")) {
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 4;
      }
      ctx.stroke(path);
      ctx.setLineDash([]);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);

  }
  isOver(ctx, width, height, mouseX, mouseY) {
    const path = Peca.#getPath(this.emHud);
    const [x, y] = this.#getPosicao(width, height);
    return ctx.isPointInPath(path, x - mouseX, y - mouseY);
  }
  #getPosicao(width, height) {
    const scale = this.emHud ? 1 : Camera.scale;
    const raio= Peca.RAIO * scale;
    const offset = Peca.#OFFSET_LEVEL * scale;
    let x, y;
    if (this.emHud) {
      const margemX = (width - 9 * raio * 3) / 2;
      x = this.tipo.posicao * raio * 3 + margemX + offset * this.z;
      if (Hive.corJogadorEmbaixo === this.cor) {
        // embaixo
        y = height - 2 * raio - (this.tipo.posicao % 2) * raio * Math.sqrt(3);
      } else {
        y = 2 * raio + (this.tipo.posicao % 2) * raio * Math.sqrt(3);
      }
      y -= offset * this.z;
    } else {
      x = width / 2 - Camera.x - this.x * raio * 3 + offset * this.z;
      y = height / 2 + Camera.y - this.y * raio * Math.sqrt(3) - offset * this.z;
    }
    return [x, y];
  }
  static #getPath(emHud) {
    const raio = (emHud ? 1 : Camera.scale) * Peca.RAIO;
    let path = new Path2D();
    path.moveTo(2 * raio, 0);
    path.lineTo(raio, raio * Math.sqrt(3));
    path.lineTo(-raio, raio * Math.sqrt(3));
    path.lineTo(-2 * raio, 0);
    path.lineTo(-raio, -raio * Math.sqrt(3));
    path.lineTo(raio, -raio * Math.sqrt(3));
    path.lineTo(2 * raio, 0);
    path.closePath();
    return path;
  }
  updateJogadas(rodada) {
    const corJogando = rodada % 2 === 1 ? CorPeca.branco : CorPeca.preto;
    this.destinos = [];
    if (this.cor !== corJogando) {
      return;
    }

    if (rodada === 1) {
      this.destinos.push(new Peca(this.cor, this.tipo, 0, false, 0, 0, null));
      return;
    }
    if (rodada === 2) {
      for (const [x, y] of Peca.#aoRedor(0, 0)) {
        this.destinos.push(new Peca(this.cor, this.tipo, 0, false, x, y, null));
      }
      return;
    }
    const rainha = Hive.pecas.find(peca => peca.tipo.nome === TipoPeca.queen.nome && peca.cor === this.cor);

    // não pode movimentar se a rainha não estiver em jogo
    if (rainha.emHud && !this.emHud) {
      return;
    }

    if (rainha.emHud && (rodada === 7 || rodada === 8) && this.id !== rainha.id) {
      // somente a rainha pode ser jogada na rodada 4 se ela não estiver em jogo
      return;
    }

    const pecasEmJogo = Hive.pecas.filter(peca => !peca.emHud);
    if (this.emHud) {
      // adiciona movimentos de colocar peça em jogo
      pecasEmJogo.forEach(peca => {
        // para cada peça do jogador...
        if (peca.cor !== this.cor) {
          return;
        }
        // procura uma casa vazia ao redor da peça
        for (const [x, y] of Peca.#aoRedor(peca.x, peca.y)) {
          // ignora se for a casa vazia já foi registrada como possível destino
          if (this.destinos.find(peca => peca.x === x && peca.y === y)) {
            continue;
          }
          // ignora se não for casa vazia
          if (pecasEmJogo.find(peca => peca.x === x && peca.y === y)) {
            continue;
          }
          // olha ao redor da casa vazia encontrada
          let aceito = true;
          for (const [x2, y2] of Peca.#aoRedor(x, y)) {
            // ignora a peça inicial
            if (peca.x === x2 && peca.y === y2) {
              continue;
            }
            // verifica se ao redor da casa vazia tem alguém de outra cor
            const p = pecasEmJogo.find(peca => peca.x === x2 && peca.y === y2);
            if (typeof p !== "undefined" && p.cor !== this.cor) {
              aceito = false;
              break;
            }
          }
          // se tudo ok, adiciona possível destino
          if (aceito) {
            this.destinos.push(new Peca(this.cor, this.tipo, 0, false, x, y, null));
          }
        }
      });
    } else {
      // adiciona movimentos

    }


  }
  static *#aoRedor(x, y) {
    yield [x - 1, y - 1];
    yield [x, y - 2];
    yield [x + 1, y - 1];
    yield [x + 1, y + 1];
    yield [x, y + 2];
    yield [x - 1, y + 1];
  }
}

window.onload = () => {
  Hive.init(CorPeca.branco);
  const canvas = document.getElementById("hive");
  canvas.addEventListener('mousemove', function(event) {
    Hive.hover(event.offsetX, event.offsetY);
  });
  canvas.addEventListener('click', function(event) {
    Hive.click(event.offsetX, event.offsetY);
  });
}

