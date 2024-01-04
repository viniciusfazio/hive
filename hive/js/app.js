
function jogadasQueen(peca, repetido = false) {
  if (!Peca.checaOneHive(peca.x, peca.y)) {
    return;
  }
  for (const [x, y, z, z1, z2] of Peca.aoRedorComVizinhos(peca.x, peca.y, peca.x, peca.y)) {
    const casaLivre = z < 0;
    if (casaLivre && semGate(peca.z, z, z1, z2)) {
      peca.insereDestino(repetido, x, y, 0);
    }
  }
}
function jogadasAnt(peca, repetido = false) {
  if (!Peca.checaOneHive(peca.x, peca.y)) {
    return;
  }
  let pontas = [peca];
  let pintados = [peca];
  // repete o movimento até não ter mais casas
  while (pontas.length > 0) {
    let novasPontas = [];
    pontas.forEach(ponta => {
      for (const [x, y, z, z1, z2] of Peca.aoRedorComVizinhos(ponta.x, ponta.y, peca.x, peca.y)) {
        const casaLivre = z < 0;
        if (casaLivre && semGate(peca.z, z, z1, z2)) {
          if (!Peca.temPeca(x, y, pintados)) {
            const p = peca.insereDestino(repetido, x, y, 0);
            pintados.push(p);
            novasPontas.push(p);
          }
        }
      }
    });
    pontas = novasPontas;
  }
}
function jogadasMosquito(peca) {
  if (peca.z > 0) {
    // se está no topo, só pode fazer o movimento do besouro
    TipoPeca.beetle.jogadas(peca);
  } else {
    for (const [x, y] of Peca.aoRedor(peca.x, peca.y)) {
      const p = Peca.getPecaNoTopo(x, y);
      // repete o movimento do que está ao redor com exceção do mosquito
      if (p !== null && p.tipo.nome !== TipoPeca.mosquito.nome) {
        p.tipo.jogadas(peca, true);
      }
    }
  }
}
// noinspection JSUnusedLocalSymbols
function jogadasLadybug(peca, repetido = false) {
  if (!Peca.checaOneHive(peca.x, peca.y)) {
    return;
  }
  let caminhos = [[[peca.x, peca.y, peca.z]]];
  // faz exatemante 3 movimentos
  for (let p = 0; p < 3; p++) {
    let novosCaminhos = [];
    // testa todos caminhos possíveis
    caminhos.forEach(caminho => {
      const [passoX, passoY, passoZ] = caminho[p];
      for (const [x, y, z, z1, z2] of Peca.aoRedorComVizinhos(passoX, passoY, peca.x, peca.y)) {
        if (p < 2) {
          // move somente sobre peças
          const casaOcupada = z >= 0;
          const inexplorado = !caminho.find(([cx, cy, cz]) => cx === x && cy === y && cz === z);
          if (casaOcupada && semGate(passoZ, z, z1, z2) && inexplorado) {
            // é um novo passo válido, que não repete um passo já feitoo
            let novoCaminho = [...caminho];
            novoCaminho.push([x, y, z]);
            novosCaminhos.push(novoCaminho);
          }
        } else {
          // move somente em casas vazias
          const casaLivre = z < 0;
          if (casaLivre && semGate(passoZ + 1, z, z1, z2)) {
            // confere se é repetido para garantir
            peca.insereDestino(true, x, y, 0);
          } else {
          }
        }
      }
    });
    caminhos = novosCaminhos;
  }
}
function jogadasGrasshopper(peca, repetido = false) {
  if (!Peca.checaOneHive(peca.x, peca.y)) {
    return;
  }
  // olha em todas direções
  for (const [dx, dy] of Peca.aoRedor(0, 0)) {
    // se tem alguma peça para ser pulada, procura o buraco
    if (Peca.temPeca(peca.x + dx, peca.y + dy)) {
      for (let i = 2; i <= Hive.pecas.length; i++) {
        const [x, y] = [peca.x + i * dx, peca.y + i * dy];
        if (!Peca.temPeca(x, y)) { // achou um buraco
          peca.insereDestino(repetido, x, y, 0);
          break;
        }
      }
    }
  }
}
function jogadasPillbug(peca, repetido = false) {
  const podeMover = Peca.checaOneHive(peca.x, peca.y);
  let livres = [];
  let vitimas = [];
  for (const [x, y, z, z1, z2] of Peca.aoRedorComVizinhos(peca.x, peca.y, peca.x, peca.y)) {
    // procura vítimas e casas livres para mover outras peças
    const casaLivre = z < 0;
    const casaVitima = z === 0;
    if (casaLivre && semGate(peca.z + 1, z, z1, z2)) {
      livres.push([x, y]);
    } else if (casaVitima && semGate(z, peca.z, z1, z2)) {
      vitimas.push([x, y]);
    }
    // movimentos de rainha
    if (podeMover && casaLivre && semGate(peca.z, z, z1, z2)) {
      peca.insereDestino(repetido, x, y, 0);
    }
  }
  // move outras peças
  vitimas.forEach(([x, y]) => {
    const vitima = Peca.getPecaNoFundo(x, y);
    if (vitima.id !== Hive.ultimaId && Peca.checaOneHive(vitima.x, vitima.y)) {
      livres.forEach(([tx, ty]) => {
        vitima.insereDestino(true, tx, ty, 0);
      });
    }
  });
}
// noinspection JSUnusedLocalSymbols
function jogadasSpider(peca, repetido = false) {
  if (!Peca.checaOneHive(peca.x, peca.y)) {
    return;
  }
  let caminhos = [[[peca.x, peca.y]]];
  // faz exatemante 3 movimentos
  for (let p = 0; p < 3; p++) {
    let novosCaminhos = [];
    // testa todos os caminhos possíveis
    caminhos.forEach(caminho => {
      const [passoX, passoY] = caminho[p];
      for (const [x, y, z, z1, z2] of Peca.aoRedorComVizinhos(passoX, passoY, peca.x, peca.y)) {
        const casaLivre = z < 0;
        const inexplorado = !caminho.find(([cx, cy]) => cx === x && cy === y);
        if (casaLivre && semGate(peca.z, z, z1, z2, -1) && inexplorado) {
          // é um novo passo válido, que não repete um passo já feito
          if (p < 2) {
            let novoCaminho = [...caminho];
            novoCaminho.push([x, y]);
            novosCaminhos.push(novoCaminho);
          } else {
            // confere se é repetido para garantir
            peca.insereDestino(true, x, y, 0);
          }
        }
      }
    });
    caminhos = novosCaminhos;
  }
}
function jogadasBeetle(peca, repetido = false) {
  if (!Peca.checaOneHive(peca.x, peca.y)) {
    return;
  }
  for (const [x, y, z, z1, z2] of Peca.aoRedorComVizinhos(peca.x, peca.y, peca.x, peca.y)) {
    if (semGate(peca.z, z, z1, z2)) {
      peca.insereDestino(repetido, x, y, z + 1);
    }
  }
}
function semGate(origemZ, destinoZ, z1, z2) {
  const naColmeia = z1 >= 0 || z2 >= 0 || destinoZ >= 0 || origemZ > 0;
  return naColmeia && Math.max(origemZ - 1, destinoZ) >= Math.min(z1, z2);
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
    // não precisa de jogadas, pois nunca sai do hud
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
  static rodada;

  // marca o frame atual (DEBUG)
  static #frame;

  static init(corJogadorEmbaixo) {
    Hive.corJogadorEmbaixo = corJogadorEmbaixo;
    Hive.rodada = 1;
    Hive.#frame = 0;
    Hive.pecas = [];
    for (const keyCor in CorPeca) {
      for (const keyTipo in TipoPeca) {
        const tipo = TipoPeca[keyTipo];
        for (let z = 0; z < tipo.quantidade; z++) {
          const numero = tipo.quantidade === 1 ? 0 : tipo.quantidade - z;
          Hive.pecas.push(new Peca(CorPeca[keyCor], tipo, z, numero));
        }
      }
    }
    Hive.ultimaId = null;
    Hive.#limpaMarcacoes();
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
      const destinos = Peca.getPecaPorId(Hive.hoverId)?.destinos ?? null;
      if (destinos !== null) {
        // desenha as jogadas possíveis da nova peça a ser selecionada
        Hive.#drawPecas(ctx, canvas.width, canvas.height, false, destinos);
      } else {
        // peça já selecionada, desenha as jogadas possíveis dela
        const destinos = Peca.getPecaPorId(Hive.selectedId).destinos;
        Hive.#drawPecas(ctx, canvas.width, canvas.height, false, destinos);
      }
    } else if (Hive.hoverId !== null) {
      // desenha as jogadas possíveis da peça sob o mouse
      const destinos = Peca.getPecaPorId(Hive.hoverId).destinos;
      Hive.#drawPecas(ctx, canvas.width, canvas.height, false, destinos);
    }

    // desenha hud
    ctx.fillStyle = "rgb(0, 0, 0, .5)";
    //ctx.fillStyle = "rgb(" + (Hive.#frame % 256) + ", " + (Hive.#frame % 256) + ", " + (Hive.#frame % 256) + ", .5)"; // DEBUG
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
      // peça já foi selecionada, então verifica se um dos destinos possíveis está sendo selecionado
      destinos = Peca.getPecaPorId(Hive.selectedId).destinos;
      pecaHover = destinos.find(peca => peca.isOver(ctx, canvas.width, canvas.height, mouseX, mouseY)) ?? null;
    }
    if (pecaHover === null) {
      // caso contrário, pode ser que outra peça esteja sendo selecionada
      pecaHover = Hive.pecas.find(peca => peca.isOver(ctx, canvas.width, canvas.height, mouseX, mouseY)) ?? null;
    }

    if (pecaHover !== null) {
      // caso tenha selecionado uma peça embaixo de outra, seleciona a peça de cima
      pecaHover = Peca.getPecaNoTopo(pecaHover.x, pecaHover.y, Hive.pecas.concat(destinos), pecaHover.emHud);
    }

    let pecaHoverAprovada = null;
    // alguma peça está sendo selecionada. Verifica se é permitido
    if (pecaHover !== null) {
      // se está sendo selecionado um destino válido, aceita
      if (Hive.selectedId !== null && Peca.getPecaPorId(pecaHover.id, Peca.getPecaPorId(Hive.selectedId).destinos)) {
        pecaHoverAprovada = pecaHover;
      }
      // se está sendo selecionada uma peça movível, aceita
      if (pecaHoverAprovada === null && pecaHover.destinos !== null && pecaHover.destinos.length > 0) {
        pecaHoverAprovada = pecaHover;
      }
    }
    const pecaHoverAprovadaId = pecaHoverAprovada?.id ?? null;

    // se não mudou a peça sendo selecionada, não precisa redraw
    if (Hive.hoverId !== pecaHoverAprovadaId) {
      Hive.hoverId = pecaHoverAprovadaId;
      Hive.draw();
    }

  }
  static click(mouseX, mouseY) {
    // garante um hover, caso o click aconteça sem mousemove
    Hive.hover(mouseX, mouseY);

    if (Hive.hoverId === null) {
      // clicou em jogada inválida
      if (Hive.selectedId !== null && Peca.getPecaPorId(Hive.selectedId).tipo.nome !== TipoPeca.pass.nome) {
        Hive.selectedId = null;
      }
    } else if (Hive.selectedId === null) {
      // selecionou um peça
      Hive.selectedId = Hive.hoverId;
      if (this.rodada <= 2) {
        // joga direto
        const peca = Peca.getPecaPorId(Hive.selectedId);
        Hive.hoverId = peca.destinos[0].id;
        Hive.#play();
      } else {
        // desmarca peça selecionada
        Hive.hoverId = null;
      }
    } else {
      // clicou no destino, então joga
      Hive.#play();
    }
    Hive.draw();
  }
  static #play() {
    if (Hive.selectedId === Hive.hoverId && Peca.getPecaPorId(Hive.selectedId).tipo.nome === TipoPeca.pass.nome) {
      // pulou a vez
      Hive.pecas = Hive.pecas.filter(peca => Hive.selectedId !== peca.id);
      Hive.ultimaId = null;
      Hive.#proximaRodada();
    } else if (Peca.getPecaPorId(Hive.hoverId)) {
      // selecionou outra peça em vez de jogar
      Hive.selectedId = Hive.hoverId;
      Hive.hoverId = null;
    } else {
      // fez a jogada
      const resultado = Peca.getPecaPorId(Hive.selectedId).play(Hive.hoverId);
      if (resultado !== null) {
        // jogo terminou
        Hive.ultimaId = null;
        Hive.#limpaMarcacoes();
        Camera.recenter();
        if (resultado === "") {
          alert("EMPATE");
        } else {
          alert(resultado + " venceram!");
        }
      } else {
        // próxima rodada
        Hive.ultimaId = Hive.selectedId;
        Hive.#proximaRodada();
      }
    }
  }
  static #limpaMarcacoes() {
    Hive.selectedId = null;
    Hive.hoverId = null;
    Hive.pecas.forEach(peca => {
      peca.destinos = [];
    });
  }
  static #proximaRodada() {
    Hive.#limpaMarcacoes();
    Hive.rodada++;
    Hive.#updateJogadas();
  }
  static #updateJogadas() {
    let total = 0;
    Hive.pecas.forEach(peca => {
      peca.updateJogadas(Hive.rodada);
      total += peca.destinos.length;
    });
    if (total === 0) {
      const cor = Hive.rodada % 2 === 1 ? CorPeca.branco : CorPeca.preto;
      const peca = new Peca(cor, TipoPeca.pass, 0, 0);
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
  static #OFFSET_LEVEL = 4;

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

  // para notação
  numero;

  destinos;

  constructor(cor, tipo, z, numero) {
    this.id = ++Peca.#id;
    this.numero = numero;
    this.tipo = tipo;
    this.cor = cor;
    this.z = z;
    this.x = -1000 - tipo.posicao;
    this.y = cor === CorPeca.branco ? -1000 : -2000;
    this.transicao = 0;
    this.emHud = true;
    this.destinos = [];
  }
  play(destinoId) {
    const canvas = document.getElementById("hive");
    const destino = Peca.getPecaPorId(destinoId, this.destinos);
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

    const brancoPerdeu = Peca.#rainhaCercada(CorPeca.branco);
    const pretoPerdeu = Peca.#rainhaCercada(CorPeca.preto);
    if (!brancoPerdeu && !pretoPerdeu) {
      return null;
    }
    if (brancoPerdeu && pretoPerdeu) {
      return "";
    }
    if (brancoPerdeu) {
      return "Pretas";
    }
    return "Brancas";
  }
  static #rainhaCercada(cor) {
    const queen = Hive.pecas.find(peca => peca.tipo.nome === TipoPeca.queen.nome && peca.cor === cor);
    if (queen.emHud) {
      return false;
    }
    return !Peca.xyzAoRedor(queen.x, queen.y, queen.x, queen.y).find(coords => coords[2] < 0);
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
        if (Peca.getPecaPorId(Hive.hoverId)) {
          // peça selecionada (mas está escolhendo outra peça)
          this.#draw(ctx, width, height, ["tracejado", "2"]);
        } else {
          // peça selecionada (mas está escolhendo destino)
          this.#draw(ctx, width, height, ["transparente", "tracejado", "2"]);
        }
      }
    } else if (this.id === Hive.hoverId) {
      if (Hive.selectedId !== null) {
        if (Peca.getPecaPorId(Hive.hoverId)) {
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
    if (this.numero > 1) {
      ctx.rotate((this.numero - 1) * Math.PI / 3);
    }
    ctx.drawImage(document.getElementById(this.tipo.nome), -raio, -raio, 2 * raio, 2 * raio);
    ctx.setTransform(1, 0, 0, 1, x, y);

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
    if (this.cor !== corJogando) {
      return;
    }

    if (rodada === 1) {
      this.insereDestino(false, 0, 0, 0);
      return;
    }
    if (rodada === 2) {
      for (const [x, y] of Peca.aoRedor(0, 0)) {
        this.insereDestino(false, x, y, 0);
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
    } else if (this.#descoberta() && this.id !== Hive.ultimaId) {
      this.tipo.jogadas(this);
    }
  }
  #descoberta() {
    return !Hive.pecas.find(peca => !peca.emHud && peca.x === this.x && peca.y === this.y && peca.z > this.z);
  }
  static checaOneHive(checaX, checaY) {
    // só pode quebrar colméia se tiver no fundo a peça
    const peca = Peca.getPecaNoTopo(checaX, checaY);
    if (!peca || peca.z > 0) {
      return  true;
    }

    // verifica o que tem ao redor da peça
    let ocupado = [];
    let pecasAoRedor = [];
    for (const [x, y] of Peca.aoRedor(checaX, checaY)) {
      const peca = Peca.getPecaNoFundo(x, y);
      if (peca === null) {
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
    // com 4 peças ao redor seguidas, não pode quebrar a colméia.
    if (pecasAoRedor.length === 4) {
      for (let i = 1; i <= 6; i++) {
        if (!ocupado[i - 1] && !ocupado[i % 6]) {
          return true;
        }
      }
    }
    // tenta "pintar a colmeia com balde de tinta" em uma das pontas. Se todas peças ao redor foram pintadas, tudo ok.
    let pintados = [];
    let pontas = [pecasAoRedor[0]];
    while (pontas.length > 0) {
      let novasPontas = [];
      pontas.forEach(ponta => {
        if (!Peca.getPecaPorId(ponta.id, pintados)) {
          pintados.push(ponta);
          for (const [x, y] of Peca.aoRedor(ponta.x, ponta.y)) {
            if (x !== checaX || y !== checaY) {
              const peca = Peca.getPecaNoFundo(x, y);
              if (peca && !Peca.getPecaPorId(peca.id, pintados)) {
                novasPontas.push(peca);
              }
            }
          }
        }
      });
      pontas = novasPontas;
    }
    return !pecasAoRedor.find(peca => !Peca.getPecaPorId(peca.id, pintados));
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
        if (Peca.temPeca(x, y, this.destinos)) {
          continue;
        }
        // ignora se não for casa vazia
        if (Peca.temPeca(x, y, pecasEmJogo)) {
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
          let p = Peca.getPecaNoTopo(x2, y2, pecasEmJogo);
          if (p !== null && p.cor !== this.cor) {
            aceito = false;
            break;
          }
        }
        // se tudo ok, adiciona possível destino
        if (aceito) {
          this.insereDestino(false, x, y, 0);
        }
      }
    });
  }
  insereDestino(repetido, x, y, z) {
    const peca = new Peca(this.cor, this.tipo, z, this.numero);
    peca.x = x;
    peca.y = y;
    peca.destinos = null;
    peca.emHud = false;
    if (!repetido || !Peca.temPeca(x, y, this.destinos)) {
      this.destinos.push(peca);
    }
    return peca;
  }

  static *aoRedor(x, y) {
    yield [x, y + 2];
    yield [x - 1, y + 1];
    yield [x - 1, y - 1];
    yield [x, y - 2];
    yield [x + 1, y - 1];
    yield [x + 1, y + 1];
  }

  static xyzAoRedor(centroX, centroY, ignoraX, ignoraY) {
    let xyz = [];
    for (const [x, y] of Peca.aoRedor(centroX, centroY)) {
      // ignora casas ocupadas ao redor
      const peca = this.getPecaNoTopo(x, y);
      if (peca === null) {
        xyz.push([x, y, -1]);
      } else if (x === ignoraX && y === ignoraY) {
        xyz.push([x, y, peca.z - 1]);
      } else {
        xyz.push([x, y, peca.z]);
      }
    }
    return xyz;
  }

  static *aoRedorComVizinhos(centroX, centroY, ignoraX, ignoraY) {
    const xyz = Peca.xyzAoRedor(centroX, centroY, ignoraX, ignoraY);
    // olha para cada casa ao redor
    for (let i = 1; i <= 6; i++) {
      // olha as peças vizinhas da casa analisada
      const [x, y, z] = xyz[i % 6];
      const z1 = xyz[i - 1][2];
      const z2 = xyz[(i + 1) % 6][2];
      yield [x, y, z, z1, z2];
    }
  }
  static getPecaNoTopo(x, y, pecas = null, emHud = false) {
    const pecasEncontradas = (pecas ?? Hive.pecas).filter(peca => peca.emHud === emHud && peca.x === x && peca.y === y);
    if (pecasEncontradas.length === 0) {
      return null;
    } else if (pecasEncontradas.length === 1) {
      return pecasEncontradas[0];
    }
    return pecasEncontradas.sort((pecaA, pecaB) => pecaA.z - pecaB.z).pop();
  }
  static temPeca(x, y, pecas = null) {
    return (pecas ?? Hive.pecas).find(peca => !peca.emHud && peca.x === x && peca.y === y);
  }
  static getPecaNoFundo(x, y, pecas = null) {
    return (pecas ?? Hive.pecas).find(peca => !peca.emHud && peca.x === x && peca.y === y && peca.z === 0) ?? null;
  }
  static getPecaPorId(id, pecas) {
    if (id === null) {
      return null;
    }
    return (pecas ?? Hive.pecas).find(peca => peca.id === id) ?? null;
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

