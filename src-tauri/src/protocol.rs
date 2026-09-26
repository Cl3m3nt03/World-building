//! `bzasset://` protocol: serves the files of the open world's `assets/`
//! folder to the WebView, and nothing else.
//!
//! The URL path must be a well-formed asset id (`<sha256>.<ext>`), checked by
//! `world::assets::resolve` before any disk access. Tauri's generic `asset:`
//! protocol is not enabled: it would expose arbitrary paths within its scope.

use std::path::Path;

use tauri::http::{Request, Response, StatusCode, header};
use tauri::{Manager, Runtime, UriSchemeContext, UriSchemeResponder};

use crate::state::AppState;
use crate::world::assets;

pub const SCHEME: &str = "bzasset";

pub fn handle<R: Runtime>(
    context: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = context.app_handle().clone();
    let id = request.uri().path().trim_start_matches('/').to_owned();
    tauri::async_runtime::spawn(async move {
        responder.respond(serve(&app, &id).await);
    });
}

async fn serve<R: Runtime>(app: &tauri::AppHandle<R>, id: &str) -> Response<Vec<u8>> {
    let Some(state) = app.try_state::<AppState>() else {
        return status(StatusCode::SERVICE_UNAVAILABLE);
    };
    let assets_dir = state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| world.assets_dir());
    respond(assets_dir.as_deref(), id).await
}

/// Response for asset `id`, given the open world's `assets/` folder (if any).
async fn respond(assets_dir: Option<&Path>, id: &str) -> Response<Vec<u8>> {
    let Some(assets_dir) = assets_dir else {
        return status(StatusCode::NOT_FOUND);
    };
    let path = match assets::resolve(assets_dir, id) {
        Ok(path) => path,
        Err(error) => {
            tracing::warn!(%error, "refused asset request");
            return status(StatusCode::BAD_REQUEST);
        }
    };

    match tokio::fs::read(&path).await {
        Ok(bytes) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, assets::mime_type(id))
            .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
            // An asset (e.g. an SVG) opened on its own must not run scripts.
            .header(
                header::CONTENT_SECURITY_POLICY,
                "default-src 'none'; style-src 'unsafe-inline'",
            )
            // Content-addressed: the bytes behind an id never change.
            .header(
                header::CACHE_CONTROL,
                "private, max-age=31536000, immutable",
            )
            .body(bytes)
            .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => status(StatusCode::NOT_FOUND),
        Err(error) => {
            tracing::warn!(%error, %id, "cannot read asset");
            status(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = code;
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn serves_an_imported_asset_with_safe_headers() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("portrait.png");
        std::fs::write(&source, "png bytes").unwrap();
        let asset = assets::import(dir.path(), &source).unwrap();

        let response = respond(Some(dir.path()), &asset.id).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), b"png bytes");
        assert_eq!(response.headers()[header::CONTENT_TYPE], "image/png");
        assert_eq!(
            response.headers()[header::X_CONTENT_TYPE_OPTIONS],
            "nosniff"
        );
    }

    #[tokio::test]
    async fn refuses_paths_outside_assets() {
        let dir = tempfile::tempdir().unwrap();
        let assets_dir = dir.path().join("assets");
        std::fs::create_dir_all(&assets_dir).unwrap();
        std::fs::write(dir.path().join("world.db"), "secret").unwrap();

        for id in [
            "../world.db",
            "..%2Fworld.db",
            "world.db",
            "C:/Windows/win.ini",
        ] {
            let response = respond(Some(&assets_dir), id).await;
            assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{id:?}");
            assert!(response.body().is_empty());
        }
    }

    #[tokio::test]
    async fn unknown_asset_or_no_open_world_is_not_found() {
        let dir = tempfile::tempdir().unwrap();
        let id = format!("{}.png", "a".repeat(64));

        assert_eq!(
            respond(Some(dir.path()), &id).await.status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(respond(None, &id).await.status(), StatusCode::NOT_FOUND);
    }
}
