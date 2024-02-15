mod piece;

use wasm_bindgen::prelude::*;
use crate::piece::PieceColor2;

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    //alert(&PieceColor2::Black.to_string());
}
