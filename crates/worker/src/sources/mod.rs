pub mod dreamspon;
pub mod financial;
pub mod gov_benefits;
pub mod local_scraper;
pub mod local_welfare;
pub mod national_welfare;
pub mod scholarship;
pub mod youth_center;

use anyhow::Result;
use serde_json::Value;
use std::collections::BTreeMap;

/// A raw record fetched from an external data source.
#[derive(Debug, Clone)]
pub struct RawRecord {
    /// Stable identifier within the source (e.g. service code)
    pub source_id: String,
    /// Raw JSON payload as returned by the API
    pub payload: Value,
    /// Hex digest of the canonical JSON bytes (change detection)
    pub content_hash: String,
}

/// Every data source must implement this trait.
/// Uses RPITIT (return-position impl Trait in traits, stable since Rust 1.75).
pub trait DataSource: Send + Sync {
    /// Human-readable name used in logs and ingestion_runs rows.
    fn name(&self) -> &'static str;

    /// Fetch all records from the source and return them as RawRecords.
    fn fetch_all(&self) -> impl std::future::Future<Output = Result<Vec<RawRecord>>> + Send;
}

/// Compute a content hash for a JSON value.
/// Serialises to canonical (sorted-key) JSON then applies FNV-1a (128-bit).
pub fn content_hash(v: &Value) -> String {
    let canonical = canonical_value(v);
    let bytes = serde_json::to_vec(&canonical).unwrap_or_default();
    fnv_hash_hex(&bytes)
}

fn canonical_value(v: &Value) -> Value {
    match v {
        Value::Object(map) => {
            let sorted: BTreeMap<String, Value> = map
                .iter()
                .map(|(k, val)| (k.clone(), canonical_value(val)))
                .collect();
            Value::Object(sorted.into_iter().collect())
        }
        Value::Array(arr) => Value::Array(arr.iter().map(canonical_value).collect()),
        other => other.clone(),
    }
}

pub fn fnv_hash_hex(data: &[u8]) -> String {
    // FNV-1a with two different seeds → 128-bit collision resistance.
    // Replace with sha2 crate if cryptographic strength is required.
    let h1 = fnv1a(data, 0xcbf29ce484222325_u64);
    let h2 = fnv1a(data, 0x14650fb0739d0383_u64);
    format!("{:016x}{:016x}", h1, h2)
}

fn fnv1a(data: &[u8], seed: u64) -> u64 {
    let prime: u64 = 0x00000100000001B3;
    let mut hash = seed;
    for &b in data {
        hash ^= b as u64;
        hash = hash.wrapping_mul(prime);
    }
    hash
}
