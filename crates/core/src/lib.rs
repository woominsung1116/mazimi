pub mod config;
pub mod models;
pub mod rule_engine;

pub use config::AppConfig;

/// Human-readable Korean label for a region code.
/// Handles both raw codes and JSON-quoted codes (e.g. `"\"busan\""` from `Value::to_string()`).
pub fn region_label(code: &str) -> &'static str {
    // Strip surrounding JSON quotes if present
    let stripped = code.trim_matches('"');
    match stripped {
        "busan" => "부산",
        "daegu" => "대구",
        "seoul" => "서울",
        "incheon" => "인천",
        "gwangju" => "광주",
        "daejeon" => "대전",
        "ulsan" => "울산",
        "sejong" => "세종",
        "gyeonggi" => "경기",
        "gangwon" => "강원",
        "chungbuk" => "충북",
        "chungnam" => "충남",
        "jeonbuk" => "전북",
        "jeonnam" => "전남",
        "gyeongbuk" => "경북",
        "gyeongnam" => "경남",
        "jeju" => "제주",
        _ => "기타",
    }
}
