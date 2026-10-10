use super::*;
use crate::world;

async fn world() -> (tempfile::TempDir, crate::world::OpenWorld) {
    let dir = tempfile::tempdir().unwrap();
    let world = world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
        .await
        .unwrap();
    (dir, world)
}

fn new_story(title: &str) -> NewStory {
    NewStory {
        title: title.into(),
        book_style: BookStyle::default(),
        cover: Cover::default(),
        chapter_title: "Chapitre 1".into(),
        draft_name: "Brouillon 1".into(),
    }
}

fn doc(text: &str, mention: Option<&str>) -> String {
    let mut content = vec![serde_json::json!({ "type": "text", "text": text })];
    if let Some(id) = mention {
        content.push(
            serde_json::json!({ "type": "mention", "attrs": { "id": id, "label": "Aragorn" } }),
        );
    }
    serde_json::json!({ "type": "doc", "content": [{ "type": "paragraph", "content": content }] })
        .to_string()
}

async fn cited_by(pool: &SqlitePool, card: &str) -> Vec<String> {
    crate::db::links::to_target(pool, card)
        .await
        .unwrap()
        .into_iter()
        .map(|link| link.source_id)
        .collect()
}

#[tokio::test]
async fn a_new_story_has_chapter_one_with_its_current_draft() {
    let (_dir, world) = world().await;
    let outline = create(&world.pool, &new_story("Mon histoire"))
        .await
        .unwrap();
    assert_eq!(outline.story.title, "Mon histoire");
    assert_eq!(outline.story.chapter_count, 1);
    let chapter = &outline.chapters[0];
    assert_eq!(chapter.title, "Chapitre 1");
    assert_eq!(chapter.drafts.len(), 1);
    assert_eq!(chapter.current_draft_id, chapter.drafts[0].id);
    assert_eq!(
        draft(&world.pool, &chapter.current_draft_id)
            .await
            .unwrap()
            .content,
        EMPTY_DRAFT
    );
    assert_eq!(list(&world.pool).await.unwrap().len(), 1);
}

#[tokio::test]
async fn bad_stories_are_refused() {
    let (_dir, world) = world().await;
    assert!(create(&world.pool, &new_story("  ")).await.is_err());
    let mut bad = new_story("A");
    bad.book_style.color = "red".into();
    assert!(create(&world.pool, &bad).await.is_err());
    let mut bad = new_story("A");
    bad.cover.asset_id = Some("../x".into());
    assert!(create(&world.pool, &bad).await.is_err());
    assert!(list(&world.pool).await.unwrap().is_empty());
}

#[tokio::test]
async fn words_are_counted_and_the_current_draft_makes_the_links() {
    let (_dir, world) = world().await;
    let outline = create(&world.pool, &new_story("Récit")).await.unwrap();
    let chapter = outline.chapters[0].clone();
    let first = chapter.current_draft_id.clone();

    let saved = save_draft(
        &world.pool,
        &first,
        &doc("Il était une fois ", Some("card-1")),
    )
    .await
    .unwrap();
    // "Il était une fois Aragorn": the mention reads as its label.
    assert_eq!(saved.word_count, 5);
    assert_eq!(
        cited_by(&world.pool, "card-1").await,
        vec![chapter.id.clone()]
    );
    assert_eq!(list(&world.pool).await.unwrap()[0].word_count, 5);

    // A second draft cites nothing until it becomes current.
    let chapter = create_draft(&world.pool, &chapter.id, "Brouillon 2", Some(&first))
        .await
        .unwrap();
    let second = chapter.drafts[1].id.clone();
    assert_eq!(chapter.current_draft_id, first);
    save_draft(&world.pool, &second, &doc("Autre version ", Some("card-2")))
        .await
        .unwrap();
    assert!(cited_by(&world.pool, "card-2").await.is_empty());

    let chapter = set_current_draft(&world.pool, &second).await.unwrap();
    assert_eq!(chapter.current_draft_id, second);
    assert_eq!(chapter.word_count, 3);
    assert!(cited_by(&world.pool, "card-1").await.is_empty());
    assert_eq!(
        cited_by(&world.pool, "card-2").await,
        vec![chapter.id.clone()]
    );

    // The current draft deleted: the other one takes over, and its links.
    let chapter = delete_draft(&world.pool, &second).await.unwrap();
    assert_eq!(chapter.current_draft_id, first);
    assert_eq!(
        cited_by(&world.pool, "card-1").await,
        vec![chapter.id.clone()]
    );
    // The last draft stays.
    assert!(delete_draft(&world.pool, &first).await.is_err());
}

#[tokio::test]
async fn a_copied_draft_has_the_same_text() {
    let (_dir, world) = world().await;
    let outline = create(&world.pool, &new_story("Récit")).await.unwrap();
    let chapter = &outline.chapters[0];
    save_draft(&world.pool, &chapter.current_draft_id, &doc("Texte", None))
        .await
        .unwrap();
    let chapter = create_draft(
        &world.pool,
        &chapter.id,
        "Copie",
        Some(&chapter.current_draft_id),
    )
    .await
    .unwrap();
    let copy = draft(&world.pool, &chapter.drafts[1].id).await.unwrap();
    assert_eq!(copy.content, doc("Texte", None));
    assert_eq!(copy.word_count, 1);
    let empty = create_draft(&world.pool, &chapter.id, "Vide", None)
        .await
        .unwrap();
    assert_eq!(
        draft(&world.pool, &empty.drafts[2].id)
            .await
            .unwrap()
            .word_count,
        0
    );
}

#[tokio::test]
async fn bad_drafts_are_refused() {
    let (_dir, world) = world().await;
    let outline = create(&world.pool, &new_story("Récit")).await.unwrap();
    let id = &outline.chapters[0].current_draft_id;
    assert!(save_draft(&world.pool, id, "not json").await.is_err());
    assert!(
        save_draft(&world.pool, id, r#"{"type":"paragraph"}"#)
            .await
            .is_err()
    );
    assert!(
        save_draft(&world.pool, "missing", EMPTY_DRAFT)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn chapters_are_added_moved_renamed_and_deleted() {
    let (_dir, world) = world().await;
    let outline = create(&world.pool, &new_story("Récit")).await.unwrap();
    let story = outline.story.id.clone();
    let one = outline.chapters[0].id.clone();
    let two = create_chapter(&world.pool, &story, "Chapitre 2", "Brouillon 1")
        .await
        .unwrap()
        .id;
    let three = create_chapter(&world.pool, &story, "Chapitre 3", "Brouillon 1")
        .await
        .unwrap()
        .id;

    let titles = |outline: &StoryOutline| -> Vec<String> {
        outline
            .chapters
            .iter()
            .map(|chapter| chapter.title.clone())
            .collect()
    };
    let moved = move_chapter(&world.pool, &three, 0).await.unwrap();
    assert_eq!(titles(&moved), ["Chapitre 3", "Chapitre 1", "Chapitre 2"]);
    rename_chapter(&world.pool, &two, "Le retour")
        .await
        .unwrap();
    let header = format!("{}.png", "a".repeat(64));
    let chapter = set_chapter_header(&world.pool, &one, Some(&header))
        .await
        .unwrap();
    assert_eq!(chapter.header_asset_id.as_deref(), Some(header.as_str()));

    save_draft(
        &world.pool,
        &chapter.current_draft_id,
        &doc("x", Some("card")),
    )
    .await
    .unwrap();
    let left = delete_chapter(&world.pool, &one).await.unwrap();
    assert_eq!(titles(&left), ["Chapitre 3", "Le retour"]);
    assert!(cited_by(&world.pool, "card").await.is_empty());
    delete_chapter(&world.pool, &three).await.unwrap();
    assert!(delete_chapter(&world.pool, &two).await.is_err());
}

#[tokio::test]
async fn a_story_is_updated_then_deleted_with_its_links() {
    let (_dir, world) = world().await;
    let outline = create(&world.pool, &new_story("Récit")).await.unwrap();
    let id = outline.story.id.clone();
    let story = update(
        &world.pool,
        &id,
        &StoryPatch {
            title: Some("Le Récit".into()),
            book_style: Some(BookStyle {
                color: "#7a2e2e".into(),
                finish: BookFinish::Leather,
            }),
            cover: Some(Cover {
                asset_id: Some(format!("{}.jpg", "b".repeat(64))),
                title_position: TitlePosition::Top,
            }),
        },
    )
    .await
    .unwrap();
    assert_eq!(story.title, "Le Récit");
    assert_eq!(story.book_style.finish, BookFinish::Leather);
    assert_eq!(story.cover.title_position, TitlePosition::Top);

    save_draft(
        &world.pool,
        &outline.chapters[0].current_draft_id,
        &doc("x", Some("card")),
    )
    .await
    .unwrap();
    delete(&world.pool, &id).await.unwrap();
    assert!(list(&world.pool).await.unwrap().is_empty());
    assert!(cited_by(&world.pool, "card").await.is_empty());
    assert!(delete(&world.pool, &id).await.is_err());
}

#[test]
fn styles_are_read_with_tolerance() {
    let style = read_style(r#"{"finish":"paper","color":"red","extra":1}"#);
    assert_eq!(style.color, BookStyle::default().color);
    assert_eq!(style.finish, BookFinish::Paper);
    assert_eq!(read_style("not json"), BookStyle::default());
    assert_eq!(read_cover("{}"), Cover::default());
    let cover = read_cover(r#"{"assetId":"../x","titlePosition":"top"}"#);
    assert_eq!(cover.asset_id, None);
    assert_eq!(cover.title_position, TitlePosition::Top);
}

#[tokio::test]
async fn the_media_library_knows_covers_and_headers() {
    use crate::domain::media::{AssetUsage, card_usages};
    let (_dir, world) = world().await;
    let image = format!("{}.png", "c".repeat(64));
    let mut story = new_story("Récit");
    story.cover.asset_id = Some(image.clone());
    let outline = create(&world.pool, &story).await.unwrap();
    let chapter = &outline.chapters[0];
    set_chapter_header(&world.pool, &chapter.id, Some(&image))
        .await
        .unwrap();
    let usages = card_usages(&world.pool, &image).await.unwrap();
    assert!(usages.contains(&AssetUsage::StoryCover {
        story_id: outline.story.id.clone(),
        story_title: "Récit".into(),
    }));
    assert!(usages.contains(&AssetUsage::ChapterHeader {
        chapter_id: chapter.id.clone(),
        chapter_title: "Chapitre 1".into(),
        story_title: "Récit".into(),
    }));
}

#[tokio::test]
async fn a_chapter_is_cited_in_the_card_it_mentions() {
    use crate::domain::card_types::{self, NewCardType};
    use crate::domain::cards;
    use crate::domain::links::{BacklinkSource, backlinks};
    let (_dir, world) = world().await;
    let kind = card_types::create(
        &world.pool,
        NewCardType {
            parent_id: None,
            name: "Personnage".into(),
            icon: "user".into(),
            color: "blue".into(),
        },
    )
    .await
    .unwrap();
    let card = cards::create(&world.pool, &kind.id, "Aragorn")
        .await
        .unwrap();
    let outline = create(&world.pool, &new_story("Récit")).await.unwrap();
    let chapter = &outline.chapters[0];
    save_draft(
        &world.pool,
        &chapter.current_draft_id,
        &doc("Ami de ", Some(&card.id)),
    )
    .await
    .unwrap();
    let cited = backlinks(&world.pool, &card.id).await.unwrap();
    assert_eq!(cited.len(), 1);
    assert_eq!(cited[0].source_kind, BacklinkSource::Chapter);
    assert_eq!(cited[0].source_title, "Chapitre 1");
    assert_eq!(
        cited[0].story_id.as_deref(),
        Some(outline.story.id.as_str())
    );
    assert_eq!(cited[0].story_title.as_deref(), Some("Récit"));
}

#[tokio::test]
async fn notes_are_made_listed_changed_copied_with_their_draft_and_deleted() {
    let (_dir, world) = world().await;
    let outline = create(&world.pool, &new_story("Récit")).await.unwrap();
    let chapter = &outline.chapters[0];
    let draft_id = chapter.current_draft_id.clone();
    let note = create_note(&world.pool, &draft_id, "À vérifier")
        .await
        .unwrap();
    let content = serde_json::json!({
        "type": "doc",
        "content": [{ "type": "paragraph", "content": [
            { "type": "text", "text": "Le roi", "marks": [{ "type": "note", "attrs": { "noteId": note.id } }] }
        ] }]
    })
    .to_string();
    save_draft(&world.pool, &draft_id, &content).await.unwrap();

    let changed = update_note(&world.pool, &note.id, "Vérifié").await.unwrap();
    assert_eq!(changed.body, "Vérifié");
    assert!(
        update_note(&world.pool, &note.id, &"x".repeat(MAX_NOTE_CHARS + 1))
            .await
            .is_err()
    );

    // A copy of the draft has its own copy of the note, its mark renamed.
    let chapter = create_draft(&world.pool, &chapter.id, "Copie", Some(&draft_id))
        .await
        .unwrap();
    let copy = draft(&world.pool, &chapter.drafts[1].id).await.unwrap();
    let notes = story_notes(&world.pool, &outline.story.id).await.unwrap();
    assert_eq!(notes.len(), 2);
    let copied = notes.iter().find(|n| n.draft_id == copy.id).unwrap();
    assert_ne!(copied.id, note.id);
    assert_eq!(copied.body, "Vérifié");
    assert_eq!(copied.chapter_title, "Chapitre 1");
    assert_eq!(copied.draft_name, "Copie");
    assert!(copy.content.contains(&copied.id) && !copy.content.contains(&note.id));

    delete_note(&world.pool, &note.id).await.unwrap();
    assert!(delete_note(&world.pool, &note.id).await.is_err());
    // A deleted draft takes its notes.
    delete_draft(&world.pool, &copy.id).await.unwrap();
    assert!(
        story_notes(&world.pool, &outline.story.id)
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn the_world_panel_layout_is_kept_per_story() {
    let (_dir, world) = world().await;
    let id = create(&world.pool, &new_story("Récit"))
        .await
        .unwrap()
        .story
        .id;
    assert_eq!(panel(&world.pool, &id).await.unwrap(), "{}");
    save_panel(&world.pool, &id, r#"{"style":"dark"}"#)
        .await
        .unwrap();
    save_panel(&world.pool, &id, r#"{"style":"light"}"#)
        .await
        .unwrap();
    assert_eq!(
        panel(&world.pool, &id).await.unwrap(),
        r#"{"style":"light"}"#
    );
    assert!(save_panel(&world.pool, &id, "[1]").await.is_err());
    assert!(save_panel(&world.pool, &id, "nope").await.is_err());
    assert!(save_panel(&world.pool, "missing", "{}").await.is_err());
    let big = format!(r#"{{"x":"{}"}}"#, "a".repeat(MAX_PANEL_BYTES));
    assert!(save_panel(&world.pool, &id, &big).await.is_err());
    delete(&world.pool, &id).await.unwrap();
    assert!(panel(&world.pool, &id).await.is_err());
}

async fn asset(pool: &SqlitePool, letter: char, kind: &str) -> String {
    let id = format!("{}.bin", letter.to_string().repeat(64));
    crate::db::assets::insert_if_absent(
        pool,
        &crate::db::assets::AssetRow {
            id: id.clone(),
            name: format!("{kind} {letter}"),
            kind: kind.into(),
            mime: format!("{kind}/x"),
            size: 1,
            width: None,
            height: None,
            created_at: now(),
        },
    )
    .await
    .unwrap();
    id
}

#[tokio::test]
async fn sounds_are_made_changed_copied_with_their_draft_and_deleted() {
    use crate::domain::media::{AssetUsage, card_usages};
    let (_dir, world) = world().await;
    let outline = create(&world.pool, &new_story("Récit")).await.unwrap();
    let chapter = &outline.chapters[0];
    let draft_id = chapter.current_draft_id.clone();
    let rain = asset(&world.pool, 'a', "audio").await;
    let bell = asset(&world.pool, 'b', "audio").await;
    let image = asset(&world.pool, 'c', "image").await;

    let effect = create_cue(&world.pool, &draft_id, CueKind::Effect, &bell)
        .await
        .unwrap();
    let ambience = create_cue(&world.pool, &draft_id, CueKind::Ambience, &rain)
        .await
        .unwrap();
    assert!(!effect.looped && ambience.looped);
    assert_eq!(effect.volume, 80);
    // Only an audio file of the library makes a sound.
    assert!(
        create_cue(&world.pool, &draft_id, CueKind::Effect, &image)
            .await
            .is_err()
    );
    assert!(
        create_cue(&world.pool, &draft_id, CueKind::Effect, "../x")
            .await
            .is_err()
    );

    let changed = update_cue(
        &world.pool,
        &effect.id,
        &CuePatch {
            volume: Some(40),
            asset_id: Some(rain.clone()),
            looped: None,
        },
    )
    .await
    .unwrap();
    assert_eq!(
        (changed.volume, changed.asset_id.as_deref()),
        (40, Some(rain.as_str()))
    );
    let too_loud = CuePatch {
        volume: Some(101),
        ..CuePatch::default()
    };
    assert!(
        update_cue(&world.pool, &effect.id, &too_loud)
            .await
            .is_err()
    );

    // The media library knows the chapter uses the sound (once).
    let usages = card_usages(&world.pool, &rain).await.unwrap();
    assert_eq!(
        usages,
        vec![AssetUsage::ChapterSound {
            chapter_id: chapter.id.clone(),
            chapter_title: "Chapitre 1".into(),
            story_title: "Récit".into(),
        }]
    );

    // A copy of the draft has its own sounds, their marks renamed.
    let content = serde_json::json!({
        "type": "doc",
        "content": [{ "type": "paragraph", "content": [
            { "type": "text", "text": "La pluie", "marks": [{ "type": CUE_MARK, "attrs": { CUE_ATTR: ambience.id } }] }
        ] }]
    })
    .to_string();
    save_draft(&world.pool, &draft_id, &content).await.unwrap();
    let chapter = create_draft(&world.pool, &chapter.id, "Copie", Some(&draft_id))
        .await
        .unwrap();
    let copy = draft(&world.pool, &chapter.drafts[1].id).await.unwrap();
    let copied = draft_cues(&world.pool, &copy.id).await.unwrap();
    assert_eq!(copied.len(), 2);
    let copied_ambience = copied
        .iter()
        .find(|cue| cue.kind == CueKind::Ambience)
        .unwrap();
    assert_ne!(copied_ambience.id, ambience.id);
    assert!(copy.content.contains(&copied_ambience.id) && !copy.content.contains(&ambience.id));

    delete_cue(&world.pool, &effect.id).await.unwrap();
    assert!(delete_cue(&world.pool, &effect.id).await.is_err());
    assert_eq!(draft_cues(&world.pool, &draft_id).await.unwrap().len(), 1);
    // A deleted draft takes its sounds.
    delete_draft(&world.pool, &copy.id).await.unwrap();
    assert!(draft_cues(&world.pool, &copy.id).await.unwrap().is_empty());
}

#[tokio::test]
async fn reading_settings_are_kept_per_story_and_read_with_tolerance() {
    let (_dir, world) = world().await;
    let outline = create(&world.pool, &new_story("Récit")).await.unwrap();
    let id = &outline.story.id;
    assert_eq!(
        reader_settings(&world.pool, id).await.unwrap(),
        ReaderSettings::default()
    );
    let settings = ReaderSettings {
        theme: reader::PageTheme::Sepia,
        mode: reader::ReadingMode::Pages,
        background: Some("#f4ecd8".into()),
        font: "lora".into(),
        text_size: reader::TextSize::Large,
        chapter_layout: reader::ChapterLayout::TitleOver,
        words_per_minute: 250,
    };
    save_reader_settings(&world.pool, id, &settings)
        .await
        .unwrap();
    assert_eq!(reader_settings(&world.pool, id).await.unwrap(), settings);

    for bad in [
        ReaderSettings {
            background: Some("red".into()),
            ..settings.clone()
        },
        ReaderSettings {
            font: "../x".into(),
            ..settings.clone()
        },
        ReaderSettings {
            words_per_minute: 5,
            ..settings.clone()
        },
    ] {
        assert!(save_reader_settings(&world.pool, id, &bad).await.is_err());
    }
    assert!(reader_settings(&world.pool, "nope").await.is_err());

    let read = reader::read_settings(
        r#"{"theme":"sepia","mode":"flip","background":"blue","wordsPerMinute":9999,"x":1}"#,
    );
    assert_eq!(read.theme, reader::PageTheme::Sepia);
    assert_eq!(read.mode, reader::ReadingMode::Scroll);
    assert_eq!(read.background, None);
    assert_eq!(read.words_per_minute, reader::MAX_WORDS_PER_MINUTE);
    assert_eq!(reader::read_settings("not json"), ReaderSettings::default());
}
