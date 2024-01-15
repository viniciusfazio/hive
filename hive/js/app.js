import HiveCanvas from "./hive/hivecanvas.js";
import CanvasPlayer from "./hive/player/canvasplayer.js";
import {PieceColor} from "./hive/core/piece.js";

let hive = null;

let canvasPlayer;
$(() => {
    canvasPlayer = new CanvasPlayer();
    $("#resign").click(() => {
        if (!hive.getPlayerPlaying() instanceof CanvasPlayer) {
            showMessage("Wait for your turn to resign");
        } else {
            hive.resign();
        }
    });
    $("#newgame").click(() => {
        const piece = $("[name='piece']:checked").val();
        const color = piece === "black" || piece !== "white" && Math.random() < .5 ? PieceColor.black : PieceColor.white;
        const totalTime = $("#timer").prop("checked") ? $("#totalTime").val() : 0;
        const increment = $("#increment").val();
        hive.newGame(color, canvasPlayer, canvasPlayer, totalTime, increment);
    });
    $("#download").click(() => {
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
    });
    $("#upload").change(() => {
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
    });
    $("#round").mousemove(event => {
        if (event.buttons % 2 === 1) {
            setRound(event.target.value);
        }
    }).change(event => {
        setRound(event.target.value);
    });
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
    const size = Math.min(window.innerWidth, window.innerHeight) - 20 - 15; // remove a borda e o scroll
    hive = new HiveCanvas($("#hive").prop("width", size).prop("height", size).mousemove(event => {
        canvasPlayer.hover(event.offsetX, event.offsetY, event.buttons % 2 === 1);
    }).mousedown(event => {
        click(event.offsetX, event.offsetY, $("#automove").prop("checked"));
    }).mouseup(event => {
        click(event.offsetX, event.offsetY, $("#automove").prop("checked"));
    }).keydown(event => {
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
                if (hive) {
                    hive.toggleDebug();
                    hive.redraw();
                }
                break;
        }
    }), canvasPlayer, hiveCallback);
});
function setRound(round) {
    if (hive) {
        hive.setRound(round);
        updateMoveList(round);
    }
}
function addRound(round) {
    if (hive) {
        setRound(hive.board.round + round);
    }
}
function hiveCallback(action) {
    const $moveList = $("#move-list");
    let txt;
    switch (action.type) {
        case "newGame":
            $moveList.html("");
            txt = "Start (" + action.timeControl + ")";
            break;
        case "move":
            txt = action.move;
            let msg = null;
            switch (action.move) {
                case "white wins":
                    msg = "White wins!";
                    break;
                case "black wins":
                    msg = "Black wins!";
                    break;
                case "draw":
                    msg = "Draw!";
                    break;
                case "draw by agreement":
                    msg = "Draw by agreement!";
                    break;
                case "resign":
                    if (action.round % 2 === 1) {
                        msg = "Black resigns! White wins!";
                    } else {
                        msg = "White resigns! Black wins!";
                    }
                    break;
                case "timeout":
                    if (action.round % 2 === 1) {
                        msg = "Time is over! White wins!";
                    } else {
                        msg = "Time is over! Black wins!";
                    }
                    break;
            }
            if (msg !== null) {
                showMessage(msg);
                $("#resign, #draw").addClass("d-none");
                $("#newgame").removeClass("d-none");

            }
            break;
    }
    const li = '<li class="list-group-item list-group-item-action py-0">' + txt + '</li>';
    const $ul = $("#move-list > ul:last-child");
    if (action.round <= 2 || $ul.find("li").length > 1) {
        $moveList.append('<ul class="list-group list-group-horizontal">' + li + '</ul>');
    } else {
        $ul.append(li);
    }
    $("#move-list > ul:last-child > li:last-child").click(() => setRound(action.round));
    $("#round").prop("max", action.round);
    updateMoveList(action.round);
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
function click(x, y, automove) {
    const round = hive.board.round;
    canvasPlayer.click(x, y, automove);
    if (round === 1 && hive.board.round === 2) {
        $("#newgame, #newonlinegame").addClass("d-none");
        $("#resign").removeClass("d-none");
    }
}
window.onbeforeunload = () => {return "-"};
