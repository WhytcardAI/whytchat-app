use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    pub temperature: f32,
    pub top_p: f32,
    pub max_tokens: i32,
    pub repeat_penalty: f32,
}

#[derive(Debug, Deserialize)]
pub struct SSEChunk {
    pub choices: Vec<SSEChoice>,
}

#[derive(Debug, Deserialize)]
pub struct SSEChoice {
    pub delta: SSEDelta,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SSEDelta {
    pub content: Option<String>,
}

/// Get llama-server URL from environment or default
pub fn get_server_url() -> String {
    if let Ok(url) = std::env::var("LLAMA_SERVER_URL") {
        return url;
    }
    let port = std::env::var("LLAMA_SERVER_PORT")
        .ok()
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(8080);
    format!("http://localhost:{}", port)
}
