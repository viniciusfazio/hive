import Hivecanvas from "./hive/hivecanvas.js";
import CanvasPlayer from "./hive/player/canvasplayer.js";

let hive = null;

let canvasPlayer;
$(() => {
    canvasPlayer = new CanvasPlayer();
    $("#rodada").mousemove(event => {
        if (hive && event.buttons % 2 === 1) {
            hive.setRound(event.target.value);
        }
    }).change(event => {
        if (hive) {
            hive.setRound(event.target.value);
        }
    });
    $("#move-list").keydown(event => {
        if (hive) {
            switch (event.key) {
                case "ArrowLeft":
                    hive.addRound(-1);
                    break;
                case "ArrowRight":
                    hive.addRound(1);
                    break;
                case "ArrowUp":
                    hive.addRound(-2);
                    break;
                case "ArrowDown":
                    hive.addRound(2);
                    break;
            }
        }
    });
    const size = Math.min(window.innerWidth, window.innerHeight) - 20 - 15; // remove a borda e o scroll
    hive = new Hivecanvas($("#hive").prop("width", size).prop("height", size).mousemove(event => {
        canvasPlayer.hover(event.offsetX, event.offsetY, event.buttons % 2 === 1);
    }).mousedown(event => {
        click(event.offsetX, event.offsetY, $("#automove").prop("checked"));
    }).mouseup(event => {
        click(event.offsetX, event.offsetY, $("#automove").prop("checked"));
    }).keydown(event => {
        if (hive) {
            switch (event.key) {
                case "ArrowLeft":
                    hive.addRound(-1);
                    break;
                case "ArrowRight":
                    hive.addRound(1);
                    break;
                case "ArrowUp":
                    hive.addRound(999999999);
                    break;
                case "ArrowDown":
                    hive.setRound(1);
                    break;
                case "D":
                    hive.toggleDebug();
                    hive.redraw();
                    break;
            }
        }
    }), canvasPlayer, playCallback);
});
function playCallback() {

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
