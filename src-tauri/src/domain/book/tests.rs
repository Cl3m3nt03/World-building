use std::io::Read;

use super::*;
use crate::db;
use crate::domain::quill::{self, BookStyle, Cover, NewStory};

fn text(value: &str) -> Value {
    serde_json::json!({ "type": "text", "text": value })
}

#[test]
fn a_draft_reads_as_blocks_with_their_look() {
    let doc = serde_json::json!({ "type": "doc", "content": [
        { "type": "heading", "attrs": { "level": 2 }, "content": [text("Avant")] },
        { "type": "paragraph", "content": [
            text("Le roi "),
            { "type": "mention", "attrs": { "id": "c", "label": "Aragorn" } },
            { "type": "text", "text": " revint", "marks": [{ "type": "bold" }, { "type": "note", "attrs": { "noteId": "n" } }] },
            { "type": "hardBreak" },
            { "type": "text", "text": "seul", "marks": [{ "type": "audioCue", "attrs": { "cueId": "s" } }, { "type": "italic" }] }
        ] },
        { "type": "blockquote", "content": [{ "type": "paragraph", "content": [text("Fin")] }] },
        { "type": "bulletList", "content": [{ "type": "listItem", "content": [{ "type": "paragraph", "content": [text("un")] }] }] },
        { "type": "horizontalRule" },
        { "type": "image", "attrs": { "assetId": format!("{}.png", "a".repeat(64)) } },
        { "type": "image", "attrs": { "assetId": "../evil.png" } }
    ] });
    let blocks = read_text(&doc.to_string());
    assert_eq!(blocks.len(), 6, "{blocks:?}");
    assert_eq!(
        blocks[0],
        Block::Heading {
            level: 2,
            runs: vec![Run {
                text: "Avant".into(),
                ..Run::default()
            }]
        }
    );
    let Block::Paragraph(runs) = &blocks[1] else {
        panic!("{:?}", blocks[1]);
    };
    let words: Vec<&str> = runs.iter().map(|run| run.text.as_str()).collect();
    assert_eq!(words, ["Le roi ", "Aragorn", " revint", "", "seul"]);
    assert!(runs[2].bold && runs[3].line_break && runs[4].italic);
    assert!(matches!(&blocks[2], Block::Quote(inner) if inner.len() == 1));
    assert!(matches!(&blocks[3], Block::List { ordered: false, items } if items.len() == 1));
    assert_eq!(blocks[4], Block::Rule);
    // An image whose id is not one of the library is left out.
    assert!(matches!(&blocks[5], Block::Image { .. }));
    assert!(read_text("not json").is_empty());
}

#[test]
fn the_target_has_the_format_extension() {
    let root = if cfg!(windows) {
        "C:\\livres\\"
    } else {
        "/livres/"
    };
    let path = target(&format!("{root}La Chute"), ExportFormat::Epub).unwrap();
    assert!(path.to_string_lossy().ends_with("La Chute.epub"));
    let kept = target(&format!("{root}La Chute.EPUB"), ExportFormat::Epub).unwrap();
    assert!(kept.to_string_lossy().ends_with("La Chute.EPUB"));
    assert!(target("relative.epub", ExportFormat::Epub).is_err());
}

async fn story_with_two_chapters() -> (tempfile::TempDir, crate::world::OpenWorld, String) {
    let dir = tempfile::tempdir().unwrap();
    let world = crate::world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
        .await
        .unwrap();
    let outline = quill::create(
        &world.pool,
        &NewStory {
            title: "La Chute & le Roi".into(),
            book_style: BookStyle::default(),
            cover: Cover::default(),
            chapter_title: "Chapitre 1".into(),
            draft_name: "Brouillon 1".into(),
        },
    )
    .await
    .unwrap();
    let id = outline.story.id.clone();
    let first = &outline.chapters[0];
    let doc = |words: &str| {
        serde_json::json!({ "type": "doc", "content": [{ "type": "paragraph", "content": [text(words)] }] })
            .to_string()
    };
    quill::save_draft(
        &world.pool,
        &first.current_draft_id,
        &doc("Il pleuvait <fort>."),
    )
    .await
    .unwrap();
    let second = quill::create_chapter(&world.pool, &id, "Chapitre 2", "Brouillon 1")
        .await
        .unwrap();
    quill::save_draft(
        &world.pool,
        &second.current_draft_id,
        &doc("Le soleil revint."),
    )
    .await
    .unwrap();
    (dir, world, id)
}

#[tokio::test]
async fn a_book_holds_the_chapters_asked_from_their_drafts() {
    let (_dir, world, id) = story_with_two_chapters().await;
    let outline = quill::outline(&world.pool, &id).await.unwrap();
    let pick = |index: usize| ExportChapter {
        chapter_id: outline.chapters[index].id.clone(),
        draft_id: outline.chapters[index].current_draft_id.clone(),
    };
    // The second chapter only, then both in their order.
    let book = load(
        &world.pool,
        &world.assets_dir(),
        &id,
        &[pick(1)],
        "fr",
        None,
    )
    .await
    .unwrap();
    assert_eq!(book.chapters.len(), 1);
    assert_eq!(book.chapters[0].title, "Chapitre 2");
    let book = load(
        &world.pool,
        &world.assets_dir(),
        &id,
        &[pick(0), pick(1)],
        "fr",
        None,
    )
    .await
    .unwrap();
    assert_eq!(book.title, "La Chute & le Roi");
    assert_eq!(book.chapters.len(), 2);

    // A draft of another chapter, a chapter of another story, nothing: refused.
    let wrong = ExportChapter {
        chapter_id: outline.chapters[0].id.clone(),
        draft_id: outline.chapters[1].current_draft_id.clone(),
    };
    assert!(
        load(&world.pool, &world.assets_dir(), &id, &[wrong], "fr", None)
            .await
            .is_err()
    );
    assert!(
        load(&world.pool, &world.assets_dir(), &id, &[], "fr", None)
            .await
            .is_err()
    );
    assert!(
        load(
            &world.pool,
            &world.assets_dir(),
            "nope",
            &[pick(0)],
            "fr",
            None
        )
        .await
        .is_err()
    );
}

#[tokio::test]
async fn the_epub_has_its_structure_cover_and_chapters() {
    let (dir, world, id) = story_with_two_chapters().await;
    let outline = quill::outline(&world.pool, &id).await.unwrap();
    let chosen: Vec<ExportChapter> = outline
        .chapters
        .iter()
        .map(|chapter| ExportChapter {
            chapter_id: chapter.id.clone(),
            draft_id: chapter.current_draft_id.clone(),
        })
        .collect();
    // A 1×1 PNG for the cover.
    let mut png = Vec::new();
    image::DynamicImage::new_rgb8(1, 1)
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .unwrap();
    let book = load(
        &world.pool,
        &world.assets_dir(),
        &id,
        &chosen,
        "fr",
        Some(png),
    )
    .await
    .unwrap();
    let path = target(
        &dir.path().join("out").join("La Chute").to_string_lossy(),
        ExportFormat::Epub,
    )
    .unwrap();
    write(&book, ExportFormat::Epub, &path).unwrap();

    let file = std::fs::File::open(&path).unwrap();
    let mut zip = zip::ZipArchive::new(file).unwrap();
    // The mimetype first, stored as is (EPUB OCF).
    {
        let mut first = zip.by_index(0).unwrap();
        assert_eq!(first.name(), "mimetype");
        assert_eq!(first.compression(), zip::CompressionMethod::Stored);
        let mut mime = String::new();
        first.read_to_string(&mut mime).unwrap();
        assert_eq!(mime, "application/epub+zip");
    }
    let names: Vec<String> = zip.file_names().map(str::to_owned).collect();
    for name in [
        "META-INF/container.xml",
        "OEBPS/content.opf",
        "OEBPS/nav.xhtml",
        "OEBPS/cover.png",
        "OEBPS/chapter_1.xhtml",
        "OEBPS/chapter_2.xhtml",
        "OEBPS/stylesheet.css",
    ] {
        assert!(
            names.iter().any(|n| n == name),
            "{name} missing in {names:?}"
        );
    }
    let mut chapter = String::new();
    zip.by_name("OEBPS/chapter_1.xhtml")
        .unwrap()
        .read_to_string(&mut chapter)
        .unwrap();
    assert!(chapter.contains("<h1>Chapitre 1</h1>"), "{chapter}");
    // Text is escaped.
    assert!(chapter.contains("Il pleuvait &lt;fort&gt;."), "{chapter}");
    let mut opf = String::new();
    zip.by_name("OEBPS/content.opf")
        .unwrap()
        .read_to_string(&mut opf)
        .unwrap();
    assert!(opf.contains("La Chute &amp; le Roi"), "{opf}");
    assert!(opf.contains("cover-image"), "{opf}");
}

#[test]
fn typst_strings_hold_any_text() {
    assert_eq!(
        pdf::string(r##"Il dit "#roi" \ $x$"##),
        "\"Il dit \\\"#roi\\\" \\\\ $x$\""
    );
    assert_eq!(pdf::string("a\nb"), r#""a\nb""#);
}

#[tokio::test]
async fn the_pdf_is_made_with_its_cover_and_chapters() {
    let (dir, world, id) = story_with_two_chapters().await;
    let outline = quill::outline(&world.pool, &id).await.unwrap();
    // A text that would break a careless Typst source.
    let tricky = serde_json::json!({ "type": "doc", "content": [
        { "type": "heading", "attrs": { "level": 1 }, "content": [text("Le #roi [sic]")] },
        { "type": "paragraph", "content": [
            { "type": "text", "text": r##"Un "*gras*" $5 @ami "##, "marks": [{ "type": "bold" }] },
            { "type": "hardBreak" },
            { "type": "text", "text": r"\ fin _", "marks": [{ "type": "italic" }, { "type": "code" }] }
        ] },
        { "type": "blockquote", "content": [{ "type": "paragraph", "content": [text("Rien ne dure.")] }] },
        { "type": "orderedList", "content": [{ "type": "listItem", "content": [{ "type": "paragraph", "content": [text("un")] }] }] },
        { "type": "horizontalRule" }
    ] });
    quill::save_draft(
        &world.pool,
        &outline.chapters[1].current_draft_id,
        &tricky.to_string(),
    )
    .await
    .unwrap();
    let chosen: Vec<ExportChapter> = outline
        .chapters
        .iter()
        .map(|chapter| ExportChapter {
            chapter_id: chapter.id.clone(),
            draft_id: chapter.current_draft_id.clone(),
        })
        .collect();
    let mut png = Vec::new();
    image::DynamicImage::new_rgb8(4, 6)
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .unwrap();
    let book = load(
        &world.pool,
        &world.assets_dir(),
        &id,
        &chosen,
        "fr",
        Some(png),
    )
    .await
    .unwrap();
    let path = target(
        &dir.path().join("La Chute").to_string_lossy(),
        ExportFormat::Pdf,
    )
    .unwrap();
    write(&book, ExportFormat::Pdf, &path).unwrap();
    let bytes = std::fs::read(&path).unwrap();
    assert!(bytes.starts_with(b"%PDF-"));
    // Cover, title, contents, then the two chapters.
    let marker = b"/Type /Page\n";
    let alt = b"/Type/Page";
    let pages = bytes.windows(marker.len()).filter(|w| *w == marker).count()
        + bytes.windows(alt.len()).filter(|w| *w == alt).count();
    assert!(pages >= 5, "{pages} pages");
}

#[tokio::test]
async fn the_pdf_opens_on_its_cover() {
    let (_dir, world, id) = story_with_two_chapters().await;
    let outline = quill::outline(&world.pool, &id).await.unwrap();
    let chosen = vec![ExportChapter {
        chapter_id: outline.chapters[0].id.clone(),
        draft_id: outline.chapters[0].current_draft_id.clone(),
    }];
    // A red cover.
    let mut png = Vec::new();
    image::DynamicImage::ImageRgb8(image::RgbImage::from_pixel(
        20,
        30,
        image::Rgb([200, 30, 40]),
    ))
    .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
    .unwrap();
    let book = load(
        &world.pool,
        &world.assets_dir(),
        &id,
        &chosen,
        "fr",
        Some(png),
    )
    .await
    .unwrap();
    let document = pdf::compile(&book).unwrap();
    let pages = document.pages();
    // The cover, the title page, the chapter (no contents for one chapter).
    assert_eq!(pages.len(), 3);
    let options = typst_render::RenderOptions::default();
    let cover = typst_render::render(&pages[0], &options);
    let middle = cover.pixel(cover.width() / 2, cover.height() / 2).unwrap();
    assert_eq!((middle.red(), middle.green(), middle.blue()), (200, 30, 40));
    // BZ_PDF_PAGES=<folder>: the pages as PNG, to look at them.
    if let Ok(folder) = std::env::var("BZ_PDF_PAGES") {
        for (index, page) in pages.iter().enumerate() {
            let png = typst_render::render(page, &options).encode_png().unwrap();
            std::fs::write(
                Path::new(&folder).join(format!("page-{}.png", index + 1)),
                png,
            )
            .unwrap();
        }
    }
}
