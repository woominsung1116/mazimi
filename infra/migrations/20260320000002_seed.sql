-- Seed data: sample programs for busan, daegu, and nationwide scholarships

-- 1. 부산 청년 월세 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 월세 지원',
    '부산 거주 만 19~34세 청년에게 월 최대 20만원 월세를 지원합니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/rent',
    'active', 200000, 19, 34, ARRAY['busan'],
    '2026-04-30 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-30 23:59:59+09'
);

-- 2. 부산 청년 교통비 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 교통비 지원',
    '부산 거주 만 19~34세 청년의 대중교통 비용을 월 최대 5만원 지원합니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/transport',
    'active', 50000, 19, 34, ARRAY['busan'],
    '2026-05-31 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-05-31 23:59:59+09'
);

-- 3. 부산 청년 창업 지원금
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 창업 지원금',
    '부산 거주 만 19~39세 창업 준비 청년에게 최대 300만원 창업 자금을 지원합니다.',
    '부산경제진흥원', 'https://www.bepa.kr/startup',
    'active', 3000000, 19, 39, ARRAY['busan'],
    '2026-04-15 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-15 23:59:59+09'
);

-- 4. 부산 기쁨두배통장
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '기쁨두배통장',
    '부산 거주 만 18~34세 청년이 매월 10만원 저축하면 시에서 10만원을 매칭하여 지원합니다. (3년간)',
    '부산광역시', 'https://www.busan.go.kr/youth/happydouble',
    'active', 100000, 18, 34, ARRAY['busan'],
    '2026-06-30 23:59:59+09', true,
    '2026-03-15 00:00:00+09', '2026-06-30 23:59:59+09'
);

-- 5. 부산 청년 취업 장려금
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 취업 장려금',
    '부산 소재 중소기업에 신규 취업한 만 18~34세 청년에게 100만원 취업 장려금을 지원합니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/employment',
    'active', 1000000, 18, 34, ARRAY['busan'],
    '2026-05-15 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-05-15 23:59:59+09'
);

-- 6. 대구 청년 주거 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 주거 지원',
    '대구 거주 만 19~39세 청년에게 월 최대 15만원 주거비를 지원합니다.',
    '대구광역시', 'https://www.daegu.go.kr/youth/housing',
    'active', 150000, 19, 39, ARRAY['daegu'],
    '2026-04-20 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-20 23:59:59+09'
);

-- 7. 대구 청년 생활비 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 생활비 지원',
    '대구 거주 만 19~34세 취업 준비 청년에게 월 최대 30만원 생활비를 지원합니다.',
    '대구광역시', 'https://www.daegu.go.kr/youth/living',
    'active', 300000, 19, 34, ARRAY['daegu'],
    '2026-05-10 23:59:59+09', true,
    '2026-03-15 00:00:00+09', '2026-05-10 23:59:59+09'
);

-- 8. 대구 청년 문화 패스
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 문화 패스',
    '대구 거주 만 19~34세 청년에게 월 3만원 문화생활비를 지원합니다.',
    '대구문화재단', 'https://www.dgfc.or.kr/youth/culture',
    'active', 30000, 19, 34, ARRAY['daegu'],
    '2026-06-15 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-06-15 23:59:59+09'
);

-- 9. 국가장학금 1유형
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '국가장학금 1유형',
    '소득 연계형 국가장학금으로, 소득 구간에 따라 학기당 최대 350만원을 지원합니다. 대한민국 국적 대학생 대상.',
    '한국장학재단', 'https://www.kosaf.go.kr/ko/scholar.do',
    'active', 3500000, 18, 40, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-04-05 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-05 23:59:59+09'
);

-- 10. 부산 인재육성 장학금
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '부산 인재육성 장학금',
    '부산 거주 대학생에게 학기당 최대 200만원 장학금을 지원합니다. 성적 및 소득 기준 충족 필요.',
    '부산인재평생교육진흥원', 'https://www.bile.or.kr/scholarship',
    'active', 2000000, 18, 30, ARRAY['busan'],
    '2026-04-10 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-10 23:59:59+09'
);
