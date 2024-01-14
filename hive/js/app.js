import Hive from "./hive/hive.js";
import LocalPlayer from "./hive/player/localplayer.js";

let hive = null;

let localPlayer;
$(() => {
    localPlayer = new LocalPlayer()
    $("#rodada").mousemove(event => {
        if (hive && event.buttons % 2 === 1) {
            //hive.setRodada(event.target.value);
        }
    }).change(event => {
        if (hive) {
            //hive.setRodada(event.target.value);
        }
    });
    $("#move-list").keydown(event => {
        if (hive) {
            switch (event.key) {
                case "ArrowLeft":
                    //hive.addRodada(-1);
                    break;
                case "ArrowRight":
                    //hive.addRodada(1);
                    break;
                case "ArrowUp":
                    //hive.addRodada(-2);
                    break;
                case "ArrowDown":
                    //hive.addRodada(2);
                    break;
            }
        }
    });
    const size = Math.min(window.innerWidth, window.innerHeight) - 20 - 15; // remove a borda e o scroll
    hive = new Hive($("#hive").prop("width", size).prop("height", size).mousemove(event => {
        localPlayer.hover(event.offsetX, event.offsetY, event.buttons % 2 === 1);
    }).mousedown(event => {
        localPlayer.click(event.offsetX, event.offsetY);
    }).mouseup(event => {
        localPlayer.click(event.offsetX, event.offsetY);
    }).keydown(event => {
        if (hive) {
            switch (event.key) {
                case "ArrowLeft":
                    //hive.addRodada(-1);
                    break;
                case "ArrowRight":
                    //hive.addRodada(1);
                    break;
                case "ArrowUp":
                    //hive.addRodada(999999999);
                    break;
                case "ArrowDown":
                    //hive.setRodada(1);
                    break;
                case "D":
                    hive.toggleDebug();
                    hive.redraw();
                    break;
            }
        }
    }), localPlayer, localPlayer);
});
window.onbeforeunload = () => {return "-"};
