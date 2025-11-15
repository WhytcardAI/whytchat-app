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
pub struct IngestFolderArgs { pub dataset_id: String, pub folder_path: String }

#[derive(Deserialize)]
pub struct IngestUrlArgs { pub dataset_id: String, pub url: String }

#[derive(Deserialize)]
pub struct ScrapeUrlArgs { pub dataset_id: String, pub base_url: String, pub max_depth: Option<usize> }

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
            // PDF extraction using pdf-extract
            extract_pdf_text(path)
        },
        "html" | "htm" => {
            // HTML parsing with scraper
            let html = fs::read_to_string(path).map_err(|e| format!("read html: {}", e))?;
            extract_html_text(&html)
        },
        "docx" => {
            // DOCX extraction using docx-rs
            extract_docx_text(path)
        },
        _ => {
            // Try as plain text
            fs::read_to_string(path)
                .map_err(|_| format!("Unsupported file format: .{}", ext))
        }
    }
}

// Extract text from PDF
fn extract_pdf_text(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("read pdf: {}", e))?;
    let out = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| format!("extract pdf text: {}", e))?;
    Ok(out)
}

// Extract text from DOCX
fn extract_docx_text(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| format!("open docx: {}", e))?;
    let docx = docx_rs::read_docx(&file).map_err(|e| format!("parse docx: {}", e))?;

    let mut text = String::new();
    for child in &docx.document.children {
        extract_docx_node(child, &mut text);
    }

    Ok(text)
}

// Recursive helper to extract text from DOCX nodes
fn extract_docx_node(node: &docx_rs::DocumentChild, text: &mut String) {
    use docx_rs::DocumentChild;
    match node {
        DocumentChild::Paragraph(p) => {
            for child in &p.children {
                if let docx_rs::ParagraphChild::Run(run) = child {
                    for run_child in &run.children {
                        if let docx_rs::RunChild::Text(t) = run_child {
                            text.push_str(&t.text);
                            text.push(' ');
                        }
                    }
                }
            }
            text.push('\n');
        }
        DocumentChild::Table(table) => {
            for row in &table.rows {
                for cell in &row.cells {
                    for cell_child in &cell.children {
                        extract_docx_node(cell_child, text);
                    }
                }
            }
        }
        _ => {}
    }
}

// Extract text from HTML using scraper
fn extract_html_text(html: &str) -> Result<String, String> {
    use scraper::{Html, Selector};

    let document = Html::parse_document(html);

    // Remove script and style tags content
    let script_selector = Selector::parse("script, style").unwrap();
    let mut clean_html = html.to_string();
    for element in document.select(&script_selector) {
        if let Some(html) = element.html().get(..) {
            clean_html = clean_html.replace(html, "");
        }
    }

    // Parse cleaned HTML
    let document = Html::parse_document(&clean_html);

    // Extract text from common content tags
    let text_selector = Selector::parse("p, h1, h2, h3, h4, h5, h6, li, td, th, span, div, a, article, section").unwrap();

    let mut text = String::new();
    for element in document.select(&text_selector) {
        let element_text = element.text().collect::<Vec<_>>().join(" ");
        if !element_text.trim().is_empty() {
            text.push_str(&element_text);
            text.push('\n');
        }
    }

    // Fallback: if no text found, use simple tag stripping
    if text.trim().is_empty() {
        let re = regex::Regex::new(r"<[^>]*>").map_err(|e| e.to_string())?;
        text = re.replace_all(html, " ").to_string();
    }

    Ok(text)
}

// Helper: Fetch and extract text from URL with scraping
async fn extract_text_from_url(url: &str) -> Result<String, String> {
    use scraper::{Html, Selector};

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
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

    if content_type.contains("text/html") || body.trim_start().starts_with("<!DOCTYPE") || body.trim_start().starts_with("<html") {
        // HTML scraping with advanced extraction
        extract_html_text(&body)
    } else {
        // Plain text or other
        Ok(body)
    }
}

// Helper: Scrape multiple URLs from a page (find links)
async fn scrape_links_from_url(base_url: &str) -> Result<Vec<String>, String> {
    use scraper::{Html, Selector};

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(base_url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("HTTP error: {}", resp.status()));
    }

    let body = resp.text().await.map_err(|e| e.to_string())?;
    let document = Html::parse_document(&body);
    let link_selector = Selector::parse("a[href]").unwrap();

    let base = url::Url::parse(base_url).map_err(|e| format!("invalid base url: {}", e))?;

    let mut links = Vec::new();
    for element in document.select(&link_selector) {
        if let Some(href) = element.value().attr("href") {
            // Convert relative URLs to absolute
            if let Ok(absolute_url) = base.join(href) {
                let url_str = absolute_url.to_string();
                // Only include HTTP(S) links
                if url_str.starts_with("http://") || url_str.starts_with("https://") {
                    links.push(url_str);
                }
            }
        }
    }

    // Deduplicate
    links.sort();
    links.dedup();

    Ok(links)
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

// Ingest entire folder (all supported files recursively)
#[tauri::command]
pub async fn rag_ingest_folder(args: IngestFolderArgs) -> Result<IngestResult, String> {
    let folder = Path::new(&args.folder_path);

    if !folder.exists() || !folder.is_dir() {
        return Err("Folder does not exist or is not a directory".into());
    }

    let mut all_text = String::new();
    let mut file_count = 0;

    // Recursively walk directory
    fn walk_dir(dir: &Path, all_text: &mut String, file_count: &mut usize) -> Result<(), String> {
        let entries = fs::read_dir(dir).map_err(|e| format!("read dir: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("dir entry: {}", e))?;
            let path = entry.path();

            if path.is_dir() {
                // Recurse into subdirectory
                walk_dir(&path, all_text, file_count)?;
            } else if path.is_file() {
                // Try to extract text from file
                let ext = path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                // Only process supported formats
                match ext.as_str() {
                    "txt" | "md" | "json" | "csv" | "log" | "pdf" | "html" | "htm" | "docx" => {
                        // Use async extraction but block on it (we're in sync context)
                        match tokio::task::block_in_place(|| {
                            tokio::runtime::Handle::current().block_on(async {
                                extract_text_from_file(&path).await
                            })
                        }) {
                            Ok(text) => {
                                if !text.trim().is_empty() {
                                    all_text.push_str(&format!("\n=== File: {} ===\n", path.display()));
                                    all_text.push_str(&text);
                                    all_text.push_str("\n\n");
                                    *file_count += 1;
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to extract {}: {}", path.display(), e);
                            }
                        }
                    }
                    _ => {
                        // Skip unsupported files silently
                    }
                }
            }
        }

        Ok(())
    }

    walk_dir(folder, &mut all_text, &mut file_count)?;

    if all_text.is_empty() {
        return Err("No supported files found in folder".into());
    }

    // Ingest all collected text
    let result = rag_ingest_text(IngestTextArgs {
        dataset_id: args.dataset_id,
        text: all_text,
    }).await?;

    Ok(IngestResult {
        chunks: result.chunks,
    })
}

// Scrape URL and follow links up to max_depth
#[tauri::command]
pub async fn rag_scrape_url(args: ScrapeUrlArgs) -> Result<IngestResult, String> {
    let max_depth = args.max_depth.unwrap_or(1).min(3); // Limit to 3 levels max for safety

    let mut visited = std::collections::HashSet::new();
    let mut to_visit = vec![(args.base_url.clone(), 0)];
    let mut all_text = String::new();

    while let Some((url, depth)) = to_visit.pop() {
        if depth > max_depth || visited.contains(&url) {
            continue;
        }

        visited.insert(url.clone());

        eprintln!("[RAG Scrape] Visiting {} (depth {})", url, depth);

        // Extract text from current URL
        match extract_text_from_url(&url).await {
            Ok(text) => {
                if !text.trim().is_empty() {
                    all_text.push_str(&format!("\n=== URL: {} ===\n", url));
                    all_text.push_str(&text);
                    all_text.push_str("\n\n");
                }
            }
            Err(e) => {
                eprintln!("[RAG Scrape] Failed to extract {}: {}", url, e);
                continue;
            }
        }

        // If not at max depth, find and queue links
        if depth < max_depth {
            match scrape_links_from_url(&url).await {
                Ok(links) => {
                    for link in links {
                        // Only follow links from same domain
                        if let (Ok(base), Ok(link_url)) = (url::Url::parse(&args.base_url), url::Url::parse(&link)) {
                            if base.host_str() == link_url.host_str() && !visited.contains(&link) {
                                to_visit.push((link, depth + 1));
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[RAG Scrape] Failed to scrape links from {}: {}", url, e);
                }
            }
        }
    }

    if all_text.is_empty() {
        return Err("No content extracted from URLs".into());
    }

    // Ingest all scraped text
    let result = rag_ingest_text(IngestTextArgs {
        dataset_id: args.dataset_id,
        text: all_text,
    }).await?;

    Ok(IngestResult {
        chunks: result.chunks,
    })
}
