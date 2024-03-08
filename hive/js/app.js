import HiveCanvas from "./hivecanvas.js";
import CanvasPlayer from "./player/canvasplayer.js";
import {BLACK, COLOR_TXT, WHITE} from "./core/piece.js";
import OnlinePlayer from "./player/onlineplayer.js";
import AIPlayer from "./player/aiplayer.js";
import Tournament, {getPlayersIndex} from "./ai/tournament.js";
import {checkEvaluatorId} from "./ai/evaluator.js";

const SHORT_ON_TIME = 20; // time to be short on time, in s

let hive, canvasPlayer, onlinePlayer;
$(() => {
    $("[name='time']").change(() => $("#increment, #totalTime").prop('disabled', !$('#timer').prop('checked')));
    $("[name='opponent']").change(playerChanged);
    $("[name='piece']").change(playerChanged);
    $("#whitePiece").val(COLOR_TXT[WHITE]);
    $("#blackPiece").val(COLOR_TXT[BLACK]);
    $("#timer").change();
    hive = new HiveCanvas(localCallbacks(), SHORT_ON_TIME);
    canvasPlayer = new CanvasPlayer(hive);
    $("#confirmMoveLabel").text("Move confirmation required if time > " + SHORT_ON_TIME + "s");
    $("#resign").click(resign);
    $("#offerUndo").click(offerUndo);
    $("#newGame").click(newGame);
    $("#newTournament").click(newTournament);
    $("#undo").click(() => hive.undo());
    $("#newOnlineGame").click(newOnlineGame);
    $("#download").click(download);
    $("#downloadTournament").click(downloadTournament);
    $("#upload").change(upload);
    $("#uploadTournament").change(uploadTournament);
    $("#receive").click(receive);
    $("#draw").click(draw);
    $("#nextGeneration").click(() => addGeneration(1));
    $("#previousGeneration").click(() => addGeneration(-1));
    $("#nextMove").click(() => addRound(1));
    $("#previousMove").click(() => addRound(-1));
    $("#firstMove").click(() => setRound(1, 0));
    $("#lastMove").click(() => setRound(999999999, 0));
    $("#disconnect").click(() => onlinePlayer.disconnect(onlineCallbacks()));
    $("#acceptNewGame").click(acceptNewGame);
    $("#acceptDraw").click(acceptDraw);
    $("#acceptUndo").click(acceptUndo);
    $("#move-list").keydown(e => {
        switch (e.key) {
            case "ArrowLeft":
                addRound(-1);
                break;
            case "ArrowRight":
                addRound(1);
                break;
        }
    });

    const $autoMove = $("#autoMove");
    const $confirmMove = $("#confirmMove");
    $("#canvasContainer").append(createCanvas("hive", Math.min(window.innerWidth, window.innerHeight) - 2));
    const $hive = $("#hive");
    $hive.css("border", "1px solid black");
    $hive.mousemove(e => {
        canvasPlayer.hover(getMousePosition(e), (e.buttons & 1) > 0);
    });
    $hive.mousedown(e => {
        if (e.button === 2) {
            canvasPlayer.click();
        } else if (e.button === 0) {
            canvasPlayer.click(getMousePosition(e), $autoMove.prop("checked"), $confirmMove.prop("checked"));
        }
    });
    $hive.mouseout(() => canvasPlayer.hover());
    $hive.mouseup(e => {
        if (e.button === 0) {
            canvasPlayer.click(getMousePosition(e), $autoMove.prop("checked"), $confirmMove.prop("checked"), true);
        }
    });
    $hive.contextmenu(event => event.preventDefault());
    $hive.keydown(e => {
        switch (e.key) {
            case "ArrowLeft":
                addRound(-1);
                break;
            case "ArrowRight":
                addRound(1);
                break;
            case "D":
                hive.toggleDebug();
                break;
            case "C":
                hive.toggleCoords();
                break;
        }
    });
    hive.init($hive, canvasPlayer);

    const id = getParam("id");
    if (id !== null) {
        connect(id);
    }
    window.onbeforeunload = () => "-";
    window.d = () => hive.toggleDebug();
});
function playerChanged(online = false) {
    hive.whitePlayer.reset();
    hive.blackPlayer.reset();
    const piece = $("[name='piece']:checked").val();
    if (piece === COLOR_TXT[WHITE]) {
        hive.bottomPlayerColor = WHITE;
    } else if (piece === COLOR_TXT[BLACK]) {
        hive.bottomPlayerColor = BLACK;
    }
    hive.whitePlayer = canvasPlayer;
    hive.blackPlayer = canvasPlayer;
    if ($("#ai").prop("checked")) {
        if (hive.bottomPlayerColor === WHITE) {
            hive.blackPlayer = new AIPlayer(hive);
        } else {
            hive.whitePlayer = new AIPlayer(hive);
        }
    } else if (!$("#human").prop("checked")) {
        hive.whitePlayer = new AIPlayer(hive);
        hive.blackPlayer = new AIPlayer(hive);
    }
    if (online || $("#ai2").prop("checked")) {
        $("#undo").addClass("d-none");
    } else {
        $("#undo").removeClass("d-none");
    }
    hive.board.computeLegalMoves(!hive.gameOver);
    hive.getPlayerPlaying().initPlayerTurn();

}
function getMousePosition(e) {
    return [e.offsetX * window.devicePixelRatio, e.offsetY * window.devicePixelRatio];
}
function createCanvas(id, size) {
    const ratio = window.devicePixelRatio;
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    canvas.tabIndex = 1;
    return canvas;
}
function setRound(round, moveListId) {
    round = Math.max(1, Math.min(round, hive.moveLists[moveListId].moves.length + 1));
    hive.setRound(round, moveListId);
    updateMoveList(round, moveListId);
}
function addRound(qty) {
    const round = hive.board.round + qty;
    const moveListId = hive.currentMoveListId;
    let $li = $("ul.move-list-" + moveListId + " > li.round-" + round);
    if ($li.length === 0 && qty < 0) {
        $li = $("ul.move-list-" + hive.getMoveList().parentMoveListId + " > li.round-" + round);
    }
    if ($li.length !== 0) {
        $li.click();
    }
}
function appendMoveList(round, move, moveListId = 0) {
    const style = [
        "list-group-item-primary",
        "list-group-item-secondary",
        "list-group-item-warning",
        "list-group-item-success",
        "list-group-item-danger",
        "list-group-item-info",
        "list-group-item-dark",
    ];
    const moveList = hive.moveLists[moveListId];
    const moveListStyle = moveListId > 0 ? style[(moveList.depth - 1) % style.length] : "";
    const li = '<li style="cursor: pointer" class="text-nowrap list-group-item list-group-item-action ' + moveListStyle + ' py-0 round-' + round + '">' + move + '</li>';
    const li2 = '<li style="cursor: pointer" class="text-nowrap list-group-item list-group-item-action ' + moveListStyle + ' py-0 empty"></li>';
    const ul = '<ul class="list-group list-group-horizontal move-list-' + moveListId + '">' + li + '</ul>';
    const ul2 = '<ul class="list-group list-group-horizontal move-list-' + moveListId + '">' + li2 + li + '</ul>';
    if (moveListId === 0) {
        // main list
        if (round === 1 || (round & 1) === 0) {
            // a new line will be added to the main list
            $("#move-list").append(ul);
        } else {
            // a move will be added to an existent main list line
            $(li).insertAfter($("#move-list > ul.move-list-0 > li.round-" + (round - 1)));
        }
    } else {
        // alternative move list
        let $ul = $("#move-list > ul.move-list-" + moveListId);
        if ($ul.length === 0) {
            // it doesn't exist yet
            $ul = $("#move-list > ul.move-list-" + moveList.parentMoveListId + " > li.round-" + round).parent();
            if ($ul.length === 0) {
                // it is after last move
                $("#move-list").append((round & 1) === 0 ? ul : ul2);
            } else {
                $((round & 1) === 0 ? ul : ul2).insertAfter($ul);
            }
        } else if (round === 1 || (round & 1) === 0) {
            // new line will be added to the alternative list
            // insert at the end, after children too
            let lastLength = null;
            let children = [moveListId];
            while (children.length > lastLength) {
                lastLength = children.length;
                children = children.concat(
                    hive.moveLists.map((m, id) => children.includes(m.parentMoveListId) ? id : null)
                    .filter(id => id !== null && !children.includes(id))
                );
            }
            $(ul).insertAfter($(children.map(id => "#move-list > ul.move-list-" + id).join(", ")).last());
        } else {
            // a move will be added to an existent alternative line
            $(li).insertAfter($("#move-list > ul.move-list-" + moveListId + " > li.round-" + (round - 1)));
        }
    }
    // add click event
    $("#move-list > ul.move-list-" + moveListId + " > li.round-" + round).click(() => setRound(round, moveListId));
    updateMoveList(round, moveListId);
}
function showMessage(msg) {
    $("#messageToast .toast-body").text(msg);
    // noinspection JSUnresolvedReference
    $("#messageToast").toast("show");
}
function updateMoveList(round, moveListId) {
    // update active status of the move
    $("#move-list > ul > li").removeClass("active");
    $("#move-list > ul.move-list-" + moveListId + " > li.round-" + round).addClass("active");
}
function upload() {
    const $file = $("#upload");
    if (!confirmKillGame()) {
        $file.val(null);
        return;
    }
    const files = $file.prop("files");
    if (files.length === 1) {
        const piece = $("[name='piece']:checked").val();
        const color = piece === COLOR_TXT[BLACK] || piece !== COLOR_TXT[WHITE] && Math.random() < .5 ? BLACK : WHITE;
        $("[name='piece']").val(COLOR_TXT[color]);
        const fileReader = new FileReader();
        fileReader.onload = e => {
            const fileContent = (e.target.result ?? "").split("\n");
            const $alternativeRules = $('#alternativeRules');
            const standardRules = !$alternativeRules.prop('checked');
            if (tryParseFile(fileContent, standardRules, color) !== null) {
                // cant parse. Try again with different ruleset
                if (tryParseFile(fileContent, !standardRules, color) !== null) {
                    // still cant parse
                    const error = tryParseFile(fileContent, standardRules);
                    hive.newGame(color, canvasPlayer, canvasPlayer, 0, 0, standardRules);
                    showMessage(error);
                    return;
                } else {
                    // success with different ruleset
                    $alternativeRules.prop('checked', standardRules);
                }
            }
            if (!$("#human").prop("checked")) {
                playerChanged();
            }
        };
        fileReader.readAsText(files[0]);
    } else if (files.length === 0) {
        showMessage("Choose a file...");
    } else {
        showMessage("Choose only 1 file.");
    }
    $file.val("");
}
function tryParseFile(fileContent, standardRules, color) {
    let error = null;
    $(".tournament-running").addClass("d-none");
    hive.newGame(color, canvasPlayer, canvasPlayer, 0, 0, standardRules);
    let timeControl = false;
    fileContent.find(move => {
        if (move.trim() === "") {
            return false;
        }
        if (hive.board.round === 1) {
            const matches = move.match(/Start - time control: ([.\d]*\d)m\+(\d+)s/);
            if (matches) {
                timeControl = true;
                hive.newGame(color, canvasPlayer, canvasPlayer, matches[1], matches[2], standardRules);
                return false;
            }
        }
        const matches = move.match(/^variation \d+ parent (\d+) start (\d+)$/);
        if (matches) {
            const round = matches[2];
            const parentId = matches[1];
            hive.gameOver = true;
            hive.setRound(parseInt(round), parseInt(parentId));

            return false;
        }
        let time = null;
        if (timeControl) {
            const matches = move.match(/ ([0-9:.]+)$/);
            if (matches) {
                let timeStamp = 0;
                matches[1].split(":").forEach(t => timeStamp = timeStamp * 60 + t * 1000);
                const moveList = hive.getMoveList();
                const timeLeft = (hive.board.round & 1) === 1 ? moveList.whitePiecesTimeLeft : moveList.blackPiecesTimeLeft;
                time = timeLeft - timeStamp;
                if (hive.board.round > 1) {
                    time += moveList.increment * 1000;
                }
            }
        }
        error = hive.playNotation(move, time);
        if (error === "cant parse") {
            error = null;
            return false;
        }
        if (error !== null) {
            error = "Error parsing '" + move + "': " + error;
            return true;
        }
        return false;
    });
    if (hive.board.round === 1) {
        error = "Error parsing: no move found.";
    }
    return error;
}
function confirmKillGame() {
    return hive.gameOver || hive.getMoveList().moves.length <= 1 || confirm("The ongoing game will be gone. Are you sure?");
}

function uploadTournament() {
    const $file = $("#uploadTournament");
    if (!confirmKillGame()) {
        $file.val(null);
        return;
    }
    const files = $file.prop("files");
    if (files.length === 1) {
        const piece = $("[name='piece']:checked").val();
        const color = piece === COLOR_TXT[BLACK] || piece !== COLOR_TXT[WHITE] && Math.random() < .5 ? BLACK : WHITE;
        $("[name='piece']").val(COLOR_TXT[color]);
        const fileReader = new FileReader();
        fileReader.onload = e => {
            let error = null;
            hive.tournament = null;
            const fileContent = (e.target.result ?? "").split("\n");
            let standardRules = true;
            for (let i = 0; i < fileContent.length && error === null; i++) {
                const text = fileContent[i];
                if (i === 0) {
                    if (text.match(/standard rules/)) {
                        $("#standardRules").prop("checked", true);
                    } else if (text.match(/variant rules/)) {
                        $("#alternativeRules").prop("checked", true);
                        standardRules = false;
                    } else {
                        error = "Invalid file: no rule definition at '" + text + "'";
                        break;
                    }
                    newTournament(false);
                    hive.tournament.game = 0;
                    hive.tournament.players = [];
                    hive.tournament.generation = 0;
                    continue;
                }
                if (hive.tournament.game + 1 >= hive.tournament.players.length * hive.tournament.players.length) {
                    const match = text.match(/^Generation (\d+):/);
                    if (!match) {
                        continue;
                    }
                    if (parseInt(match[1]) !== hive.tournament.generation + 1) {
                        error = "Invalid file: inconsistent generation at '" + text + "'";
                        break;
                    }
                    hive.tournament.generation++;
                    hive.tournament.game = 0;
                    hive.tournament.players = [];
                    for (i++; i < fileContent.length; i++) {
                        const subText = fileContent[i];
                        const split = subText.split(" - ");
                        if (split.length !== 2) {
                            break;
                        }
                        if (!checkEvaluatorId(split[0], standardRules)) {
                            error = "Invalid file: inconsistent evaluator ID at '" + subText + "'";
                            break;
                        }
                        if (hive.tournament.players.find(p => p.evaluatorId === split[0])) {
                            error = "Invalid file: repeated evaluator ID at '" + subText + "'";
                            break;
                        }
                        hive.tournament.players.push({
                            evaluatorId: split[0],
                            score: 0,
                            origin: split[1],
                        });
                    }
                    updateTournamentPlayers();
                } else {
                    const match = text.match(/^White ([0-9A-Za-z]+) (draws to|wins|loses to) Black ([0-9A-Za-z]+)/);
                    if (!match) {
                        continue;
                    }
                    const p1 = hive.tournament.players.findIndex(p => p.evaluatorId === match[1]);
                    const p2 = hive.tournament.players.findIndex(p => p.evaluatorId === match[3]);
                    if (p1 < 0 || p2 < 0) {
                        error = "Invalid file: invalid game result at '" + text + "'";
                        break;
                    }
                    let [expectedP1, expectedP2] = getPlayersIndex(hive.tournament.game, hive.tournament.players);
                    if (expectedP1 === expectedP2) {
                        [expectedP1, expectedP2] = getPlayersIndex(++hive.tournament.game, hive.tournament.players);
                    }
                    if (expectedP1 !== p1 || expectedP2 !== p2) {
                        error = "Invalid file: invalid player at '" + text + "'. Expected " + hive.tournament.players[expectedP1].evaluatorId + " vs " + hive.tournament.players[expectedP2].evaluatorId + ".";
                        break;
                    }
                    switch (match[2]) {
                        case "wins":
                            hive.tournament.players[p1].score += 2;
                            updateTournamentPlayers(false, true);
                            break;
                        case "loses to":
                            hive.tournament.players[p2].score += 2;
                            updateTournamentPlayers(true, false);
                            break;
                        case "draws to":
                            hive.tournament.players[p1].score++;
                            hive.tournament.players[p2].score++;
                            updateTournamentPlayers(true, true);
                            break;
                    }
                    hive.tournament.game++;
                }
            }
            if (error === null && hive.tournament.players.length > 0) {
                fileContent.forEach(text => addTournamentLine(text));
                hive.tournament.game--;
                hive.tournament.proceed();
            } else {
                showMessage(error);
                hive.tournament = null;
                $(".tournament-running").addClass("d-none");
            }
        };
        fileReader.readAsText(files[0]);
    } else if (files.length === 0) {
        showMessage("Choose a file...");
    } else {
        showMessage("Choose only 1 file.");
    }
    $file.val("");
}
function updateTournamentPlayers(whiteDead, blackDead) {
    if (hive.tournament.game === 0) {
        const $tournament = $("#tournament_tables");
        let table = "<table class='table tournament-" + hive.tournament.generation + " d-none'>";
        hive.tournament.players.forEach((p, idx) => {
            table += "<tr>";
            table += "<td><b>" + (idx + 1) + ".</b></td>";
            table += "<td>" + p.evaluatorId + "</td>";
            table += "<td>" + p.origin + "</td>";
            table += "</tr>";
        });
        table += "</table>";
        $tournament.append(table);

        table = "<table class='text-center tournament-" + hive.tournament.generation + " table d-none'>";
        for (let row = 0; row <= hive.tournament.players.length; row++) {
            if (row === 0) {
                table += "<tr>";
                for (let col = 0; col <= hive.tournament.players.length; col++) {
                    if (col === 0) {
                        table += "<th class='border-1 fw-bold table-dark'>Score</th>";
                    } else {
                        table += "<th class='border-1 fw-bold table-secondary'>" + col + ".<i class='bi bi-bug-fill'></i></th>";
                    }
                }
            } else {
                table += "<tr class='player-" + row + "'>";
                for (let col = 0; col <= hive.tournament.players.length; col++) {
                    if (col === 0) {
                        table += "<th class='border-1 fw-bold'>" + row + ".<i class='bi bi-bug'></i></th>"
                    } else if (col === row) {
                        table += "<td class='border-1 player-" + col + " table-dark'>0</td>";
                    } else {
                        table += "<td class='border-1 player-" + col + " table-dark'>&nbsp;</td>";
                    }
                }
            }
            table += "</tr>";
        }
        table += "</table>";
        $tournament.append(table);
        setGeneration(hive.tournament.generation);
    } else {
        const [p1, p2] = getPlayersIndex(hive.tournament.game, hive.tournament.players);
        const $t = $("#tournament_tables > table.tournament-" + hive.tournament.generation + " tr.player-" + (p1 + 1) + " > td.player-" + (p2 + 1));
        const $p1 = $("#tournament_tables > table.tournament-" + hive.tournament.generation + " tr.player-" + (p1 + 1) + " > td.player-" + (p1 + 1));
        const $p2 = $("#tournament_tables > table.tournament-" + hive.tournament.generation + " tr.player-" + (p2 + 1) + " > td.player-" + (p2 + 1));
        if (whiteDead && blackDead) {
            $t.html("<i class='bi bi-emoji-sunglasses'></i>").addClass("table-warning").removeClass("table-dark");
        } else if (whiteDead) {
            $t.html("<i class='bi bi-bug-fill'></i>").addClass("table-secondary").removeClass("table-dark");
        } else {
            $t.html("<i class='bi bi-bug'></i>").removeClass("table-dark");
        }
        $p1.html(hive.tournament.players[p1].score);
        $p2.html(hive.tournament.players[p2].score);
    }
}
function setGeneration(generation) {
    $("#tournament_generation_text").html("Generation " + generation);
    $("#tournament_tables table").addClass("d-none");
    $("#tournament_tables table.tournament-" + generation).removeClass("d-none");
    $("#tournament_generation").val(generation);
}
function addGeneration(add) {
    setGeneration(Math.max(1, Math.min(hive.tournament.generation, parseInt($("#tournament_generation").val()) + add)));
}

function download() {
    let text = "Ruleset: " + (hive.standardRules ? "standard" : "variant") + "\n";
    hive.moveLists.forEach((moveList, id) => {
        if (id > 0) {
            text += "\n\nvariation " + id + " parent " + moveList.parentMoveListId + " start " + moveList.variationRound + "\n";
        }
        $("#move-list > ul.move-list-" + id + " > li").each((i, v) => {
            text += $(v).text() + "\n";
        });
    });
    saveToFile(text, "hive_game");
}
function downloadTournament() {
    let text = "";
    $("#tournament_log > li").each((i, v) => {
        text += $(v).text() + "\n";
    });
    saveToFile(text, "hive_tournament");
}
function saveToFile(text, filenamePrefix) {
    const date = new Date();
    let filename = filenamePrefix + "_" + date.getFullYear() + "-";
    filename += (date.getMonth() < 9 ? "0" : "") + (date.getMonth() + 1) + "-";
    filename += (date.getDate() < 10 ? "0" : "") + date.getDate() + ".txt";

    const pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);
    pom.click();
}
function newGame() {
    if (!confirmKillGame()) {
        return;
    }
    $(".tournament-running").addClass("d-none");
    const piece = $("[name='piece']:checked").val();
    const color = piece === COLOR_TXT[BLACK] || piece !== COLOR_TXT[WHITE] && Math.random() < .5 ? BLACK : WHITE;
    $("[name='piece']").val(COLOR_TXT[color]);
    const standardRules = !$('#alternativeRules').prop('checked');
    const [totalTime, increment] = getTime();
    const human = $("#human").prop("checked");
    const ai = $("#ai").prop("checked");
    hive.newGame(
        color,
        human || ai && color === WHITE ? canvasPlayer : new AIPlayer(hive),
        human || ai && color === BLACK ? canvasPlayer : new AIPlayer(hive),
        totalTime, increment, standardRules);
}
function getTime() {
    let totalTimeVal = $("#totalTime").val();
    let incrementVal = $("#increment").val();
    let totalTime = $("#timer").prop("checked") && $.isNumeric(totalTimeVal) ? totalTimeVal : 0;
    totalTime = Math.max(0, Math.min(60000, totalTime));
    let increment = $.isNumeric(incrementVal) ? incrementVal : 0;
    increment = Math.max(0, Math.min(3600000, Math.ceil(increment)));
    return [totalTime, increment];
}
function draw () {
    onlinePlayer.draw();
    // noinspection JSUnresolvedReference
    $("#drawSentToast").toast("show");
}
function offerUndo() {
    onlinePlayer.undo();
    // noinspection JSUnresolvedReference
    $("#undoSentToast").toast("show");
}
function newOnlineGame() {
    const piece = $("[name='piece']:checked").val();
    const [totalTime, increment] = getTime();
    const standardRules = !$('#alternativeRules').prop('checked');
    onlinePlayer.newGame(piece, totalTime, increment, standardRules);
    // noinspection JSUnresolvedReference
    $("#challengeSentToast").toast("show");
}
function acceptNewGame() {
    // noinspection JSUnresolvedReference
    $("#challengeToast").toast("hide");
    onlinePlayer.acceptNewGame(onlineCallbacks());
}
function acceptDraw() {
    // noinspection JSUnresolvedReference
    $("#drawToast").toast("hide");
    onlinePlayer.acceptDraw();
}
function acceptUndo() {
    // noinspection JSUnresolvedReference
    $("#undoToast").toast("hide");
    onlinePlayer.acceptUndo();
}
function resign() {
    if (hive.getPlayerPlaying() instanceof CanvasPlayer) {
        hive.resign();
    } else {
        showMessage("Wait for your turn to resign");
    }
}
function connect(id) {
    $("#connecting").removeClass("d-none");
    $("#receive, #openGame").addClass("d-none");
    onlinePlayer = new OnlinePlayer(hive);
    onlinePlayer.connect(id, onlineCallbacks());
}
function getParam(name) {
    const param = window.location.search.substring(1).split("&")
        .map(param => param.split("=", 2))
        .find(param => param[0] === name);
    if (!param) {
        return null;
    } else if (param.length === 1) {
        return "";
    } else {
        return param[1];
    }
}
function receive() {
    $("#receive").addClass("d-none");
    $("#receiving").removeClass("d-none");
    $("#receive, #openGame").addClass("d-none");
    onlinePlayer = new OnlinePlayer(hive);
    onlinePlayer.waitForConnection(onlineCallbacks());
}
function localCallbacks() {
    return {
        move: appendMoveList,
        newGame: timeControl => {
            if ($("#ai2").prop("checked")) {
                $("#undo").addClass("d-none");
            } else {
                $("#undo").removeClass("d-none");
            }
            $("#move-list").html("");
            appendMoveList(1, "Start - " + timeControl);
            if (hive.whitePlayer instanceof OnlinePlayer || hive.blackPlayer instanceof OnlinePlayer) {
                $("#newGame, #newOnlineGame, .gameSettings, #undo").addClass("d-none");
                $("#resign, #offerUndo, #draw").removeClass("d-none");
            }
        },
        resign: color => {
            if (color === BLACK) {
                showMessage("Black resigns! White wins!");
            } else {
                showMessage("White resigns! Black wins!");
            }
            gameOver();
        },
        drawByAgreement: () => {
            showMessage("Draw by agreement!");
            gameOver();
        },
        undo: (ok, gameOver) => {
            if (ok) {
                if ((hive.board.round & 1) === 1) {
                    $("#move-list > ul:last-child").remove();
                } else {
                    $("#move-list > ul > li.round-" + (hive.board.round + 1)).remove();
                }
                if (gameOver || hive.getPlayerPlaying() instanceof AIPlayer) {
                    hive.undo();
                } else {
                    updateMoveList(hive.board.round, 0);
                }
            } else {
                showMessage("There is no move to undo...");
            }
        },
        timeout: id => {
            if (id === BLACK) {
                showMessage("Time is over! White wins!");
            } else {
                showMessage("Time is over! Black wins!");
            }
            gameOver();
        },
        gameOver: color => {
            if (color === WHITE) {
                showMessage("White wins!");
            } else if (color === BLACK) {
                showMessage("Black wins!");
            } else {
                showMessage("Draw!");
            }
            gameOver();
        },
    }
}
function gameOver() {
    if (hive.whitePlayer instanceof OnlinePlayer || hive.blackPlayer instanceof OnlinePlayer) {
        $("#newOnlineGame, .gameSettings").removeClass("d-none");
        $("#resign, #offerUndo, #draw, .opponent").addClass("d-none");
    }
}
function onlineCallbacks() {
    return {
        waiting: id => {
            $("#receiving").addClass("d-none");
            $("#waiting, #received").removeClass("d-none");
            $("#user_id").val(window.location.href.split('?')[0] + "?id=" + id);
            // noinspection JSUnresolvedReference
            new ClipboardJS("#user_id_button");
        },
        connected: () => {
            $("#newGame, #waiting, #connecting, #received, #receive, .opponent, .tournament").addClass("d-none");
            $("#newOnlineGame, #disconnect").removeClass("d-none");
            $("#human").prop("checked", true);
            playerChanged();
            showMessage("Connected!");
        },
        opponentOffersNewGame: (colorTxt, totalTime, increment, standardRules) => {
            const you = colorTxt === COLOR_TXT[WHITE] ? "White" : (colorTxt === COLOR_TXT[BLACK] ? "Black" : "Random");
            const timeControl = hive.getMoveList().timeControlToText(totalTime, increment);
            let text = "You play as " + you + " with " + timeControl;
            if (!standardRules) {
                text += " and alternative rules";
            }
            $("#challenge").text(text + ".  Do you accept?");
            // noinspection JSUnresolvedReference,SpellCheckingInspection
            $("#challengeToast").toast("show", { autohide: false });
        },
        newGame: (bottomColor, totalTime, increment, standardRules) => {
            const whitePlayer = bottomColor === WHITE ? canvasPlayer : onlinePlayer;
            const blackPlayer = bottomColor === BLACK ? canvasPlayer : onlinePlayer;
            $("#undo").removeClass("d-none");
            $(".tournament-running").addClass("d-none");
            hive.newGame(bottomColor, whitePlayer, blackPlayer, totalTime, increment, standardRules);
        },
        disconnect: () => showMessage("Disconnected"),
        opponentDisconnects: () => showMessage("Your opponent disconnected"),
        opponentOffersDraw: () => {
            // noinspection JSUnresolvedReference,SpellCheckingInspection
            $("#drawToast").toast("show", { autohide: false });
        },
        opponentOffersUndo: () => {
            // noinspection JSUnresolvedReference,SpellCheckingInspection
            $("#undoToast").toast("show", { autohide: false });
        },
        error: err => showMessage("" + err),
        connectionBroken: connectionBroken,
    };
}
function connectionBroken(showNotification) {
    if (showNotification) {
        showMessage("Connection broken")
    }
    $(".connection, #openGame, #newOnlineGame, #resign, #offerUndo, #draw, #disconnect").addClass("d-none");
    $("#receive, #newGame, #openGame, .gameSettings, .tournament").removeClass("d-none");
    if (hive.whitePlayer instanceof OnlinePlayer) {
        hive.whitePlayer = canvasPlayer;
    }
    if (hive.blackPlayer instanceof OnlinePlayer) {
        hive.blackPlayer = canvasPlayer;
    }
}
function newTournament(startNow = true) {
    $("#ai2").prop("checked", true);
    $("#noTimer").prop("checked", true).change();
    $("#whitePiece").prop("checked", true);
    $("#tournament_log").html("");
    $(".tournament-running").removeClass("d-none");
    $("#undo").addClass("d-none");
    hive.tournament = new Tournament(hive, !$('#alternativeRules').prop('checked'), tournamentCallbacks());
    $("#tournament_tables").html("");
    if (startNow) {
        updateTournamentPlayers();
        addTournamentLine("New tournament with " + (hive.standardRules ? "standard" : "variant") + " rules!");
        hive.tournament.start();
    }
}
function tournamentCallbacks() {
    return {
        gameResult: (whiteDead, blackDead, time) => {
            let result;
            if (whiteDead && blackDead) {
                result = " draws to ";
            } else if (whiteDead) {
                result = " loses to ";
            } else {
                result = " wins ";
            }
            addTournamentLine("White " + hive.whitePlayer.evaluatorId + result + "Black " + hive.blackPlayer.evaluatorId + " in " + time + "s.");
            hive.moveLists.forEach((moveList, id) => {
                $("#move-list > ul.move-list-" + id + " > li").each((i, v) => {
                    addTournamentLine($(v).text());
                });
            });
            addTournamentLine();
            updateTournamentPlayers(whiteDead, blackDead);
        },
        generationResult: (players, generation) => {
            addTournamentLine("Generation " + generation + " results:");
            players.forEach((p, idx) => {
                addTournamentLine((idx + 1) + ". " + p.evaluatorId + ": " + p.score);
            });
            addTournamentLine();
        },
        generationStart: (players, generation) => {
            addTournamentLine();
            addTournamentLine("Generation " + generation + ":");
            players.forEach(p => {
                addTournamentLine(p.evaluatorId + " - " + p.origin);
            });
            addTournamentLine();
            updateTournamentPlayers();
        },
    };
}
function addTournamentLine(s = "") {
    $("#tournament_log").append("<li class='text-nowrap'>" + s + "</li>");
}