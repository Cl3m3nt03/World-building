use super::*;

#[test]
fn folder_name_is_safe_for_windows() {
    assert_eq!(folder_name("Eldefleur"), "Eldefleur - wiki");
    assert_eq!(
        folder_name("  Les: Protecteurs?/ d'Eldefleur.. "),
        "Les Protecteurs d'Eldefleur - wiki"
    );
    assert_eq!(folder_name(""), "wiki");
    assert_eq!(folder_name("???"), "wiki");
    assert_eq!(folder_name("con"), "wiki");
    assert_eq!(folder_name("COM1"), "wiki");
    assert_eq!(
        folder_name(&"a".repeat(200)).chars().count(),
        MAX_NAME_CHARS + " - wiki".len()
    );
}

#[test]
fn site_dir_needs_an_existing_folder() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(
        site_dir(dir.path(), "Arda").unwrap(),
        dir.path().join("Arda - wiki")
    );
    assert!(site_dir(&dir.path().join("missing"), "Arda").is_err());
    assert!(site_dir(Path::new("relative"), "Arda").is_err());
}

#[test]
fn file_paths_stay_in_the_site() {
    let dir = Path::new("C:/site");
    assert_eq!(
        file_path(dir, "index.html").unwrap(),
        dir.join("index.html")
    );
    assert_eq!(
        file_path(dir, "pages/abc-1.html").unwrap(),
        dir.join("pages").join("abc-1.html")
    );
    for bad in [
        "",
        "../x.html",
        "pages/../../x",
        "/abs.html",
        "C:/x.html",
        r"a\b.html",
        ".hidden",
        "pages/.x",
        "a b.html",
        "pages//x.html",
    ] {
        assert!(file_path(dir, bad).is_err(), "{bad:?} accepted");
    }
    assert!(file_path(dir, &"a".repeat(MAX_PATH_LEN + 1)).is_err());
}

#[test]
fn writes_files_only_when_every_path_is_safe() {
    let dir = tempfile::tempdir().unwrap();
    let file = |path: &str| SiteFile {
        path: path.into(),
        content: format!("<p>{path}</p>"),
    };
    write_files(dir.path(), &[file("index.html"), file("pages/a.html")]).unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.path().join("pages/a.html")).unwrap(),
        "<p>pages/a.html</p>"
    );
    // One bad path: nothing of the batch is written.
    assert!(write_files(dir.path(), &[file("b.html"), file("../c.html")]).is_err());
    assert!(!dir.path().join("b.html").exists());
}

#[test]
fn copies_the_images_still_in_the_world() {
    let world = tempfile::tempdir().unwrap();
    let site = tempfile::tempdir().unwrap();
    let present = format!("{}.png", "a".repeat(64));
    let gone = format!("{}.png", "b".repeat(64));
    std::fs::write(world.path().join(&present), b"png").unwrap();
    let copied = copy_assets(world.path(), site.path(), &[present.clone(), gone]).unwrap();
    assert_eq!(copied, 1);
    assert_eq!(
        std::fs::read(site.path().join("assets").join("aaaaaaaaaaaaaaaa.png")).unwrap(),
        b"png"
    );
    assert!(copy_assets(world.path(), site.path(), &["../x".into()]).is_err());
}

#[test]
fn site_asset_names_are_short() {
    let id = format!("{}{}.webp", "0123456789abcdef", "f".repeat(48));
    assert_eq!(site_asset_name(&id), "0123456789abcdef.webp");
    assert_eq!(site_asset_name(&"e".repeat(64)), "eeeeeeeeeeeeeeee");
}
