use std::fmt;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;


#[wasm_bindgen]
pub enum PieceColor {
    White = 1, Black = 2
}

/**
 * Caution: color_string leaks memory
 */
#[wasm_bindgen]
pub fn color_string(p: i32) -> JsValue {
    match p {
        x if x == PieceColor::White as i32 => JsValue::from_str(&PieceColor::White.to_string()),
        x if x == PieceColor::Black as i32 => JsValue::from_str(&PieceColor::Black.to_string()),
        _ => JsValue::NULL,
    }
}

impl fmt::Display for PieceColor {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            PieceColor::White => write!(f, "w"),
            PieceColor::Black => write!(f, "b"),
        }
    }
}
