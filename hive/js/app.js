import HiveCanvas from "./hive/hivecanvas.js";
import CanvasPlayer from "./hive/player/canvasplayer.js";
import {PieceColor} from "./hive/core/piece.js";
import OnlinePlayer from "./hive/player/onlineplayer.js";
//import {Toast} from "https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/js/bootstrap.esm.min.js";

let hive, canvasPlayer, onlinePlayer;
$(() => {
    hive = new HiveCanvas(localCallbacks());
    canvasPlayer = new CanvasPlayer(hive);
    $("#resign").click(resign);
    $("#newGame").click(newGame);
    $("#newOnlineGame").click(newOnlineGame);
    $("#download").click(download);
    $("#upload").change(upload);
    $("#receive").click(receive);
    $("#connect").click(connect);
    $("#draw").click(() => hive.resign());
    $("#disconnect").click(() => onlinePlayer.disconnect(onlineCallbacks()));
    $("#acceptNewGame").click(acceptNewGame);
    $("#round").mousemove(event => {
        if (event.buttons % 2 === 1) {
            setRound(event.target.value);
        }
    }).change(event => setRound(event.target.value));
    $("#move-list").keydown(event => {
        switch (event.key) {
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
    const size = Math.min(window.innerWidth, window.innerHeight) - 20 - 15; // remove border and scroll sizes
    const $autoMove = $("#autoMove");
    hive.init($("#hive").prop("width", size).prop("height", size)
    .mousemove(event => canvasPlayer.hover(event.offsetX, event.offsetY, event.buttons % 2 === 1))
    .mousedown(event => canvasPlayer.click(event.offsetX, event.offsetY, $autoMove.prop("checked")))
    .mouseup(event => canvasPlayer.click(event.offsetX, event.offsetY, $autoMove.prop("checked")))
    .keydown(event => {
        switch (event.key) {
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
                hive.redraw();
                break;
        }
    }), canvasPlayer);
});
function setRound(round) {
    hive.setRound(round);
    showMessage("round " + round);
    updateMoveList(round);
}
function addRound(round) {
    setRound(hive.board.round + round);
}
function appendMoveList(round, move) {
    const li = '<li class="list-group-item list-group-item-action py-0">' + move + '</li>';
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
function updateMoveList(round) {
    if (!round) {
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
    hive.newGame(PieceColor.white, canvasPlayer, canvasPlayer);
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
    hive.newGame(color, canvasPlayer, canvasPlayer, totalTime, increment);
}
function newOnlineGame() {
    const piece = $("[name='piece']:checked").val();
    const totalTime = $("#timer").prop("checked") ? $("#totalTime").val() : 0;
    const increment = $("#increment").val();
    onlinePlayer.newGame(piece, totalTime, increment);
    $("#challengeSentToast").toast("show");
}
function acceptNewGame() {
    $("#challengeToast").toast("hide");
    onlinePlayer.acceptNewGame(onlineCallbacks());
}
function resign() {
    if (hive.getPlayerPlaying() instanceof CanvasPlayer) {
        hive.resign();
    } else {
        showMessage("Wait for your turn to resign");
    }
}
function connect() {
    $("#connect").addClass("d-none");
    $("#connecting").removeClass("d-none");
    $("#receive, #connect, #remote_id, #openGame").addClass("d-none");
    onlinePlayer = new OnlinePlayer(hive);
    onlinePlayer.connect($("[name='remote_id']").val().trim(), onlineCallbacks());
}
function receive() {
    $("#receive").addClass("d-none");
    $("#receiving").removeClass("d-none");
    $("#receive, #connect, #remote_id, #openGame").addClass("d-none");
    onlinePlayer = new OnlinePlayer(hive);
    onlinePlayer.waitForConnection(onlineCallbacks());
}
function localCallbacks() {
    return {
        move: appendMoveList,
        newGame: timeControl => {
            $("#move-list").html("");
            appendMoveList(1, "Start (" + timeControl + ")");
            if (hive.whitePlayer instanceof OnlinePlayer || hive.blackPlayer instanceof OnlinePlayer) {
                $("#newGame, #newOnlineGame").addClass("d-none");
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
        $("#newOnlineGame").removeClass("d-none");
        $("#resign, #draw").addClass("d-none");
    }
}
function onlineCallbacks() {
    return {
        waiting: id => {
            $("#receiving").addClass("d-none");
            $("#waiting, #received").removeClass("d-none");
            $("#user_id").val(id);
            // noinspection JSUnresolvedReference
            new ClipboardJS("#user_id_button");
        },
        connected: () => {
            $("#newGame, #waiting, #connecting, #received").addClass("d-none");
            $("#newOnlineGame, #disconnect").removeClass("d-none");
            showMessage("Connected!");
        },
        opponentOffersNewGame: (color, totalTime, increment) => {
            const you = color === "random" ? "Random" : (color === "w" ? "Black" : "White");
            const timeControl = hive.getMoveList().timeControlToText(totalTime, increment);
            $("#challenge").text("You play as " + you + " with " + timeControl + ".  Do you accept?");
            $("#challengeToast").toast("show", { autohide: false });
        },
        newGame: (bottomColor, totalTime, increment) => {
            const whitePlayer = bottomColor.id === "w" ? canvasPlayer : onlinePlayer;
            const blackPlayer = bottomColor.id === "b" ? canvasPlayer : onlinePlayer;
            hive.newGame(bottomColor, whitePlayer, blackPlayer, totalTime, increment)
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
    $(".connection, #openGame, #newOnlineGame, #resign, #draw").addClass("d-none");
    $("#remote_id").val("");
    $("#receive, #remote_id, #connect, #newGame, #openGame").removeClass("d-none");
    if (hive.whitePlayer instanceof OnlinePlayer) {
        hive.whitePlayer = canvasPlayer;
    }
    if (hive.blackPlayer instanceof OnlinePlayer) {
        hive.blackPlayer = canvasPlayer;
    }
}
window.onbeforeunload = () => {return "-"};
