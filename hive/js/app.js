import HiveCanvas from "./hive/hivecanvas.js";
import CanvasPlayer from "./hive/player/canvasplayer.js";
import {PieceColor} from "./hive/core/piece.js";
import OnlinePlayer from "./hive/player/onlineplayer.js";

const SHORT_ON_TIME = 20; // time to be short on time, in s

let hive, canvasPlayer, onlinePlayer;
$(() => {
    window.onbeforeunload = () => "-";
    hive = new HiveCanvas(localCallbacks(), SHORT_ON_TIME);
    canvasPlayer = new CanvasPlayer(hive);
    $("#confirmMoveLabel").text("Must confirm move if time > " + SHORT_ON_TIME + "s");
    $("#resign").click(resign);
    $("#newGame").click(newGame);
    $("#newOnlineGame").click(newOnlineGame);
    $("#download").click(download);
    $("#upload").change(upload);
    $("#receive").click(receive);
    $("#draw").click(draw);
    $("#nextMove").click(() => addRound(1));
    $("#previousMove").click(() => addRound(-1));
    $("#firstMove").click(() => setRound(1, 0));
    $("#lastMove").click(() => setRound(999999999, 0));
    $("#disconnect").click(() => onlinePlayer.disconnect(onlineCallbacks()));
    $("#acceptNewGame").click(acceptNewGame);
    $("#acceptDraw").click(acceptDraw);
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
    const size = Math.min(window.innerWidth, window.innerHeight) - 2;
    const $autoMove = $("#autoMove");
    const $confirmMove = $("#confirmMove");
    const $hive = $("#hive");
    $hive.css("border", "1px solid black").prop("width", size).prop("height", size);
    $hive.mousemove(e => canvasPlayer.hover(e.offsetX, e.offsetY, (e.buttons & 1) > 0));
    $hive.mousedown(e => {
        if (e.button === 2) {
            canvasPlayer.click(-1, -1);
        } else if (e.button === 0) {
            canvasPlayer.click(e.offsetX, e.offsetY, $autoMove.prop("checked"), $confirmMove.prop("checked"));
        }
    });
    $hive.mouseout(() => canvasPlayer.hover(-1, -1));
    $hive.mouseup(e => {
        if (e.button === 0) {
            canvasPlayer.click(e.offsetX, e.offsetY, $autoMove.prop("checked"), $confirmMove.prop("checked"), true);
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
        }
    });
    hive.init($hive, canvasPlayer);

    const id = getParam("id");
    if (id !== null) {
        connect(id);
    }
});
function setRound(round, moveListId) {
    round = Math.max(1, Math.min(round, hive.moveLists[moveListId].moves.length + 1));
    hive.setRound(round, moveListId);
    updateMoveList(round, moveListId);
}
function addRound(qty) {
    const round = hive.board.round + qty;
    const moveListId = hive.currentMoveListId;
    const $li = $("ul.move-list-" + moveListId + " > li.round-" + round);
    if ($li.length !== 0) {
        $li.click();
    }
}
function appendMoveList(round, move, moveListId = 0) {
    const li = '<li style="cursor: pointer" class="text-nowrap list-group-item list-group-item-action ' + (moveListId > 0 ? "list-group-item-secondary" : "") + ' py-0 round-' + round + '">' + move + '</li>';
    const li2 = '<li style="cursor: pointer" class="text-nowrap list-group-item list-group-item-action ' + (moveListId > 0 ? "list-group-item-secondary" : "") + ' py-0 empty"></li>';
    const ul = '<ul class="list-group list-group-horizontal move-list-' + moveListId + '">' + li + '</ul>';
    const ul2 = '<ul class="list-group list-group-horizontal move-list-' + moveListId + '">' + li2 + li + '</ul>';
    if (moveListId === 0) {
        // main list
        if (round === 1 || round % 2 === 0) {
            // there is no list or new line
            $("#move-list").append(ul);
        } else {
            // a move will be added to an existent line
            $(li).insertAfter($("#move-list > ul.move-list-0 > li.round-" + (round - 1)));
        }
    } else {
        // alternative move list
        let $ul = $("#move-list > ul.move-list-" + moveListId);
        if ($ul.length === 0) {
            // it doesn't exist yet
            $ul = $("#move-list > ul.move-list-0 > li.round-" + round).parent();
            if ($ul.length === 0) {
                // it is after last move
                $("#move-list").append(round % 2 === 0 ? ul : ul2);
            } else {
                $(round % 2 === 0 ? ul : ul2).insertAfter($ul);
            }
        } else if (round === 1 || round % 2 === 0) {
            // new line will be added to the list
            $(ul).insertAfter($ul.last());
        } else {
            // a move will be added to an existent line
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
    if (!hive.gameOver && !confirm("The ongoing game will be gone. Are you sure?")) {
        $file.val(null);
        return;
    }
    const files = $file.prop("files");
    if (files.length === 1) {
        const fileReader = new FileReader();
        fileReader.onload = e => {
            const fileContent = (e.target.result ?? "").split("\n");
            const $alternativeRules = $('#alternativeRules');
            const standardRules = !$alternativeRules.prop('checked');
            if (tryParseFile(fileContent, standardRules) !== null) {
                // cant parse. Try again with different ruleset
                if (tryParseFile(fileContent, !standardRules) !== null) {
                    // still cant parse
                    showMessage(tryParseFile(fileContent, standardRules));
                } else {
                    // success with different ruleset
                    $alternativeRules.prop('checked', standardRules);
                }
            }
            hive.gameOver = true;
        };
        fileReader.readAsText(files[0]);
    } else if (files.length === 0) {
        showMessage("Choose a file...");
    } else {
        showMessage("Choose only 1 file.");
    }
    $file.val("");
}
function tryParseFile(fileContent, standardRules) {
    let error = null;
    hive.newGame(PieceColor.white, canvasPlayer, canvasPlayer, 0, 0, standardRules);
    fileContent.find(move => {
        error = hive.playNotation(move);
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
function download() {
    let text = "";
    $("#move-list > ul.move-list-0 > li").each((i, v) => {
        text += $(v).text() + "\n";
    });
    const pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    const date = new Date();
    let filename = "hive_" + date.getFullYear() + "-";
    filename += (date.getMonth() < 9 ? "0" : "") + (date.getMonth() + 1) + "-";
    filename += (date.getDate() < 10 ? "0" : "") + date.getDate() + ".txt";
    pom.setAttribute('download', filename);
    pom.click();
}
function newGame() {
    const piece = $("[name='piece']:checked").val();
    const color = piece === "b" || piece !== "w" && Math.random() < .5 ? PieceColor.black : PieceColor.white;
    const standardRules = !$('#alternativeRules').prop('checked');
    const [totalTime, increment] = getTime();
    hive.newGame(color, canvasPlayer, canvasPlayer, totalTime, increment, standardRules);
}
function getTime() {
    let totalTime = $("#timer").prop("checked") ? $("#totalTime").val() : "0";
    totalTime = Math.min(60000, parseInt(totalTime.substring(0, 5)));
    let increment = $("#increment").val();
    increment = Math.min(3600000, parseInt(increment.substring(0, 7)));
    return [totalTime, increment];
}
function draw () {
    onlinePlayer.draw();
    // noinspection JSUnresolvedReference
    $("#drawSentToast").toast("show");
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
            $("#move-list").html("");
            appendMoveList(1, "Start - " + timeControl);
            if (hive.whitePlayer instanceof OnlinePlayer || hive.blackPlayer instanceof OnlinePlayer) {
                $("#newGame, #newOnlineGame, .gameSettings").addClass("d-none");
                $("#resign, #draw").removeClass("d-none");
            }
        },
        resign: id => {
            if (id === "b") {
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
        timeout: id => {
            if (id === "b") {
                showMessage("Time is over! White wins!");
            } else {
                showMessage("Time is over! Black wins!");
            }
            gameOver();
        },
        gameOver: id => {
            if (id === "w") {
                showMessage("White wins!");
            } else if (id === "b") {
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
        $("#resign, #draw").addClass("d-none");
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
            $("#newGame, #waiting, #connecting, #received, #receive").addClass("d-none");
            $("#newOnlineGame, #disconnect").removeClass("d-none");
            showMessage("Connected!");
        },
        opponentOffersNewGame: (color, totalTime, increment, standardRules) => {
            const you = color === "random" ? "Random" : (color === "w" ? "Black" : "White");
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
            const whitePlayer = bottomColor.id === "w" ? canvasPlayer : onlinePlayer;
            const blackPlayer = bottomColor.id === "b" ? canvasPlayer : onlinePlayer;
            hive.newGame(bottomColor, whitePlayer, blackPlayer, totalTime, increment, standardRules);
        },
        disconnect: () => showMessage("Disconnected"),
        opponentDisconnects: () => showMessage("Your opponent disconnected"),
        opponentOffersDraw: () => {
            // noinspection JSUnresolvedReference,SpellCheckingInspection
            $("#drawToast").toast("show", { autohide: false });
        },
        error: err => showMessage("" + err),
        connectionBroken: connectionBroken,
    };
}
function connectionBroken(showNotification) {
    if (showNotification) {
        showMessage("Connection broken")
    }
    $(".connection, #openGame, #newOnlineGame, #resign, #draw, #disconnect").addClass("d-none");
    $("#receive, #newGame, #openGame, .gameSettings").removeClass("d-none");
    if (hive.whitePlayer instanceof OnlinePlayer) {
        hive.whitePlayer = canvasPlayer;
    }
    if (hive.blackPlayer instanceof OnlinePlayer) {
        hive.blackPlayer = canvasPlayer;
    }
}
