//! Tauri commands: a thin layer that validates input, calls the domain and
//! maps errors to `AppError`. Every command is registered in `crate::specta_builder`
//! and allowed in `build.rs` / `capabilities/default.json`.

pub mod app;
pub mod assets;
pub mod card_types;
pub mod cards;
pub mod documents;
pub mod library;
pub mod links;
pub mod properties;
pub mod settings;
pub mod tree;
pub mod world;
