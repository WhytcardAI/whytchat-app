fn main() {
  ensure_icon();
  tauri_build::build()
}

fn ensure_icon() {
  use std::{env, fs, path::PathBuf, io::Write};

  let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".into());
  let icons_dir = PathBuf::from(&manifest_dir).join("icons");
  let icon_path = icons_dir.join("icon.ico");
  if icon_path.exists() { return; }

  let _ = fs::create_dir_all(&icons_dir);

  let mut data = vec![0u8; 64 * 64 * 4];
  for px in data.chunks_mut(4) { px.copy_from_slice(&[30, 144, 255, 255]); }

  let image = ico::IconImage::from_rgba_data(64, 64, data);
  let mut icon_dir = ico::IconDir::new(ico::ResourceType::Icon);
  icon_dir.add_entry(ico::IconDirEntry::encode(&image).expect("encode icon"));

  let mut file = fs::File::create(&icon_path).expect("create icon.ico");
  icon_dir.write(&mut file).expect("write icon.ico");
  let _ = file.flush();
}
