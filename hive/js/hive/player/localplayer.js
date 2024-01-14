
import Player from "./player.js";
export default class LocalPlayer extends Player {
    mouseX = 0;
    mouseY = 0;
    selectedPieceId = null;
    hoverPieceId = null;
    dragging = null;

    hover(x, y, dragging = false) {
        this.dragging = dragging;
        this.mouseX = x;
        this.mouseY = y;
    }
    click(x, y) {
        this.hover(x, y);
    }

}
