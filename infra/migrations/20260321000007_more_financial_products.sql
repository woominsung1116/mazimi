-- Migration: additional youth financial products and government support programs
--
-- Adds 20 additional programs covering:
--   loans/financial (대출/금융), housing (주거), regional (지역 특화), education/skills (교육/역량)
--
-- program_type values:
--   'financial_product' — loans, savings, tax benefits, wage subsidies
--   'policy'            — monthly cash subsidies, regional grants, vouchers
--   'welfare'           — public housing programs
--
-- All entries are source_type = 'manual'.
-- 전국 programs use regions = ARRAY[]::TEXT[].
-- Regional programs carry the city code in the regions array.

-- ── 1. 대학생 학자금 대출 (취업 후 상환) ────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '취업 후 상환 학자금 대출',
    '만 19~34세 대학생이 등록금 전액과 생활비 학기당 최대 400만원을 무이자 또는 저금리로 대출받고, 취업 후 소득이 발생하면 상환하는 한국장학재단의 학자금 대출 상품입니다. 재학 중에는 상환 의무가 없어 학업에 집중할 수 있습니다.',
    '한국장학재단', 'https://www.kosaf.go.kr/ko/loan01.do',
    'active',
    4000000, 19, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["취업후상환","학자금대출","한국장학재단","등록금","생활비","전국","상시","대학생"]'::jsonb,
    to_tsvector('simple',
        '취업후상환학자금대출 한국장학재단 등록금 생활비 대학생 저금리 무이자 전국 상시')
);

-- ── 2. 일반 상환 학자금 대출 ──────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '일반 상환 학자금 대출',
    '만 19~34세 대학생이 등록금과 생활비를 연 1~2%대 저금리로 대출받는 한국장학재단의 학자금 대출 상품입니다. 대출 즉시 상환이 시작되며 소득분위 제한 없이 신청 가능합니다.',
    '한국장학재단', 'https://www.kosaf.go.kr/ko/loan02.do',
    'active',
    NULL, 19, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["일반상환","학자금대출","한국장학재단","등록금","생활비","저금리","전국","상시","대학생"]'::jsonb,
    to_tsvector('simple',
        '일반상환학자금대출 한국장학재단 등록금 생활비 저금리 대학생 전국 상시')
);

-- ── 3. 청년 창업자금 대출 ─────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '청년 창업자금 대출',
    '만 19~39세 예비 창업자 및 창업 후 7년 이내 청년 대표자에게 최대 1억원을 연 2%의 고정 저금리로 지원하는 중소벤처기업진흥공단의 정책 자금 대출 상품입니다. 창업 초기 운전자금 및 시설 자금으로 활용 가능합니다.',
    '중소벤처기업진흥공단', 'https://www.kosmes.or.kr',
    'active',
    100000000, 19, 39, ARRAY[]::TEXT[],
    NULL, true,
    '["창업자금","청년창업","저금리대출","중소벤처기업진흥공단","스타트업","전국","상시"]'::jsonb,
    to_tsvector('simple',
        '청년창업자금대출 중소벤처기업진흥공단 창업 저금리 스타트업 운전자금 시설자금 전국 상시')
);

-- ── 4. 청년전용 전세보증금 반환보증 ─────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '청년전용 전세보증금 반환보증',
    '만 19~34세 청년 임차인이 전세 계약 만료 시 집주인으로부터 보증금을 돌려받지 못할 경우 HUG주택도시보증공사가 대신 반환해주는 보증 상품입니다. 보증료 할인 혜택이 적용되어 청년 전세 사기 피해를 예방할 수 있습니다.',
    'HUG주택도시보증공사', 'https://www.khug.or.kr',
    'active',
    NULL, 19, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["전세보증금","반환보증","HUG","전세사기","청년전용","주거안전","전국","상시"]'::jsonb,
    to_tsvector('simple',
        '청년전용전세보증금반환보증 HUG주택도시보증공사 전세보증 반환보증 전세사기 주거안전 전국 상시')
);

-- ── 5. 청년 우대형 ISA ────────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '청년 우대형 ISA',
    '만 19~34세 청년에게 일반 ISA 대비 비과세 한도를 400만원(일반 200만원)으로 확대하고 추가 이율 혜택을 제공하는 개인종합자산관리계좌입니다. 금융위원회에서 운영하며 주식·펀드·예금을 한 계좌에서 통합 관리할 수 있습니다.',
    '금융위원회', 'https://www.fsc.go.kr',
    'active',
    4000000, 19, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["ISA","개인종합자산관리계좌","비과세","금융위원회","자산관리","전국","상시","절세"]'::jsonb,
    to_tsvector('simple',
        '청년우대형ISA 개인종합자산관리계좌 비과세 금융위원회 자산관리 절세 전국 상시')
);

-- ── 6. 중소기업 취업 청년 소득세 감면 ───────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '중소기업 취업 청년 소득세 감면',
    '중소기업에 취업한 만 15~34세 청년의 소득세를 취업일로부터 5년간 90% 감면해주는 세제 혜택입니다. 국세청에서 관리하며 연말정산 시 자동 적용됩니다. 중소기업 취업을 장려하고 청년 가처분소득을 높이기 위한 지원책입니다.',
    '국세청', 'https://www.nts.go.kr',
    'active',
    NULL, 15, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["소득세감면","중소기업취업","세제혜택","국세청","연말정산","전국","상시","5년감면"]'::jsonb,
    to_tsvector('simple',
        '중소기업취업청년소득세감면 국세청 소득세감면 세제혜택 중소기업 연말정산 전국 상시')
);

-- ── 7. 청년 고용장려금 ────────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '청년 고용장려금',
    '만 15~34세 청년을 정규직으로 신규 채용한 중소·중견기업에 월 최대 80만원을 1년간 지원하는 고용노동부의 채용 장려금 사업입니다. 청년 구직자의 취업 기회 확대 및 중소기업의 청년 채용 부담을 완화하기 위해 운영됩니다.',
    '고용노동부', 'https://www.work.go.kr',
    'active',
    800000, 15, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["고용장려금","청년채용","중소기업","고용노동부","취업지원","전국","상시","정규직"]'::jsonb,
    to_tsvector('simple',
        '청년고용장려금 고용노동부 청년채용 중소기업 취업 정규직 전국 상시')
);

-- ── 8. 청년 매입임대주택 ──────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'welfare', 'manual',
    '청년 매입임대주택',
    'LH한국토지주택공사가 기존 주택을 매입하여 만 19~39세 무주택 청년에게 주변 시세의 40~50% 수준으로 임대하는 공공임대주택 사업입니다. 1인 가구 청년을 위한 소형 주택 위주로 공급되며 최장 6년간 거주 가능합니다.',
    'LH한국토지주택공사', 'https://www.lh.or.kr',
    'active',
    NULL, 19, 39, ARRAY[]::TEXT[],
    NULL, true,
    '["매입임대주택","공공임대","LH","청년주거","시세40%","무주택","전국","주거지원"]'::jsonb,
    to_tsvector('simple',
        '청년매입임대주택 LH한국토지주택공사 공공임대 청년주거 무주택 저렴임대 전국')
);

-- ── 9. 청년 전세임대주택 ──────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'welfare', 'manual',
    '청년 전세임대주택',
    'LH한국토지주택공사가 만 19~39세 무주택 청년이 직접 선택한 주택의 전세금을 대신 지급하고, 청년은 저렴한 임대료만 LH에 납부하는 전세 지원 프로그램입니다. 수도권 최대 1억 2천만원, 지방 최대 8천만원의 전세금을 지원합니다.',
    'LH한국토지주택공사', 'https://www.lh.or.kr',
    'active',
    120000000, 19, 39, ARRAY[]::TEXT[],
    NULL, true,
    '["전세임대주택","전세지원","LH","청년주거","무주택","공공임대","전국","주거지원"]'::jsonb,
    to_tsvector('simple',
        '청년전세임대주택 LH한국토지주택공사 전세지원 공공임대 청년주거 무주택 전국')
);

-- ── 10. 행복주택 청년 특별공급 ───────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'welfare', 'manual',
    '행복주택 청년 특별공급',
    '만 19~39세 무주택 청년(대학생·취업준비생·사회초년생)에게 주변 시세의 60~80% 수준 임대료로 공급하는 LH의 공공임대주택입니다. 역세권 등 교통 편의 지역에 공급되며 최장 6년 거주가 가능합니다.',
    'LH한국토지주택공사', 'https://www.lh.or.kr/menu.do?method=MENU_LH_4010',
    'active',
    NULL, 19, 39, ARRAY[]::TEXT[],
    NULL, true,
    '["행복주택","공공임대","LH","청년주거","역세권","시세60%","무주택","전국","특별공급"]'::jsonb,
    to_tsvector('simple',
        '행복주택청년특별공급 LH한국토지주택공사 공공임대 청년주거 역세권 무주택 전국')
);

-- ── 11. 부산 청년 창업지원금 ─────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '부산 청년 창업지원금',
    '부산 거주 만 19~39세 청년 예비창업자 및 창업 3년 이내 사업자에게 사업화 자금을 최대 3,000만원까지 지원하는 부산광역시의 창업 지원 사업입니다. 사업계획서 심사를 통해 선발하며 멘토링 및 사무공간 연계 지원도 제공됩니다.',
    '부산광역시', 'https://www.busan.go.kr/bizstartup',
    'active',
    30000000, 19, 39, ARRAY['busan'],
    NULL, true,
    '["창업지원금","청년창업","부산","사업화자금","예비창업자","지역지원","상시"]'::jsonb,
    to_tsvector('simple',
        '부산청년창업지원금 부산광역시 창업 사업화자금 예비창업자 멘토링 부산 상시')
);

-- ── 12. 부산 청년 취업장려금 ─────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '부산 청년 취업장려금',
    '부산 거주 만 18~34세 청년이 부산 소재 중소기업에 정규직으로 취업할 경우 월 50만원씩 6개월간 총 300만원을 지원하는 부산광역시의 취업 지원 사업입니다. 부산 청년의 지역 내 정착 및 중소기업 취업을 장려하기 위해 운영됩니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/employment',
    'active',
    500000, 18, 34, ARRAY['busan'],
    NULL, true,
    '["취업장려금","청년취업","부산","중소기업","정규직","월지원금","지역정착","상시"]'::jsonb,
    to_tsvector('simple',
        '부산청년취업장려금 부산광역시 청년취업 중소기업 정규직 월지원금 부산 상시')
);

-- ── 13. 대구 청년 취업지원금 ─────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '대구 청년 취업지원금',
    '대구 거주 만 18~34세 미취업 청년이 대구 소재 기업에 취업하거나 직업훈련에 참여할 경우 최대 300만원을 지원하는 대구광역시의 청년 고용 촉진 사업입니다. 취업 준비 비용 및 초기 정착을 돕기 위한 일회성 지원금입니다.',
    '대구광역시', 'https://www.daegu.go.kr/youth/employment',
    'active',
    3000000, 18, 34, ARRAY['daegu'],
    NULL, true,
    '["취업지원금","청년취업","대구","미취업청년","고용촉진","지역지원","상시"]'::jsonb,
    to_tsvector('simple',
        '대구청년취업지원금 대구광역시 청년취업 미취업 고용촉진 취업준비 대구 상시')
);

-- ── 14. 대구 청년 창업 패키지 ────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '대구 청년 창업 패키지',
    '대구 거주 만 19~39세 예비창업자 및 창업 7년 이내 청년 대표자에게 최대 5,000만원의 사업화 자금과 함께 전문 멘토링, 사무 공간, 네트워킹 프로그램을 패키지로 지원하는 대구창조경제혁신센터의 창업 육성 프로그램입니다.',
    '대구창조경제혁신센터', 'https://ccei.creativekorea.or.kr/daegu',
    'active',
    50000000, 19, 39, ARRAY['daegu'],
    NULL, true,
    '["창업패키지","청년창업","대구","사업화자금","멘토링","사무공간","창조경제혁신센터","상시"]'::jsonb,
    to_tsvector('simple',
        '대구청년창업패키지 대구창조경제혁신센터 창업 사업화자금 멘토링 사무공간 대구 상시')
);

-- ── 15. 부산 청년 문화패스 ───────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '부산 청년 문화패스',
    '부산 거주 만 19~34세 청년에게 공연·전시·영화 등 문화 예술 분야 이용권을 연 10만원 상당 제공하는 부산문화재단의 문화 바우처 사업입니다. 부산 소재 문화 시설 및 공연장에서 사용 가능하며 청년 문화 향유 기회를 높이기 위해 운영됩니다.',
    '부산문화재단', 'https://www.bscf.or.kr',
    'active',
    100000, 19, 34, ARRAY['busan'],
    NULL, true,
    '["문화패스","문화바우처","부산","공연","전시","문화재단","문화비지원","상시"]'::jsonb,
    to_tsvector('simple',
        '부산청년문화패스 부산문화재단 문화바우처 공연 전시 영화 문화비지원 부산 상시')
);

-- ── 16. 국민내일배움카드 ─────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '국민내일배움카드',
    '취업 준비 중이거나 재직 중인 만 15세 이상 국민 누구나 직업능력개발 훈련비를 300~500만원 범위에서 지원받는 고용노동부의 직업훈련 바우처입니다. IT·디자인·어학·회계 등 다양한 분야의 국가 인증 훈련 과정에 사용할 수 있으며 5년간 유효합니다.',
    '고용노동부', 'https://www.hrd.go.kr',
    'active',
    5000000, 15, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["내일배움카드","직업훈련","고용노동부","훈련비","자격증","취업준비","전국","상시","바우처"]'::jsonb,
    to_tsvector('simple',
        '국민내일배움카드 고용노동부 직업훈련 훈련비 자격증 취업준비 바우처 전국 상시')
);

-- ── 17. 청년 디지털 아카데미 ─────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '청년 디지털 아카데미',
    '만 19~34세 청년을 대상으로 AI·빅데이터·클라우드·소프트웨어 분야 전문 교육을 무료로 제공하고, 교육 기간 중 월 훈련수당을 지급하는 과기정통부 주관 디지털 인재 양성 프로그램입니다. 수료 후 취업 연계까지 지원합니다.',
    '과학기술정보통신부', 'https://www.msit.go.kr',
    'active',
    400000, 19, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["디지털아카데미","IT교육","AI","빅데이터","클라우드","과기정통부","훈련수당","전국","무료교육"]'::jsonb,
    to_tsvector('simple',
        '청년디지털아카데미 과학기술정보통신부 AI 빅데이터 클라우드 소프트웨어 훈련수당 전국 무료교육')
);

-- ── 18. K-디지털 트레이닝 ────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    'K-디지털 트레이닝',
    '만 15세 이상 구직자를 대상으로 AI·SW·데이터 분야 6개월 집중 부트캠프를 교육비 전액 무료로 운영하고 훈련수당을 지급하는 고용노동부의 디지털 역량 강화 사업입니다. 대기업·중견기업과의 취업 연계 프로그램이 함께 운영됩니다.',
    '고용노동부', 'https://www.work.go.kr/kdigital',
    'active',
    400000, 15, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["K디지털트레이닝","부트캠프","고용노동부","AI","SW","데이터","무료교육","훈련수당","전국","취업연계"]'::jsonb,
    to_tsvector('simple',
        'K디지털트레이닝 고용노동부 부트캠프 AI SW 데이터 무료교육 훈련수당 취업연계 전국')
);

-- ── 19. 부산 청년 해외취업지원 ──────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '부산 청년 해외취업지원',
    '부산 거주 만 18~34세 청년이 해외 기업에 취업할 경우 항공료와 현지 정착 비용을 합산하여 최대 500만원을 지원하는 부산경제진흥원의 해외 취업 지원 사업입니다. 사전 어학 교육 및 해외 취업 컨설팅 서비스도 함께 제공됩니다.',
    '부산경제진흥원', 'https://www.bepa.kr',
    'active',
    5000000, 18, 34, ARRAY['busan'],
    NULL, true,
    '["해외취업","항공료지원","정착금","부산","글로벌취업","부산경제진흥원","상시"]'::jsonb,
    to_tsvector('simple',
        '부산청년해외취업지원 부산경제진흥원 해외취업 항공료 정착금 글로벌 부산 상시')
);

-- ── 20. 대구 청년 직무교육 바우처 ───────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '대구 청년 직무교육 바우처',
    '대구 거주 만 18~34세 미취업 청년 및 재직 청년에게 직무 역량 향상 교육비를 최대 100만원 범위에서 바우처로 지원하는 대구광역시의 교육 지원 사업입니다. IT·경영·어학·디자인 등 분야 민간 교육기관의 강의를 자유롭게 선택하여 수강할 수 있습니다.',
    '대구광역시', 'https://www.daegu.go.kr/youth/education',
    'active',
    1000000, 18, 34, ARRAY['daegu'],
    NULL, true,
    '["직무교육바우처","교육비지원","대구","역량강화","IT교육","민간교육","상시","바우처"]'::jsonb,
    to_tsvector('simple',
        '대구청년직무교육바우처 대구광역시 직무교육 교육비지원 역량강화 IT 민간교육 바우처 대구 상시')
);
