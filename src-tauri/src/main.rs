// Hide console window on Windows only
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod db;
mod llama;
mod llama_install;
mod rag;

use futures_util::StreamExt;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Size, State, Window,
    WindowEvent,
};
use tokio::{fs as afs, io::AsyncWriteExt};

struct OverlayState(Mutex<bool>);

struct DbState(Mutex<Connection>);

struct DownloadManager {
    inner: Mutex<HashMap<String, DownloadEntry>>,
}

/// Enable/disable OS-level click-through on the window (ignore cursor events)
#[tauri::command]
async fn set_click_through(window: Window, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn apply_overlay_bounds(
    window: Window,
    width: Option<f64>,
    height: Option<f64>,
    x: Option<i32>,
    y: Option<i32>,
) -> Result<(), String> {
    if let (Some(w), Some(h)) = (width, height) {
        window
            .set_size(Size::Logical(LogicalSize::new(w, h)))
            .map_err(|e| e.to_string())?;
    }
    if let (Some(px), Some(py)) = (x, y) {
        window
            .set_position(Position::Logical(LogicalPosition::new(
                px as f64, py as f64,
            )))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Serialize, Clone)]
struct DownloadState {
    filename: String,
    total: Option<u64>,
    written: u64,
    status: String,
    error: Option<String>,
}

struct DownloadEntry {
    state: DownloadState,
    cancel: Arc<AtomicBool>,
}

#[tauri::command]
async fn toggle_overlay(window: Window, state: State<'_, OverlayState>) -> Result<(), String> {
    let mut flag = state.0.lock().map_err(|_| "lock".to_string())?;
    *flag = !*flag;
    window.set_always_on_top(*flag).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn set_overlay_mode(
    window: Window,
    state: State<'_, OverlayState>,
    enabled: bool,
) -> Result<(), String> {
    {
        let mut flag = state.0.lock().map_err(|_| "lock".to_string())?;
        *flag = enabled;
    }
    window
        .set_always_on_top(enabled)
        .map_err(|e| e.to_string())?;
    // Keep decorations enabled for overlay mode to allow dragging
    if enabled {
        // Set a compact mini-chat size
        window
            .set_size(Size::Logical(LogicalSize::new(420.0, 560.0)))
            .map_err(|e| e.to_string())?;
        window.set_resizable(true).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Deserialize)]
struct ImportArgs {
    #[serde(rename = "presetId")]
    preset_id: String,
    #[serde(rename = "sourcePath")]
    source_path: String,
}

#[tauri::command]
async fn import_pack(args: ImportArgs, app: AppHandle) -> Result<String, String> {
    let target_dir: PathBuf = models_root_dir(&app)?.join(&args.preset_id);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let src = PathBuf::from(&args.source_path);
    if !src.exists() {
        return Err("Source file not found".to_string());
    }
    let file_name = src
        .file_name()
        .ok_or_else(|| "Invalid file name".to_string())?;
    let dest = target_dir.join(file_name);
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[derive(Deserialize)]
struct StartArgs {
    #[serde(rename = "presetId")]
    preset_id: String,
}

#[derive(Serialize)]
struct StartResult {
    need_download: bool,
}

#[tauri::command]
async fn start_llama(args: StartArgs, _app: AppHandle) -> Result<StartResult, String> {
    const PACKS_JSON: &str = include_str!("../pack-sources.json");
    let packs: Vec<PackSource> = serde_json::from_str(PACKS_JSON).map_err(|e| e.to_string())?;
    let pack = packs
        .into_iter()
        .find(|p| p.id == args.preset_id)
        .ok_or_else(|| "Unknown preset".to_string())?;
    let final_path = models_root_dir(&_app)?.join(&pack.id).join(&pack.filename);
    let need = !final_path.exists();

    // Debug logging
    eprintln!("[start_llama] Checking preset: {}", args.preset_id);
    eprintln!("[start_llama] Expected path: {:?}", final_path);
    eprintln!("[start_llama] File exists: {}", !need);
    eprintln!("[start_llama] Current dir: {:?}", std::env::current_dir());

    Ok(StartResult {
        need_download: need,
    })
}

#[derive(Serialize, Deserialize)]
struct PresetInternal {
    id: String,
    #[serde(rename = "labelKey")]
    label_key: String,
    #[serde(rename = "descKey")]
    desc_key: String,
    engine: String,
    quant: String,
    context: u32,
    #[serde(rename = "useCases", default)]
    use_cases: Vec<String>,
}

#[derive(Serialize)]
struct PresetPublic {
    id: String,
    #[serde(rename = "labelKey")]
    label_key: String,
    #[serde(rename = "descKey")]
    desc_key: String,
    #[serde(rename = "useCases")]
    use_cases: Vec<String>,
}

#[tauri::command]
async fn get_presets() -> Result<Vec<PresetPublic>, String> {
    const PRESETS_JSON: &str = include_str!("../presets.json");
    let data: Vec<PresetInternal> =
        serde_json::from_str(PRESETS_JSON).map_err(|e| e.to_string())?;

    let list: Vec<PresetPublic> = data
        .into_iter()
        .filter(|p| {
            // Hide phi3_local in production builds
            if cfg!(debug_assertions) {
                true
            } else {
                p.id != "phi3_local"
            }
        })
        .map(|p| PresetPublic {
            id: p.id,
            label_key: p.label_key,
            desc_key: p.desc_key,
            use_cases: p.use_cases,
        })
        .collect();
    Ok(list)
}

/// Helper function to get the root directory for models
/// Keep models within program folder for portability
fn models_root_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    // In dev: use project root (parent of src-tauri) via compile-time CARGO_MANIFEST_DIR
    // In prod: use executable directory
    let base = if cfg!(debug_assertions) {
        let src_tauri = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        src_tauri
            .parent()
            .ok_or("src-tauri has no parent")?
            .to_path_buf()
    } else {
        std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?
            .parent()
            .ok_or("No parent directory for exe")?
            .to_path_buf()
    };
    eprintln!("[models_root_dir] Base path: {:?}", base);
    Ok(base.join("models"))
}

#[tauri::command]
async fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

fn main() {
    tauri::Builder::default()
        .manage(OverlayState(Mutex::new(false)))
        .manage(DownloadManager {
            inner: Mutex::new(HashMap::new()),
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize database with proper app data directory
            let db_conn = db::init_db(app.handle()).expect("Failed to initialize database");
            app.manage(DbState(Mutex::new(db_conn)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                // Stop server only when application is actually being destroyed
                let _ = llama_install::stop_server_process(window.clone());
            }
        })
        .invoke_handler(tauri::generate_handler![
            toggle_overlay,
            set_overlay_mode,
            apply_overlay_bounds,
            set_click_through,
            start_llama,
            get_presets,
            import_pack,
            download_pack,
            download_status,
            cancel_download,
            list_conversations,
            list_groups,
            create_conversation,
            get_conversation,
            delete_conversation,
            list_messages,
            add_message,
            generate_text,
            generate_prompt_ai_dialogue,
            generate_prompt_ai,
            check_llama_server,
            health_check_llama_server,
            download_llama_server,
            start_llama_server,
            start_llama_for_conversation,
            start_llama_with_preset,
            get_first_installed_preset,
            stop_llama_server,
            get_db_path_string,
            get_llama_logs,
            clear_llama_logs,
            get_server_diagnostics,
            read_file_content,
            // RAG commands
            rag::rag_list_datasets,
            rag::rag_create_dataset,
            rag::rag_delete_dataset,
            rag::rag_ingest_text,
            rag::rag_list_chunks,
            // RAG Dataset Linking
            link_dataset_to_conversation,
            unlink_dataset_from_conversation,
            list_datasets_for_conversation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Deserialize)]
struct DownloadArgs {
    #[serde(rename = "presetId")]
    preset_id: String,
}

#[derive(Deserialize, Serialize)]
struct PackSource {
    id: String,
    url: String,
    filename: String,
    #[serde(default, rename = "sizeBytes")]
    size_bytes: Option<u64>,
}

#[tauri::command]
async fn download_pack(
    args: DownloadArgs,
    dm: State<'_, DownloadManager>,
    app: AppHandle,
) -> Result<String, String> {
    const PACKS_JSON: &str = include_str!("../pack-sources.json");
    let packs: Vec<PackSource> = serde_json::from_str(PACKS_JSON).map_err(|e| e.to_string())?;
    let pack = packs
        .into_iter()
        .find(|p| p.id == args.preset_id)
        .ok_or_else(|| "Unknown preset".to_string())?;
    // Use models_root_dir for consistency across dev/prod
    let target_dir: PathBuf = models_root_dir(&app)?.join(&args.preset_id);
    let part_path = target_dir.join(format!("{}.part", pack.filename));
    let final_path = target_dir.join(&pack.filename);

    // Handle local models (file:// URLs or already existing files)
    if pack.url.starts_with("file://") || final_path.exists() {
        if final_path.exists() {
            // Model already present, mark as done immediately
            let mut map = dm.inner.lock().unwrap();
            map.insert(
                args.preset_id.clone(),
                DownloadEntry {
                    state: DownloadState {
                        filename: pack.filename.clone(),
                        total: pack.size_bytes,
                        written: pack.size_bytes.unwrap_or(0),
                        status: "done".into(),
                        error: None,
                    },
                    cancel: Arc::new(AtomicBool::new(false)),
                },
            );
            return Ok("already_installed".into());
        } else {
            return Err(
                "Local model file not found. Please place the model file manually.".to_string(),
            );
        }
    }

    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut map = dm.inner.lock().unwrap();
        map.insert(
            args.preset_id.clone(),
            DownloadEntry {
                state: DownloadState {
                    filename: pack.filename.clone(),
                    total: pack.size_bytes,
                    written: 0,
                    status: "running".into(),
                    error: None,
                },
                cancel: cancel_flag.clone(),
            },
        );
    }
    let app_handle = app.clone();
    let preset_id = args.preset_id.clone();
    tokio::spawn(async move {
        let dm = app_handle.state::<DownloadManager>();
        let _ = afs::create_dir_all(&target_dir).await;
        let client = reqwest::Client::new();

        let mut resume: u64 = 0;
        if let Ok(meta) = afs::metadata(&part_path).await {
            resume = meta.len();
        }

        let mut req = client.get(&pack.url);
        if resume > 0 {
            req = req.header(reqwest::header::RANGE, format!("bytes={}-", resume));
        }

        let resp = match req.send().await.and_then(|r| r.error_for_status()) {
            Ok(r) => r,
            Err(e) => {
                let mut map = dm.inner.lock().unwrap();
                if let Some(entry) = map.get_mut(&preset_id) {
                    entry.state.status = "error".into();
                    entry.state.error = Some(e.to_string());
                }
                return;
            }
        };

        let total = resp.content_length().map(|cl| cl + resume);
        {
            let mut map = dm.inner.lock().unwrap();
            if let Some(entry) = map.get_mut(&preset_id) {
                entry.state.total = total;
                entry.state.written = resume;
            }
        }

        let mut stream = resp.bytes_stream();
        let mut file = if resume > 0 {
            afs::OpenOptions::new()
                .append(true)
                .open(&part_path)
                .await
                .unwrap()
        } else {
            afs::File::create(&part_path).await.unwrap()
        };

        while let Some(chunk) = stream.next().await {
            if cancel_flag.load(Ordering::SeqCst) {
                let _ = afs::remove_file(&part_path).await;
                let mut map = dm.inner.lock().unwrap();
                if let Some(entry) = map.get_mut(&preset_id) {
                    entry.state.status = "canceled".into();
                }
                return;
            }
            match chunk {
                Ok(data) => {
                    if file.write_all(&data).await.is_err() {
                        let mut map = dm.inner.lock().unwrap();
                        if let Some(entry) = map.get_mut(&preset_id) {
                            entry.state.status = "error".into();
                            entry.state.error = Some("write failed".into());
                        }
                        return;
                    }
                    let mut map = dm.inner.lock().unwrap();
                    if let Some(entry) = map.get_mut(&preset_id) {
                        entry.state.written += data.len() as u64;
                    }
                }
                Err(e) => {
                    let mut map = dm.inner.lock().unwrap();
                    if let Some(entry) = map.get_mut(&preset_id) {
                        entry.state.status = "error".into();
                        entry.state.error = Some(e.to_string());
                    }
                    return;
                }
            }
        }

        let _ = file.flush().await;
        let _ = afs::rename(&part_path, &final_path).await;
        let mut map = dm.inner.lock().unwrap();
        if let Some(entry) = map.get_mut(&preset_id) {
            entry.state.status = "done".into();
            entry.state.total = total;
        }
        // Notify UI a model is now installed
        let _ = app_handle.emit("model-installed", &preset_id);
    });

    Ok("started".into())
}

#[tauri::command]
async fn download_status(
    preset_id: String,
    dm: State<'_, DownloadManager>,
) -> Result<DownloadState, String> {
    let map = dm.inner.lock().unwrap();
    if let Some(entry) = map.get(&preset_id) {
        return Ok(entry.state.clone());
    }
    Err("not_found".into())
}

#[tauri::command]
async fn cancel_download(preset_id: String, dm: State<'_, DownloadManager>) -> Result<(), String> {
    let map = dm.inner.lock().unwrap();
    if let Some(entry) = map.get(&preset_id) {
        entry.cancel.store(true, Ordering::SeqCst);
        return Ok(());
    }
    Err("not_found".into())
}

#[tauri::command]
async fn list_conversations(db: State<'_, DbState>) -> Result<Vec<db::Conversation>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::list_conversations(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_groups(db: State<'_, DbState>) -> Result<Vec<db::Group>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::list_groups(&conn).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct ModelParameters {
    temperature: f32,
    #[serde(rename = "topP")]
    top_p: f32,
    #[serde(rename = "maxTokens")]
    max_tokens: i32,
    #[serde(rename = "repeatPenalty")]
    repeat_penalty: f32,
}

#[derive(Deserialize)]
struct CreateConversationArgs {
    name: String,
    #[serde(rename = "groupName")]
    group_name: Option<String>,
    #[serde(rename = "presetId")]
    preset_id: String,
    #[serde(rename = "systemPrompt")]
    system_prompt: String,
    parameters: ModelParameters,
    #[serde(rename = "datasetIds")]
    dataset_ids: Option<Vec<String>>,
    #[serde(rename = "initialDatasetName")]
    initial_dataset_name: Option<String>,
    #[serde(rename = "initialDatasetText")]
    initial_dataset_text: Option<String>,
}

#[tauri::command]
async fn create_conversation(
    args: CreateConversationArgs,
    db: State<'_, DbState>,
) -> Result<i64, String> {
    // Scope lock to avoid holding across awaits
    let conversation_id = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;

        // Get or create group if specified
        let group_id = if let Some(group_name) = &args.group_name {
            if !group_name.is_empty() {
                // Try to find existing group or create new one
                let groups = db::list_groups(&conn).map_err(|e| e.to_string())?;
                if let Some(group) = groups.iter().find(|g| g.name == *group_name) {
                    Some(group.id)
                } else {
                    Some(db::create_group(&conn, group_name).map_err(|e| e.to_string())?)
                }
            } else {
                None
            }
        } else {
            None
        };

        let system_prompt_opt = if args.system_prompt.is_empty() {
            None
        } else {
            Some(args.system_prompt.clone())
        };

        // Convert dataset_ids Vec to JSON string (legacy field retained for backward compatibility)
        let dataset_ids_json = args
            .dataset_ids
            .clone()
            .and_then(|ids| serde_json::to_string(&ids).ok());

        let params = db::ConversationParams {
            name: args.name.clone(),
            group_id,
            preset_id: args.preset_id.clone(),
            system_prompt: system_prompt_opt,
            temperature: args.parameters.temperature,
            top_p: args.parameters.top_p,
            max_tokens: args.parameters.max_tokens,
            repeat_penalty: args.parameters.repeat_penalty,
            dataset_ids: dataset_ids_json,
        };

        db::create_conversation(&conn, params).map_err(|e| e.to_string())?
    };

    // Link any provided legacy dataset IDs via N-N table
    if let Some(ids) = args.dataset_ids.clone() {
        for did in ids {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            if let Err(e) = db::link_dataset_to_conversation(&conn, conversation_id, &did) {
                eprintln!(
                    "[create_conversation] Failed to link dataset {}: {}",
                    did, e
                );
            }
        }
    }

    // Auto-create dataset if requested (name or text provided)
    let wants_dataset = args
        .initial_dataset_name
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false)
        || args
            .initial_dataset_text
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);

    if wants_dataset {
        // Determine dataset name
        let ds_name = if let Some(name) = &args.initial_dataset_name {
            if name.trim().is_empty() {
                format!("{}-kb", args.name)
            } else {
                name.trim().to_string()
            }
        } else {
            format!("{}-kb", args.name)
        };

        match rag::rag_create_dataset(ds_name).await {
            Ok(info) => {
                // Ingest initial text if provided
                if let Some(text) = &args.initial_dataset_text {
                    if !text.trim().is_empty() {
                        let ingest_args = rag::IngestTextArgs {
                            dataset_id: info.id.clone(),
                            text: text.clone(),
                        };
                        if let Err(e) = rag::rag_ingest_text(ingest_args).await {
                            eprintln!("[create_conversation] Ingestion failed: {}", e);
                        }
                    }
                }
                // Link dataset
                let conn = db.0.lock().map_err(|e| e.to_string())?;
                if let Err(e) = db::link_dataset_to_conversation(&conn, conversation_id, &info.id) {
                    eprintln!(
                        "[create_conversation] Failed to link auto dataset {}: {}",
                        info.id, e
                    );
                }
            }
            Err(e) => {
                eprintln!("[create_conversation] Auto dataset creation failed: {}", e);
            }
        }
    }

    Ok(conversation_id)
}

#[tauri::command]
async fn get_conversation(id: i64, db: State<'_, DbState>) -> Result<db::Conversation, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::get_conversation(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_conversation(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::delete_conversation(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_messages(
    conversation_id: i64,
    db: State<'_, DbState>,
) -> Result<Vec<db::Message>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::list_messages(&conn, conversation_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_db_path_string(app: tauri::AppHandle) -> Result<String, String> {
    let p = crate::db::get_db_path(&app)?;
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
async fn add_message(
    conversation_id: i64,
    role: String,
    content: String,
    db: State<'_, DbState>,
) -> Result<i64, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    db::add_message(&mut conn, conversation_id, &role, &content).map_err(|e| e.to_string())
}

// ===== RAG Dataset Linking Commands =====

#[tauri::command]
async fn link_dataset_to_conversation(
    conversation_id: i64,
    dataset_id: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::link_dataset_to_conversation(&conn, conversation_id, &dataset_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn unlink_dataset_from_conversation(
    conversation_id: i64,
    dataset_id: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::unlink_dataset_from_conversation(&conn, conversation_id, &dataset_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_datasets_for_conversation(
    conversation_id: i64,
    db: State<'_, DbState>,
) -> Result<Vec<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::list_datasets_for_conversation(&conn, conversation_id).map_err(|e| e.to_string())
}

/// Load RAG context from all datasets linked to a conversation
async fn load_rag_context(conversation_id: i64, db: &State<'_, DbState>) -> Result<String, String> {
    // Get linked datasets
    let dataset_ids = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        db::list_datasets_for_conversation(&conn, conversation_id).map_err(|e| e.to_string())?
    };

    if dataset_ids.is_empty() {
        return Ok(String::new());
    }

    // Load chunks from each dataset
    let mut all_chunks = Vec::new();
    for dataset_id in dataset_ids {
        match rag::rag_list_chunks(dataset_id.clone()).await {
            Ok(chunks) => {
                all_chunks.extend(chunks);
            }
            Err(e) => {
                eprintln!(
                    "[RAG] Failed to load chunks for dataset {}: {}",
                    dataset_id, e
                );
                // Continue with other datasets
            }
        }
    }

    if all_chunks.is_empty() {
        return Ok(String::new());
    }

    // Limit total context size (max ~3000 chars to avoid token overflow)
    const MAX_CONTEXT_CHARS: usize = 3000;
    let mut context = String::new();
    let mut total_chars = 0;

    for chunk in all_chunks {
        if total_chars + chunk.len() > MAX_CONTEXT_CHARS {
            break;
        }
        context.push_str(&chunk);
        context.push_str("\n\n---\n\n");
        total_chars += chunk.len() + 8; // 8 for separator
    }

    Ok(context.trim().to_string())
}

#[tauri::command]
async fn generate_text(
    conversation_id: i64,
    user_message: String,
    window: Window,
    db: State<'_, DbState>,
) -> Result<(), String> {
    // Load conversation
    let conversation = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        db::get_conversation(&conn, conversation_id).map_err(|e| e.to_string())?
    };

    // Load message history
    let messages = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        db::list_messages(&conn, conversation_id).map_err(|e| e.to_string())?
    };

    // Build chat messages
    let mut chat_messages = Vec::new();

    // Add system prompt if exists
    if let Some(system_prompt) = &conversation.system_prompt {
        if !system_prompt.is_empty() {
            chat_messages.push(llama::ChatMessage {
                role: "system".to_string(),
                content: system_prompt.clone(),
            });
        }
    }

    // Add RAG context if datasets are linked
    let rag_context = load_rag_context(conversation_id, &db).await?;
    if !rag_context.is_empty() {
        let context_message = format!(
            "Relevant knowledge from your datasets:\n\n{}\n\n\
            Use this information to provide accurate answers. \
            If the question relates to this knowledge, reference it in your response.",
            rag_context
        );
        chat_messages.push(llama::ChatMessage {
            role: "system".to_string(),
            content: context_message,
        });
    }

    // Add message history
    for msg in messages {
        chat_messages.push(llama::ChatMessage {
            role: msg.role,
            content: msg.content,
        });
    }

    // Add new user message
    chat_messages.push(llama::ChatMessage {
        role: "user".to_string(),
        content: user_message,
    });

    // Build payload
    let payload = llama::ChatCompletionRequest {
        model: conversation.preset_id.clone(),
        messages: chat_messages,
        stream: true,
        temperature: conversation.temperature,
        top_p: conversation.top_p,
        max_tokens: conversation.max_tokens,
        repeat_penalty: conversation.repeat_penalty,
    };

    // Send request to llama-server
    let server_url = llama::get_server_url();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(format!("{}/v1/chat/completions", server_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            if e.to_string().contains("Connection refused") {
                "llama-server is not running. Please start it first.".to_string()
            } else {
                format!("Failed to connect to llama-server: {}", e)
            }
        })?;

    if !response.status().is_success() {
        let error_msg = format!("llama-server returned error: {}", response.status());
        window.emit("generation-error", &error_msg).ok();
        return Err(error_msg);
    }

    // Stream response
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut accumulated = String::new();
    let mut finished = false;

    println!("[generate_text] Starting to stream response...");

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&bytes);

        buffer.push_str(&text);

        // Process complete lines
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            println!("[generate_text] Raw SSE line: {}", line);

            if let Some(json_str) = line.strip_prefix("data: ") {
                if json_str == "[DONE]" {
                    println!("[generate_text] Received [DONE], finishing stream");
                    finished = true;
                    break;
                }

                // Parse SSE chunk
                match serde_json::from_str::<llama::SSEChunk>(json_str) {
                    Ok(sse_chunk) => {
                        if let Some(choice) = sse_chunk.choices.first() {
                            // Extract content delta
                            if let Some(content) = &choice.delta.content {
                                if !content.is_empty() {
                                    accumulated.push_str(content);
                                    println!("[generate_text] Emitting chunk: {}", content);
                                    // Emit chunk to frontend
                                    if let Err(e) = window.emit("generation-chunk", content) {
                                        println!("[generate_text] Failed to emit chunk: {:?}", e);
                                    }
                                }
                            }

                            // Check if generation is complete
                            if let Some(reason) = &choice.finish_reason {
                                if reason == "stop" || reason == "length" {
                                    println!("[generate_text] Finish reason: {}", reason);
                                    finished = true;
                                    break;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[generate_text] ⚠️ PARSE ERROR: {} | JSON: {}", e, json_str);
                        eprintln!("[generate_text] ⚠️ This chunk was SKIPPED. Check if llama-server is sending malformed JSON.");
                        // Continue processing next chunks instead of silently failing
                    }
                }
            }
        }

        // If the stream indicated completion, exit the outer loop promptly
        if finished {
            break;
        }
    }

    println!(
        "[generate_text] Streaming complete. Total accumulated: {} chars",
        accumulated.len()
    );

    // Save assistant message to DB
    {
        let mut conn = db.0.lock().map_err(|e| e.to_string())?;
        db::add_message(&mut conn, conversation_id, "assistant", &accumulated)
            .map_err(|e| e.to_string())?;
    }

    // Emit completion event
    println!("[generate_text] Emitting generation-complete");
    if let Err(e) = window.emit("generation-complete", &accumulated) {
        println!("[generate_text] Failed to emit complete: {:?}", e);
    }

    Ok(())
}

// ============= LLAMA-SERVER INSTALLATION & MANAGEMENT =============

#[tauri::command]
async fn check_llama_server(app: tauri::AppHandle) -> Result<llama_install::ServerStatus, String> {
    llama_install::check_server_binary(&app)
}

#[tauri::command]
async fn health_check_llama_server() -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;

    // Try multiple endpoints - llama.cpp may not have /health
    let base = llama::get_server_url();
    let endpoints = vec![
        format!("{}/health", base),
        format!("{}/v1/models", base),
        base.clone(),
    ];

    for endpoint in endpoints {
        match client.get(&endpoint).send().await {
            Ok(response) => {
                if response.status().is_success() || response.status().as_u16() == 404 {
                    println!("[health_check] Success via: {}", endpoint);
                    return Ok(true);
                }
            }
            Err(e) => {
                println!("[health_check] Failed {}: {}", endpoint, e);
                continue;
            }
        }
    }

    Ok(false)
}

#[tauri::command]
async fn start_llama_for_conversation(
    conversation_id: i64,
    db: tauri::State<'_, DbState>,
    window: Window,
    app: tauri::AppHandle,
) -> Result<u32, String> {
    // Get conversation preset_id from database
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let conversation = db::get_conversation(&conn, conversation_id).map_err(|e| e.to_string())?;

    // Load pack info
    const PACKS_JSON: &str = include_str!("../pack-sources.json");
    let packs: Vec<PackSource> = serde_json::from_str(PACKS_JSON).map_err(|e| e.to_string())?;
    let pack = packs
        .into_iter()
        .find(|p| p.id == conversation.preset_id)
        .ok_or_else(|| "Unknown preset for this conversation".to_string())?;

    // Build model path
    let model_path = models_root_dir(&app)?.join(&pack.id).join(&pack.filename);

    if !model_path.exists() {
        return Err(format!(
            "Model '{}' is not downloaded. Please download it from the onboarding page first.",
            pack.id
        ));
    }

    // Start server with this model
    let model_path_str = format!("models/{}/{}", pack.id, pack.filename);
    llama_install::start_server_process(model_path_str, 2048, window, &app)
}

// ===== AI prompt generation (non-streaming) =====
#[derive(Deserialize)]
struct GeneratePromptAiArgs {
    #[serde(rename = "presetId")]
    preset_id: String,
    intent: String,
    #[serde(default)]
    clarifications: Vec<QAItem>,
    #[serde(rename = "strictMode")]
    strict_mode: bool,
    #[serde(default)]
    locale: Option<String>,
}

#[derive(Deserialize)]
struct QAItem {
    question: String,
    answer: String,
}

#[derive(Deserialize)]
struct ChatRespChoiceMessage {
    content: String,
}
#[derive(Deserialize)]
struct ChatRespChoice {
    message: ChatRespChoiceMessage,
}
#[derive(Deserialize)]
struct ChatResp {
    choices: Vec<ChatRespChoice>,
}

#[derive(Deserialize)]
struct DialogueMsg {
    role: String,
    content: String,
}
#[derive(Deserialize)]
struct GenerateDialogueArgs {
    #[serde(rename = "presetId")]
    preset_id: String,
    #[serde(default)]
    history: Vec<DialogueMsg>,
    #[serde(default)]
    strict_mode: bool,
    #[serde(default)]
    locale: Option<String>,
}
#[derive(Serialize)]
#[serde(tag = "status")]
enum DialogueResult {
    #[serde(rename = "questions")]
    Questions { questions: Vec<String> },
    #[serde(rename = "final")]
    Final { prompt: String },
}

#[tauri::command]
async fn generate_prompt_ai_dialogue(
    args: GenerateDialogueArgs,
    window: Window,
    app: AppHandle,
) -> Result<DialogueResult, String> {
    // Ensure server is started
    let _ = start_llama_with_preset(args.preset_id.clone(), window.clone(), app.clone()).await;

    let language = match args.locale.as_deref() {
        Some("en") | Some("en-US") => "English",
        Some(l) if l.starts_with("fr") => "français",
        None => "français",
        _ => "français",
    };

    let mut strict = String::new();
    if args.strict_mode {
        strict.push_str("RÈGLES STRICTES - ZÉRO INVENTION\n1) Suivre uniquement les instructions explicites\n2) Aucune extrapolation\n3) Si une info manque, poser jusqu'à 3 questions concises\n4) Respecter langue/format demandés\n\n");
    }

    // Protocol for iterative prompting
    let system_proto = format!(
        "{}Tu es un ingénieur de prompt. Conduis un court dialogue pour clarifier le besoin.\nProtocole de réponse unique à chaque tour:\n- Si des informations sont manquantes: réponds UNIQUEMENT sous la forme:\nQUESTIONS:\n- <Q1>\n- <Q2>\n- <Q3 (optionnelle)>\n- Sinon, si tout est clair: réponds UNIQUEMENT sous la forme:\nPROMPT_FINAL:\n<Prompt système complet et prêt à l'emploi en {}>\nAucun texte avant/après, pas d'explication.",
        strict, language
    );

    // Build messages
    let mut messages: Vec<crate::llama::ChatMessage> = Vec::new();
    messages.push(crate::llama::ChatMessage {
        role: "system".into(),
        content: system_proto,
    });
    for m in &args.history {
        messages.push(crate::llama::ChatMessage {
            role: m.role.clone(),
            content: m.content.clone(),
        });
    }
    if messages.len() == 1 {
        messages.push(crate::llama::ChatMessage {
            role: "user".into(),
            content: "Bonjour".into(),
        });
    }

    let payload = crate::llama::ChatCompletionRequest {
        model: args.preset_id.clone(),
        messages,
        stream: false,
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 512,
        repeat_penalty: 1.1,
    };

    let server_url = crate::llama::get_server_url();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(format!("{}/v1/chat/completions", server_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to llama-server: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("llama-server returned error: {}", resp.status()));
    }
    let txt = resp.text().await.map_err(|e| e.to_string())?;
    let parsed: ChatResp =
        serde_json::from_str(&txt).map_err(|e| format!("Invalid response: {} | {}", e, txt))?;
    let content = parsed
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    // Parse protocol
    let trimmed = content.trim();
    if let Some(rest) = trimmed.strip_prefix("PROMPT_FINAL:") {
        let prompt = rest.trim().to_string();
        return Ok(DialogueResult::Final { prompt });
    }
    if let Some(rest) = trimmed.strip_prefix("QUESTIONS:") {
        let qs: Vec<String> = rest
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .map(|l| l.trim_start_matches('-').trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();
        return Ok(DialogueResult::Questions { questions: qs });
    }
    // Fallback: treat as assistant question in a single block
    Ok(DialogueResult::Questions {
        questions: vec![trimmed.to_string()],
    })
}

#[tauri::command]
async fn generate_prompt_ai(
    args: GeneratePromptAiArgs,
    window: Window,
    app: AppHandle,
) -> Result<String, String> {
    // Best effort: try to start server with this preset (ignore if already running)
    let _ = start_llama_with_preset(args.preset_id.clone(), window.clone(), app.clone()).await;

    let language = match args.locale.as_deref() {
        Some("en") | Some("en-US") => "English",
        Some(l) if l.starts_with("fr") => "français",
        None => "français",
        _ => "français",
    };

    let mut strict = String::new();
    if args.strict_mode {
        strict.push_str("RÈGLES STRICTES - ZÉRO INVENTION\n1) Suivre uniquement les instructions explicites\n2) Aucune extrapolation\n3) Si une information critique manque, proposer 2-3 questions courtes\n4) Respect strict de la langue/format\n\n");
    }

    let clarif = if args.clarifications.is_empty() {
        String::new()
    } else {
        let mut s = String::from("Informations complémentaires:\n");
        for qa in &args.clarifications {
            if !qa.answer.trim().is_empty() {
                s.push_str(&format!("- {} {}\n", qa.question, qa.answer));
            }
        }
        s
    };

    let meta_system = format!(
        "{}Tu es une IA experte en ingénierie de prompt.\n\nMission: Générer le MEILLEUR prompt système pour un assistant de chat afin d'atteindre l'objectif utilisateur.\nContraintes: sortie = UNIQUEMENT le prompt système final, clair, structuré, avec règles précises et langue.\nLangue demandée: {}",
        strict, language
    );

    let user_payload = format!(
        "Objectif utilisateur: {}\n{}\nGénère le prompt système final maintenant.",
        args.intent.trim(),
        clarif
    );

    let payload = crate::llama::ChatCompletionRequest {
        model: args.preset_id.clone(),
        messages: vec![
            crate::llama::ChatMessage {
                role: "system".into(),
                content: meta_system,
            },
            crate::llama::ChatMessage {
                role: "user".into(),
                content: user_payload,
            },
        ],
        stream: false,
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 512,
        repeat_penalty: 1.1,
    };

    let server_url = crate::llama::get_server_url();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(format!("{}/v1/chat/completions", server_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to llama-server: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("llama-server returned error: {}", resp.status()));
    }
    let txt = resp.text().await.map_err(|e| e.to_string())?;
    let parsed: ChatResp =
        serde_json::from_str(&txt).map_err(|e| format!("Invalid response: {} | {}", e, txt))?;
    if let Some(first) = parsed.choices.first() {
        Ok(first.message.content.clone())
    } else {
        Err("Empty AI response".into())
    }
}

#[tauri::command]
async fn get_first_installed_preset(app: tauri::AppHandle) -> Result<Option<PackSource>, String> {
    const PACKS_JSON: &str = include_str!("../pack-sources.json");
    let packs: Vec<PackSource> = serde_json::from_str(PACKS_JSON).map_err(|e| e.to_string())?;
    for p in packs {
        let path = models_root_dir(&app)?.join(&p.id).join(&p.filename);
        if path.exists() {
            return Ok(Some(p));
        }
    }
    Ok(None)
}

#[tauri::command]
async fn start_llama_with_preset(
    preset_id: String,
    window: Window,
    app: tauri::AppHandle,
) -> Result<u32, String> {
    const PACKS_JSON: &str = include_str!("../pack-sources.json");
    let packs: Vec<PackSource> = serde_json::from_str(PACKS_JSON).map_err(|e| e.to_string())?;
    let pack = packs
        .into_iter()
        .find(|p| p.id == preset_id)
        .ok_or_else(|| "Unknown preset".to_string())?;
    let model_path = models_root_dir(&app)?.join(&pack.id).join(&pack.filename);
    if !model_path.exists() {
        return Err(format!("Model not found: {}", model_path.display()));
    }
    // Pass absolute path to avoid base-dir ambiguity
    let model_path_str = model_path.to_string_lossy().to_string();
    llama_install::start_server_process(model_path_str, 2048, window, &app)
}

#[tauri::command]
async fn download_llama_server(window: Window, app: tauri::AppHandle) -> Result<String, String> {
    // Download binary
    let zip_path = llama_install::download_server_binary(window.clone()).await?;

    // Extract binary
    let binary_path = llama_install::extract_server_binary(&zip_path, &app)?;

    window.emit("llama-server-status", "installed").ok();

    Ok(binary_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn start_llama_server(
    model_path: String,
    ctx_size: Option<i32>,
    window: Window,
    app: tauri::AppHandle,
) -> Result<u32, String> {
    let context_size = ctx_size.unwrap_or(2048);
    llama_install::start_server_process(model_path, context_size, window, &app)
}

#[tauri::command]
async fn stop_llama_server(window: Window) -> Result<(), String> {
    llama_install::stop_server_process(window)
}

// ============= LOGS & DIAGNOSTICS =============

#[tauri::command]
async fn get_llama_logs() -> Result<Vec<String>, String> {
    Ok(llama_install::get_logs_snapshot())
}

#[tauri::command]
async fn clear_llama_logs() -> Result<(), String> {
    llama_install::clear_logs();
    Ok(())
}

#[derive(Serialize)]
struct ServerDiagnostics {
    status: llama_install::ServerStatus,
    bin_dir: Option<String>,
    env_path_head: Option<String>,
}

#[tauri::command]
async fn get_server_diagnostics(app: AppHandle) -> Result<ServerDiagnostics, String> {
    let status = llama_install::check_server_binary(&app)?;
    let bin_dir = status.path.as_ref().and_then(|p| {
        std::path::Path::new(p)
            .parent()
            .map(|pp| pp.to_string_lossy().to_string())
    });
    let env_path_head = std::env::var("PATH")
        .ok()
        .map(|p| p.chars().take(200).collect());
    Ok(ServerDiagnostics {
        status,
        bin_dir,
        env_path_head,
    })
}
