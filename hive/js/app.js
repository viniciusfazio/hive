
function jogadasQueen(peca) {
  const xyz = Peca.xyzAoRedor(peca.x, peca.y);
  for (let i = 1; i <= 6; i++) {
    const [x, y, z] = xyz[i % 6];
    if (z < 0 && (xyz[i - 1][2] < 0 || xyz[(i + 1) % 6][2] < 0)) {
      peca.destinos.push(new Peca(peca.cor, peca.tipo, 0, false, x, y, null));
    }
  }
}
function jogadasAnt(peca) {
  peca.destinos.push(new Peca(peca.cor, peca.tipo, 0, false, peca.tipo.posicao, peca.tipo.posicao, null));
}
function jogadasMosquito(peca) {
  peca.destinos.push(new Peca(peca.cor, peca.tipo, 0, false, peca.tipo.posicao, peca.tipo.posicao, null));
}
function jogadasLadybug(peca) {
  peca.destinos.push(new Peca(peca.cor, peca.tipo, 0, false, peca.tipo.posicao, peca.tipo.posicao, null));
}
function jogadasGrasshopper(peca) {
  peca.destinos.push(new Peca(peca.cor, peca.tipo, 0, false, peca.tipo.posicao, peca.tipo.posicao, null));
}
function jogadasPillbug(peca) {
  peca.destinos.push(new Peca(peca.cor, peca.tipo, 0, false, peca.tipo.posicao, peca.tipo.posicao, null));
}
function jogadasSpider(peca) {
  peca.destinos.push(new Peca(peca.cor, peca.tipo, 0, false, peca.tipo.posicao, peca.tipo.posicao, null));
}
function jogadasBeetle(peca) {
  const xyz = Peca.xyzAoRedor(peca.x, peca.y);
  for (let i = 1; i <= 6; i++) {
    const [x, y, z] = xyz[i % 6];
    const z1 = xyz[i - 1][2];
    const z2 = xyz[(i + 1) % 6][2];
    if (Math.max(peca.z, z) >= Math.min(z1, z2)) {
      peca.destinos.push(new Peca(peca.cor, peca.tipo, z + 1, false, x, y, null));
    }
  }
}

const CorPeca = {
  branco: "rgb(140, 140, 140)",
  preto: "rgb(50, 50, 50)",
}
const TipoPeca = {
  pass: {
    nome: "pass",
    posicao: 0,
    quantidade: 0,
  },
  queen: {
    nome: "queen",
    posicao: 1,
    quantidade: 1,
    jogadas: jogadasQueen,
  },
  ant: {
    nome: "ant",
    posicao: 2,
    quantidade: 3,
    jogadas: jogadasAnt,
  },
  mosquito: {
    nome: "mosquito",
    posicao: 3,
    quantidade: 1,
    jogadas: jogadasMosquito,
  },
  ladybug: {
    nome: "ladybug",
    posicao: 4,
    quantidade: 1,
    jogadas: jogadasLadybug,
  },
  grasshopper: {
    nome: "grasshopper",
    posicao: 5,
    quantidade: 3,
    jogadas: jogadasGrasshopper,
  },
  pillbug: {
    nome: "pillbug",
    posicao: 6,
    quantidade: 1,
    jogadas: jogadasPillbug,
  },
  spider: {
    nome: "spider",
    posicao: 7,
    quantidade: 2,
    jogadas: jogadasSpider,
  },
  beetle: {
    nome: "beetle",
    posicao: 8,
    quantidade: 2,
    jogadas: jogadasBeetle,
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
    Hive.#rodada = 1;
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
    Hive.selectedId = null;
    Hive.hoverId = null;
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
    // caso tenha peças acima, desenha elas
    if (pecasAcima.length > 0) {
      Hive.#drawPecas(ctx, width, height, emHud, pecasAcima, z + 1);
    }
  }
  static hover(mouseX, mouseY) {
    const canvas = document.getElementById("hive");
    const ctx = canvas.getContext("2d");

    // obtém a peça em cima do mouse
    let pecaHover = null;
    let destinos = [];
    if (Hive.selectedId !== null) {
      destinos = Hive.pecas.find(peca => peca.id === Hive.selectedId).destinos;
      pecaHover = destinos.find(peca => peca.isOver(ctx, canvas.width, canvas.height, mouseX, mouseY)) ?? null;
    }
    if (pecaHover === null) {
      pecaHover = Hive.pecas.find(peca => peca.isOver(ctx, canvas.width, canvas.height, mouseX, mouseY)) ?? null;
    }

    // caso tenha selecionado uma peça embaixo de outra, seleciona a peça de cima
    if (pecaHover !== null) {
      Hive.pecas.concat(destinos).forEach(peca => {
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
      if (Hive.selectedId !== null && Hive.pecas.find(peca => peca.id === Hive.selectedId).tipo.nome !== TipoPeca.pass.nome) {
        Hive.selectedId = null;
      }
    } else if (Hive.selectedId === null) {
      // selecionou um peça
      Hive.selectedId = Hive.hoverId;
      Hive.hoverId = null;
    } else {
      // verifica se selecionou um destino ou outra peça
      if (Hive.pecas.find(peca => peca.id === Hive.selectedId).tipo.nome === TipoPeca.pass.nome && Hive.selectedId === Hive.hoverId) {
        // pulou a vez
        Hive.pecas = Hive.pecas.filter(peca => Hive.selectedId !== peca.id);
        Hive.ultimaId = null;
        Hive.selectedId = null;
        Hive.hoverId = null;
        Hive.#rodada++;
        Hive.#updateJogadas();
      } else if (Hive.pecas.find(peca => peca.id === Hive.hoverId)) {
        // selecionou outra peça
        Hive.selectedId = Hive.hoverId;
        Hive.hoverId = null;
      } else {
        if (Hive.pecas.find(peca => Hive.selectedId === peca.id).play(Hive.hoverId)) {
          // jogou e o jogo terminou
          Hive.ultimaId = null;
          Hive.selectedId = null;
          Hive.hoverId = null;
          alert((Hive.#rodada % 2 === 1 ? "Brancas" : "Pretas") + " venceram!");
          Camera.recenter();
        } else {
          // jogada feita, próxima rodada
          Hive.ultimaId = null;
          Hive.selectedId = null;
          Hive.hoverId = null;
          Hive.#rodada++;
          Hive.#updateJogadas();
        }
        Hive.ultimaId = Hive.selectedId;
      }
    }
    Hive.draw();
  }
  static #updateJogadas() {
    let total = 0;
    Hive.pecas.forEach(peca => {
      peca.updateJogadas(Hive.#rodada);
      total += peca.destinos.length;
    });
    if (total === 0) {
      const cor = Hive.#rodada % 2 === 1 ? CorPeca.branco : CorPeca.preto;
      const peca = new Peca(cor, TipoPeca.pass, 0);
      peca.destinos.push(peca);
      Hive.pecas.push(peca);
      Hive.selectedId = peca.id;
    }
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
    const raio = Peca.RAIO;
    // reposiciona Camera
    const qtdX = 2 + maxX - minX;
    const qtdY = 2 + maxY - minY;
    const maxEmX = canvas.width / (raio * 3) - 1;
    const maxEmY = canvas.height / (raio * Math.sqrt(3)) - 8;
    const scaleX = qtdX <= maxEmX ? 1 : maxEmX / qtdX;
    const scaleY = qtdY <= maxEmY ? 1 : maxEmY / qtdY;
    Camera.#newScale = Math.min(scaleX, scaleY);
    Camera.#newX = -3 * raio * Camera.#newScale * (maxX + minX) / 2;
    Camera.#newY = Math.sqrt(3) * raio * Camera.#newScale * (maxY + minY) / 2;
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
    Peca.#id = Math.max.apply(null, Hive.pecas.map(peca => peca.id));
    Peca.transicao();
    const outraQueen = Hive.pecas.find(peca => peca.tipo.nome === TipoPeca.queen.nome && peca.cor !== this.cor);
    if (outraQueen.emHud) {
      return false;
    }
    return !Peca.xyzAoRedor(outraQueen.x, outraQueen.y).find(coords => coords[2] < 0);
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
    if (this.tipo.nome === TipoPeca.pass.nome) {
      if (this.id === Hive.hoverId) {
        this.#draw(ctx, width, height, ["tracejado", "2"]);
      } else {
        this.#draw(ctx, width, height, ["tracejado", "4"]);
      }
    } else if (this.id === Hive.selectedId) {
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
      const margemX = (width - Object.keys(TipoPeca).length * raio * 3) / 2;
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
      for (const [x, y] of Peca.aoRedor(0, 0)) {
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

    if (this.emHud) {
      this.#jogadasPecasColocadas();
    } else if (this.#descoberta() && this.#checaOneHive()) {
      this.tipo.jogadas(this);
    }
  }
  #descoberta() {
    return !Hive.pecas.find(peca => !peca.emHud && peca.x === this.x && peca.y === this.y && peca.z > this.z);
  }
  #checaOneHive() {
    // verifica o que tem ao redor da peça
    let ocupado = [];
    let pecasAoRedor = [];
    for (const [x, y] of Peca.aoRedor(this.x, this.y)) {
      const peca = Hive.pecas.find(peca => !peca.emHud && peca.x === x && peca.y === y && peca.z === 0);
      if (typeof peca === "undefined") {
        ocupado.push(false);
      } else {
        pecasAoRedor.push(peca);
        ocupado.push(true);
      }
    }
    // somente é possível quebrar a colmeia com 2 a 4 peças ao redor
    if (pecasAoRedor.length < 2 || pecasAoRedor.length > 4) {
      return true;
    }
    // com 2 a 3 peças ao redor e sem peça isolada, não pode quebrar a colméia.
    if (pecasAoRedor.length < 4) {
      let comPecaIsolada = false;
      for (let i = 1; i <= 6; i++) {
        if (!ocupado[i - 1] && ocupado[i % 6] && !ocupado[(i + 1) % 6]) {
          comPecaIsolada = true;
          break;
        }
      }
      if (!comPecaIsolada) {
        return true;
      }
    }
    // tenta "pintar a colmeia com balde de tinta" em uma das pontas. Se todas peças ao redor foram pintadas, tudo ok.
    let pintados = [this];
    let pontas = [pecasAoRedor[0]];
    while (pontas.length > 0) {
      let novasPontas = [];
      pontas.forEach(ponta => {
        if (!pintados.find(pintado => ponta.id === pintado.id)) {
          pintados.push(ponta);
          for (const [x, y] of Peca.aoRedor(ponta.x, ponta.y)) {
            Hive.pecas.forEach(peca => {
              if (!peca.emHud && peca.x === x && peca.y === y && peca.z === 0) {
                if (!pintados.find(p => p.id === peca.id)) {
                  novasPontas.push(peca);
                }
              }
            });
          }
        }
      });
      pontas = novasPontas;
    }
    return !pecasAoRedor.find(peca => !pintados.find(pintado => peca.id === pintado.id));
  }
  // adiciona movimentos de colocar peça em jogo
  #jogadasPecasColocadas() {
    const pecasEmJogo = Hive.pecas.filter(peca => !peca.emHud);
    pecasEmJogo.forEach(peca => {
      // se a peça for de outro jogador, ignora
      if (peca.cor !== this.cor) {
        return;
      }
      // se tiver peça acima, ignora por enquanto
      if (pecasEmJogo.find(p => p.x === peca.x && p.y === peca.y && p.z > peca.z)) {
        return;
      }
      // procura uma casa vazia ao redor da peça
      for (const [x, y] of Peca.aoRedor(peca.x, peca.y)) {
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
        for (const [x2, y2] of Peca.aoRedor(x, y)) {
          // ignora a peça inicial
          if (peca.x === x2 && peca.y === y2) {
            continue;
          }
          // verifica se ao redor da casa vazia tem alguém de outra cor
          let ps = pecasEmJogo.filter(peca => peca.x === x2 && peca.y === y2).sort((a, b) => b.z - a.z);
          if (ps.length > 0 && ps[0].cor !== this.cor) { // pega a peça mais alta
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
  }
  static *aoRedor(x, y) {
    yield [x - 1, y - 1];
    yield [x, y - 2];
    yield [x + 1, y - 1];
    yield [x + 1, y + 1];
    yield [x, y + 2];
    yield [x - 1, y + 1];
  }
  static xyzAoRedor(centroX, centroY) {
    let xyz = [];
    for (const [x, y] of Peca.aoRedor(centroX, centroY)) {
      // ignora casas ocupadas ao redor
      const pecas = Hive.pecas.filter(peca => !peca.emHud && peca.x === x && peca.y === y);
      if (pecas.length === 0) {
        xyz.push([x, y, -1]);
      } else {
        const z = Math.max.apply(null, pecas.map(peca => peca.z));
        xyz.push([x, y, z]);
      }
    }
    return xyz;
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

