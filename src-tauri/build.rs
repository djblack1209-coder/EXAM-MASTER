fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "choose_learning_save",
            "write_learning_selection",
            "discard_learning_selection",
            "read_learning_backup",
            "choose_learning_material",
            "read_learning_material",
            "discard_learning_material",
            "create_desktop_oauth_proof",
            "open_desktop_oauth",
            "focus_desktop_after_oauth",
        ]),
    ))
    .expect("desktop build configuration failed");
}
