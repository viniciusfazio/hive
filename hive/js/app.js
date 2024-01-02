

class Camera {
  static x = 0;
  static y = 0;
  static #newX = 0;
  static #newY = 0;
  static update(width, height, mouseX, mouseY) {
    Camera.#newX = Camera.x - (width / 2 - mouseX);
    Camera.#newY = Camera.y + (height / 2 - mouseY);
    Camera.#recenter();
  }
  static #recenter() {
    const divisao = 5;
    const diffX = Camera.#newX - Camera.x;
    const diffY = Camera.#newY - Camera.y;
    if (Math.abs(diffX) <= 1) {
      Camera.x = Camera.#newX;
    } else {
      Camera.x += diffX / divisao;
    }
    if (Math.abs(diffY) <= 1) {
      Camera.y = Camera.#newY;
    } else {
      Camera.y += diffY / divisao;
    }
    redraw();
    if (Math.abs(diffX) > 1 || Math.abs(diffY) > 1) {
      setTimeout(Camera.#recenter, 20);
    }
  }
}
const CorPeca = {
  branco: "rgb(210, 210, 210)",
  preto: "rgb(100, 150, 100)",
}
class Peca {
  static #RAIO = 25;

  // guarda o último id usado, para criar novos ids
  static #id = 0;

  // id da peça que o mouse está sobre
  static hoverId = -1;

  // hexagono
  static #path = null;

  // id único da peça
  id;
  // posição
  x;
  y;
  cor;
  // altura
  z = 0;

  constructor(x, y, cor) {
    this.id = Peca.#id++;
    this.x = x;
    this.y = y;
    this.cor = cor;
  }
  // retorna a posição da peça no canvas
  #getPosicao(width, height) {
    const raio= Peca.#RAIO;
    const offsetLevel = 3;
    const posX = width / 2 - Camera.x - this.x * raio * 3 + offsetLevel * this.z;
    const posY = height / 2 + Camera.y - this.y * raio * Math.sqrt(3) - offsetLevel * this.z;
    return [posX, posY];
  }
  static #getPath() {
    if (Peca.#path === null) {
      const raio = Peca.#RAIO;
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
  static draw(ctx, pecas, width, height, z = 0) {
    const path = Peca.#getPath();
    let pecasAcima = [];
    // desenha as peças no mesmo nível
    pecas.forEach(peca => {
      // se for peça acima, guarda para depois
      if (peca.z > z) {
        pecasAcima.push(peca);
        return;
      }
      // desenha o hexagono
      const [posX, posY] = peca.#getPosicao(width, height);
      ctx.setTransform(scale, 0, 0, scale, posX, posY);
      ctx.fillStyle = peca.cor;
      ctx.fill(path);
      // desenha a borda
      ctx.strokeStyle = "rgb(0, 0, 0)";
      ctx.lineWidth = 1;
      ctx.stroke(path);
      // clareia se estiver com o mouse em cima da peça
      if (peca.id === Peca.hoverId) {
        ctx.fillStyle = "rgb(255, 255, 255, .5)";
        ctx.fill(path);
      }
    });
    // caso tenha peças acima, desenha elas
    if (pecasAcima.length > 0) {
      Peca.draw(ctx, pecasAcima, width, height, z + 1);
    }
  }
  static update(ctx, pecas, width, height, mouseX, mouseY) {
    // reseta as transformações para o isPointInPath funcionar corretamente
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // obtém a peça em cima o mouse
    let pecaHover = null;
    const path = Peca.#getPath();
    pecas.forEach(peca => {
      const [posX, posY] = peca.#getPosicao(width, height);
      if (ctx.isPointInPath(path, posX - mouseX, posY - mouseY) && (pecaHover === null || pecaHover.z < peca.z)) {
        pecaHover = peca;
      }
    });
    // caso tenha selecionado uma peça embaixo de outra, seleciona a peça de cima
    if (pecaHover !== null) {
      pecas.forEach(peca => {
        if (peca.x === pecaHover.x && peca.y === pecaHover.y && peca.z > pecaHover.z) {
          pecaHover = peca;
        }
      });
    }
    // caso a peça em cima do mouse mudou, faz o redraw
    const hoverId = pecaHover === null ? -1 : pecaHover.id;
    if (Peca.hoverId !== hoverId) {
      Peca.hoverId = hoverId;
      redraw();
    }
  }
}

let scale = 1;
let pecasEmJogo = [];

window.onload = () => {
  let canvas = document.getElementById("hive");
  let ctx = canvas.getContext("2d");

  canvas.addEventListener('mousemove', function(event) {
    Peca.update(ctx, pecasEmJogo, canvas.width, canvas.height, event.offsetX, event.offsetY);
  });
  canvas.addEventListener('click', function(event) {
    Camera.update(canvas.width, canvas.height, event.offsetX, event.offsetY);
  });

  pecasEmJogo.push(new Peca(0, 0, CorPeca.branco));
  pecasEmJogo.push(new Peca(-1, -1, CorPeca.preto));
  pecasEmJogo.push(new Peca(1, -1, CorPeca.branco));
  let peca = new Peca(0, 0, CorPeca.preto);
  peca.z = 1;
  pecasEmJogo.push(peca);
  peca = new Peca(0, 0, CorPeca.branco);
  peca.z = 2;
  pecasEmJogo.push(peca);
  peca = new Peca(-1, -1, CorPeca.preto);
  peca.z = 1;
  pecasEmJogo.push(peca);

  redraw();
}

function redraw() {
  let canvas = document.getElementById("hive");
  let ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // limpa tela e cria moldura
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgb(0, 0, 0)";
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // cria retângulo para indicar redraw (DEBUG)
  ctx.fillStyle = "rgb(" + Math.round(Math.random() * 255) + ", " + Math.round(Math.random() * 255) + ", " + Math.round(Math.random() * 255) + ")";
  ctx.fillRect(0, 0, 50, 50);

  // desenha as peças em jogo
  Peca.draw(ctx, pecasEmJogo, canvas.width, canvas.height);
}
