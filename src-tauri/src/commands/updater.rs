use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateCheckResult {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_title: String,
    pub release_notes: String,
    pub published_at: String,
    pub download_url: Option<String>,
    pub asset_name: Option<String>,
    pub asset_size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressPayload {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f32,
    pub status: String,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
    #[serde(default)]
    size: u64,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
    #[serde(default)]
    assets: Vec<GithubAsset>,
}

fn parse_semver(v: &str) -> Vec<u32> {
    let clean = v.trim_start_matches('v').trim_start_matches('V');
    clean
        .split(|c: char| c == '.' || c == '-' || c == '+')
        .filter_map(|part| part.parse::<u32>().ok())
        .collect()
}

fn is_version_newer(latest: &str, current: &str) -> bool {
    let l_parts = parse_semver(latest);
    let c_parts = parse_semver(current);

    let max_len = l_parts.len().max(c_parts.len());
    for i in 0..max_len {
        let l = l_parts.get(i).copied().unwrap_or(0);
        let c = c_parts.get(i).copied().unwrap_or(0);
        if l > c {
            return true;
        } else if l < c {
            return false;
        }
    }
    false
}

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateCheckResult, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let url = "https://api.github.com/repos/AchiraStudio/kivo/releases/latest";

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let res = client
        .get(url)
        .header("User-Agent", "Kivo-App-Updater")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Koneksi ke GitHub Release gagal: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("GitHub API mengembalikan status: {}", res.status()));
    }

    let release: GithubRelease = res
        .json()
        .await
        .map_err(|e| format!("Gagal memproses data release dari GitHub: {}", e))?;

    let latest_version = release.tag_name.trim_start_matches('v').trim_start_matches('V').to_string();
    let has_update = is_version_newer(&latest_version, &current_version);

    // Look for Windows installer asset (.exe / .msi)
    let best_asset = release.assets.iter().find(|a| {
        let lower = a.name.to_lowercase();
        (lower.ends_with(".exe") || lower.ends_with(".msi"))
            && !lower.contains(".sig")
            && !lower.contains(".sha256")
    });

    let (download_url, asset_name, asset_size) = if let Some(asset) = best_asset {
        (Some(asset.browser_download_url.clone()), Some(asset.name.clone()), asset.size)
    } else {
        (None, None, 0)
    };

    let tag_name = release.tag_name.clone();
    let release_title = release.name.unwrap_or_else(|| tag_name.clone());

    Ok(UpdateCheckResult {
        has_update,
        current_version,
        latest_version: tag_name,
        release_title,
        release_notes: release.body.unwrap_or_default(),
        published_at: release.published_at.unwrap_or_default(),
        download_url,
        asset_name,
        asset_size,
    })
}

#[tauri::command]
pub async fn download_and_install_update(
    download_url: String,
    asset_name: String,
    app: AppHandle,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let mut res = client
        .get(&download_url)
        .header("User-Agent", "Kivo-App-Updater")
        .send()
        .await
        .map_err(|e| format!("Gagal memulai unduhan: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Gagal mengunduh file: HTTP {}", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);
    let temp_dir = std::env::temp_dir();
    let file_path: PathBuf = temp_dir.join(&asset_name);

    let mut file = tokio::fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Gagal membuat file sementara: {}", e))?;

    let mut downloaded: u64 = 0;

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = res.chunk().await.map_err(|e| format!("Gagal membaca data unduhan: {}", e))? {
        downloaded += chunk.len() as u64;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Gagal menulis data ke file: {}", e))?;

        let percentage = if total_size > 0 {
            (downloaded as f32 / total_size as f32) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "updater://progress",
            ProgressPayload {
                downloaded,
                total: total_size,
                percentage,
                status: "downloading".to_string(),
            },
        );
    }

    file.flush().await.map_err(|e| format!("Gagal menyimpan file: {}", e))?;
    drop(file);

    let _ = app.emit(
        "updater://progress",
        ProgressPayload {
            downloaded,
            total: total_size,
            percentage: 100.0,
            status: "ready".to_string(),
        },
    );

    // Launch the downloaded installer
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(&file_path)
            .spawn()
            .map_err(|e| format!("Gagal menjalankan installer: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Gagal membuka installer: {}", e))?;
    }

    // Delay briefly then exit the current process so the installer can update the files
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(1500)).await;
        app_clone.exit(0);
    });

    Ok(format!("Installer {} berhasil dijalankan!", asset_name))
}
