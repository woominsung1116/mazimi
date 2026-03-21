-- Migration: eligibility_rules seed data
--
-- Inserts rule_json (DSL tree) and explain_json (Korean template strings) for
-- 20 major programs already present in the programs table.
--
-- Rule DSL reference (rule_engine.rs):
--   { "all": [...] }          — all child conditions must pass (AND)
--   { "any": [...] }          — at least one child must pass (OR)
--   { "field", "op", "value", "weight" }  — leaf condition
--
-- Supported ops: eq, ne, in, not_in, between, gte, lte, gt, lt,
--                contains, is_true, is_false, is_null, is_not_null
--
-- Available profile fields:
--   birth_year, region_code, city_code, school_name, school_year,
--   school_type, enrollment_status, employment_status, major_group,
--   income_bracket (1=최저 ~ 10=최고), kosaf_support_bracket,
--   housing_type, household_size, age_band,
--   has_disability, is_multicultural_family, is_low_income_household,
--   veteran_family
--
-- explain_json keys must match field names used in rule_json.
-- The rule engine renders these strings at match time.
--
-- Pattern:
--   INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
--   SELECT id, '<rule>'::jsonb, '<explain>'::jsonb, 1
--   FROM programs WHERE title = '...' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 부산 청년 월세 지원
--    만 19~34세 / 부산 거주 / 소득 8분위 이하 / 독립 거주
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "region_code", "op": "in",      "value": ["busan"],               "weight": 30},
    {"field": "birth_year",  "op": "between", "value": [1992, 2007],            "weight": 20},
    {"field": "income_bracket", "op": "lte",  "value": 8,                       "weight": 30},
    {"field": "housing_type",   "op": "in",   "value": ["rental", "boarding"],  "weight": 20}
  ]
}'::jsonb,
'{
  "region_code":    "부산 거주 청년 대상이에요",
  "birth_year":     "만 19~34세 (1992~2007년생) 연령 조건이에요",
  "income_bracket": "소득 8분위 이하 조건이에요 (현재 소득 분위: {{value}})",
  "housing_type":   "월세·전세 독립 거주 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '부산 청년 월세 지원' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 부산 청년 교통비 지원
--    만 19~34세 / 부산 거주
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "region_code", "op": "in",      "value": ["busan"],    "weight": 40},
    {"field": "birth_year",  "op": "between", "value": [1992, 2007], "weight": 40},
    {"field": "income_bracket", "op": "lte",  "value": 8,            "weight": 20}
  ]
}'::jsonb,
'{
  "region_code":    "부산 거주 청년 대상이에요",
  "birth_year":     "만 19~34세 (1992~2007년생) 연령 조건이에요",
  "income_bracket": "소득 8분위 이하 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '부산 청년 교통비 지원' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 부산 청년 창업 지원금
--    만 19~39세 / 부산 거주 / 미취업 또는 창업 준비
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "region_code",       "op": "in",      "value": ["busan"],                         "weight": 30},
    {"field": "birth_year",        "op": "between", "value": [1987, 2007],                      "weight": 25},
    {"field": "employment_status", "op": "in",      "value": ["unemployed", "self_employed", "preparing"], "weight": 30},
    {"field": "income_bracket",    "op": "lte",     "value": 7,                                 "weight": 15}
  ]
}'::jsonb,
'{
  "region_code":       "부산 거주 청년 대상이에요",
  "birth_year":        "만 19~39세 (1987~2007년생) 연령 조건이에요",
  "employment_status": "미취업·예비창업자 조건이에요 (현재 상태: {{value}})",
  "income_bracket":    "소득 7분위 이하 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '부산 청년 창업 지원금' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 기쁨두배통장
--    만 18~34세 / 부산 거주 / 소득 6분위 이하
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "region_code",    "op": "in",      "value": ["busan"],    "weight": 35},
    {"field": "birth_year",     "op": "between", "value": [1992, 2008], "weight": 30},
    {"field": "income_bracket", "op": "lte",     "value": 6,            "weight": 35}
  ]
}'::jsonb,
'{
  "region_code":    "부산 거주 청년 대상이에요",
  "birth_year":     "만 18~34세 (1992~2008년생) 연령 조건이에요",
  "income_bracket": "소득 6분위 이하 조건이에요 (매칭 저축 지원 요건)"
}'::jsonb,
1
FROM programs WHERE title = '기쁨두배통장' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 부산 청년 취업 장려금
--    만 18~34세 / 부산 거주 / 취업 상태 (신규 취업)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "region_code",       "op": "in",      "value": ["busan"],               "weight": 35},
    {"field": "birth_year",        "op": "between", "value": [1992, 2008],            "weight": 25},
    {"field": "employment_status", "op": "in",      "value": ["employed", "new_hire"],"weight": 30},
    {"field": "income_bracket",    "op": "lte",     "value": 7,                       "weight": 10}
  ]
}'::jsonb,
'{
  "region_code":       "부산 거주 청년 대상이에요",
  "birth_year":        "만 18~34세 (1992~2008년생) 연령 조건이에요",
  "employment_status": "부산 소재 중소기업 신규 취업자 조건이에요",
  "income_bracket":    "소득 7분위 이하 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '부산 청년 취업 장려금' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 대구 청년 주거 지원
--    만 19~39세 / 대구 거주 / 소득 8분위 이하 / 임차 거주
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "region_code",    "op": "in",      "value": ["daegu"],             "weight": 30},
    {"field": "birth_year",     "op": "between", "value": [1987, 2007],          "weight": 20},
    {"field": "income_bracket", "op": "lte",     "value": 8,                     "weight": 30},
    {"field": "housing_type",   "op": "in",      "value": ["rental", "boarding"],"weight": 20}
  ]
}'::jsonb,
'{
  "region_code":    "대구 거주 청년 대상이에요",
  "birth_year":     "만 19~39세 (1987~2007년생) 연령 조건이에요",
  "income_bracket": "소득 8분위 이하 조건이에요",
  "housing_type":   "임차(월세·전세·고시원) 거주 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '대구 청년 주거 지원' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. 대구 청년 생활비 지원
--    만 19~34세 / 대구 거주 / 미취업 또는 취업 준비 / 소득 6분위 이하
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "region_code",       "op": "in",      "value": ["daegu"],                          "weight": 30},
    {"field": "birth_year",        "op": "between", "value": [1992, 2007],                       "weight": 20},
    {"field": "employment_status", "op": "in",      "value": ["unemployed", "preparing"],        "weight": 30},
    {"field": "income_bracket",    "op": "lte",     "value": 6,                                  "weight": 20}
  ]
}'::jsonb,
'{
  "region_code":       "대구 거주 청년 대상이에요",
  "birth_year":        "만 19~34세 (1992~2007년생) 연령 조건이에요",
  "employment_status": "미취업·취업 준비 중 청년 대상이에요",
  "income_bracket":    "소득 6분위 이하 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '대구 청년 생활비 지원' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. 국가장학금 1유형
--    만 18~40세 / 전국 / 재학·휴학 / 소득 구간 8분위 이하 (코사프 8분위 이하)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",           "op": "between", "value": [1986, 2008],                "weight": 15},
    {"field": "enrollment_status",    "op": "in",      "value": ["enrolled", "on_leave"],    "weight": 30},
    {"field": "school_type",          "op": "in",      "value": ["university", "college"],   "weight": 20},
    {"field": "kosaf_support_bracket","op": "lte",     "value": 8,                           "weight": 35}
  ]
}'::jsonb,
'{
  "birth_year":            "만 18~40세 (1986~2008년생) 연령 조건이에요",
  "enrollment_status":     "대학 재학 또는 휴학 중이어야 해요",
  "school_type":           "4년제 대학교 또는 전문대학 재학 조건이에요",
  "kosaf_support_bracket": "한국장학재단 소득 분위 8구간 이하 조건이에요 (현재: {{value}}구간)"
}'::jsonb,
1
FROM programs WHERE title = '국가장학금 1유형' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. 부산 인재육성 장학금
--    만 18~30세 / 부산 거주 / 재학 / 소득 6분위 이하
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "region_code",        "op": "in",      "value": ["busan"],                  "weight": 30},
    {"field": "birth_year",         "op": "between", "value": [1996, 2008],               "weight": 15},
    {"field": "enrollment_status",  "op": "in",      "value": ["enrolled"],               "weight": 25},
    {"field": "school_type",        "op": "in",      "value": ["university", "college"],  "weight": 15},
    {"field": "income_bracket",     "op": "lte",     "value": 6,                          "weight": 15}
  ]
}'::jsonb,
'{
  "region_code":       "부산 거주 대학생 대상이에요",
  "birth_year":        "만 18~30세 (1996~2008년생) 연령 조건이에요",
  "enrollment_status": "현재 재학 중이어야 해요",
  "school_type":       "4년제 대학교 또는 전문대학 재학 조건이에요",
  "income_bracket":    "소득 6분위 이하 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '부산 인재육성 장학금' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. 한국장학재단 2유형
--     만 18~40세 / 전국 / 재학 / 소득 구간 제한 없음 (성적 우선)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",        "op": "between", "value": [1986, 2008],               "weight": 15},
    {"field": "enrollment_status", "op": "in",      "value": ["enrolled"],               "weight": 45},
    {"field": "school_type",       "op": "in",      "value": ["university", "college"],  "weight": 40}
  ]
}'::jsonb,
'{
  "birth_year":        "만 18~40세 (1986~2008년생) 연령 조건이에요",
  "enrollment_status": "대학 재학 중이어야 해요 (대학 자체 선발 기준 적용)",
  "school_type":       "4년제 대학교 또는 전문대학 재학 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '한국장학재단 2유형' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. 이공계장학금
--     만 18~35세 / 전국 / 재학 / 이공계 전공 / 소득 6분위 이하
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",        "op": "between", "value": [1991, 2008],                              "weight": 10},
    {"field": "enrollment_status", "op": "in",      "value": ["enrolled", "on_leave"],                  "weight": 25},
    {"field": "major_group",       "op": "in",      "value": ["engineering", "science", "it", "stem"], "weight": 35},
    {"field": "income_bracket",    "op": "lte",     "value": 6,                                         "weight": 30}
  ]
}'::jsonb,
'{
  "birth_year":        "만 18~35세 (1991~2008년생) 연령 조건이에요",
  "enrollment_status": "대학 재학 또는 휴학 중이어야 해요",
  "major_group":       "이공계(공학·자연과학·IT) 전공 조건이에요",
  "income_bracket":    "소득 6분위 이하 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '이공계장학금' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. 민간장학재단A (저소득 우수 대학생)
--     만 18~30세 / 전국 / 재학 / 소득 4분위 이하 / 저소득 가구
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",             "op": "between", "value": [1996, 2008],              "weight": 10},
    {"field": "enrollment_status",      "op": "in",      "value": ["enrolled"],              "weight": 25},
    {"field": "income_bracket",         "op": "lte",     "value": 4,                         "weight": 35},
    {"field": "is_low_income_household","op": "is_true",                                      "weight": 30}
  ]
}'::jsonb,
'{
  "birth_year":              "만 18~30세 (1996~2008년생) 연령 조건이에요",
  "enrollment_status":       "대학 재학 중이어야 해요",
  "income_bracket":          "소득 4분위 이하 조건이에요",
  "is_low_income_household": "저소득 가구 확인이 필요해요"
}'::jsonb,
1
FROM programs WHERE title = '민간장학재단A' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. 청년내일채움공제 (policy 버전 — seed_extended.sql #41)
--     만 15~34세 / 전국 / 재직 (중소기업 정규직) / 소득 무관
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",        "op": "between", "value": [1992, 2011],                     "weight": 20},
    {"field": "employment_status", "op": "in",      "value": ["employed", "new_hire"],         "weight": 60},
    {"field": "income_bracket",    "op": "lte",     "value": 9,                                "weight": 20}
  ]
}'::jsonb,
'{
  "birth_year":        "만 15~34세 (1992~2011년생) 연령 조건이에요",
  "employment_status": "중소기업 정규직 재직 중이어야 해요",
  "income_bracket":    "소득 9분위 이하 조건이에요 (사실상 소득 제한 없음)"
}'::jsonb,
1
FROM programs WHERE title = '청년내일채움공제' AND source_type = 'manual' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. 청년구직활동지원금
--     만 18~34세 / 전국 / 미취업 / 소득 6분위 이하
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",        "op": "between", "value": [1992, 2008],             "weight": 20},
    {"field": "employment_status", "op": "in",      "value": ["unemployed", "preparing"],"weight": 50},
    {"field": "income_bracket",    "op": "lte",     "value": 6,                        "weight": 30}
  ]
}'::jsonb,
'{
  "birth_year":        "만 18~34세 (1992~2008년생) 연령 조건이에요",
  "employment_status": "졸업·중퇴 후 미취업 상태여야 해요",
  "income_bracket":    "소득 6분위 이하 조건이에요"
}'::jsonb,
1
FROM programs WHERE title = '청년구직활동지원금' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. 장애학생 지원
--     만 18~40세 / 전국 / 재학 / 장애 등록
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",        "op": "between", "value": [1986, 2008],              "weight": 10},
    {"field": "enrollment_status", "op": "in",      "value": ["enrolled", "on_leave"],  "weight": 30},
    {"field": "has_disability",    "op": "is_true",                                      "weight": 60}
  ]
}'::jsonb,
'{
  "birth_year":        "만 18~40세 (1986~2008년생) 연령 조건이에요",
  "enrollment_status": "대학 재학 또는 휴학 중이어야 해요",
  "has_disability":    "장애인 등록 조건이에요 (장애인증명서 필요)"
}'::jsonb,
1
FROM programs WHERE title = '장애학생 지원' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. 다문화가정 지원
--     0~25세 / 전국 / 재학(학생) 또는 무관 / 다문화가정
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",             "op": "gte",     "value": 2001,    "weight": 20},
    {"field": "is_multicultural_family","op": "is_true",                   "weight": 80}
  ]
}'::jsonb,
'{
  "birth_year":              "만 25세 이하 (2001년생 이후) 조건이에요",
  "is_multicultural_family": "다문화가족 구성원 조건이에요 (다문화가족증명서 필요)"
}'::jsonb,
1
FROM programs WHERE title = '다문화가정 지원' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. 보훈자녀 학비지원
--     만 18~25세 / 전국 / 재학 / 국가유공자 자녀
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",        "op": "between", "value": [2001, 2008],              "weight": 15},
    {"field": "enrollment_status", "op": "in",      "value": ["enrolled", "on_leave"],  "weight": 30},
    {"field": "veteran_family",    "op": "is_true",                                      "weight": 55}
  ]
}'::jsonb,
'{
  "birth_year":        "만 18~25세 (2001~2008년생) 연령 조건이에요",
  "enrollment_status": "대학 재학 또는 휴학 중이어야 해요",
  "veteran_family":    "국가유공자 자녀·손자녀 조건이에요 (보훈등록 증명서 필요)"
}'::jsonb,
1
FROM programs WHERE title = '보훈자녀 학비지원' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. 청년도약계좌
--     만 19~34세 / 전국 / 취업·재직 또는 소득 보유 / 소득 7,500만원 이하 (9분위 이하 근사)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",        "op": "between", "value": [1992, 2007], "weight": 25},
    {"field": "income_bracket",    "op": "lte",     "value": 9,            "weight": 50},
    {
      "any": [
        {"field": "employment_status", "op": "in", "value": ["employed", "self_employed", "new_hire"], "weight": 25},
        {"field": "enrollment_status", "op": "in", "value": ["enrolled"],                             "weight": 25}
      ]
    }
  ]
}'::jsonb,
'{
  "birth_year":        "만 19~34세 (1992~2007년생) 연령 조건이에요",
  "income_bracket":    "개인소득 7,500만원 이하 (소득 9분위 이하) 조건이에요",
  "employment_status": "소득이 있는 재직·자영업자 또는 재학생이어야 해요"
}'::jsonb,
1
FROM programs WHERE title = '청년도약계좌' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. 청년전용 버팀목전세대출
--     만 19~34세 / 전국 / 무주택 / 소득 5,000만원 이하 (7분위 이하 근사)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "birth_year",     "op": "between", "value": [1992, 2007],           "weight": 20},
    {"field": "income_bracket", "op": "lte",     "value": 7,                      "weight": 45},
    {"field": "housing_type",   "op": "in",      "value": ["rental", "boarding"], "weight": 35}
  ]
}'::jsonb,
'{
  "birth_year":     "만 19~34세 (1992~2007년생) 연령 조건이에요",
  "income_bracket": "연소득 5,000만원 이하 (소득 7분위 이하) 조건이에요",
  "housing_type":   "무주택 임차 거주 청년 조건이에요 (전세·월세 거주 필요)"
}'::jsonb,
1
FROM programs WHERE title = '청년전용 버팀목전세대출' LIMIT 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. 삼성전기 청년 인턴십 프로그램 (corporate_benefit)
--     만 20~30세 / 부산 거주 / 재학 또는 졸업예정 / 이공계 전공 우대
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eligibility_rules (program_id, rule_json, explain_json, version)
SELECT id,
'{
  "all": [
    {"field": "region_code",       "op": "in",      "value": ["busan"],                              "weight": 25},
    {"field": "birth_year",        "op": "between", "value": [1996, 2006],                           "weight": 20},
    {"field": "enrollment_status", "op": "in",      "value": ["enrolled", "graduated"],              "weight": 30},
    {
      "any": [
        {"field": "major_group", "op": "in", "value": ["engineering", "science", "it", "stem"], "weight": 25},
        {"field": "major_group", "op": "is_not_null",                                            "weight": 10}
      ]
    }
  ]
}'::jsonb,
'{
  "region_code":       "부산 거주 청년 대상이에요",
  "birth_year":        "만 20~30세 (1996~2006년생) 연령 조건이에요",
  "enrollment_status": "재학 중 또는 졸업(예정)자 조건이에요",
  "major_group":       "이공계(공학·자연과학·IT) 전공자 우대예요"
}'::jsonb,
1
FROM programs WHERE title = '삼성전기 청년 인턴십 프로그램' LIMIT 1;
