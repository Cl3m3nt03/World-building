// Prevents an additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::ExitCode;

fn main() -> ExitCode {
    match builderz_lib::run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            // Proper logging arrives with `tracing` in 0.8.
            eprintln!("BuilderZ failed to start: {error}");
            ExitCode::FAILURE
        }
    }
}
