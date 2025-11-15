use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

// Basic dataset types exposed to the frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DatasetInfo {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IngestResult { pub chunks: usize }



fn app_base_dir() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        let src_tauri = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        Ok(src_tauri.parent().ok_or("src-tauri has no parent")?.to_path_buf())
    } else {
        Ok(std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?
            .parent()
            .ok_or("No parent directory for exe")?
            .to_path_buf())
    }
}

fn rag_root() -> Result<PathBuf, String> {
    let mut base = app_base_dir()?;
    base.push("data");
    base.push("rag");
    fs::create_dir_all(&base).map_err(|e| format!("create rag dir: {}", e))?;
    Ok(base)
}

fn registry_path() -> Result<PathBuf, String> {
    let mut p = rag_root()?;
    p.push("datasets.json");
    Ok(p)
}

fn now_iso() -> String {
    // simple ISO-like timestamp
    chrono::Utc::now().to_rfc3339()
}

fn load_registry() -> Result<Vec<DatasetInfo>, String> {
    let p = registry_path()?;
    if !p.exists() { return Ok(vec![]); }
    let txt = fs::read_to_string(&p).map_err(|e| e.to_string())?;
    if txt.trim().is_empty() { return Ok(vec![]); }
    serde_json::from_str(&txt).map_err(|e| e.to_string())
}

fn save_registry(list: &[DatasetInfo]) -> Result<(), String> {
    let p = registry_path()?;
    let txt = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
    fs::write(p, txt).map_err(|e| e.to_string())
}

fn dataset_dir(id: &str) -> Result<PathBuf, String> {
    let mut d = rag_root()?;
    d.push(id);
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

fn chunks_json_path(id: &str) -> Result<PathBuf, String> {
    let mut p = dataset_dir(id)?;
    p.push("chunks.json");
    Ok(p)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Chunk { text: String }

#[tauri::command]
pub async fn rag_list_datasets() -> Result<Vec<DatasetInfo>, String> { load_registry() }

#[tauri::command]
pub async fn rag_create_dataset(name: String) -> Result<DatasetInfo, String> {
    let mut list = load_registry()?;
    // ID = ds_<epoch_ms>
    let epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let id = format!("ds_{}", epoch);
    let now = now_iso();
    let info = DatasetInfo {
        id: id.clone(),
        name,
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    // create folder & empty chunks file
    let _ = dataset_dir(&info.id)?;
    fs::write(chunks_json_path(&info.id)?, "[]").map_err(|e| e.to_string())?;
    list.push(info.clone());
    save_registry(&list)?;
    Ok(info)
}

#[tauri::command]
pub async fn rag_delete_dataset(id: String) -> Result<(), String> {
    let mut list = load_registry()?;
    list.retain(|d| d.id != id);
    save_registry(&list)?;
    let dir = dataset_dir(&id)?;
    fs::remove_dir_all(dir).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct IngestTextArgs { pub dataset_id: String, pub text: String }



#[tauri::command]
pub async fn rag_ingest_text(args: IngestTextArgs) -> Result<IngestResult, String> {
    // naive chunking by char length ~ 1200 with 200 overlap
    let max = 1200usize;
    let overlap = 200usize;
    let mut chunks: Vec<Chunk> = vec![];
    let mut i = 0;
    let t = args.text.replace("\r\n", "\n");
    let chars: Vec<char> = t.chars().collect();
    
    while i < chars.len() {
        let end = usize::min(i + max, chars.len());
        let s: String = chars[i..end].iter().collect();
        chunks.push(Chunk { text: s });
        if end == chars.len() {
            break;
        }
        i = end.saturating_sub(overlap);
    }

    // Persist chunks only (no embeddings)
    let cpath = chunks_json_path(&args.dataset_id)?;
    let cjson = serde_json::to_string_pretty(&chunks).map_err(|e| e.to_string())?;
    fs::write(cpath, cjson).map_err(|e| e.to_string())?;

    Ok(IngestResult {
        chunks: chunks.len(),
    })
}


