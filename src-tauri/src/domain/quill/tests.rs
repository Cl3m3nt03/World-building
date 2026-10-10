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
    let style: BookStyle = serde_json::from_str(r#"{"finish":"paper","extra":1}"#).unwrap();
    assert_eq!(style.color, BookStyle::default().color);
    assert_eq!(style.finish, BookFinish::Paper);
    let cover: Cover = serde_json::from_str("{}").unwrap();
    assert_eq!(cover, Cover::default());
}
