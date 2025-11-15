use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RagHit { pub text: String, pub score: f32 }

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

fn chunks_json_path(id: &str) -> Result<PathBuf, String> { let mut p = dataset_dir(id)?; p.push("chunks.json"); Ok(p) }
fn embeds_json_path(id: &str) -> Result<PathBuf, String> { let mut p = dataset_dir(id)?; p.push("embeddings.json"); Ok(p) }

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Chunk { text: String }

#[tauri::command]
pub async fn rag_list_datasets() -> Result<Vec<DatasetInfo>, String> { load_registry() }

#[tauri::command]
pub async fn rag_create_dataset(name: String) -> Result<DatasetInfo, String> {
    let mut list = load_registry()?;
    // ID = ds_<epoch_ms>
    let epoch = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    let id = format!("ds_{}", epoch);
    let now = now_iso();
    let info = DatasetInfo { id: id.clone(), name, created_at: now.clone(), updated_at: now.clone() };
    // create folder & empty files
    let _ = dataset_dir(&info.id)?;
    fs::write(chunks_json_path(&info.id)?, "[]").map_err(|e| e.to_string())?;
    fs::write(embeds_json_path(&info.id)?, "[]").map_err(|e| e.to_string())?;
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

#[derive(Deserialize)]
pub struct IngestFileArgs { pub dataset_id: String, pub file_path: String }

#[derive(Deserialize)]
pub struct IngestUrlArgs { pub dataset_id: String, pub url: String }

// Helper: Extract text from various file formats
async fn extract_text_from_file(path: &Path) -> Result<String, String> {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    match ext.as_str() {
        "txt" | "md" | "json" | "csv" | "log" => {
            // Plain text files
            fs::read_to_string(path).map_err(|e| format!("read text file: {}", e))
        },
        "pdf" => {
            // PDF extraction (requires pdf-extract crate)
            Err("PDF support coming soon - add pdf-extract implementation".into())
        },
        "html" | "htm" => {
            // HTML parsing (requires scraper crate)
            let html = fs::read_to_string(path).map_err(|e| format!("read html: {}", e))?;
            // Basic HTML tag stripping (improve with scraper crate)
            let re = regex::Regex::new(r"<[^>]*>").map_err(|e| e.to_string())?;
            Ok(re.replace_all(&html, " ").to_string())
        },
        "docx" => {
            Err("DOCX support coming soon - add docx parser implementation".into())
        },
        _ => {
            // Try as plain text
            fs::read_to_string(path)
                .map_err(|_| format!("Unsupported file format: .{}", ext))
        }
    }
}

// Helper: Fetch and extract text from URL
async fn extract_text_from_url(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    
    if !resp.status().is_success() {
        return Err(format!("HTTP error: {}", resp.status()));
    }
    
    let content_type = resp.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    
    let body = resp.text().await.map_err(|e| e.to_string())?;
    
    if content_type.contains("text/html") {
        // Basic HTML tag stripping (improve with scraper crate)
        let re = regex::Regex::new(r"<[^>]*>").map_err(|e| e.to_string())?;
        Ok(re.replace_all(&body, " ").to_string())
    } else {
        // Plain text or other
        Ok(body)
    }
}

#[tauri::command]
pub async fn rag_ingest_text(args: IngestTextArgs) -> Result<IngestResult, String> {
    // naive chunking by char length ~ 1200 with 200 overlap
    let max = 1200usize; let overlap = 200usize;
    let mut chunks: Vec<Chunk> = vec![];
    let mut i = 0;
    let t = args.text.replace("\r\n", "\n");
    let chars: Vec<char> = t.chars().collect();
    while i < chars.len() {
        let end = usize::min(i + max, chars.len());
        let s: String = chars[i..end].iter().collect();
        chunks.push(Chunk { text: s });
        if end == chars.len() { break; }
        i = end.saturating_sub(overlap);
    }

    // call embeddings endpoint
    #[derive(Serialize)]
    struct EmbReq<'a> { model: &'a str, input: Vec<&'a str> }
    #[derive(Deserialize)]
    struct EmbResp { data: Vec<EmbObj> }
    #[derive(Serialize, Deserialize)]
    struct EmbObj { embedding: Vec<f32> }

    let server = crate::llama::get_server_url();
    let model = "nomic-embed-text"; // default embedding model name (user can change later)
    let inputs: Vec<&str> = chunks.iter().map(|c| c.text.as_str()).collect();
    let client = reqwest::ClientBuilder::new()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(format!("{}/v1/embeddings", server))
        .json(&EmbReq { model, input: inputs })
        .send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(format!("embeddings error: {} - body: {}", status, body));
    }
    let payload: EmbResp = resp.json().await.map_err(|e| e.to_string())?;
    if payload.data.len() != chunks.len() { return Err("embeddings size mismatch".into()); }

    // persist
    let cpath = chunks_json_path(&args.dataset_id)?;
    let epath = embeds_json_path(&args.dataset_id)?;
    let cjson = serde_json::to_string_pretty(&chunks).map_err(|e| e.to_string())?;
    fs::write(cpath, cjson).map_err(|e| e.to_string())?;
    let ejson = serde_json::to_string_pretty(&payload.data).map_err(|e| e.to_string())?;
    fs::write(epath, ejson).map_err(|e| e.to_string())?;

    Ok(IngestResult { chunks: chunks.len() })
}

#[tauri::command]
pub async fn rag_ingest_file(args: IngestFileArgs) -> Result<IngestResult, String> {
    // Extract text from file
    let path = Path::new(&args.file_path);
    let text = extract_text_from_file(path).await?;
    
    // Reuse text ingestion logic
    rag_ingest_text(IngestTextArgs {
        dataset_id: args.dataset_id,
        text,
    }).await
}

#[tauri::command]
pub async fn rag_ingest_url(args: IngestUrlArgs) -> Result<IngestResult, String> {
    // Fetch and extract text from URL
    let text = extract_text_from_url(&args.url).await?;
    
    // Reuse text ingestion logic
    rag_ingest_text(IngestTextArgs {
        dataset_id: args.dataset_id,
        text,
    }).await
}

#[derive(Deserialize)]
pub struct RagQueryArgs { pub dataset_id: String, pub query: String, pub k: usize }

#[tauri::command]
pub async fn rag_query(args: RagQueryArgs) -> Result<Vec<RagHit>, String> {
    // load chunks + embeddings
    let cpath = chunks_json_path(&args.dataset_id)?;
    let epath = embeds_json_path(&args.dataset_id)?;
    if !cpath.exists() || !epath.exists() { return Ok(vec![]); }
    let chunks: Vec<Chunk> = serde_json::from_str(&fs::read_to_string(&cpath).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    #[derive(Deserialize)] struct EmbObj { embedding: Vec<f32> }
    let embeds: Vec<EmbObj> = serde_json::from_str(&fs::read_to_string(&epath).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    if embeds.is_empty() { return Ok(vec![]); }

    // embed query
    #[derive(Serialize)] struct EmbReq<'a> { model: &'a str, input: Vec<&'a str> }
    #[derive(Deserialize)] struct EmbResp { data: Vec<EmbRespObj> }
    #[derive(Deserialize)] struct EmbRespObj { embedding: Vec<f32> }
    let server = crate::llama::get_server_url();
    let model = "nomic-embed-text";
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/v1/embeddings", server))
        .json(&EmbReq { model, input: vec![args.query.as_str()] })
        .send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Err(format!("embeddings error: {}", resp.status())); }
    let qemb: Vec<f32> = resp.json::<EmbResp>().await.map_err(|e| e.to_string())?.data.into_iter().next().ok_or("no embedding")?.embedding;

    // cosine similarity brute-force
    fn cosine(a: &[f32], b: &[f32]) -> f32 {
        let mut dot = 0f32; let mut na = 0f32; let mut nb = 0f32;
        let n = a.len().min(b.len());
        for i in 0..n { let (x,y) = (a[i], b[i]); dot += x*y; na += x*x; nb += y*y; }
        if na == 0f32 || nb == 0f32 { 0.0 } else { dot / (na.sqrt()*nb.sqrt()) }
    }

    let mut pairs: Vec<(usize, f32)> = embeds
        .iter()
        .enumerate()
        .map(|(i, e)| (i, cosine(&qemb, &e.embedding)))
        .filter(|(_, score)| !score.is_nan())
        .collect();
    pairs.sort_by(|a,b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let topk = pairs.into_iter().take(args.k).map(|(i, score)| RagHit { text: chunks[i].text.clone(), score }).collect();
    Ok(topk)
}
