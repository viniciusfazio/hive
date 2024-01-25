import HiveCanvas from "./hive/hivecanvas.js";
import CanvasPlayer from "./hive/player/canvasplayer.js";
import {PieceColor} from "./hive/core/piece.js";
import OnlinePlayer from "./hive/player/onlineplayer.js";

let hive, canvasPlayer, onlinePlayer;
$(() => {
    window.onbeforeunload = () => "-";
    hive = new HiveCanvas(localCallbacks());
    canvasPlayer = new CanvasPlayer(hive);
    $("#resign").click(resign);
    $("#newGame").click(newGame);
    $("#newOnlineGame").click(newOnlineGame);
    $("#download").click(download);
    $("#upload").change(upload);
    $("#receive").click(receive);
    $("#draw").click(draw);
    $("#nextMove").click(() => addRound(1));
    $("#previousMove").click(() => addRound(-1));
    $("#firstMove").click(() => setRound(1));
    $("#lastMove").click(() => addRound(999999999));
    $("#disconnect").click(() => onlinePlayer.disconnect(onlineCallbacks()));
    $("#acceptNewGame").click(acceptNewGame);
    $("#acceptDraw").click(acceptDraw);
    $("#round").mousemove(e => {
        if (e.buttons % 2 === 1) {
            setRound(e.target.value);
        }
    }).change(e => setRound(e.target.value));
    $("#move-list").keydown(e => {
        switch (e.key) {
            case "ArrowLeft":
                addRound(-1);
                break;
            case "ArrowRight":
                addRound(1);
                break;
            case "ArrowUp":
                addRound(-2);
                break;
            case "ArrowDown":
                addRound(2);
                break;
        }
    });
    const size = Math.min(window.innerWidth, window.innerHeight) - 2;
    const $autoMove = $("#autoMove");
    const $alternativeRules = $("#alternativeRules");
    const $hive = $("#hive");
    $hive.css("border", "1px solid black").prop("width", size).prop("height", size);
    $hive.mousemove(e => canvasPlayer.hover(e.offsetX, e.offsetY, (e.buttons & 1) > 0));
    $hive.mousedown(e => {
        if (e.button === 2) {
            canvasPlayer.click(-1, -1, false);
        } else if (e.button === 0) {
            canvasPlayer.click(e.offsetX, e.offsetY, $autoMove.prop("checked") && !$alternativeRules.prop("checked"));
        }
    });
    $hive.mouseout(() => canvasPlayer.hover(-1, -1, false));
    $hive.mouseup(e => {
        if (e.button === 0) {
            canvasPlayer.click(e.offsetX, e.offsetY, $autoMove.prop("checked") && !$alternativeRules.prop("checked"), true);
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
            case "ArrowUp":
                addRound(999999999);
                break;
            case "ArrowDown":
                setRound(1);
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
function setRound(round) {
    round = Math.max(1, Math.min(round, hive.getMoveList().moves.length + 1));
    hive.setRound(round);
    updateMoveList(round);
}
function addRound(round) {
    setRound(hive.board.round + round);
}
function appendMoveList(round, move) {
    const li = '<li style="cursor: pointer" class="text-nowrap list-group-item list-group-item-action py-0">' + move + '</li>';
    const $ul = $("#move-list > ul:last-child");
    if (round <= 2 || $ul.find("li").length > 1) {
        $("#move-list").append('<ul class="list-group list-group-horizontal">' + li + '</ul>');
    } else {
        $ul.append(li);
    }
    $("#move-list > ul:last-child > li:last-child").click(() => setRound(round));
    $("#round").prop("max", round);
    updateMoveList(round);
}
function showMessage(msg) {
    $("#messageToast .toast-body").text(msg);
    // noinspection JSUnresolvedReference
    $("#messageToast").toast("show");
}
function updateMoveList(round = null) {
    if (round === null) {
        round = hive.board.round;
    }
    $("#move-list > ul > li").removeClass("active");
    $("#move-list > ul").eq(round === 1 ? 0 : Math.floor(round / 2))
        .find("li").eq(round === 1 ? 0 : round % 2).addClass("active");
    $("#round").val(round);
}
function upload() {
    const $file = $("#upload");
    if ($("#move-list > ul > li").length > 2 && !hive.gameOver && !confirm("The ongoing game will be gone. Are you sure?")) {
        $file.val(null);
        return;
    }
    hive.newGame(PieceColor.white, canvasPlayer, canvasPlayer, 0, 0, !$('#alternativeRules').prop('checked'));
    const files = $file.prop("files");
    if (files.length === 1) {
        const fileReader = new FileReader();
        fileReader.onload = e => {
            let ended = false;
            (e.target.result ?? "").split("\n").forEach(move => {
                if (ended) {
                    return;
                }
                const error = hive.playNotation(move);
                if (error && error !== "cant parse") {
                    showMessage("Error parsing '" + move + "': " + error);
                    ended = true;
                }
            });
            if (hive.board.round === 1) {
                showMessage("Error parsing: no move found.");
            }
        };
        fileReader.readAsText(files[0]);
    } else if (files.length === 0) {
        showMessage("Choose a file...");
    } else {
        showMessage("Choose only 1 file.");
    }
}
function download() {
    let text = "";
    $("#move-list > ul > li").each((i, v) => {
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
    const totalTime = $("#timer").prop("checked") ? $("#totalTime").val() : 0;
    const increment = $("#increment").val();
    hive.newGame(color, canvasPlayer, canvasPlayer, totalTime, increment, !$('#alternativeRules').prop('checked'));
}
function draw () {
    onlinePlayer.draw();
    // noinspection JSUnresolvedReference
    $("#drawSentToast").toast("show");
}
function newOnlineGame() {
    const piece = $("[name='piece']:checked").val();
    const totalTime = $("#timer").prop("checked") ? $("#totalTime").val() : 0;
    const increment = $("#increment").val();
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
    // noinspection JSUnresolvedReference,SpellCheckingInspection
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
        opponentOffersDraw: () => $("#drawToast").toast("show", { autohide: false }),
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
