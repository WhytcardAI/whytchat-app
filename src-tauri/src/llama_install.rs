use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::{self, File};
use std::io::{self, BufRead, BufReader, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, MutexGuard};
use tauri::{Emitter, Window};

// Global process handle
static LLAMA_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static LOG_BUFFER: Mutex<VecDeque<String>> = Mutex::new(VecDeque::new());
const LOG_CAPACITY: usize = 1000;

/// Get the base directory for the application (workspace root in dev, exe dir in production)
fn get_base_dir() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        // Use project root (parent of src-tauri) to ensure stable paths in dev
        let src_tauri = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        Ok(src_tauri
            .parent()
            .ok_or("src-tauri has no parent")?
            .to_path_buf())
    } else {
        Ok(std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?
            .parent()
            .ok_or("No parent directory for exe")?
            .to_path_buf())
    }
}

// Download URLs for different platforms
const LLAMA_VERSION: &str = "b6940";
const WIN_X64_URL: &str =
    "https://github.com/ggml-org/llama.cpp/releases/download/b6940/llama-b6940-bin-win-cpu-x64.zip";
const LINUX_X64_URL: &str = 
    "https://github.com/ggml-org/llama.cpp/releases/download/b6940/llama-b6940-bin-ubuntu-x64.zip";
const MACOS_ARM_URL: &str = 
    "https://github.com/ggml-org/llama.cpp/releases/download/b6940/llama-b6940-bin-macos-arm64.zip";
const MACOS_X64_URL: &str = 
    "https://github.com/ggml-org/llama.cpp/releases/download/b6940/llama-b6940-bin-macos-x64.zip";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub running: bool,
    pub pid: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percentage: f32,
}

/// Append line to in-memory log buffer and emit event
fn push_log_line(mut guard: MutexGuard<'static, VecDeque<String>>, window: &Window, line: String) {
    if guard.len() >= LOG_CAPACITY {
        guard.pop_front();
    }
    guard.push_back(line.clone());
    let _ = window.emit("llama-log", &line);
}

/// Public helper to read current logs (for UI initial fetch)
pub fn get_logs_snapshot() -> Vec<String> {
    let guard = LOG_BUFFER.lock().unwrap();
    guard.iter().cloned().collect()
}

/// Clear in-memory logs
pub fn clear_logs() {
    let mut guard = LOG_BUFFER.lock().unwrap();
    guard.clear();
}

/// Get the path to the llama-server binary
pub fn get_server_binary_path(_app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Keep binary within program folder
    // In dev mode, current_dir() points to workspace root
    // In production, use executable's parent directory
    let base = get_base_dir()?;
    let mut bin_path = base.join("llama-bin");

    #[cfg(target_os = "windows")]
    {
        bin_path.push("llama-server.exe");
    }

    #[cfg(not(target_os = "windows"))]
    {
        bin_path.push("llama-server");
    }

    Ok(bin_path)
}

/// Check if llama-server is installed
pub fn check_server_binary(app_handle: &tauri::AppHandle) -> Result<ServerStatus, String> {
    let binary_path = get_server_binary_path(app_handle)?;
    let installed = binary_path.exists();

    let version = if installed {
        Some(LLAMA_VERSION.to_string())
    } else {
        None
    };

    let path_str = if installed {
        Some(binary_path.to_string_lossy().to_string())
    } else {
        None
    };

    // Check if process is running
    let (running, pid) = {
        let guard = LLAMA_PROCESS.lock().unwrap();
        if let Some(child) = guard.as_ref() {
            (true, Some(child.id()))
        } else {
            (false, None)
        }
    };

    Ok(ServerStatus {
        installed,
        version,
        path: path_str,
        running,
        pid,
    })
}

/// Get download URL based on platform
fn get_download_url() -> Result<&'static str, String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    match (os, arch) {
        ("windows", "x86_64") => Ok(WIN_X64_URL),
        ("windows", "aarch64") => Ok("https://github.com/ggml-org/llama.cpp/releases/download/b6916/llama-b6916-bin-win-cpu-arm64.zip"),
        ("linux", "x86_64") => Ok(LINUX_X64_URL),
        ("macos", "aarch64") => Ok(MACOS_ARM_URL),
        ("macos", "x86_64") => Ok(MACOS_X64_URL),
        _ => Err(format!("Platform {}/{} not supported. Supported: Windows (x64/ARM64), Linux (x64), macOS (x64/ARM64).", os, arch)),
    }
}

/// Download llama-server binary with progress
pub async fn download_server_binary(window: Window) -> Result<PathBuf, String> {
    let url = get_download_url()?;

    window.emit("llama-server-status", "downloading").ok();

    // Create temp directory under program folder
    let base = get_base_dir()?;
    let temp_dir = base.join("downloads");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let zip_path = temp_dir.join(format!("llama-{}.zip", LLAMA_VERSION));

    // Download with progress
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let total_size = response.content_length();
    let mut downloaded: u64 = 0;
    let mut file = File::create(&zip_path).map_err(|e| format!("Failed to create file: {}", e))?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Error reading chunk: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Error writing to file: {}", e))?;

        downloaded += chunk.len() as u64;

        let percentage = if let Some(total) = total_size {
            (downloaded as f32 / total as f32) * 100.0
        } else {
            0.0
        };

        let progress = DownloadProgress {
            downloaded,
            total: total_size,
            percentage,
        };

        window.emit("llama-download-progress", &progress).ok();
    }

    file.flush()
        .map_err(|e| format!("Failed to flush file: {}", e))?;

    window.emit("llama-server-status", "extracting").ok();

    Ok(zip_path)
}

/// Extract llama-server binary from ZIP archive
pub fn extract_server_binary(
    zip_path: &Path,
    app_handle: &tauri::AppHandle,
) -> Result<PathBuf, String> {
    let file = File::open(zip_path).map_err(|e| format!("Failed to open ZIP: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    // Create bin directory within program folder
    let base = get_base_dir()?;
    let bin_dir = base.join("llama-bin");
    fs::create_dir_all(&bin_dir).map_err(|e| format!("Failed to create bin dir: {}", e))?;

    // Find and extract llama-server executable and all required DLLs
    let target_name = if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    let mut found = false;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;
        let full_name = entry.name().to_string();
        // Use only the basename to avoid nested paths from the archive
        let basename = std::path::Path::new(&full_name)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(&full_name)
            .to_string();

        let is_target = basename.eq_ignore_ascii_case(target_name);
        let is_dll = basename.to_ascii_lowercase().ends_with(".dll");

        if is_target || is_dll {
            let dest_path = bin_dir.join(&basename);
            let mut dest_file = File::create(&dest_path).map_err(|e| {
                format!(
                    "Failed to create destination file {}: {}",
                    dest_path.display(),
                    e
                )
            })?;
            io::copy(&mut entry, &mut dest_file)
                .map_err(|e| format!("Failed to extract {}: {}", basename, e))?;

            // Set executable permissions on Unix for the main binary
            #[cfg(unix)]
            if is_target {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&dest_path)
                    .map_err(|e| e.to_string())?
                    .permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&dest_path, perms).map_err(|e| e.to_string())?;
            }

            if is_target {
                found = true;
            }
        }
    }

    if !found {
        return Err(format!("{} not found in downloaded archive", target_name));
    }

    // Cleanup temp file
    fs::remove_file(zip_path).ok();

    get_server_binary_path(app_handle)
}

/// Start llama-server process
pub fn start_server_process(
    model_path: String,
    ctx_size: i32,
    window: Window,
    app_handle: &tauri::AppHandle,
) -> Result<u32, String> {
    eprintln!("[llama_install] ====== START SERVER PROCESS ======");
    eprintln!("[llama_install] Model: {}", model_path);
    eprintln!("[llama_install] Ctx size: {}", ctx_size);

    // Check if already running
    {
        let mut guard = LLAMA_PROCESS
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(None) => {
                    // Still running
                    let pid = child.id();
                    eprintln!("[llama_install] Server already running with PID: {}", pid);
                    return Ok(pid);
                }
                Ok(Some(status)) => {
                    eprintln!("[llama_install] Previous process exited with: {:?}", status);
                    *guard = None;
                }
                Err(e) => {
                    eprintln!("[llama_install] Error checking process status: {}", e);
                    *guard = None;
                }
            }
        }
    }

    // Check if binary exists
    let binary_path = get_server_binary_path(app_handle)?;
    if !binary_path.exists() {
        return Err("llama-server binary not found. Please install it first.".to_string());
    }

    // Check if model exists within program folder
    let base = get_base_dir()?;
    let model_full_path = base.join(&model_path);

    if !model_full_path.exists() {
        return Err(format!("Model file not found: {}", model_path));
    }

    window.emit("llama-server-status", "starting").ok();

    // Log command for debugging
    eprintln!("[llama_install] Starting server:");
    eprintln!("[llama_install]   Binary: {:?}", binary_path);
    eprintln!("[llama_install]   Model: {:?}", model_full_path);
    let port: u16 = std::env::var("LLAMA_SERVER_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    eprintln!("[llama_install]   Port: {}", port);
    eprintln!("[llama_install]   Ctx size: {}", ctx_size);

    // Get current working directory for the process
    let bin_dir = binary_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let current_path = std::env::var("PATH").unwrap_or_default();
    
    // Use correct PATH separator for the platform
    #[cfg(target_os = "windows")]
    let path_separator = ";";
    #[cfg(not(target_os = "windows"))]
    let path_separator = ":";
    
    let injected_path = format!("{}{}{}", bin_dir.to_string_lossy(), path_separator, current_path);
    
    // SystemRoot is Windows-specific
    #[cfg(target_os = "windows")]
    let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
    #[cfg(not(target_os = "windows"))]
    let system_root = String::new(); // Not used on Unix
    eprintln!(
        "[llama_install]   Injected PATH head: {}",
        bin_dir.to_string_lossy()
    );
    eprintln!("[llama_install]   SystemRoot: {}", system_root);
    eprintln!("[llama_install]   PATH length: {}", injected_path.len());

    // Start process and capture stdout/stderr for UI debug
    // Use bin_dir as working directory to maximize DLL resolution reliability
    let mut command = Command::new(&binary_path);
    command
        .current_dir(&bin_dir)
        .env("PATH", &injected_path);
    
    // Windows-specific environment variables
    #[cfg(target_os = "windows")]
    {
        command
            .env("SystemRoot", &system_root)
            .env("WINDIR", &system_root);
    }
    
    command
        .arg("-m")
        .arg(model_full_path.to_string_lossy().as_ref())
        .arg("--port")
        .arg(port.to_string())
        .arg("--ctx-size")
        .arg(ctx_size.to_string())
        // Enable embeddings endpoint for RAG features
        .arg("--embeddings")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Windows, prevent a console window from appearing
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to start llama-server: {}", e))?;

    let pid = child.id();
    eprintln!("[llama_install] Process spawned with PID: {}", pid);

    // Spawn reader threads to capture logs
    if let Some(stdout) = child.stdout.take() {
        let window_clone = window.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                let guard = LOG_BUFFER.lock().unwrap();
                push_log_line(guard, &window_clone, format!("[stdout] {}", line));
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let window_clone = window.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                let guard = LOG_BUFFER.lock().unwrap();
                push_log_line(guard, &window_clone, format!("[stderr] {}", line));
            }
        });
    }

    // Store process
    {
        let mut guard = LLAMA_PROCESS.lock().unwrap();
        *guard = Some(child);
    }

    // Wait longer to let server fully initialize before checking
    eprintln!("[llama_install] Waiting 1.5s for process to initialize...");
    std::thread::sleep(std::time::Duration::from_millis(1500));
    {
        let mut guard = LLAMA_PROCESS.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(Some(status)) => {
                    eprintln!(
                        "[llama_install] ERROR: Process exited immediately with: {:?}",
                        status
                    );
                    *guard = None;
                    return Err("llama-server process exited immediately. Please verify dependencies and DLLs.".to_string());
                }
                Ok(None) => {
                    eprintln!("[llama_install] Process is still running - OK!");
                }
                Err(e) => {
                    eprintln!("[llama_install] Error checking process: {}", e);
                }
            }
        }
    }

    window.emit("llama-server-status", "running").ok();

    Ok(pid)
}

/// Stop llama-server process
pub fn stop_server_process(window: Window) -> Result<(), String> {
    eprintln!("[llama_install] ====== STOP SERVER REQUESTED ======");

    let mut guard = LLAMA_PROCESS
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    if let Some(mut child) = guard.take() {
        let pid = child.id();
        eprintln!("[llama_install] Killing server process PID: {}", pid);
        window.emit("llama-server-status", "stopping").ok();

        match child.kill() {
            Ok(_) => {
                eprintln!("[llama_install] Kill signal sent successfully");
            }
            Err(e) => {
                eprintln!("[llama_install] Failed to kill process: {}", e);
                return Err(format!("Failed to kill process: {}", e));
            }
        }

        match child.wait() {
            Ok(status) => {
                eprintln!("[llama_install] Process exited with: {:?}", status);
            }
            Err(e) => {
                eprintln!("[llama_install] Failed to wait for process: {}", e);
                return Err(format!("Failed to wait for process: {}", e));
            }
        }

        window.emit("llama-server-status", "stopped").ok();
        // Mark in logs
        {
            let guard = LOG_BUFFER.lock().unwrap();
            push_log_line(guard, &window, "[info] llama-server stopped".to_string());
        }
        eprintln!("[llama_install] ====== SERVER STOPPED ======");

        Ok(())
    } else {
        eprintln!("[llama_install] No server process is running (already stopped)");
        // Return Ok instead of Err to make this idempotent
        Ok(())
    }
}
