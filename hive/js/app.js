import HiveCanvas from "./hive/hivecanvas.js";
import CanvasPlayer from "./hive/player/canvasplayer.js";

let hive = null;

let canvasPlayer;
$(() => {
    canvasPlayer = new CanvasPlayer();
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
                        msg = "White resigns! Black wins!";
                    } else {
                        msg = "Black resigns! White wins!";
                    }
                    break;
                case "timeout":
                    if (action.round % 2 === 1) {
                        msg = "Time is over! Black wins!";
                    } else {
                        msg = "Time is over! White wins!";
                    }
                    break;
            }
            if (msg !== null) {
                $("#messageToast .toast-body").text(msg);
                // noinspection JSUnresolvedReference
                $("#messageToast").toast("show");

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
