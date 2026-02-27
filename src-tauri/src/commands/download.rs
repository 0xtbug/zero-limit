use std::fs::{self, File};
use std::io::{self, Cursor};
use std::path::PathBuf;
use tauri::{command, AppHandle};
use reqwest;

use crate::error::{CommandError, CommandResult};

#[command]
pub fn find_alternate_proxy_exe(current_exe_path: String, target_version: String) -> CommandResult<Option<String>> {
    let current = PathBuf::from(&current_exe_path);
    let parent = current.parent()
        .ok_or_else(|| CommandError::General("Cannot determine parent directory".to_string()))?;

    let is_target_plus = target_version == "plus";

    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() { continue; }
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_lowercase();
            let normalized = name.replace("-", "");

            if !normalized.starts_with("cliproxy") { continue; }

            #[cfg(windows)]
            if !name.ends_with(".exe") { continue; }
            #[cfg(not(windows))]
            if name.ends_with(".dll") || name.ends_with(".dylib") { continue; }

            if path == current { continue; }

            let has_plus = name.contains("plus");
            if is_target_plus && has_plus {
                return Ok(Some(path.to_string_lossy().to_string()));
            }
            if !is_target_plus && !has_plus {
                return Ok(Some(path.to_string_lossy().to_string()));
            }
        }
    }

    Ok(None)
}

#[command]
pub async fn download_and_extract_proxy(_app: AppHandle, url: String, target_dir: Option<String>) -> CommandResult<String> {
    let proxy_dir = if let Some(ref dir) = target_dir {
        PathBuf::from(dir)
    } else {
        let mut d = dirs::home_dir()
            .ok_or_else(|| CommandError::General("Could not determine user home directory".to_string()))?;
        d.push(".zerolimit");
        d.push("cli_proxy");
        d
    };

    let config_extensions = ["yaml", "yml", "json", "toml", "env"];
    let is_config_file = |name: &str| -> bool {
        let lower = name.to_lowercase();
        config_extensions.iter().any(|ext| lower.ends_with(ext))
    };

    if proxy_dir.exists() {
        if let Ok(entries) = fs::read_dir(&proxy_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() { continue; }
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_lowercase();
                if (name.contains("cliproxy") || name.contains("cli-proxy"))
                    && !is_config_file(&name)
                {
                    let _ = fs::remove_file(&path);
                }
            }
        }
    }
    fs::create_dir_all(&proxy_dir)
        .map_err(|e| CommandError::General(format!("Failed to create proxy dir: {}", e)))?;

    println!("Downloading proxy from: {}", url);

    let client = reqwest::Client::new();
    let response = client.get(&url)
        .header("User-Agent", "CLIProxyAPI")
        .send()
        .await
        .map_err(|e| CommandError::General(format!("Failed to fetch URL: {}", e)))?;

    if !response.status().is_success() {
        return Err(CommandError::General(format!("Received non-success status code: {}", response.status())));
    }

    let bytes = response.bytes().await
        .map_err(|e| CommandError::General(format!("Failed to read response bytes: {}", e)))?;

    println!("Downloaded {} bytes. Extracting...", bytes.len());

    let is_zip = url.to_lowercase().ends_with(".zip");
    let is_tar_gz = url.to_lowercase().ends_with(".tar.gz") || url.to_lowercase().ends_with(".tgz");

    if is_zip {
        let cursor = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| CommandError::General(format!("Failed to read zip archive: {}", e)))?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| CommandError::General(format!("Failed to access zip entry: {}", e)))?;
            let outpath = match file.enclosed_name() {
                Some(path) => proxy_dir.join(path),
                None => continue,
            };

            if (*file.name()).ends_with('/') {
                fs::create_dir_all(&outpath)
                    .map_err(|e| CommandError::General(format!("Failed to create zip dir: {}", e)))?;
            } else {
                let file_name = outpath.file_name().and_then(|n| n.to_str()).unwrap_or_default();
                if is_config_file(file_name) && outpath.exists() {
                    println!("Skipping existing config file: {:?}", outpath);
                    continue;
                }

                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)
                            .map_err(|e| CommandError::General(format!("Failed to create zip parent dir: {}", e)))?;
                    }
                }
                let mut outfile = File::create(&outpath)
                    .map_err(|e| CommandError::General(format!("Failed to create extracted file {:?}: {}", outpath, e)))?;
                io::copy(&mut file, &mut outfile)
                    .map_err(|e| CommandError::General(format!("Failed to write extracted file: {}", e)))?;
            }

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = file.unix_mode() {
                    let permissions = fs::Permissions::from_mode(mode);
                    let _ = fs::set_permissions(&outpath, permissions);
                } else {
                    let file_name = outpath.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if file_name.contains("CLIProxyAPI") || file_name.contains("cliproxy") {
                         let permissions = fs::Permissions::from_mode(0o755);
                         let _ = fs::set_permissions(&outpath, permissions);
                    }
                }
            }
        }
    } else if is_tar_gz {
        let temp_extract = std::env::temp_dir().join("zerolimit_proxy_extract");
        if temp_extract.exists() {
            let _ = fs::remove_dir_all(&temp_extract);
        }
        fs::create_dir_all(&temp_extract)
            .map_err(|e| CommandError::General(format!("Failed to create temp extract dir: {}", e)))?;

        let cursor = Cursor::new(bytes);
        let tar = flate2::read::GzDecoder::new(cursor);
        let mut archive = tar::Archive::new(tar);
        archive.unpack(&temp_extract)
             .map_err(|e| CommandError::General(format!("Failed to unpack tarball: {}", e)))?;

        fn copy_dir_selective(src: &std::path::Path, dst: &std::path::Path, is_config: &dyn Fn(&str) -> bool) -> io::Result<()> {
            if !dst.exists() {
                fs::create_dir_all(dst)?;
            }
            for entry in fs::read_dir(src)? {
                let entry = entry?;
                let src_path = entry.path();
                let file_name = src_path.file_name().and_then(|n| n.to_str()).unwrap_or_default();
                let dst_path = dst.join(file_name);

                if src_path.is_dir() {
                    copy_dir_selective(&src_path, &dst_path, is_config)?;
                } else {
                    if is_config(file_name) && dst_path.exists() {
                        println!("Skipping existing config file: {:?}", dst_path);
                        continue;
                    }
                    fs::copy(&src_path, &dst_path)?;
                }
            }
            Ok(())
        }
        copy_dir_selective(&temp_extract, &proxy_dir, &is_config_file)
            .map_err(|e| CommandError::General(format!("Failed to copy extracted files: {}", e)))?;
        let _ = fs::remove_dir_all(&temp_extract);
    } else {
        return Err(CommandError::General(format!("Unsupported file extension in URL: {}", url)));
    }

    println!("Extraction complete. Looking for executable...");

    let mut exe_path: Option<PathBuf> = None;

    if let Ok(entries) = fs::read_dir(&proxy_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_lowercase();
                if file_name.replace("-", "").starts_with("cliproxy") {
                    #[cfg(windows)]
                    if file_name.ends_with(".exe") {
                        exe_path = Some(path.clone());
                    }
                    #[cfg(not(windows))]
                    if !file_name.ends_with(".exe") && !file_name.ends_with(".dll") && !file_name.ends_with(".dylib") {
                        exe_path = Some(path.clone());
                    }
                } else if file_name == "config.example.yaml" {
                    let mut new_config_path = path.clone();
                    new_config_path.set_file_name("config.yaml");
                    if new_config_path.exists() {
                        println!("Skipping config.example.yaml rename: config.yaml already exists");
                    } else if let Err(e) = fs::rename(&path, &new_config_path) {
                        println!("Notice: Could not rename config.example.yaml: {}", e);
                    } else {
                        println!("Successfully renamed config.example.yaml to config.yaml");
                    }
                }
            }
        }
    }

    if exe_path.is_none() {
        let mut stack = vec![proxy_dir.clone()];
        while let Some(dir) = stack.pop() {
            if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        stack.push(path);
                    } else if path.is_file() {
                        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_lowercase();
                        if file_name.replace("-", "").starts_with("cliproxy") {
                            #[cfg(windows)]
                            if file_name.ends_with(".exe") {
                                exe_path = Some(path.clone());
                            }
                            #[cfg(not(windows))]
                            if !file_name.ends_with(".exe") && !file_name.ends_with(".dll") && !file_name.ends_with(".dylib") {
                                exe_path = Some(path.clone());
                            }
                        } else if file_name == "config.example.yaml" {
                            let mut new_config_path = path.clone();
                            new_config_path.set_file_name("config.yaml");
                            if new_config_path.exists() {
                                println!("Skipping config.example.yaml rename: config.yaml already exists");
                            } else if let Err(e) = fs::rename(&path, &new_config_path) {
                                println!("Notice: Could not rename config.example.yaml: {}", e);
                            } else {
                                println!("Successfully renamed config.example.yaml to config.yaml");
                            }
                        }
                    }
                }
            }
            if exe_path.is_some() { break; }
        }
    }

    match exe_path {
        Some(path) => {
            let path_str = path.to_string_lossy().to_string();
            println!("Found executable at: {}", path_str);

            #[cfg(unix)]
            {
               use std::os::unix::fs::PermissionsExt;
               let permissions = fs::Permissions::from_mode(0o755);
               let _ = fs::set_permissions(&path, permissions);
            }

            Ok(path_str)
        },
        None => Err(CommandError::General("Could not locate CLIProxyAPI executable after extraction.".to_string()))
    }
}
