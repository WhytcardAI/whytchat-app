use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Group {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: i64,
    pub name: String,
    pub group_id: Option<i64>,
    pub group_name: Option<String>,
    pub preset_id: String,
    pub system_prompt: Option<String>,
    pub temperature: f32,
    pub top_p: f32,
    pub max_tokens: i32,
    pub repeat_penalty: f32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: i64,
    pub conversation_id: i64,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

pub fn get_db_path(_app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Store DB inside the application folder for portability
    let mut base = app_base_dir()?;
    base.push("data");
    std::fs::create_dir_all(&base).map_err(|e| format!("Failed to create data dir: {}", e))?;
    base.push("whytchat.db");
    Ok(base)
}

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection> {
    let path = get_db_path(app_handle).map_err(|e| rusqlite::Error::InvalidPath(e.to_string().into()))?;
    let conn = Connection::open(path)?;
    
    // CRITICAL: Enable foreign keys (disabled by default in SQLite!)
    // RECOMMENDED: Enable WAL mode for better concurrency
    // OPTIONAL: Normal synchronous for better performance with WAL
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;"
    )?;
    
    // Create tables
    conn.execute(
        "CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            group_id INTEGER,
            preset_id TEXT NOT NULL,
            system_prompt TEXT,
            temperature REAL NOT NULL DEFAULT 0.7,
            top_p REAL NOT NULL DEFAULT 0.9,
            max_tokens INTEGER NOT NULL DEFAULT 2048,
            repeat_penalty REAL NOT NULL DEFAULT 1.1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversations_group_id ON conversations(group_id)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)",
        [],
    )?;
    
    Ok(conn)
}

pub fn list_groups(conn: &Connection) -> Result<Vec<Group>> {
    let mut stmt = conn.prepare("SELECT id, name, created_at FROM groups ORDER BY name")?;
    let groups = stmt.query_map([], |row| {
        Ok(Group {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;
    Ok(groups)
}

pub fn create_group(conn: &Connection, name: &str) -> Result<i64> {
    conn.execute("INSERT INTO groups (name) VALUES (?1)", [name])?;
    Ok(conn.last_insert_rowid())
}

pub fn list_conversations(conn: &Connection) -> Result<Vec<Conversation>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.group_id, g.name as group_name, c.preset_id, 
                c.system_prompt, c.temperature, c.top_p, c.max_tokens, c.repeat_penalty,
                c.created_at, c.updated_at
         FROM conversations c
         LEFT JOIN groups g ON c.group_id = g.id
         ORDER BY c.updated_at DESC"
    )?;
    
    let conversations = stmt.query_map([], |row| {
        Ok(Conversation {
            id: row.get(0)?,
            name: row.get(1)?,
            group_id: row.get(2)?,
            group_name: row.get(3)?,
            preset_id: row.get(4)?,
            system_prompt: row.get(5)?,
            temperature: row.get(6)?,
            top_p: row.get(7)?,
            max_tokens: row.get(8)?,
            repeat_penalty: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;
    Ok(conversations)
}

#[derive(Debug)]
pub struct ConversationParams {
    pub name: String,
    pub group_id: Option<i64>,
    pub preset_id: String,
    pub system_prompt: Option<String>,
    pub temperature: f32,
    pub top_p: f32,
    pub max_tokens: i32,
    pub repeat_penalty: f32,
}

pub fn get_conversation(conn: &Connection, id: i64) -> Result<Conversation> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.group_id, g.name as group_name, c.preset_id, 
                c.system_prompt, c.temperature, c.top_p, c.max_tokens, c.repeat_penalty,
                c.created_at, c.updated_at
         FROM conversations c
         LEFT JOIN groups g ON c.group_id = g.id
         WHERE c.id = ?1"
    )?;
    
    stmt.query_row([id], |row| {
        Ok(Conversation {
            id: row.get(0)?,
            name: row.get(1)?,
            group_id: row.get(2)?,
            group_name: row.get(3)?,
            preset_id: row.get(4)?,
            system_prompt: row.get(5)?,
            temperature: row.get(6)?,
            top_p: row.get(7)?,
            max_tokens: row.get(8)?,
            repeat_penalty: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })
}

pub fn create_conversation(
    conn: &Connection,
    params: ConversationParams,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO conversations (name, group_id, preset_id, system_prompt, temperature, top_p, max_tokens, repeat_penalty)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![params.name, params.group_id, params.preset_id, params.system_prompt, params.temperature, params.top_p, params.max_tokens, params.repeat_penalty],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn list_messages(conn: &Connection, conversation_id: i64) -> Result<Vec<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, role, content, created_at 
         FROM messages 
         WHERE conversation_id = ?1 
         ORDER BY created_at ASC"
    )?;
    
    let messages = stmt.query_map([conversation_id], |row| {
        Ok(Message {
            id: row.get(0)?,
            conversation_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;
    Ok(messages)
}

pub fn add_message(
    conn: &mut Connection,
    conversation_id: i64,
    role: &str,
    content: &str,
) -> Result<i64> {
    // Use explicit transaction for atomicity
    let tx = conn.transaction()?;
    
    tx.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?1, ?2, ?3)",
        rusqlite::params![conversation_id, role, content],
    )?;
    
    let message_id = tx.last_insert_rowid();
    
    // Update conversation timestamp in same transaction
    tx.execute(
        "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?1",
        [conversation_id],
    )?;
    
    tx.commit()?;
    
    Ok(message_id)
}

pub fn delete_conversation(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM conversations WHERE id = ?1", [id])?;
    Ok(())
}
