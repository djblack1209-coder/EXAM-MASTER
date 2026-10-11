fn main() {
    println!("cargo:rerun-if-changed=src/notifications.m");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let out = std::path::PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR missing"));
        let object = out.join("yozi_notifications.o");
        let library = out.join("libyozi_notifications.a");
        assert!(std::process::Command::new("xcrun").args(["clang", "-c", "-fobjc-arc", "-mmacosx-version-min=12.0"])
            .arg("src/notifications.m").arg("-o").arg(&object).status().expect("Apple compiler unavailable").success(),
            "notification bridge compilation failed");
        assert!(std::process::Command::new("xcrun").args(["ar", "crs"]).arg(&library).arg(&object)
            .status().expect("Apple archive tool unavailable").success(), "notification bridge archive failed");
        println!("cargo:rustc-link-search=native={}", out.display());
        println!("cargo:rustc-link-lib=static=yozi_notifications");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=UserNotifications");
    }
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
            "begin_learning_notifications",
            "learning_notification_permission",
            "replace_learning_notifications",
            "take_learning_notification_actions",
        ]),
    ))
    .expect("desktop build configuration failed");
}
