
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
          if (!pintados.find(p => p.x === x && p.y === y)) {
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
      const p = Hive.pecasEmJogo.find(p => p.x === x && p.y === y);
      // repete o movimento do que está ao redor com exceção do mosquito
      if (p && p.tipo.nome !== TipoPeca.mosquito.nome) {
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
    if (Hive.pecasEmJogo.find(p => p.x === peca.x + dx && p.y === peca.y + dy)) {
      for (let i = 2; i <= Hive.pecas.length; i++) {
        const [x, y] = [peca.x + i * dx, peca.y + i * dy];
        if (!Hive.pecasEmJogo.find(p => p.x === x && p.y === y)) { // achou um buraco
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
    const vitima = Hive.pecasEmJogo.find(p => p.x === x && p.y === y);
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

// retorna se tem gate entre a casa origem e destino, considerando a altura das casas vizinhas
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
    nome: "pass",  // nome da imagem
    posicao: 1,    // posição no hud
    quantidade: 1, // quantidade no início do jogo
    jogadas: null, // função que calcula jogadas - neste caso não precisa
  },
  queen: {
    nome: "queen",
    posicao: 1,
    quantidade: 1,
    jogadas: jogadasQueen,
  },
  beetle: {
    nome: "beetle",
    posicao: 2,
    quantidade: 2,
    jogadas: jogadasBeetle,
  },
  grasshopper: {
    nome: "grasshopper",
    posicao: 3,
    quantidade: 3,
    jogadas: jogadasGrasshopper,
  },
  spider: {
    nome: "spider",
    posicao: 4,
    quantidade: 2,
    jogadas: jogadasSpider,
  },
  ant: {
    nome: "ant",
    posicao: 5,
    quantidade: 3,
    jogadas: jogadasAnt,
  },
  ladybug: {
    nome: "ladybug",
    posicao: 6,
    quantidade: 1,
    jogadas: jogadasLadybug,
  },
  mosquito: {
    nome: "mosquito",
    posicao: 7,
    quantidade: 1,
    jogadas: jogadasMosquito,
  },
  pillbug: {
    nome: "pillbug",
    posicao: 8,
    quantidade: 1,
    jogadas: jogadasPillbug,
  },
};

class Hive {
  // atributos imutáveis durante a partida
  static MAX_OFFSET_HUD;
  static corJogadorEmbaixo; // cor das peças que aparece no hud debaixo
  static pecas;             // todas peças (apenas as peças são alteradas, não o array)

  // atributo alterados a cada da rodada
  static rodadaDePasse; // mostra botão de empate
  static ultimaId;      // id da última peça movida
  static rodada;        // rodada atual, começando em 1 (branco)
  static corJogando;    // cor da rodada atual
  static jogadas;       // todas jogadas feitas desde o início

  // atributo pré-calculados a cada da rodada
  static pecasEmJogo; // peças em jogo que estão por cima
  static pecasEmHud;  // peças que podem ser colocadas em jogo que estão por cima

  // atributos alterados durante a rodada
  static selectedId; // id da peça selecionada
  static hoverId;    // id da casa/peça em que está sendo selecionada
  static dragging;   // está fazendo drag no mouse
  static mouseX;     // posição do mouse durante o drag
  static mouseY;     // posição do mouse durante o drag
  static DEBUG;      // flag que indica se está no modo DEBUG

  // atributos alterados a cada vez que a tela é desenhada
  static #animando   // indica se está acontecendo alguma animacao
  static #frame;     // marca a quantidade de vezes que a tela foi desenhada (para debugar)

  // inicia uma nova partida
  static init(corJogadorEmbaixo) {
    Hive.corJogadorEmbaixo = corJogadorEmbaixo;
    Hive.pecas = [];
    Hive.MAX_OFFSET_HUD = 0;
    for (const keyCor in CorPeca) {
      for (const keyTipo in TipoPeca) {
        const tipo = TipoPeca[keyTipo];
        Hive.MAX_OFFSET_HUD = Math.max(tipo.quantidade, Hive.MAX_OFFSET_HUD);
        for (let z = 0; z < tipo.quantidade; z++) {
          const numero = tipo.quantidade === 1 ? 0 : tipo.quantidade - z;
          Hive.pecas.push(new Peca(CorPeca[keyCor], tipo, z, numero));
        }
      }
    }

    Hive.#frame = 0;
    Hive.#animando = false;
    Hive.jogadas = [];
    Hive.iniciaRodada(1);
  }

  static anima() {
    if (!Hive.#animando) {
      Hive.#anima();
    }
  }
  static #anima() {
    Hive.#animando = Camera.anima() | Peca.anima();
    Hive.draw();
    if (Hive.#animando) {
      setTimeout(Hive.#anima, 20);
    }
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

    const hoverPeca = Hive.hoverId === null ? null : Hive.pecas.find(p => p.id === Hive.hoverId);
    if (Hive.selectedId !== null && !hoverPeca) {
      // peça já selecionada e nenhuma peça sob o mouse, só possivelmente destino
      const destinos = Hive.pecas.find(p => p.id === Hive.selectedId).destinos;
      Hive.#drawPecas(ctx, canvas.width, canvas.height, false, destinos);
    } else if (hoverPeca) {
      // desenha as jogadas possíveis da peça sob o mouse
      Hive.#drawPecas(ctx, canvas.width, canvas.height, false, hoverPeca.destinos);
    }

    // desenha hud
    ctx.fillStyle = "rgb(0, 0, 0, .5)";
    const [, ry, offset] = Peca.getRaio();
    const height = 4 * ry + (Hive.MAX_OFFSET_HUD - 1) * offset + 4;
    ctx.fillRect(0, 0, canvas.width, height);
    ctx.fillRect(0, canvas.height - height, canvas.width, height);

    // desenha peças no hud
    Hive.#drawPecas(ctx, canvas.width, canvas.height, true, Hive.pecas);


    if (Hive.DEBUG) {
      const text = [
        "Frame: " + Hive.#frame,
        "Selected: " + Hive.selectedId,
        "Hover: " + Hive.hoverId,
        "Último: " + Hive.ultimaId,
        "Rodada: " + Hive.rodada,
      ];
      Hive.drawText(ctx, text, 0, 0, "top", "left", 12);
    }

  }
  static drawText(ctx, text, x = 0, y = 0, valign = "middle", align = "center", size = 20) {
    ctx.font = size + "px Sans-serif";
    ctx.lineWidth = 2;
    ctx.textAlign = align;
    ctx.textBaseline = valign;
    text.forEach(txt => {
      ctx.strokeStyle = "black";
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = "white";
      ctx.fillText(txt, x, y);
      y += size;
    })
  }


  static #drawPecas(ctx, width, height, emHud, pecas, z = 0) {
    let pecasAcima = [];
    pecas.filter(peca => peca.emHud === emHud).forEach(peca => {
      if (peca.z > z) {
        pecasAcima.push(peca); // se for peça acima, guarda para próxima iteração
      } else {
        peca.draw(ctx, width, height);
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
      destinos = Hive.pecas.find(p => p.id === Hive.selectedId).destinos;
      pecaHover = destinos.find(peca => peca.isOver(ctx, canvas.width, canvas.height, mouseX, mouseY)) ?? null;
    }
    if (pecaHover === null && !Hive.dragging) {
      // caso contrário, pode ser que alguma peça esteja sendo selecionada
      pecaHover = Hive.pecas.find(peca => peca.isOver(ctx, canvas.width, canvas.height, mouseX, mouseY)) ?? null;
      if (pecaHover !== null) {
        // verifica se é permitido selecionar essa peça
        pecaHover = Peca.getPecaNoTopo(pecaHover, Hive.pecas.concat(destinos));
        if (pecaHover.destinos === null || pecaHover.destinos.length === 0) {
          pecaHover = null;
        }
      }
    }
    const pecaHoverId = pecaHover?.id ?? null;

    // se mudou a peça sendo selecionada ou está fazendo dragging, faz redraw
    if (Hive.hoverId !== pecaHoverId || Hive.dragging) {
      Hive.hoverId = pecaHoverId;
      Hive.draw();
    }
  }

  static click(mouseX, mouseY) {
    // garante um hover, caso o click aconteça sem mousemove
    Hive.hover(mouseX, mouseY);

    if (Hive.hoverId === null) {
      // clicou em jogada inválida
      if (!Hive.rodadaDePasse) {
        // se tem alguma jogada válida, desseleciona a jogada escolhida
        Hive.selectedId = null;
      }
    } else if (Hive.selectedId === null) {
      // selecionou uma peça
      Hive.selectedId = Hive.hoverId;
      if (this.rodada <= 2) {
        // joga direto porque é a primeira peça a ser jogada
        const peca = Hive.pecasEmHud.find(p => p.id === Hive.selectedId);
        Jogada.play(peca, peca.destinos[0]);
      } else {
        // desmarca peça selecionada
        Hive.hoverId = null;
      }
    } else if (Hive.rodadaDePasse) {
      Jogada.play(null, null);
    } else if (Hive.pecas.find(p => p.id === Hive.hoverId)) {
      // selecionou outra peça em vez de jogar
      Hive.selectedId = Hive.hoverId;
      Hive.hoverId = null;
    } else {
      // clicou no destino, então joga
      const peca = Hive.pecas.find(p => p.id === Hive.selectedId);
      const destino = peca.destinos.find(p => p.id === Hive.hoverId);
      Jogada.play(peca, destino);
    }
    Hive.draw();
  }


  // executado ao fim de cada rodada
  static #limpaMouse() {
    Hive.selectedId = null;
    Hive.hoverId = null;
    Hive.dragging = false;
    Hive.mouseX = 0;
    Hive.mouseY = 0;
  }


  static iniciaRodada(rodada, resultado = null) {
    Hive.#limpaMouse();
    Hive.pecas.forEach(peca => peca.destinos = []);
    Hive.rodada = rodada;
    Hive.corJogando = Hive.rodada % 2 === 1 ? CorPeca.branco : CorPeca.preto;
    Hive.rodadaDePasse = false;
    Hive.pecasEmHud = Hive.pecas.filter(p => p.emHud && Peca.getPecaNoTopo(p, Hive.pecas).id === p.id);
    Hive.pecasEmJogo = Hive.pecas.filter(p => !p.emHud && Peca.getPecaNoTopo(p, Hive.pecas).id === p.id);
    Hive.pecasEmHud = Hive.pecasEmHud.filter(p => p.tipo.nome !== TipoPeca.pass.nome);

    if (resultado !== null) {
      Camera.recenter();
      if (resultado === "Empate") {
        alert("EMPATE!!!");
      } else {
        alert(resultado + " venceram!");
      }
    } else if (Hive.rodada > Hive.jogadas.length) {
      // pré-calcula jogadas
      let total = Peca.updateJogadasHud();
      Hive.pecasEmJogo.filter(p => p.cor === Hive.corJogando).forEach(peca => total += peca.updateJogadas());
      if (total === 0) {
        // nenhuma jogada válida, então mostra botão de empate
        Hive.rodadaDePasse = true;
        const peca = Hive.pecas.find(p => p.tipo.nome === TipoPeca.pass.nome && p.cor === Hive.corJogando);
        peca.destinos = [peca];
        Hive.selectedId = peca.id;
      }
    }
    Camera.recenter();
  }

}
class Jogada {
  id;
  passe;
  x1;
  y1;
  z1;
  emHud1;
  x2;
  y2;
  z2;
  emHud2;
  constructor(passe) {
    this.id = null;
    this.passe = passe;
    this.x1 = null;
    this.y1 = null;
    this.z1 = null;
    this.emHud1 = null;
    this.x2 = null;
    this.y2 = null;
    this.z2 = null;
    this.emHud2 = null;
  }

  static play(peca, destino) {
    if (Hive.rodadaDePasse) {
      // pulou a vez
      Hive.jogadas.push(new Jogada(true));
    } else {
      // fez a jogada
      const jogada = new Jogada(false);
      jogada.id = peca.id;
      jogada.x1 = peca.x;
      jogada.y1 = peca.y;
      jogada.z1 = peca.z;
      jogada.emHud1 = peca.emHud;
      jogada.x2 = destino.x;
      jogada.y2 = destino.y;
      jogada.z2 = destino.z;
      jogada.emHud2 = destino.emHud;
      Hive.jogadas.push(jogada);
    }
    Jogada.replay(Hive.rodada + 1)
  }
  static replay(rodada) {
    rodada = Math.max(1, Math.min(rodada, Hive.jogadas.length + 1));
    let resultado = null;
    if (Hive.rodada < rodada) {
      for (let r = Hive.rodada; r < rodada; r++) {
        //play
        const j = Hive.jogadas[r - 1];
        if (j.passe) {
          resultado = null;
        } else {
          resultado = Hive.pecas.find(p => p.id === j.id).play(j.x2, j.y2, j.z2, j.emHud2);
        }
      }
    } else {
      for (let r = Hive.rodada - 1; r >= rodada; r--) {
        //unplay
        const j = Hive.jogadas[r - 1];
        if (j.passe) {
          resultado = null;
        } else {
          resultado = Hive.pecas.find(p => p.id === j.id).play(j.x1, j.y1, j.z1, j.emHud1);
        }
      }
    }
    Hive.ultimaId = rodada < 2 ? null : Hive.jogadas[rodada - 2].id;
    Hive.iniciaRodada(rodada, resultado);
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
    let minX = null;
    let maxX = null;
    let minY = null;
    let maxY = null;
    Hive.pecasEmJogo.forEach(peca => {
      minX = Math.min(peca.x, minX);
      maxX = Math.max(peca.x, maxX);
      minY = Math.min(peca.y, minY);
      maxY = Math.max(peca.y, maxY);
    });
    const [rx, ry, ] = Peca.getRaio(1);
    // reposiciona Camera
    const qtdX = 4 + 1 + maxX - minX;
    const qtdY = 5 + 1 + maxY - minY;
    const maxEmX = canvas.width / rx;
    const maxEmY = canvas.height / (3 * ry);
    Camera.#newScale = Math.min(maxEmX / qtdX, maxEmY / qtdY, 1);
    Camera.#newX = -rx * Camera.#newScale * (maxX + minX) / 2;
    Camera.#newY = 3 * ry * Camera.#newScale * (maxY + minY) / 2;
    Hive.anima();
  }
  static anima() {
    const thresholdX = 1;
    const thresholdY = 1;
    const thresholdScale = .01;
    const diffX = Camera.#newX - Camera.x;
    const diffY = Camera.#newY - Camera.y;
    const diffScale = Camera.#newScale - Camera.scale;
    let continuaAnimando = false;
    if (Math.abs(diffX) <= thresholdX) {
      Camera.x = Camera.#newX;
    } else {
      Camera.x += diffX / 5;
      continuaAnimando = true;
    }
    if (Math.abs(diffY) <= thresholdY) {
      Camera.y = Camera.#newY;
    } else {
      Camera.y += diffY / 5;
      continuaAnimando = true;
    }
    if (Math.abs(diffScale) <= thresholdScale) {
      Camera.scale = Camera.#newScale;
    } else {
      Camera.scale += diffScale / 5;
      continuaAnimando = true;
    }
    return continuaAnimando;
  }
}

class Peca {
  static #RAIO = 25; // maximo canvas / 30 para caber o HUD
  static #OFFSET_LEVEL = Peca.#RAIO / 4;

  // guarda o último id usado, para criar novos ids
  static #id = 0;

  // atributos imutáveis
  id;
  tipo;
  cor;
  numero;

  // atributos que definem a posição no jogo
  x;
  y;
  z;
  emHud;

  // atributos para animação
  fromX;
  fromY;
  transicao;

  // pré-calculado no início da rodada
  destinos;

  constructor(cor, tipo, z, numero) {
    this.id = ++Peca.#id;
    this.numero = numero;
    this.tipo = tipo;
    this.cor = cor;

    this.x = null;
    this.y = null;
    this.z = z;

    this.transicao = 0;
    this.emHud = true;
    this.destinos = [];
  }

  play(x, y, z, emHud) {
    const canvas = document.getElementById("hive");
    const [px, py] = this.#getPosicao(canvas.width, canvas.height);
    this.fromX = px;
    this.fromY = py;
    this.transicao = 1;

    this.x = x;
    this.y = y;
    this.z = z;
    this.emHud = emHud;

    Peca.#id = Math.max.apply(null, Hive.pecas.map(peca => peca.id));

    const brancoPerdeu = Peca.#rainhaCercada(CorPeca.branco);
    const pretoPerdeu = Peca.#rainhaCercada(CorPeca.preto);
    if (!brancoPerdeu && !pretoPerdeu) {
      return null;
    }
    if (brancoPerdeu && pretoPerdeu) {
      return "Empate";
    }
    if (brancoPerdeu) {
      return "Pretas";
    }
    return "Brancas";
  }

  // verifica se a rainha está cercada
  static #rainhaCercada(cor) {
    const queen = Hive.pecasEmJogo.find(peca => peca.tipo.nome === TipoPeca.queen.nome && peca.cor === cor);
    if (!queen) {
      return false;
    }
    return !Peca.xyzAoRedor(queen.x, queen.y, queen.x, queen.y).find(([, , z]) => z < 0);
  }

  // faz animação da peça sendo jogada
  // faz animação da peça sendo jogada
  static anima() {
    let continuaAnimando = false;
    Hive.pecas.forEach(peca => {
      if (peca.transicao > 1e-3) {
        continuaAnimando = true;
        peca.transicao *= .5;
      } else {
        peca.transicao = 0;
      }
    });
    return continuaAnimando;
  }

  draw(ctx, width, height) {
    if (this.tipo.nome === TipoPeca.pass.nome) {
      if (this.id !== Hive.selectedId) {
        this.#draw(ctx, width, height);
      } else if (this.id === Hive.hoverId) {
        // peça de passar a vez sendo selecionada
        this.#draw(ctx, width, height, ["tracejado", "1"]);
      } else {
        // peça de passar pedindo para ser selecionada
        this.#draw(ctx, width, height, ["tracejado", "2"]);
      }
    } else if (this.id === Hive.selectedId) {
      if (Hive.hoverId === null) {
        // peça selecionada (mas não está escolhendo nada)
        if (Hive.dragging) {
          this.#draw(ctx, width, height, ["transparente", "tracejado", "2"]);
          this.#draw(ctx, width, height, ["tracejado", "2", "hover"]);
        } else {
          this.#draw(ctx, width, height, ["tracejado", "2"]);
        }
      } else if (this.destinos.find(p => p.id === Hive.hoverId)) {
        // peça selecionada (mas está escolhendo destino)
        this.#draw(ctx, width, height, ["transparente", "tracejado", "2"]);
      } else {
        // peça selecionada (mas está escolhendo outra peça)
        this.#draw(ctx, width, height, ["tracejado", "2"]);
      }
    } else if (this.id === Hive.hoverId) {
      if (Hive.selectedId !== null) {
        if (Hive.pecas.find(p => p.id === Hive.hoverId)) { // peça hover não está no destino, é uma peça do jogo mesmo
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
    let x, y;
    if (estilo.includes("hover")) {
      [x, y] = [Hive.mouseX, Hive.mouseY];
    } else {
      [x, y] = this.#getPosicao(width, height)
      if (this.transicao > 0) {
        x = x + (this.fromX - x) * this.transicao;
        y = y + (this.fromY - y) * this.transicao;
      }
    }
    const [rx, ry, ] = Peca.getRaio();
    const path = Peca.#getPath();

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
    const raio = Math.min(rx, ry);
    if (this.tipo.nome !== TipoPeca.pass.nome) {
      ctx.rotate(-Math.PI / 2 + (Math.max(1, this.numero) - 1) * Math.PI / 3);
    }
    ctx.drawImage(document.getElementById(this.tipo.nome), -raio, -raio, 2 * raio, 2 * raio);
    ctx.setTransform(1, 0, 0, 1, x, y);

    ctx.globalAlpha = 1;

    if (Hive.DEBUG) {
      if (this.emHud) {
        Hive.drawText(ctx, ["", "ID: " + this.id], 0, 0);
      } else {
        let text = [this.x + "," + this.y + "," + this.z];
        if (this.destinos !== null) {
          text.push("ID: " + this.id);
        }
        Hive.drawText(ctx, text, 0, 0);
      }
    }

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

  // verifica se o mouse está sobre uma peça
  isOver(ctx, width, height, mouseX, mouseY) {
    const path = Peca.#getPath();
    const [x, y] = this.#getPosicao(width, height);
    return ctx.isPointInPath(path, x - mouseX, y - mouseY);
  }

  // transforma a posição do jogo em posição na tela
  #getPosicao(width, height) {
    const [rx, ry, offset] = Peca.getRaio();
    let x, y;
    if (this.emHud) {
      const margemX = (width - Object.keys(TipoPeca).length * rx * 2) / 2;
      x = this.tipo.posicao * rx * 2 + margemX + offset * this.z;
      if (Hive.corJogadorEmbaixo === this.cor) {
        y = height - ry * 2;
      } else {
        y = 2 * ry + (Hive.MAX_OFFSET_HUD - 1) * offset;
      }
      y -= offset * this.z;
    } else {
      x = width / 2 - Camera.x - this.x * rx + offset * this.z;
      y = height / 2 + Camera.y - this.y * ry * 3 - offset * this.z;
    }
    return [x, y];
  }

  static getRaio(scale) {
    const r = Peca.#RAIO * (scale ?? Camera.scale);
    return [r * Math.sqrt(3), r, Peca.#OFFSET_LEVEL * (scale ?? Camera.scale)];
  }
  // obtem o hexagono
  static #getPath() {
    let path = new Path2D();
    const [rx, ry, ] = Peca.getRaio();

    let [px, py] = [null, null];
    for (const [x, y] of Peca.aoRedor(0, 0)) {
      const [cx, cy] = [rx * y, ry * x];
      if (px === null && py === null) {
        [px, py] = [cx, cy];
        path.moveTo(cx, cy);
      } else {
        path.lineTo(cx, cy);
      }
    }
    path.lineTo(px, py);
    path.closePath();
    return path;
  }
  // précalcula as jogadas de colocar peça em jogo
  static updateJogadasHud() {
    let pecasEmHud = Hive.pecasEmHud.filter(peca => peca.cor === Hive.corJogando);
    // primeira e segunda rodada só tem 1 possibilidade
    if (Hive.rodada === 1) {
      pecasEmHud.forEach(peca => peca.insereDestino(false, 0, 0, 0));
      return pecasEmHud.length;
    }
    if (Hive.rodada === 2) {
      const [x, y] = Peca.aoRedor(0, 0).next().value;
      pecasEmHud.forEach(peca => peca.insereDestino(false, x, y, 0));
      return pecasEmHud.length;
    }

    // se não tiver peça em hud, nada a ser feito
    if (pecasEmHud.length === 0) {
      return 0;
    }

    // se estiver na rodada 7 ou 8, somente a rainha joga
    if (Hive.rodada === 7 || Hive.rodada === 8) {
      const rainha = pecasEmHud.find(peca => peca.tipo.nome === TipoPeca.queen.nome);
      if (rainha) {
        pecasEmHud = [rainha];
      }
    }

    let destinos = [];
    let total = 0;
    Hive.pecasEmJogo.filter(peca => peca.cor === Hive.corJogando).forEach(peca => {
      // procura uma casa vazia ao redor da peça
      for (const [x, y] of Peca.aoRedor(peca.x, peca.y)) {
        // ignora se for a casa vazia já foi registrada como possível destino
        if (destinos.find(([rx, ry]) => rx === x && ry === y)) {
          continue;
        }
        destinos.push([x, y]);

        // ignora se não for casa vazia
        if (Hive.pecasEmJogo.find(p => p.x === x && p.y === y)) {
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
          if (Hive.pecasEmJogo.find(p => p.x === x2 && p.y === y2 && p.cor !== Hive.corJogando)) {
            aceito = false;
            break;
          }
        }
        // se tudo ok, adiciona possível destino
        if (aceito) {
          total++;
          pecasEmHud.forEach(peca => peca.insereDestino(false, x, y, 0));
        }
      }
    });
    return total;
  }

  // précalcula as jogadas de uma peça
  updateJogadas() {
    // não pode movimentar se a rainha estiver no hud
    if (Hive.pecasEmHud.find(peca => peca.tipo.nome === TipoPeca.queen.nome && peca.cor === this.cor)) {
      return 0;
    }
    // não pode movimentar se foi a última peça movida
    if (this.id === Hive.ultimaId) {
      return 0;
    }
    this.tipo.jogadas(this);
    return this.destinos.length;
  }
  static checaOneHive(checaX, checaY) {
    // só pode quebrar colméia se tiver no fundo a peça
    const peca = Hive.pecasEmJogo.find(p => p.x === checaX && p.y === checaY);
    if (!peca || peca.z > 0) {
      return true;
    }

    // verifica o que tem ao redor da peça
    let ocupado = [];
    let pecasAoRedor = [];
    for (const [x, y] of Peca.aoRedor(checaX, checaY)) {
      const peca = Hive.pecasEmJogo.find(p => p.x === x && p.y === y);
      if (peca) {
        pecasAoRedor.push(peca);
        ocupado.push(true);
      } else {
        ocupado.push(false);
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
        if (pintados.find(p => p.id === ponta.id)) {
          return;
        }
        pintados.push(ponta);
        for (const [x, y] of Peca.aoRedor(ponta.x, ponta.y)) {
          if (x === checaX && y === checaY) {
            continue;
          }
          const peca = Hive.pecasEmJogo.find(p => p.x === x && p.y === y);
          if (peca && !pintados.find(p => p.id === peca.id)) {
            novasPontas.push(peca);
          }
        }
      });
      pontas = novasPontas;
    }
    // returna true se não encontrou nenhuma peça não pintada ao redor
    return !pecasAoRedor.find(peca => !pintados.find(p => p.id === peca.id));
  }



  // insere possível jogada
  insereDestino(repetido, x, y, z) {
    const peca = new Peca(this.cor, this.tipo, z, this.numero);
    peca.x = x;
    peca.y = y;
    peca.destinos = null;
    peca.emHud = false;
    if (!repetido || !this.destinos.find(p => p.x === x && p.y === y)) {
      this.destinos.push(peca);
    }
    return peca;
  }

  // retorna as cadas ao redor
  static *aoRedor(x, y) {
    yield [x + 2, y + 0];
    yield [x + 1, y + 1];
    yield [x - 1, y + 1];
    yield [x - 2, y + 0];
    yield [x - 1, y - 1];
    yield [x + 1, y - 1];
  }

  // retorna as cadas ao redor, incluindo o z
  static xyzAoRedor(centroX, centroY, ignoraX, ignoraY) {
    let xyz = [];
    for (const [x, y] of Peca.aoRedor(centroX, centroY)) {
      // ignora casas ocupadas ao redor
      const peca = Hive.pecasEmJogo.find(peca => peca.x === x && peca.y === y);
      if (peca) {
        if (x === ignoraX && y === ignoraY) {
          xyz.push([x, y, peca.z - 1]);
        } else {
          xyz.push([x, y, peca.z]);
        }
      } else {
        xyz.push([x, y, -1]);
      }
    }
    return xyz;
  }

  // retorna as cadas ao redor, incluindo o z da casa e dos vizinhos da casa
  static *aoRedorComVizinhos(centroX, centroY, ignoraX, ignoraY) {
    const xyz = Peca.xyzAoRedor(centroX, centroY, ignoraX, ignoraY);
    // olha para cada casa ao redor
    for (let i = 1; i <= 6; i++) {
      // olha as peças vizinhas da casa analisada
      const [x, y, z] = xyz[i % 6];
      const [, , z1] = xyz[i - 1];
      const [, , z2] = xyz[(i + 1) % 6];
      yield [x, y, z, z1, z2];
    }
  }

  // pega peça no topo de uma posição
  static getPecaNoTopo(peca, pecas) {
    let pecasEncontradas;
    if (peca.emHud) {
      pecasEncontradas = pecas.filter(p => p.emHud && p.tipo.posicao === peca.tipo.posicao && p.cor === peca.cor);
    } else {
      pecasEncontradas = pecas.filter(p => !p.emHud && p.x === peca.x && p.y === peca.y);
    }
    if (pecasEncontradas.length === 0) {
      return null;
    } else if (pecasEncontradas.length === 1) {
      return pecasEncontradas[0];
    }
    return pecasEncontradas.filter(p => p.tipo.nome !== TipoPeca.pass.nome).sort((a, b) => a.z - b.z).pop();
  }
}

// inicia o jogo e os eventos
window.onload = () => {
  Hive.init(CorPeca.branco);
  const canvas = document.getElementById("hive");
  canvas.addEventListener('mousemove', function(event) {
    Hive.dragging = event.buttons % 2 === 1;
    Hive.mouseX = event.offsetX;
    Hive.mouseY = event.offsetY;
    Hive.hover(event.offsetX, event.offsetY);
  });
  canvas.addEventListener('mousedown', function(event) {
    Hive.click(event.offsetX, event.offsetY);
  });
  canvas.addEventListener('mouseup', function(event) {
    Hive.click(event.offsetX, event.offsetY);
  });
  window.addEventListener('keydown', function(event) {
    switch (event.key) {
      case "ArrowLeft":
        Jogada.replay(Hive.rodada - 1);
        break;
      case "ArrowRight":
        Jogada.replay(Hive.rodada + 1);
        break;
      case "ArrowUp":
        Jogada.replay(999999);
        break;
      case "ArrowDown":
        Jogada.replay(1);
        break;
      case "D":
        Hive.DEBUG = !Hive.DEBUG;
        Hive.draw();
        break;
    }
  });
}

