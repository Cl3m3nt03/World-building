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
            }],
            align: None,
        }
    );
    let Block::Paragraph { runs, align: None } = &blocks[1] else {
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
    // The app is named as its generator.
    let mut nav = String::new();
    zip.by_name("OEBPS/nav.xhtml")
        .unwrap()
        .read_to_string(&mut nav)
        .unwrap();
    assert!(
        nav.contains(r#"<meta name="generator" content="Atlasaga""#),
        "{nav}"
    );
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
    // The app, not Typst, is named as its creator.
    let creator = format!("({})", pdf::CREATOR);
    assert!(
        bytes
            .windows(creator.len())
            .any(|w| w == creator.as_bytes())
    );
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

/// The text of a frame as (font family, text, a glyph is missing).
fn text_runs(frame: &typst::layout::Frame, out: &mut Vec<(String, String, bool)>) {
    for (_, item) in frame.items() {
        match item {
            typst::layout::FrameItem::Group(group) => text_runs(&group.frame, out),
            typst::layout::FrameItem::Text(text) => out.push((
                text.font.info().family.clone(),
                text.text.to_string(),
                text.glyphs.iter().any(|glyph| glyph.id == 0),
            )),
            _ => {}
        }
    }
}

/// The fonts a PDF embeds, without their subset tag (`ABCDEF+`).
fn pdf_fonts(bytes: &[u8]) -> std::collections::BTreeSet<String> {
    let key = b"/BaseFont";
    let mut names = std::collections::BTreeSet::new();
    for start in 0..bytes.len().saturating_sub(key.len()) {
        if &bytes[start..start + key.len()] != key {
            continue;
        }
        let name: String = bytes[start + key.len()..]
            .iter()
            .skip_while(|b| b.is_ascii_whitespace() || **b == b'/')
            .take_while(|b| b.is_ascii_graphic() && !b"/<>[]()".contains(b))
            .map(|&b| b as char)
            .collect();
        let name = match name.split_once('+') {
            Some((_, name)) => name.to_string(),
            None => name,
        };
        names.insert(name);
    }
    names
}

#[tokio::test]
async fn the_pdf_sets_french_text_in_the_fonts_the_app_ships() {
    let (_dir, world, id) = story_with_two_chapters().await;
    let outline = quill::outline(&world.pool, &id).await.unwrap();
    let words = "Œuvre française : l'élève reçut à Noël un cœur, « ça » déjà.";
    let doc = serde_json::json!({ "type": "doc", "content": [
        { "type": "heading", "attrs": { "level": 1 }, "content": [text("Où naît l'Œil")] },
        { "type": "paragraph", "content": [
            text(words),
            { "type": "text", "text": " Ç’était bien", "marks": [{ "type": "bold" }] },
            { "type": "text", "text": " à l’ombre", "marks": [{ "type": "italic" }] },
            { "type": "text", "text": " garçon()", "marks": [{ "type": "code" }] }
        ] }
    ] });
    quill::save_draft(
        &world.pool,
        &outline.chapters[0].current_draft_id,
        &doc.to_string(),
    )
    .await
    .unwrap();
    let chosen = vec![ExportChapter {
        chapter_id: outline.chapters[0].id.clone(),
        draft_id: outline.chapters[0].current_draft_id.clone(),
    }];
    let mut book = load(&world.pool, &world.assets_dir(), &id, &chosen, "fr", None)
        .await
        .unwrap();
    for (key, family) in [
        ("garamond", "EB Garamond"),
        ("inter", "Inter"),
        ("cinzel", "Cinzel"),
        ("playfair", "Playfair Display"),
        ("lora", "Lora"),
        ("source-serif", "Source Serif 4"),
    ] {
        book.settings.font = key.into();
        let document = pdf::compile(&book).unwrap();
        let bytes = pdf::write(&book).unwrap();
        // BZ_PDF_PAGES=<folder>: the book in each font, to look at it.
        if let Ok(folder) = std::env::var("BZ_PDF_PAGES") {
            let options = typst_render::RenderOptions::default();
            for (index, page) in document.pages().iter().enumerate() {
                let png = typst_render::render(page, &options).encode_png().unwrap();
                std::fs::write(
                    Path::new(&folder).join(format!("{key}-{}.png", index + 1)),
                    png,
                )
                .unwrap();
            }
            std::fs::write(Path::new(&folder).join(format!("{key}.pdf")), &bytes).unwrap();
        }
        let mut runs = Vec::new();
        for page in document.pages() {
            text_runs(&page.frame, &mut runs);
        }
        // Every glyph is drawn (no box), in the reading font or, for code, Space Mono.
        for (font, text, missing) in &runs {
            assert!(!missing, "{key}: a glyph of {text:?} is missing in {font}");
            let code = text.contains("garçon");
            let expected = if code { "Space Mono" } else { family };
            assert_eq!(font, expected, "{key}: {text:?}");
        }
        let all: String = runs.iter().map(|(_, text, _)| text.as_str()).collect();
        for letter in ['Œ', 'œ', 'ç', 'Ç', 'é', 'è', 'à', 'ë', '«', '’'] {
            assert!(all.contains(letter), "{key}: {letter} not in {all}");
        }
        // The PDF embeds these fonts and only them.
        let fonts = pdf_fonts(&bytes);
        let squashed = family.replace(' ', "");
        assert!(
            fonts
                .iter()
                .all(|name| name.starts_with(&squashed) || name.starts_with("SpaceMono")),
            "{key}: {fonts:?}"
        );
        assert!(
            fonts.iter().any(|name| name.starts_with("SpaceMono")),
            "{key}: {fonts:?}"
        );
        assert!(
            fonts.iter().any(|name| name.starts_with(&squashed)),
            "{key}: {fonts:?}"
        );
        eprintln!("{key}: {fonts:?}");
    }
}

#[tokio::test]
async fn the_docx_has_its_cover_chapters_and_styles() {
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
    let mut png = Vec::new();
    image::DynamicImage::new_rgb8(40, 60)
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
        ExportFormat::Docx,
    )
    .unwrap();
    assert!(path.to_string_lossy().ends_with(".docx"));
    write(&book, ExportFormat::Docx, &path).unwrap();

    let mut zip = zip::ZipArchive::new(std::fs::File::open(&path).unwrap()).unwrap();
    let names: Vec<String> = zip.file_names().map(str::to_owned).collect();
    assert!(
        names.iter().any(|n| n == "[Content_Types].xml"),
        "{names:?}"
    );
    assert!(
        names.iter().any(|n| n.starts_with("word/media/")),
        "no cover in {names:?}"
    );
    let mut document = String::new();
    zip.by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    for text in [
        "Chapitre 1",
        "Chapitre 2",
        "Il pleuvait &lt;fort&gt;.",
        "Le soleil revint.",
    ] {
        assert!(document.contains(text), "{text} missing");
    }
    assert!(document.contains("w:val=\"Heading1\""));
    let mut styles = String::new();
    zip.by_name("word/styles.xml")
        .unwrap()
        .read_to_string(&mut styles)
        .unwrap();
    assert!(styles.contains("Heading 1"));
}

/// A chapter's text with a paragraph in each alignment, and one without.
fn aligned_doc() -> Value {
    let para = |align: Option<&str>, words: &str| match align {
        Some(align) => {
            serde_json::json!({ "type": "paragraph", "attrs": { "textAlign": align }, "content": [text(words)] })
        }
        None => {
            serde_json::json!({ "type": "paragraph", "attrs": { "textAlign": null }, "content": [text(words)] })
        }
    };
    serde_json::json!({ "type": "doc", "content": [
        { "type": "heading", "attrs": { "level": 1, "textAlign": "center" }, "content": [text("Titre")] },
        para(None, "Le livre décide."),
        para(Some("left"), "À gauche toute."),
        para(Some("center"), "Au milieu."),
        para(Some("right"), "Signé : le roi."),
        para(Some("justify"), "Justifié."),
        para(Some("sideways"), "Inconnu."),
        { "type": "blockquote", "content": [para(Some("right"), "Cité à droite.")] }
    ] })
}

/// A book of one chapter holding `doc`, without a world.
fn book_of(doc: &Value) -> Book {
    Book {
        title: "Livre".into(),
        language: "fr".into(),
        settings: ReaderSettings::default(),
        cover: None,
        chapters: vec![BookChapter {
            title: "Chapitre 1".into(),
            header: None,
            blocks: read_text(&doc.to_string()),
        }],
        images: Vec::new(),
    }
}

#[test]
fn a_draft_keeps_the_alignment_of_its_paragraphs_and_titles() {
    let blocks = read_text(&aligned_doc().to_string());
    let aligns: Vec<Option<Align>> = blocks
        .iter()
        .map(|block| match block {
            Block::Heading { align, .. } | Block::Paragraph { align, .. } => *align,
            Block::Quote(inner) => match inner.first() {
                Some(Block::Paragraph { align, .. }) => *align,
                other => panic!("{other:?}"),
            },
            other => panic!("{other:?}"),
        })
        .collect();
    assert_eq!(
        aligns,
        [
            Some(Align::Center),
            None,
            Some(Align::Left),
            Some(Align::Center),
            Some(Align::Right),
            Some(Align::Justify),
            // An alignment the app does not know is the book's own.
            None,
            Some(Align::Right),
        ]
    );
}

#[test]
fn the_epub_aligns_the_blocks_that_chose_it() {
    let book = book_of(&aligned_doc());
    let page = epub::chapter_page(&book, 0);
    for line in [
        "<h2 class=\"align-center\">Titre</h2>",
        // No alignment: the book's own, as before.
        "<p>Le livre décide.</p>",
        "<p class=\"align-left\">À gauche toute.</p>",
        "<p class=\"align-center\">Au milieu.</p>",
        "<p class=\"align-right\">Signé : le roi.</p>",
        "<p class=\"align-justify\">Justifié.</p>",
        "<p>Inconnu.</p>",
        "<p class=\"align-right\">Cité à droite.</p>",
    ] {
        assert!(page.contains(line), "{line} not in {page}");
    }
}

/// Each line of text of a frame with where it starts and ends (x, in pt).
fn text_lines(
    frame: &typst::layout::Frame,
    origin: typst::layout::Point,
    out: &mut Vec<(String, f64, f64)>,
) {
    for (pos, item) in frame.items() {
        let at = origin + *pos;
        match item {
            typst::layout::FrameItem::Group(group) => text_lines(&group.frame, at, out),
            typst::layout::FrameItem::Text(text) => {
                let width = text.width().to_pt();
                let start = at.x.to_pt();
                // Words of one line come as several items: they are joined.
                match out.last_mut() {
                    Some(last) if (last.2 - start).abs() < 6.0 && !last.0.is_empty() => {
                        last.0.push_str(&text.text);
                        last.2 = start + width;
                    }
                    _ => out.push((text.text.to_string(), start, start + width)),
                }
            }
            _ => {}
        }
    }
}

#[test]
fn the_pdf_aligns_the_blocks_that_chose_it() {
    let book = book_of(&aligned_doc());
    let source = pdf::source(&book);
    // No alignment: the paragraph is written as before.
    assert!(source.contains("\n\n#\"Le livre décide.\"\n\n"), "{source}");
    let document = pdf::compile(&book).unwrap();
    let page = document.pages().last().unwrap();
    let width = page.frame.width().to_pt();
    let mut lines = Vec::new();
    text_lines(&page.frame, typst::layout::Point::zero(), &mut lines);
    let line = |words: &str| {
        lines
            .iter()
            .find(|(text, _, _)| text.contains(words))
            .cloned()
            .unwrap_or_else(|| panic!("{words} not in {lines:?}"))
    };
    let (_, left_start, _) = line("gauche");
    let (_, middle_start, middle_end) = line("milieu");
    let (_, right_start, right_end) = line("roi");
    let (_, title_start, title_end) = line("Titre");
    // Margins of 1.8 cm on an A5 page.
    let margin = 1.8 / 2.54 * 72.0;
    // The text's first lines (book's own, left) start at the margin, plus
    // the first-line indent after another paragraph.
    assert!(left_start < margin + 20.0, "{left_start}");
    let centre = width / 2.0;
    assert!(
        ((middle_start + middle_end) / 2.0 - centre).abs() < 2.0,
        "{middle_start}..{middle_end} on {width}"
    );
    assert!(
        ((title_start + title_end) / 2.0 - centre).abs() < 2.0,
        "{title_start}..{title_end} on {width}"
    );
    assert!(
        // Punctuation may hang a little into the margin.
        (right_end - (width - margin)).abs() < 4.0,
        "{right_start}..{right_end} on {width}"
    );
    assert!(right_start > centre, "{right_start}");
}

#[test]
fn the_docx_aligns_the_blocks_that_chose_it() {
    let dir = tempfile::tempdir().unwrap();
    let book = book_of(&aligned_doc());
    let path = dir.path().join("livre.docx");
    write(&book, ExportFormat::Docx, &path).unwrap();
    let mut zip = zip::ZipArchive::new(std::fs::File::open(&path).unwrap()).unwrap();
    let mut document = String::new();
    zip.by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut document)
        .unwrap();
    // The paragraph (`<w:p …>`) up to `words`.
    let paragraph = |words: &str| -> String {
        let at = document
            .find(words)
            .unwrap_or_else(|| panic!("{words} missing"));
        let start = document[..at].rfind("<w:p ").unwrap();
        document[start..at].to_owned()
    };
    assert!(paragraph("Titre").contains("<w:jc w:val=\"center\" />"));
    // No alignment: the style's (justified), nothing written on the paragraph.
    assert!(!paragraph("Le livre décide.").contains("<w:jc"));
    assert!(!paragraph("Inconnu.").contains("<w:jc"));
    assert!(paragraph("À gauche toute.").contains("<w:jc w:val=\"left\" />"));
    let middle = paragraph("Au milieu.");
    assert!(middle.contains("<w:jc w:val=\"center\" />"), "{middle}");
    assert!(middle.contains("w:firstLine=\"0\""), "{middle}");
    assert!(paragraph("Signé : le roi.").contains("<w:jc w:val=\"right\" />"));
    assert!(paragraph("Justifié.").contains("<w:jc w:val=\"both\" />"));
    // A quote keeps its indent when aligned.
    let quoted = paragraph("Cité à droite.");
    assert!(quoted.contains("w:left=\"567\""), "{quoted}");
    assert!(quoted.contains("<w:jc w:val=\"right\" />"), "{quoted}");
}

#[test]
fn the_pdf_justifies_a_long_paragraph_unless_it_is_set_left() {
    let long = "Il pleuvait sur la vallée depuis trois jours, et les bergers \
                redescendaient lentement vers les villages avec leurs bêtes trempées.";
    let doc = |align: Value| {
        serde_json::json!({ "type": "doc", "content": [
            { "type": "paragraph", "attrs": { "textAlign": align }, "content": [text(long)] }
        ] })
    };
    let first_line_end = |doc: Value| {
        let document = pdf::compile(&book_of(&doc)).unwrap();
        let page = document.pages().last().unwrap();
        let mut lines = Vec::new();
        text_lines(&page.frame, typst::layout::Point::zero(), &mut lines);
        let line = lines
            .iter()
            .find(|(text, _, _)| text.starts_with("Il"))
            .cloned()
            .unwrap_or_else(|| panic!("{lines:?}"));
        (line.2, page.frame.width().to_pt())
    };
    let margin = 1.8 / 2.54 * 72.0;
    // The book's own (and justify): the first line reaches the margin.
    for align in [Value::Null, Value::from("justify")] {
        let (end, width) = first_line_end(doc(align.clone()));
        assert!((end - (width - margin)).abs() < 4.0, "{align}: {end}");
    }
    // Set left: it stops short of it.
    let (end, width) = first_line_end(doc(Value::from("left")));
    assert!(end < width - margin - 4.0, "{end}");
}
