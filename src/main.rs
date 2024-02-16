mod piece;

use wasm_bindgen::prelude::*;
use crate::piece::PieceColor;

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen(start)]
pub fn init_hive() {
    
}

fn main() {

}