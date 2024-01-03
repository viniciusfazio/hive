
const CorPeca = {
  branco: "rgb(140, 140, 140)",
  preto: "rgb(50, 50, 50)",
}
const TipoPeca = {
  queen: {
    nome: "queen",
    posicao: 1,
  },
  ant: {
    nome: "ant",
    posicao: 2,
  },
  mosquito: {
    nome: "mosquito",
    posicao: 3,
  },
  ladybug: {
    nome: "ladybug",
    posicao: 4,
  },
  grasshopper: {
    nome: "grasshopper",
    posicao: 5,
  },
  pillbug: {
    nome: "pillbug",
    posicao: 6,
  },
  spider: {
    nome: "spider",
    posicao: 7,
  },
  beetle: {
    nome: "beetle",
    posicao: 8,
  },
};

class Hive {
  static pecas = [];
  static corJogador;
  static rodada;
  static vez;
  static init(corJogador) {
    Hive.corJogador = corJogador;
    Hive.rodada = 1;
    Hive.vez = corJogador;
    Hive.pecas = [
      new Peca(CorPeca.branco, TipoPeca.queen, 0),
      new Peca(CorPeca.branco, TipoPeca.ant, 0),
      new Peca(CorPeca.branco, TipoPeca.ant, 1),
      new Peca(CorPeca.branco, TipoPeca.ant, 2),
      new Peca(CorPeca.branco, TipoPeca.grasshopper, 0),
      new Peca(CorPeca.branco, TipoPeca.grasshopper, 1),
      new Peca(CorPeca.branco, TipoPeca.grasshopper, 2),
      new Peca(CorPeca.branco, TipoPeca.spider, 0),
      new Peca(CorPeca.branco, TipoPeca.spider, 1),
      new Peca(CorPeca.branco, TipoPeca.beetle, 0),
      new Peca(CorPeca.branco, TipoPeca.beetle, 1),
      new Peca(CorPeca.branco, TipoPeca.mosquito, 0),
      new Peca(CorPeca.branco, TipoPeca.ladybug, 0),
      new Peca(CorPeca.branco, TipoPeca.pillbug, 0),
      new Peca(CorPeca.preto, TipoPeca.queen, 0),
      new Peca(CorPeca.preto, TipoPeca.ant, 0),
      new Peca(CorPeca.preto, TipoPeca.ant, 1),
      new Peca(CorPeca.preto, TipoPeca.ant, 2),
      new Peca(CorPeca.preto, TipoPeca.grasshopper, 0),
      new Peca(CorPeca.preto, TipoPeca.grasshopper, 1),
      new Peca(CorPeca.preto, TipoPeca.grasshopper, 2),
      new Peca(CorPeca.preto, TipoPeca.spider, 0),
      new Peca(CorPeca.preto, TipoPeca.spider, 1),
      new Peca(CorPeca.preto, TipoPeca.beetle, 0),
      new Peca(CorPeca.preto, TipoPeca.beetle, 1),
      new Peca(CorPeca.preto, TipoPeca.mosquito, 0),
      new Peca(CorPeca.preto, TipoPeca.ladybug, 0),
      new Peca(CorPeca.preto, TipoPeca.pillbug, 0),
    ];
    Camera.recenter();
  }
}
class Camera {
  static scale = 1;
  static x = 0;
  static y = 0;
  static #newX = 0;
  static #newY = 0;
  static #newScale = 1;
  static #goto(posX = 0, posY = 0, scale = 1) {
    const canvas = document.getElementById("hive");
  }
  static recenter() {
    const canvas = document.getElementById("hive");
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
    // reposiciona Camera
    Camera.#newX = (maxX - minX) / 2;
    Camera.#newY = (maxY - minY) / 2;
    const qtdX = 2 + maxX - minX;
    const qtdY = 2 + maxY - minY;
    const maxEmX = canvas.width / (Peca.RAIO * 3);
    const maxEmY = canvas.height / (Peca.RAIO * Math.sqrt(3)) - 4;
    const scaleX = qtdX <= maxEmX ? 1 : maxEmX / qtdX;
    const scaleY = qtdY <= maxEmY ? 1 : maxEmY / qtdY;
    //console.log("@" + maxEmX + "  " + maxEmY + "  " + qtdX + "  " + qtdY);
    Camera.#newScale = Math.min(scaleX, scaleY);
    Camera.#recenter();
  }
  static #recenter() {
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
    redraw();
    if (Math.abs(diffX) > thresholdX || Math.abs(diffY) > thresholdY || Math.abs(diffScale) > thresholdScale) {
      setTimeout(Camera.#recenter, 20);
    }
  }
}
class Peca {
  static RAIO = 25;
  static #OFFSET_LEVEL = 3;

  // guarda o último id usado, para criar novos ids
  static #id = 0;

  // id da peça que o mouse está sobre
  static hoverId = null;

  // hexagono
  static #path = null;

  // id único da peça
  id;

  x;
  y;
  z;
  emHud;
  tipo;
  cor;

  constructor(cor, tipo, z, emHud = true, x = 0, y = 0) {
    this.id = Peca.#id++;
    this.x = x;
    this.y = y;
    this.z = z;
    this.emHud = emHud;
    if (emHud) {
      this.x = tipo.posicao;
      this.y = cor === CorPeca.branco ? 0 : 10;
    }
    this.tipo = tipo;
    this.cor = cor;
  }
  play(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.emHud = false;
    Peca.hoverId = null;
    Camera.recenter();
  }
  // retorna a posição da peça no canvas
  #getPosicao(width, height) {
    const raio= Peca.RAIO;
    let x, y;
    if (this.emHud) {
      const margemX = (width - 9 * raio * 3) / 2;
      x = this.tipo.posicao * raio * 3 + margemX + Peca.#OFFSET_LEVEL;
      if (Hive.corJogador === this.cor) {
        // embaixo
        y = height - 2 * raio - (this.tipo.posicao % 2) * raio * Math.sqrt(3);
      } else {
        y = 2 * raio + (this.tipo.posicao % 2) * raio * Math.sqrt(3);
      }
      y -= Peca.#OFFSET_LEVEL * this.z;
    } else {
      x = width / 2 - Camera.x - this.x * raio * 3 + Peca.#OFFSET_LEVEL * this.z;
      y = height / 2 + Camera.y - this.y * raio * Math.sqrt(3) - Peca.#OFFSET_LEVEL * this.z;
    }
    return [x, y];
  }
  static #getPath() {
    if (Peca.#path === null) {
      const raio = Peca.RAIO;
      Peca.#path = new Path2D();
      Peca.#path.moveTo(2 * raio, 0);
      Peca.#path.lineTo(raio, raio * Math.sqrt(3));
      Peca.#path.lineTo(-raio, raio * Math.sqrt(3));
      Peca.#path.lineTo(-2 * raio, 0);
      Peca.#path.lineTo(-raio, -raio * Math.sqrt(3));
      Peca.#path.lineTo(raio, -raio * Math.sqrt(3));
      Peca.#path.lineTo(2 * raio, 0);
      Peca.#path.closePath();
    }
    return Peca.#path;
  }
  #draw(ctx, x, y, scale) {
    const path = Peca.#getPath();
    ctx.setTransform(scale, 0, 0, scale, x, y);
    ctx.fillStyle = this.cor;
    ctx.fill(path);
    // desenha a borda
    ctx.strokeStyle = "rgb(0, 0, 0)";
    ctx.lineWidth = 1;
    ctx.stroke(path);
    // desenha o tipo
    const raio = Peca.RAIO;
    ctx.drawImage(document.getElementById(this.tipo.nome), -raio, -raio, 2 * raio, 2 * raio);
    // clareia se estiver com o mouse em cima da peça
    if (this.id === Peca.hoverId) {
      ctx.fillStyle = "rgb(255, 255, 255, .5)";
      ctx.fill(path);
    }
  }
  static drawTodasPecas(ctx, width, height, emHud, pecas = null, z = 0) {
    if (pecas === null) {
      pecas = Hive.pecas;
    }
    let pecasAcima = [];
    pecas.forEach(peca => {
      if (!peca.emHud && emHud || peca.emHud && !emHud) {
        return;
      }
      // se for peça acima, guarda para depois
      if (peca.z > z) {
        pecasAcima.push(peca);
        return;
      }
      const [x, y] = peca.#getPosicao(width, height);
      peca.#draw(ctx, x, y, emHud ? 1 : Camera.scale);
    });
    // caso tenha peças acima, desenha elas
    if (pecasAcima.length > 0) {
      Peca.drawTodasPecas(ctx, width, height, emHud, pecasAcima, z + 1);
    }
  }
  static hover(mouseX, mouseY) {
    const canvas = document.getElementById("hive");
    const ctx = canvas.getContext("2d");
    const path = Peca.#getPath();

    // reseta as transformações para o isPointInPath funcionar corretamente
    ctx.setTransform(Camera.scale, 0, 0, Camera.scale, 0, 0);

    // obtém a peça em cima do mouse
    let pecaHover = null;
    Hive.pecas.forEach(peca => {
      const [x, y] = peca.#getPosicao(canvas.width, canvas.height);
      if ((pecaHover === null || pecaHover.z < peca.z) &&
        ctx.isPointInPath(path, x - mouseX, y - mouseY)) {
        pecaHover = peca;
      }
    });
    // caso tenha selecionado uma peça embaixo de outra, seleciona a peça de cima
    if (pecaHover !== null) {
      Hive.pecas.forEach(peca => {
        if (peca.x === pecaHover.x && peca.y === pecaHover.y && peca.z > pecaHover.z) {
          pecaHover = peca;
        }
      });
    }
    // caso a peça em cima do mouse mudou, faz o redraw
    const hoverId = pecaHover === null ? null : pecaHover.id;
    if (Peca.hoverId !== hoverId) {
      Peca.hoverId = hoverId;
      redraw();
    }
  }
  static click(mouseX, mouseY) {
    if (Peca.hoverId === null) {
      return;
    }
    let peca = Hive.pecas.find(peca => Peca.hoverId === peca.id);
    if (peca.cor !== Hive.vez) {
      return;
    }
    if (Hive.rodada === 1) {
      peca.play(0, 0, 0);
    }
  }
}

window.onload = () => {
  const canvas = document.getElementById("hive");
  Hive.init(CorPeca.branco);

  canvas.addEventListener('mousemove', function(event) {
    Peca.hover(event.offsetX, event.offsetY);
  });
  canvas.addEventListener('click', function(event) {
    Peca.click(event.offsetX, event.offsetY);
  });

  redraw();
}

function redraw() {
  const canvas = document.getElementById("hive");
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // limpa tela
  ctx.fillStyle = "rgb(100, 100, 60)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  Peca.drawTodasPecas(ctx, canvas.width, canvas.height, false);

  // desenha hud
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgb(0, 0, 0, .5)";
  const height = 6 * Peca.RAIO;
  ctx.fillRect(0, 0, canvas.width, height);
  ctx.fillRect(0, canvas.height - height, canvas.width, height);

  Peca.drawTodasPecas(ctx, canvas.width, canvas.height, true);

  // cria retângulo para indicar redraw (DEBUG)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgb(" + Math.round(Math.random() * 255) + ", " + Math.round(Math.random() * 255) + ", " + Math.round(Math.random() * 255) + ")";
  ctx.fillRect(0, 0, 50, 50);
}
