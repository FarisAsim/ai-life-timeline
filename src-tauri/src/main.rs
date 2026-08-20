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

    // 1) Packaged app: use Tauri's resource resolver (works for NSIS/MSI/DMG installs).
    //    resources globs map to their relative structure under the install dir.
    let server_js = if let Ok(p) = app_handle_path_resolve("server.js") {
        p
    } else {
        // 2) Fallback: repo checkout (cargo tauri dev)
        let repo = env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));
        repo.join("..")
            .join("..")
            .join(".next")
            .join("standalone")
            .join("server.js")
    };
    if !server_js.exists() {
        panic!("Next.js standalone server.js not found at {:?}", server_js);
    }

    // 3) Node binary: bundled node.exe (from resources) or system node
    let node_bin = if let Ok(p) = app_handle_path_resolve("node.exe") {
        p.to_string_lossy().to_string()
    } else {
        let repo = env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));
        let bundled = repo.join("..").join("node.exe");
        if bundled.exists() {
            bundled.to_string_lossy().to_string()
        } else {
            "node".to_string()
        }
    };

    let mut cmd = Command::new(&node_bin);
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

/// Resolve a bundled resource path relative to the app's resource dir,
/// without needing an `AppHandle` (we are not inside setup yet).
fn app_handle_path_resolve(rel: &str) -> Result<PathBuf, ()> {
    let base = env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .ok_or(())?;
    // Tauri installs resources next to the app binary preserving relative
    // structure from the resource dir (src-tauri for direct globs).
    let direct = base.join("resources").join(rel);
    if direct.exists() {
        return Ok(direct);
    }
    // On Windows installs, resources may sit directly next to the exe
    // (e.g. node.exe was `resources/node.exe` -> installed as <appdir>/resources/node.exe
    //  or stripped to <appdir>/node.exe depending on bundle). Try both.
    let flat = base.join(rel);
    if flat.exists() {
        return Ok(flat);
    }
    Err(())
}

#[cfg(windows)]
fn attach_kill_on_close(child: &mut std::process::Child) {
    // Ensure the Node child exits when the Tauri app closes (no zombies).
    use std::os::windows::io::AsRawHandle;
    unsafe {
        use windows_sys::Win32::System::JobObjects::*;
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return;
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        AssignProcessToJobObject(job, child.as_raw_handle());
        // Leak the job handle so it stays alive until process exit,
        // at which point Windows closes it and kills the job.
        std::mem::forget(job);
    }
}

fn main() {
    #[allow(unused_mut)]
    let (port, mut child) = launch_next_server();
    #[cfg(windows)]
    attach_kill_on_close(&mut child);
    #[cfg(not(windows))]
    let _ = child;
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
