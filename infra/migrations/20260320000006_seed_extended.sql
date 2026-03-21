-- Seed data extended: programs 11~50 (기존 10건에 추가)
-- 부산 정책 12건 | 대구 정책 8건 | 장학금 10건 | 생활지원 10건

-- ============================================================
-- 부산 정책 12건
-- ============================================================

-- 11. 청년 희망 적금
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '청년 희망 적금',
    '부산 거주 만 19~34세 청년이 월 50만원 이하 저축 시 시가 저축액의 최대 36%를 추가 지원하는 우대 적금 프로그램입니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/savings',
    'active', 180000, 19, 34, ARRAY['busan'],
    '2026-05-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-31 23:59:59+09'
);

-- 12. 청년 디지털 배움터
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '청년 디지털 배움터',
    '부산 거주 만 18~34세 청년에게 AI·빅데이터·클라우드 등 디지털 역량 교육을 무료로 제공하고 수료 시 50만원 교육비를 지원합니다.',
    '부산경제진흥원', 'https://www.bepa.kr/digital',
    'active', 500000, 18, 34, ARRAY['busan'],
    '2026-06-30 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-06-30 23:59:59+09'
);

-- 13. 부산 청년 건강검진
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 건강검진',
    '부산 거주 만 19~39세 청년에게 종합건강검진 비용을 1인당 최대 15만원 지원합니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/health',
    'active', 150000, 19, 39, ARRAY['busan'],
    '2026-07-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-07-31 23:59:59+09'
);

-- 14. 부산 청년 마음건강
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 마음건강',
    '부산 거주 만 19~34세 청년을 대상으로 심리 상담 서비스를 연간 최대 10회(회당 5만원) 지원합니다.',
    '부산광역시정신건강복지센터', 'https://www.busan.go.kr/youth/mental',
    'active', 50000, 19, 34, ARRAY['busan'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 15. 부산 청년 해외연수
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 해외연수',
    '부산 거주 만 19~34세 청년에게 해외 단기 연수 프로그램 참가 시 항공료·체재비 포함 최대 200만원을 지원합니다.',
    '부산경제진흥원', 'https://www.bepa.kr/global',
    'active', 2000000, 19, 34, ARRAY['busan'],
    '2026-05-15 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-15 23:59:59+09'
);

-- 16. 부산 청년 창작공간
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 창작공간',
    '부산 거주 만 19~39세 예술·창작 분야 청년에게 공유 작업 공간을 월 3만원에 제공하고 재료비를 최대 월 10만원 지원합니다.',
    '부산문화재단', 'https://www.bscf.or.kr/youth/space',
    'active', 100000, 19, 39, ARRAY['busan'],
    '2026-06-30 23:59:59+09', true,
    '2026-04-15 00:00:00+09', '2026-06-30 23:59:59+09'
);

-- 17. 부산 청년 면접 정장
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 면접 정장',
    '부산 거주 만 18~34세 취업 준비 청년에게 면접용 정장 구매·대여 비용으로 최대 20만원을 지원합니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/suit',
    'active', 200000, 18, 34, ARRAY['busan'],
    '2026-07-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-07-31 23:59:59+09'
);

-- 18. 부산 신혼부부 주거
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 신혼부부 주거',
    '부산 거주 혼인신고 후 5년 이내 신혼부부(만 20~49세)에게 전세 보증금 대출 이자의 최대 연 2%를 지원합니다.',
    '부산광역시', 'https://www.busan.go.kr/newcouple/housing',
    'active', 1500000, 20, 49, ARRAY['busan'],
    '2026-06-30 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-06-30 23:59:59+09'
);

-- 19. 부산 청년 반려동물 돌봄
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 반려동물 돌봄',
    '부산 거주 만 19~34세 1인 청년 가구에게 반려동물 의료비·돌봄 서비스 비용을 연 최대 30만원 지원합니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/pet',
    'active', 300000, 19, 34, ARRAY['busan'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 20. 부산 청년 법률 상담
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 법률 상담',
    '부산 거주 만 19~34세 청년에게 노동·주거·금융 분야 법률 상담을 연 5회까지 무료로 제공합니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/legal',
    'active', 0, 19, 34, ARRAY['busan'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 21. 부산 청년 여행 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 여행 지원',
    '부산 거주 만 19~34세 청년에게 국내 여행 경비를 최대 30만원 지원하여 심리적 회복과 자기계발을 돕습니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/travel',
    'active', 300000, 19, 34, ARRAY['busan'],
    '2026-06-30 23:59:59+09', true,
    '2026-04-15 00:00:00+09', '2026-06-30 23:59:59+09'
);

-- 22. 부산 청년 자격증 취득 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '부산 청년 자격증 취득 지원',
    '부산 거주 만 18~34세 청년에게 국가기술·전문자격증 취득 응시료 및 교재비를 1인당 최대 50만원 지원합니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/certificate',
    'active', 500000, 18, 34, ARRAY['busan'],
    '2026-07-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-07-31 23:59:59+09'
);

-- ============================================================
-- 대구 정책 8건
-- ============================================================

-- 23. 대구 청년 창업 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 창업 지원',
    '대구 거주 만 19~39세 예비 창업자 및 창업 초기(3년 이내) 청년에게 사업화 자금 최대 500만원을 지원합니다.',
    '대구경제통상진흥원', 'https://www.dbia.or.kr/startup',
    'active', 5000000, 19, 39, ARRAY['daegu'],
    '2026-05-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-31 23:59:59+09'
);

-- 24. 대구 청년 교통카드
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 교통카드',
    '대구 거주 만 19~34세 청년에게 대중교통비를 월 최대 6만원 지원하는 교통카드를 발급합니다.',
    '대구광역시', 'https://www.daegu.go.kr/youth/transit',
    'active', 60000, 19, 34, ARRAY['daegu'],
    '2026-06-30 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-06-30 23:59:59+09'
);

-- 25. 대구 청년 해외 인턴십
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 해외 인턴십',
    '대구 거주 만 19~34세 청년에게 해외 기업 인턴십 참가 비용(항공·체재·보험)으로 최대 300만원을 지원합니다.',
    '대구경제통상진흥원', 'https://www.dbia.or.kr/global',
    'active', 3000000, 19, 34, ARRAY['daegu'],
    '2026-05-15 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-15 23:59:59+09'
);

-- 26. 대구 청년 건강검진
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 건강검진',
    '대구 거주 만 19~39세 청년에게 종합건강검진 비용을 1인당 최대 12만원 지원합니다.',
    '대구광역시', 'https://www.daegu.go.kr/youth/health',
    'active', 120000, 19, 39, ARRAY['daegu'],
    '2026-07-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-07-31 23:59:59+09'
);

-- 27. 대구 청년 학습 공간
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 학습 공간',
    '대구 거주 만 18~34세 청년에게 공공 스터디 카페 이용권(월 40시간)을 무료 또는 월 2만원에 제공합니다.',
    '대구광역시', 'https://www.daegu.go.kr/youth/study',
    'active', 20000, 18, 34, ARRAY['daegu'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-15 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 28. 대구 청년 멘토링
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 멘토링',
    '대구 거주 만 19~34세 청년을 지역 기업인·전문가와 1:1로 연결하고 참가 청년에게 활동비 30만원을 지원합니다.',
    '대구광역시', 'https://www.daegu.go.kr/youth/mentoring',
    'active', 300000, 19, 34, ARRAY['daegu'],
    '2026-06-30 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-06-30 23:59:59+09'
);

-- 29. 대구 신혼부부 전세
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 신혼부부 전세',
    '대구 거주 혼인신고 후 7년 이내 신혼부부(만 20~45세)에게 전세 보증금 최대 1억원의 저금리(연 1.5%) 대출을 지원합니다.',
    '대구광역시', 'https://www.daegu.go.kr/newcouple/lease',
    'active', 0, 20, 45, ARRAY['daegu'],
    '2026-06-30 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-06-30 23:59:59+09'
);

-- 30. 대구 청년 디지털 역량
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '대구 청년 디지털 역량',
    '대구 거주 만 18~39세 청년에게 코딩·데이터분석·사이버보안 교육 과정을 무료로 제공하고 수료 시 40만원 장려금을 지급합니다.',
    '대구디지털혁신진흥원', 'https://www.dgdx.or.kr/youth',
    'active', 400000, 18, 39, ARRAY['daegu'],
    '2026-07-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-07-31 23:59:59+09'
);

-- ============================================================
-- 장학금 10건
-- ============================================================

-- 31. 한국장학재단 2유형
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '한국장학재단 2유형',
    '대학 자체 기준으로 선발된 학생에게 학기당 최대 200만원을 지원하는 대학 연계형 국가장학금입니다.',
    '한국장학재단', 'https://www.kosaf.go.kr/ko/scholar2.do',
    'active', 2000000, 18, 40, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-04-05 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-05 23:59:59+09'
);

-- 32. 지역인재장학금(부산)
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '지역인재장학금(부산)',
    '부산 지역 고교 졸업 후 부산 소재 대학에 진학한 학생에게 학기당 최대 250만원을 지원합니다.',
    '한국장학재단', 'https://www.kosaf.go.kr/ko/local_busan.do',
    'active', 2500000, 18, 30, ARRAY['busan'],
    '2026-04-10 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-10 23:59:59+09'
);

-- 33. 지역인재장학금(대구)
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '지역인재장학금(대구)',
    '대구 지역 고교 졸업 후 대구 소재 대학에 진학한 학생에게 학기당 최대 250만원을 지원합니다.',
    '한국장학재단', 'https://www.kosaf.go.kr/ko/local_daegu.do',
    'active', 2500000, 18, 30, ARRAY['daegu'],
    '2026-04-10 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-10 23:59:59+09'
);

-- 34. 이공계장학금
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '이공계장학금',
    '이공계 학과 재학 중인 대학생에게 성적·소득 기준을 충족하면 학기당 최대 300만원의 장학금을 지원합니다.',
    '한국장학재단', 'https://www.kosaf.go.kr/ko/stem.do',
    'active', 3000000, 18, 35, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-04-15 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-15 23:59:59+09'
);

-- 35. 예체능장학금
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '예체능장학금',
    '예술·체육 분야 특기자 또는 전공 대학생에게 실기·훈련 비용을 포함하여 학기당 최대 200만원을 지원합니다.',
    '한국장학재단', 'https://www.kosaf.go.kr/ko/arts.do',
    'active', 2000000, 18, 35, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-05-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-31 23:59:59+09'
);

-- 36. 민간장학재단A
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '민간장학재단A',
    '저소득 가정 우수 대학생에게 학기당 150만원 장학금과 함께 진로 멘토링 프로그램을 제공합니다.',
    '희망장학재단', 'https://www.hopescholar.or.kr/apply',
    'active', 1500000, 18, 30, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-04-20 23:59:59+09', true,
    '2026-03-15 00:00:00+09', '2026-04-20 23:59:59+09'
);

-- 37. 민간장학재단B
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '민간장학재단B',
    '지역 출신 대학생을 대상으로 학기당 100만원 장학금과 취업 연계 인턴십 기회를 제공하는 장학 프로그램입니다.',
    '미래인재장학재단', 'https://www.futurescholar.or.kr/apply',
    'active', 1000000, 18, 32, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-05-10 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-10 23:59:59+09'
);

-- 38. 교내 성적우수
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '교내 성적우수',
    '직전 학기 성적 상위 5% 이내 재학생에게 학기당 등록금 전액을 면제하는 교내 성적우수장학금입니다.',
    '각 대학교', 'https://portal.university.ac.kr/scholarship/academic',
    'active', 4000000, 18, 35, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-04-15 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-15 23:59:59+09'
);

-- 39. 교내 소득연계
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '교내 소득연계',
    '소득 4분위 이하 재학생에게 학기당 최대 200만원을 지원하는 소득 연계형 교내 장학금입니다.',
    '각 대학교', 'https://portal.university.ac.kr/scholarship/income',
    'active', 2000000, 18, 35, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-04-15 23:59:59+09', true,
    '2026-03-01 00:00:00+09', '2026-04-15 23:59:59+09'
);

-- 40. 외국인유학생장학금
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'scholarship', 'manual', '외국인유학생장학금',
    '국내 대학에 재학 중인 외국인 유학생에게 학기당 최대 250만원의 장학금과 생활비 보조를 지원합니다.',
    '국립국제교육원', 'https://www.niied.go.kr/user/foreign_scholarship.do',
    'active', 2500000, 18, 35, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-05-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-31 23:59:59+09'
);

-- ============================================================
-- 생활지원 10건
-- ============================================================

-- 41. 청년내일채움공제
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '청년내일채움공제',
    '중소기업에 취업한 만 15~34세 청년이 2년간 400만원을 적립하면 정부·기업이 1,600만원을 추가 지원해 총 2,000만원을 마련합니다.',
    '고용노동부', 'https://www.work.go.kr/youth/nyif.do',
    'active', 20000000, 15, 34, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-06-30 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-06-30 23:59:59+09'
);

-- 42. 청년구직활동지원금
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '청년구직활동지원금',
    '졸업·중퇴 후 2년 이내 만 18~34세 미취업 청년에게 월 50만원씩 최대 6개월간 구직 활동 비용을 지원합니다.',
    '고용노동부', 'https://www.work.go.kr/youth/jobseek.do',
    'active', 500000, 18, 34, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-05-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-31 23:59:59+09'
);

-- 43. 국민취업지원제도
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '국민취업지원제도',
    '취업 취약계층(만 15~69세)에게 구직촉진수당 월 50만원을 최대 6개월간 지급하고 취업 지원 서비스를 제공합니다.',
    '고용노동부', 'https://www.kua.go.kr',
    'active', 500000, 15, 69, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 44. 긴급복지지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '긴급복지지원',
    '갑작스러운 위기 상황(실직·질병·재난 등)에 처한 가구에게 생계비 월 최대 160만원, 의료비·주거비 등을 단기 지원합니다.',
    '보건복지부', 'https://www.mohw.go.kr/emergency',
    'active', 1600000, 0, 100, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 45. 기초생활보장
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '기초생활보장',
    '소득인정액이 기준 중위소득 30~50% 이하인 가구에게 생계·의료·주거·교육 급여를 지원하는 공공부조 제도입니다.',
    '보건복지부', 'https://www.mohw.go.kr/nbl',
    'active', 713000, 0, 100, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 46. 차상위계층 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '차상위계층 지원',
    '기준 중위소득 50% 이하 차상위계층에게 의료비 본인부담 경감, 전기료 감면, 문화누리카드 등 복합 지원 서비스를 제공합니다.',
    '보건복지부', 'https://www.mohw.go.kr/near-poverty',
    'active', 100000, 0, 100, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 47. 한부모가족 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '한부모가족 지원',
    '소득 기준을 충족하는 한부모가족(만 18세 미만 자녀 양육)에게 아동양육비 월 21만원 및 생활·교육·의료 지원을 제공합니다.',
    '여성가족부', 'https://www.mogef.go.kr/single-parent',
    'active', 210000, 0, 100, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 48. 장애학생 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '장애학생 지원',
    '장애 등록 대학생에게 학기당 등록금 전액 및 생활비 월 20만원, 학습 보조 기기 대여 서비스를 지원합니다.',
    '교육부', 'https://www.moe.go.kr/disability-student',
    'active', 5000000, 18, 40, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-05-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-31 23:59:59+09'
);

-- 49. 다문화가정 지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '다문화가정 지원',
    '다문화가정 자녀의 학교 적응과 학습을 위해 언어 교육·진학 지도·문화체험비를 월 15만원 내외로 지원합니다.',
    '여성가족부', 'https://www.mogef.go.kr/multicultural',
    'active', 150000, 0, 25, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-08-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-08-31 23:59:59+09'
);

-- 50. 보훈자녀 학비지원
INSERT INTO programs (
    program_type, source_type, title, summary, provider_name, official_url,
    program_status, benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at
) VALUES (
    'policy', 'manual', '보훈자녀 학비지원',
    '국가유공자 자녀 및 손자녀(만 25세 이하)에게 대학교 등록금 전액 및 생활보조비 학기당 50만원을 지원합니다.',
    '국가보훈처', 'https://www.mpva.go.kr/scholarship',
    'active', 4500000, 18, 25, ARRAY['busan','daegu','seoul','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi'],
    '2026-05-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-31 23:59:59+09'
);
