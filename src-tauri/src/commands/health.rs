use crate::AppState;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use tauri::State;
use uuid::Uuid;

// ── Records ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct HealthMedicine {
    pub id: String,
    pub record_id: String,
    pub item_id: Option<String>,
    pub name: String,
    pub qty: f64,
    pub unit: Option<String>,
    pub price: f64,
    pub instructions: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct HealthRecordRow {
    pub id: String,
    pub customer_id: String,
    pub checked_at: String,
    pub blood_sugar: Option<f64>,
    pub blood_sugar_context: Option<String>,
    pub cholesterol_total: Option<f64>,
    pub cholesterol_hdl: Option<f64>,
    pub cholesterol_ldl: Option<f64>,
    pub triglycerides: Option<f64>,
    pub uric_acid: Option<f64>,
    pub systolic: Option<i64>,
    pub diastolic: Option<i64>,
    pub weight: Option<f64>,
    pub height: Option<f64>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct HealthRecord {
    #[serde(flatten)]
    pub record: HealthRecordRow,
    pub medicines: Vec<HealthMedicine>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MedicineInput {
    pub item_id: Option<String>,
    pub name: String,
    pub qty: f64,
    pub unit: Option<String>,
    pub price: f64,
    pub instructions: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct HealthRecordInput {
    pub id: Option<String>,
    pub customer_id: String,
    pub checked_at: Option<String>,
    pub blood_sugar: Option<f64>,
    pub blood_sugar_context: Option<String>,
    pub cholesterol_total: Option<f64>,
    pub cholesterol_hdl: Option<f64>,
    pub cholesterol_ldl: Option<f64>,
    pub triglycerides: Option<f64>,
    pub uric_acid: Option<f64>,
    pub systolic: Option<i64>,
    pub diastolic: Option<i64>,
    pub weight: Option<f64>,
    pub height: Option<f64>,
    pub notes: Option<String>,
    #[serde(default)]
    pub medicines: Vec<MedicineInput>,
}

fn clean(s: &Option<String>) -> Option<String> {
    s.as_ref().map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn check_measure(label: &str, v: Option<f64>, max: f64) -> Result<(), String> {
    if let Some(n) = v {
        if !n.is_finite() || n < 0.0 || n > max {
            return Err(format!("Nilai {} tidak valid.", label));
        }
    }
    Ok(())
}

fn validate_medicines(meds: &[MedicineInput]) -> Result<(), String> {
    for m in meds {
        if m.name.trim().is_empty() {
            return Err("Nama obat wajib diisi.".to_string());
        }
        if !m.qty.is_finite() || m.qty <= 0.0 {
            return Err(format!("Jumlah obat \"{}\" harus lebih dari 0.", m.name.trim()));
        }
        if !m.price.is_finite() || m.price < 0.0 {
            return Err(format!("Harga obat \"{}\" tidak valid.", m.name.trim()));
        }
    }
    Ok(())
}

pub async fn get_health_records_pool(pool: &SqlitePool, customer_id: &str) -> Result<Vec<HealthRecord>, String> {
    let rows = sqlx::query_as::<_, HealthRecordRow>(
        "SELECT * FROM health_records WHERE customer_id = ? ORDER BY checked_at DESC, created_at DESC",
    )
    .bind(customer_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let meds = sqlx::query_as::<_, HealthMedicine>(
        "SELECT m.* FROM health_record_medicines m
         JOIN health_records r ON r.id = m.record_id
         WHERE r.customer_id = ? ORDER BY m.rowid ASC",
    )
    .bind(customer_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|record| {
            let medicines = meds.iter().filter(|m| m.record_id == record.id).cloned().collect();
            HealthRecord { record, medicines }
        })
        .collect())
}

pub async fn save_health_record_pool(pool: &SqlitePool, input: HealthRecordInput) -> Result<HealthRecord, String> {
    check_measure("gula darah", input.blood_sugar, 2000.0)?;
    check_measure("kolesterol total", input.cholesterol_total, 1500.0)?;
    check_measure("HDL", input.cholesterol_hdl, 500.0)?;
    check_measure("LDL", input.cholesterol_ldl, 1500.0)?;
    check_measure("trigliserida", input.triglycerides, 5000.0)?;
    check_measure("asam urat", input.uric_acid, 50.0)?;
    check_measure("berat badan", input.weight, 500.0)?;
    check_measure("tinggi badan", input.height, 300.0)?;
    check_measure("sistolik", input.systolic.map(|v| v as f64), 400.0)?;
    check_measure("diastolik", input.diastolic.map(|v| v as f64), 300.0)?;
    if input.systolic.is_some() != input.diastolic.is_some() {
        return Err("Tekanan darah harus diisi sistolik dan diastolik.".to_string());
    }
    validate_medicines(&input.medicines)?;

    let has_measure = input.blood_sugar.is_some()
        || input.cholesterol_total.is_some()
        || input.cholesterol_hdl.is_some()
        || input.cholesterol_ldl.is_some()
        || input.triglycerides.is_some()
        || input.uric_acid.is_some()
        || input.systolic.is_some()
        || input.weight.is_some()
        || input.height.is_some();
    if !has_measure && input.medicines.is_empty() {
        return Err("Isi minimal satu hasil pemeriksaan atau satu obat.".to_string());
    }

    let customer_exists: Option<i64> = sqlx::query_scalar("SELECT 1 FROM customers WHERE id = ?")
        .bind(&input.customer_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;
    if customer_exists.is_none() {
        return Err("Pelanggan tidak ditemukan.".to_string());
    }

    let id = input.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let checked_at = clean(&input.checked_at);
    let context = clean(&input.blood_sugar_context);
    let notes = clean(&input.notes);

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    if input.id.is_some() {
        let res = sqlx::query(
            "UPDATE health_records SET checked_at = COALESCE(?, checked_at), blood_sugar = ?, blood_sugar_context = ?,
                cholesterol_total = ?, cholesterol_hdl = ?, cholesterol_ldl = ?, triglycerides = ?, uric_acid = ?,
                systolic = ?, diastolic = ?, weight = ?, height = ?, notes = ?, updated_at = datetime('now')
             WHERE id = ? AND customer_id = ?",
        )
        .bind(&checked_at).bind(input.blood_sugar).bind(&context)
        .bind(input.cholesterol_total).bind(input.cholesterol_hdl).bind(input.cholesterol_ldl)
        .bind(input.triglycerides).bind(input.uric_acid)
        .bind(input.systolic).bind(input.diastolic).bind(input.weight).bind(input.height)
        .bind(&notes).bind(&id).bind(&input.customer_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        if res.rows_affected() == 0 {
            return Err("Catatan kesehatan tidak ditemukan.".to_string());
        }
        sqlx::query("DELETE FROM health_record_medicines WHERE record_id = ?")
            .bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        sqlx::query(
            "INSERT INTO health_records (id, customer_id, checked_at, blood_sugar, blood_sugar_context,
                cholesterol_total, cholesterol_hdl, cholesterol_ldl, triglycerides, uric_acid,
                systolic, diastolic, weight, height, notes)
             VALUES (?, ?, COALESCE(?, datetime('now')), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id).bind(&input.customer_id).bind(&checked_at)
        .bind(input.blood_sugar).bind(&context)
        .bind(input.cholesterol_total).bind(input.cholesterol_hdl).bind(input.cholesterol_ldl)
        .bind(input.triglycerides).bind(input.uric_acid)
        .bind(input.systolic).bind(input.diastolic).bind(input.weight).bind(input.height)
        .bind(&notes)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    for m in &input.medicines {
        sqlx::query(
            "INSERT INTO health_record_medicines (id, record_id, item_id, name, qty, unit, price, instructions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string()).bind(&id).bind(clean(&m.item_id))
        .bind(m.name.trim()).bind(m.qty).bind(clean(&m.unit)).bind(m.price).bind(clean(&m.instructions))
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    get_health_records_pool(pool, &input.customer_id)
        .await?
        .into_iter()
        .find(|r| r.record.id == id)
        .ok_or_else(|| "Catatan kesehatan gagal dimuat setelah disimpan.".to_string())
}

pub async fn delete_health_record_pool(pool: &SqlitePool, id: &str) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM health_record_medicines WHERE record_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM health_records WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_health_records(customer_id: String, state: State<'_, AppState>) -> Result<Vec<HealthRecord>, String> {
    get_health_records_pool(&state.db_pool, &customer_id).await
}

#[tauri::command]
pub async fn save_health_record(input: HealthRecordInput, state: State<'_, AppState>) -> Result<HealthRecord, String> {
    save_health_record_pool(&state.db_pool, input).await
}

#[tauri::command]
pub async fn delete_health_record(id: String, state: State<'_, AppState>) -> Result<(), String> {
    delete_health_record_pool(&state.db_pool, &id).await
}

// ── Medicine presets ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct PresetItem {
    pub id: String,
    pub preset_id: String,
    pub item_id: Option<String>,
    pub name: String,
    pub qty: f64,
    pub unit: Option<String>,
    pub price: f64,
    pub instructions: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct MedicinePresetRow {
    pub id: String,
    pub name: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct MedicinePreset {
    #[serde(flatten)]
    pub preset: MedicinePresetRow,
    pub items: Vec<PresetItem>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MedicinePresetInput {
    pub id: Option<String>,
    pub name: String,
    pub notes: Option<String>,
    #[serde(default)]
    pub items: Vec<MedicineInput>,
}

pub async fn get_medicine_presets_pool(pool: &SqlitePool) -> Result<Vec<MedicinePreset>, String> {
    let presets = sqlx::query_as::<_, MedicinePresetRow>("SELECT * FROM medicine_presets ORDER BY name COLLATE NOCASE ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    let items = sqlx::query_as::<_, PresetItem>("SELECT * FROM medicine_preset_items ORDER BY sort_order ASC, rowid ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(presets
        .into_iter()
        .map(|preset| {
            let its = items.iter().filter(|i| i.preset_id == preset.id).cloned().collect();
            MedicinePreset { preset, items: its }
        })
        .collect())
}

pub async fn save_medicine_preset_pool(pool: &SqlitePool, input: MedicinePresetInput) -> Result<MedicinePreset, String> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Nama preset wajib diisi.".to_string());
    }
    if input.items.is_empty() {
        return Err("Preset harus berisi minimal satu obat.".to_string());
    }
    validate_medicines(&input.items)?;

    let id = input.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let notes = clean(&input.notes);

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let name_taken: Option<i64> = sqlx::query_scalar("SELECT 1 FROM medicine_presets WHERE name = ? COLLATE NOCASE AND id <> ?")
        .bind(&name)
        .bind(&id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    if name_taken.is_some() {
        return Err(format!("Preset \"{}\" sudah ada. Gunakan nama lain atau edit preset tersebut.", name));
    }

    if input.id.is_some() {
        let res = sqlx::query("UPDATE medicine_presets SET name = ?, notes = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(&name).bind(&notes).bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        if res.rows_affected() == 0 {
            return Err("Preset tidak ditemukan.".to_string());
        }
        sqlx::query("DELETE FROM medicine_preset_items WHERE preset_id = ?")
            .bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        sqlx::query("INSERT INTO medicine_presets (id, name, notes) VALUES (?, ?, ?)")
            .bind(&id).bind(&name).bind(&notes)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    for (idx, m) in input.items.iter().enumerate() {
        sqlx::query(
            "INSERT INTO medicine_preset_items (id, preset_id, item_id, name, qty, unit, price, instructions, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string()).bind(&id).bind(clean(&m.item_id))
        .bind(m.name.trim()).bind(m.qty).bind(clean(&m.unit)).bind(m.price).bind(clean(&m.instructions))
        .bind(idx as i64)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    get_medicine_presets_pool(pool)
        .await?
        .into_iter()
        .find(|p| p.preset.id == id)
        .ok_or_else(|| "Preset gagal dimuat setelah disimpan.".to_string())
}

pub async fn delete_medicine_preset_pool(pool: &SqlitePool, id: &str) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM medicine_preset_items WHERE preset_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM medicine_presets WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_medicine_presets(state: State<'_, AppState>) -> Result<Vec<MedicinePreset>, String> {
    get_medicine_presets_pool(&state.db_pool).await
}

#[tauri::command]
pub async fn save_medicine_preset(input: MedicinePresetInput, state: State<'_, AppState>) -> Result<MedicinePreset, String> {
    save_medicine_preset_pool(&state.db_pool, input).await
}

#[tauri::command]
pub async fn delete_medicine_preset(id: String, state: State<'_, AppState>) -> Result<(), String> {
    delete_medicine_preset_pool(&state.db_pool, &id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query("CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO customers (id, name) VALUES ('c1', 'Budi')")
            .execute(&pool)
            .await
            .unwrap();
        for stmt in include_str!("../db/migrations/061_member_health.sql").split(';') {
            let body: String = stmt.lines().filter(|l| !l.trim_start().starts_with("--")).collect::<Vec<_>>().join("\n");
            if !body.trim().is_empty() {
                sqlx::query(&body).execute(&pool).await.unwrap();
            }
        }
        pool
    }

    fn med(name: &str, qty: f64, price: f64) -> MedicineInput {
        MedicineInput { item_id: None, name: name.into(), qty, unit: Some("strip".into()), price, instructions: Some("3 x 1".into()) }
    }

    fn base_input() -> HealthRecordInput {
        HealthRecordInput {
            id: None, customer_id: "c1".into(), checked_at: Some("2026-11-01 09:30:00".into()),
            blood_sugar: Some(132.0), blood_sugar_context: Some("fasting".into()),
            cholesterol_total: Some(210.0), cholesterol_hdl: None, cholesterol_ldl: None, triglycerides: None,
            uric_acid: None, systolic: Some(130), diastolic: Some(85), weight: None, height: None,
            notes: Some("  kontrol 2 minggu  ".into()), medicines: vec![med("Metformin", 2.0, 15000.0)],
        }
    }

    #[tokio::test]
    async fn saves_reads_updates_and_deletes_a_record() {
        let pool = test_pool().await;
        let saved = save_health_record_pool(&pool, base_input()).await.unwrap();
        assert_eq!(saved.record.blood_sugar, Some(132.0));
        assert_eq!(saved.record.notes.as_deref(), Some("kontrol 2 minggu"));
        assert_eq!(saved.medicines.len(), 1);
        assert_eq!(saved.medicines[0].price, 15000.0);

        let mut edit = base_input();
        edit.id = Some(saved.record.id.clone());
        edit.blood_sugar = Some(118.0);
        edit.medicines = vec![med("Metformin", 1.0, 16000.0), med("Vitamin B", 1.0, 5000.0)];
        let updated = save_health_record_pool(&pool, edit).await.unwrap();
        assert_eq!(updated.record.id, saved.record.id);
        assert_eq!(updated.record.blood_sugar, Some(118.0));
        assert_eq!(updated.medicines.len(), 2);

        let all = get_health_records_pool(&pool, "c1").await.unwrap();
        assert_eq!(all.len(), 1);

        delete_health_record_pool(&pool, &saved.record.id).await.unwrap();
        assert!(get_health_records_pool(&pool, "c1").await.unwrap().is_empty());
        let orphans: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM health_record_medicines").fetch_one(&pool).await.unwrap();
        assert_eq!(orphans, 0);
    }

    #[tokio::test]
    async fn rejects_invalid_records() {
        let pool = test_pool().await;

        let mut empty = base_input();
        empty.blood_sugar = None; empty.cholesterol_total = None; empty.systolic = None; empty.diastolic = None; empty.medicines = vec![];
        assert!(save_health_record_pool(&pool, empty).await.is_err());

        let mut half_bp = base_input();
        half_bp.diastolic = None;
        assert!(save_health_record_pool(&pool, half_bp).await.is_err());

        let mut negative = base_input();
        negative.blood_sugar = Some(-5.0);
        assert!(save_health_record_pool(&pool, negative).await.is_err());

        let mut bad_med = base_input();
        bad_med.medicines = vec![med("Obat", 0.0, 1000.0)];
        assert!(save_health_record_pool(&pool, bad_med).await.is_err());

        let mut unknown = base_input();
        unknown.customer_id = "nope".into();
        assert!(save_health_record_pool(&pool, unknown).await.is_err());
    }

    #[tokio::test]
    async fn presets_keep_prices_and_enforce_unique_names() {
        let pool = test_pool().await;
        let input = MedicinePresetInput { id: None, name: "Paket diabetes".into(), notes: None, items: vec![med("Metformin", 2.0, 15000.0), med("Glimepiride", 1.0, 22000.5)] };
        let saved = save_medicine_preset_pool(&pool, input.clone()).await.unwrap();
        assert_eq!(saved.items.len(), 2);
        assert_eq!(saved.items[1].price, 22000.5);
        assert_eq!(saved.items[0].sort_order, 0);

        let dup = MedicinePresetInput { name: "paket DIABETES".into(), ..input.clone() };
        assert!(save_medicine_preset_pool(&pool, dup).await.is_err());

        let renamed = MedicinePresetInput { id: Some(saved.preset.id.clone()), name: "Paket gula".into(), notes: Some("rutin".into()), items: vec![med("Metformin", 3.0, 15500.0)] };
        let updated = save_medicine_preset_pool(&pool, renamed).await.unwrap();
        assert_eq!(updated.items.len(), 1);
        assert_eq!(updated.items[0].qty, 3.0);

        assert!(save_medicine_preset_pool(&pool, MedicinePresetInput { id: None, name: "Kosong".into(), notes: None, items: vec![] }).await.is_err());

        delete_medicine_preset_pool(&pool, &saved.preset.id).await.unwrap();
        assert!(get_medicine_presets_pool(&pool).await.unwrap().is_empty());
    }
}
