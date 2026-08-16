// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::Rng;
use std::env;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;
use tauri::Manager;

/// Pick a free TCP port on the loopback interface.
fn pick_free_port() -> u16 {
    for _ in 0..10 {
        let port = rand::thread_rng().gen_range(7000..9000);
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    rand::thread_rng().gen_range(7000..9000)
}

/// Launch the Next.js standalone server as a child process and return its port.
fn launch_next_server() -> (u16, std::process::Child) {
    let port = pick_free_port();

    // Resolve paths relative to this binary's location (works for installed app)
    // and fall back to repo paths when running via `cargo tauri dev`.
    let resource_dir = env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let candidates = vec![
        resource_dir.join("server").join("server.js"),
        resource_dir.join("..").join("..").join(".next").join("standalone").join("server.js"),
    ];

    let server_js = candidates
        .into_iter()
        .find(|p| p.exists())
        .expect("Next.js standalone server.js not found");

    let mut cmd = Command::new("node");
    cmd.arg(&server_js)
        .env("PORT", port.to_string())
        .env("NODE_ENV", "production")
        // Database & AI env vars: prefer packaged values, then process env.
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if let Ok(url) = env::var("TURSO_DATABASE_URL") {
        cmd.env("TURSO_DATABASE_URL", url);
    }
    if let Ok(url) = env::var("DATABASE_URL") {
        cmd.env("DATABASE_URL", url);
    }
    if let Ok(key) = env::var("GEMINI_API_KEY") {
        cmd.env("GEMINI_API_KEY", key);
    }
    if let Ok(key) = env::var("AI_API_KEY") {
        cmd.env("AI_API_KEY", key);
    }

    let child = cmd.spawn().expect("failed to start Next.js server");

    // Give the server a moment to bind the port.
    thread::sleep(Duration::from_millis(1500));
    (port, child)
}

fn main() {
    let (port, _child) = launch_next_server();
    let url = format!("http://127.0.0.1:{}", port);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let webview = app
                .get_webview_window("main")
                .expect("no main window");
            webview
                .navigate(url.parse().unwrap())
                .expect("failed to navigate");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
