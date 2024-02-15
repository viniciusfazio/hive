use std::fmt;
use wasm_bindgen::prelude::wasm_bindgen;


#[wasm_bindgen]
pub enum PieceColor2 {
    White, Black
}

impl fmt::Display for PieceColor2 {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            PieceColor2::White => write!(f, "w"),
            PieceColor2::Black => write!(f, "b"),
        }
    }
}
