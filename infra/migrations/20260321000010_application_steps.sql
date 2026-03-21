-- Migration: application_steps
-- Adds application_steps JSONB column to programs and seeds step-by-step guides
-- for 13 major programs across scholarship, rent, loan, employment, startup categories.

ALTER TABLE programs ADD COLUMN IF NOT EXISTS application_steps JSONB;

-- ============================================================
-- 장학금 (scholarship)
-- ============================================================

-- 국가장학금 1유형 — 한국장학재단 온라인 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "서류 준비", "description": "재학증명서, 성적증명서, 소득금액증명원, 주민등록등본을 미리 발급해 두세요. 정부24(gov.kr)·홈택스에서 온라인 발급 가능합니다.", "url": null},
  {"step": 2, "title": "한국장학재단 로그인", "description": "한국장학재단 홈페이지에 접속한 뒤 공동인증서 또는 간편인증으로 로그인합니다.", "url": "https://www.kosaf.go.kr"},
  {"step": 3, "title": "장학금 신청", "description": "상단 메뉴 [장학금] → [국가장학금 신청]을 클릭하고 신청서를 작성합니다. 가구원 동의도 같은 기간 안에 완료해야 합니다.", "url": "https://www.kosaf.go.kr/ko/scholar.do"},
  {"step": 4, "title": "가구원 동의", "description": "부모(또는 배우자)가 공동인증서로 가구원 정보 제공에 동의해야 심사가 진행됩니다.", "url": "https://www.kosaf.go.kr"},
  {"step": 5, "title": "심사 대기", "description": "신청 완료 후 소득분위 산정까지 약 4~6주가 소요됩니다. 진행 상황은 홈페이지에서 확인할 수 있습니다.", "url": null},
  {"step": 6, "title": "장학금 수혜 확인", "description": "심사 결과가 문자로 통보됩니다. 수혜 확정 후 등록금 고지서에서 자동 차감 또는 계좌로 입금됩니다.", "url": null}
]'
WHERE title = '국가장학금 1유형';

-- 부산 인재육성 장학금 — 부산인재평생교육진흥원 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "서류 준비", "description": "재학증명서, 성적증명서(직전학기), 소득금액증명원, 주민등록등본, 통장 사본을 발급합니다.", "url": null},
  {"step": 2, "title": "공고 확인", "description": "부산인재평생교육진흥원 홈페이지에서 장학금 공고 기간과 제출 서류를 확인합니다.", "url": "https://www.bile.or.kr/scholarship"},
  {"step": 3, "title": "온라인 신청서 작성", "description": "진흥원 홈페이지에서 회원가입 후 장학금 신청 양식을 작성하고 서류를 첨부합니다.", "url": "https://www.bile.or.kr/scholarship"},
  {"step": 4, "title": "서류 심사", "description": "성적 및 소득 기준을 바탕으로 심사가 진행됩니다. 약 3~4주가 소요됩니다.", "url": null},
  {"step": 5, "title": "장학금 수혜", "description": "합격자 발표 후 신청 계좌로 장학금이 입금됩니다.", "url": null}
]'
WHERE title = '부산 인재육성 장학금';

-- ============================================================
-- 월세·주거 지원
-- ============================================================

-- 부산 청년 월세 지원 — 복지로 온라인 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "서류 준비", "description": "주민등록등본, 임대차계약서 사본, 소득금액증명원, 통장 사본을 미리 발급합니다.", "url": null},
  {"step": 2, "title": "복지로 접속", "description": "복지로 홈페이지에 접속한 뒤 공동인증서 또는 간편인증으로 로그인합니다.", "url": "https://www.bokjiro.go.kr"},
  {"step": 3, "title": "서비스 신청", "description": "[서비스 신청] → [주거] → [청년 월세 지원]을 선택하고 신청서를 작성합니다.", "url": "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do"},
  {"step": 4, "title": "서류 업로드", "description": "임대차계약서, 소득 서류 등을 스캔·촬영하여 첨부합니다.", "url": null},
  {"step": 5, "title": "심사 대기", "description": "접수 후 담당 공무원이 서류를 검토합니다. 약 2~4주 소요됩니다.", "url": null},
  {"step": 6, "title": "월세 지원 수혜", "description": "심사 통과 시 매달 지정 계좌로 월세 지원금이 입금됩니다.", "url": null}
]'
WHERE title = '부산 청년 월세 지원';

-- 대구 청년 주거 지원 — 복지로 온라인 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "서류 준비", "description": "주민등록등본, 임대차계약서 사본, 소득금액증명원, 통장 사본을 미리 발급합니다.", "url": null},
  {"step": 2, "title": "복지로 접속", "description": "복지로 홈페이지에서 공동인증서로 로그인합니다.", "url": "https://www.bokjiro.go.kr"},
  {"step": 3, "title": "주거 지원 신청", "description": "[서비스 신청] → [주거] → [청년 주거 지원]을 선택하고 대구 지역을 확인한 뒤 신청서를 작성합니다.", "url": "https://www.bokjiro.go.kr"},
  {"step": 4, "title": "서류 첨부", "description": "임대차계약서, 소득 서류 등을 스캔하여 첨부합니다.", "url": null},
  {"step": 5, "title": "심사 결과 확인", "description": "약 2~3주 후 문자 또는 복지로 홈페이지에서 결과를 확인합니다.", "url": null}
]'
WHERE title = '대구 청년 주거 지원';

-- 청년 월세 한시 특별지원 — 복지로 신청 (전국)
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "자격 확인", "description": "만 19~34세, 독립 거주(부모와 별도 주소), 중위소득 60% 이하 요건을 먼저 확인합니다.", "url": null},
  {"step": 2, "title": "서류 준비", "description": "주민등록등본, 주민등록초본(주소 이력), 임대차계약서 사본, 소득금액증명원, 통장 사본을 준비합니다.", "url": null},
  {"step": 3, "title": "복지로 신청", "description": "복지로 홈페이지에서 [서비스 신청] → [주거] → [청년 월세 한시 특별지원]을 선택합니다.", "url": "https://www.bokjiro.go.kr"},
  {"step": 4, "title": "주민센터 방문 (선택)", "description": "온라인 신청이 어려운 경우 거주지 관할 주민센터를 직접 방문하여 신청할 수 있습니다.", "url": null},
  {"step": 5, "title": "심사 및 지급", "description": "심사 후 최대 12개월간 매달 최대 20만원이 지정 계좌로 입금됩니다.", "url": null}
]'
WHERE title = '청년 월세 한시 특별지원';

-- ============================================================
-- 전세대출 (금융 상품)
-- ============================================================

-- 청년전용 버팀목전세대출 — 은행 앱 또는 방문 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "자격 및 한도 확인", "description": "주택도시기금 홈페이지에서 소득·나이·보증금 요건과 대출 한도를 먼저 확인합니다.", "url": "https://nhuf.molit.go.kr"},
  {"step": 2, "title": "서류 준비", "description": "주민등록등본, 임대차계약서 사본, 소득금액증명원, 주민등록초본(주소 이력)을 발급합니다.", "url": null},
  {"step": 3, "title": "은행 앱 또는 방문 신청", "description": "우리·신한·하나·국민·기업은행 앱에서 버팀목전세대출을 검색하거나 가까운 지점을 방문합니다.", "url": "https://nhuf.molit.go.kr/FP/FP05/FP0503/FP05030301.jsp"},
  {"step": 4, "title": "심사 및 보증 신청", "description": "은행이 소득·신용을 심사하고 주택도시보증공사(HUG) 또는 SGI서울보증에 보증을 신청합니다. 약 1~2주 소요됩니다.", "url": null},
  {"step": 5, "title": "대출 실행", "description": "임대차계약 잔금일에 맞춰 대출금이 임대인 계좌로 직접 송금됩니다.", "url": null}
]'
WHERE title LIKE '%버팀목전세대출%';

-- 청년도약계좌 — 은행 앱 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "소득 요건 확인", "description": "개인소득 7,500만원 이하, 가구소득 중위 180% 이하 요건을 확인합니다.", "url": "https://ylaccount.kinfa.or.kr"},
  {"step": 2, "title": "서류 준비", "description": "주민등록등본, 소득금액증명원, 건강보험료 납부확인서, 신분증을 준비합니다.", "url": null},
  {"step": 3, "title": "은행 앱 신청", "description": "취급 은행(국민·신한·하나·우리·농협·기업·대구·부산은행 등) 앱에서 청년도약계좌를 검색하여 가입 신청합니다.", "url": "https://ylaccount.kinfa.or.kr"},
  {"step": 4, "title": "비대면 심사", "description": "은행이 소득 자격을 확인합니다. 보통 1~2주 이내에 결과를 문자로 통보합니다.", "url": null},
  {"step": 5, "title": "계좌 개설 및 납입 시작", "description": "심사 통과 후 앱에서 계좌를 개설하고 매달 최대 70만원을 납입하면 정부 기여금이 매칭됩니다.", "url": null}
]'
WHERE title = '청년도약계좌';

-- ============================================================
-- 취업 지원
-- ============================================================

-- 부산 청년 취업 장려금 — 부산시 온라인 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "취업 후 신청 준비", "description": "부산 소재 중소기업에 취업한 날로부터 6개월 이내에 신청해야 합니다. 근로계약서, 4대보험 가입내역확인서, 주민등록등본, 통장 사본을 준비합니다.", "url": null},
  {"step": 2, "title": "고용24 구직 등록", "description": "고용24에서 구직 등록을 완료합니다(이미 등록된 경우 생략 가능).", "url": "https://www.work24.go.kr"},
  {"step": 3, "title": "부산시 청년일자리 포털 신청", "description": "부산 청년 일자리 포털에서 장려금 신청서를 작성하고 서류를 첨부합니다.", "url": "https://www.busan.go.kr/youth/employment"},
  {"step": 4, "title": "서류 심사", "description": "담당자가 취업 사실 및 대상 기업 해당 여부를 확인합니다. 약 2~3주 소요됩니다.", "url": null},
  {"step": 5, "title": "장려금 수령", "description": "심사 통과 시 신청 계좌로 100만원이 일시 입금됩니다.", "url": null}
]'
WHERE title = '부산 청년 취업 장려금';

-- 청년내일채움공제 — 고용24 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "정규직 취업 확인", "description": "중소·중견기업에 정규직으로 취업한 날로부터 6개월 이내에 신청해야 합니다.", "url": null},
  {"step": 2, "title": "고용24 접속 및 로그인", "description": "고용24 홈페이지에서 공동인증서 또는 간편인증으로 로그인합니다.", "url": "https://www.work24.go.kr"},
  {"step": 3, "title": "구직 등록 확인", "description": "고용24에서 구직 등록이 되어 있는지 확인합니다. 미등록 시 구직 등록을 먼저 완료합니다.", "url": "https://www.work24.go.kr"},
  {"step": 4, "title": "청년내일채움공제 신청", "description": "[지원금 신청] → [청년내일채움공제]를 선택하고 재직 기업 정보와 함께 신청서를 제출합니다.", "url": "https://www.work24.go.kr/cm/c/d/CMPCD001L.do"},
  {"step": 5, "title": "기업 확인", "description": "재직 중인 기업 담당자도 고용24에서 동의 처리를 해야 신청이 완료됩니다.", "url": null},
  {"step": 6, "title": "2년 납입 후 만기 수령", "description": "청년 본인이 2년간 월 12.5만원을 납입하면 만기 시 정부·기업 적립금 포함 1,200만원 이상을 수령합니다.", "url": null}
]'
WHERE title = '청년내일채움공제' AND program_type = 'policy';

-- 청년구직활동지원금 — 고용24 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "자격 확인", "description": "졸업(중퇴) 후 2년 이내, 미취업 상태, 중위소득 120% 이하 요건을 확인합니다.", "url": null},
  {"step": 2, "title": "고용24 구직 등록", "description": "고용24에서 구직 등록을 먼저 완료합니다. 구직등록 완료 후에야 지원금 신청이 가능합니다.", "url": "https://www.work24.go.kr"},
  {"step": 3, "title": "지원금 신청", "description": "고용24 [지원금 신청] → [청년구직활동지원금]을 선택하고 구직 활동 계획서를 작성합니다.", "url": "https://www.work24.go.kr/cm/c/d/CMPCD001L.do"},
  {"step": 4, "title": "서류 첨부", "description": "주민등록등본, 졸업(예정)증명서, 소득금액증명원을 온라인으로 첨부합니다.", "url": null},
  {"step": 5, "title": "지원금 수령", "description": "심사 통과 시 월 50만원씩 최대 6개월(최대 300만원)이 지정 계좌로 지급됩니다.", "url": null}
]'
WHERE title = '청년구직활동지원금';

-- 국민취업지원제도 — 고용24 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "자격 확인", "description": "연령(만 15~69세), 소득(중위소득 60% 이하), 재산 기준을 고용24에서 미리 확인합니다.", "url": "https://www.work24.go.kr"},
  {"step": 2, "title": "고용24 로그인 및 구직 등록", "description": "고용24에 공동인증서로 로그인 후 구직 등록을 완료합니다.", "url": "https://www.work24.go.kr"},
  {"step": 3, "title": "국민취업지원제도 신청", "description": "[지원금 신청] → [국민취업지원제도]를 선택하여 신청서를 작성합니다.", "url": "https://www.work24.go.kr/cm/c/d/CMPCD001L.do"},
  {"step": 4, "title": "취업지원 서비스 이수", "description": "고용센터 상담사와 개인 취업 활동 계획(IAP)을 수립하고 취업 지원 서비스에 참여합니다.", "url": null},
  {"step": 5, "title": "구직촉진수당 수령", "description": "1유형 인정 시 월 50만원씩 6개월 수령(최대 300만원). 취업 활동 의무를 성실히 이행해야 합니다.", "url": null}
]'
WHERE title = '국민취업지원제도';

-- ============================================================
-- 창업 지원
-- ============================================================

-- 부산 청년 창업 지원금 — 부산경제진흥원 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "공고 확인", "description": "부산경제진흥원 홈페이지에서 모집 공고, 지원 분야, 일정을 확인합니다.", "url": "https://www.bepa.kr/startup"},
  {"step": 2, "title": "사업계획서 작성", "description": "창업 아이디어, 시장 분석, 수익 모델, 자금 사용 계획이 포함된 사업계획서를 진흥원 양식에 맞게 작성합니다.", "url": null},
  {"step": 3, "title": "서류 준비 및 온라인 접수", "description": "주민등록등본, 소득금액증명원, 통장 사본, 사업계획서를 준비하고 진흥원 포털에서 온라인 접수합니다.", "url": "https://www.bepa.kr/startup"},
  {"step": 4, "title": "서류 심사 및 발표 심사", "description": "1차 서류 심사 후 통과자를 대상으로 2차 발표 심사(PT)가 진행됩니다. 약 3~4주 소요됩니다.", "url": null},
  {"step": 5, "title": "협약 체결 및 지원금 수령", "description": "최종 선정 후 진흥원과 협약을 체결하고 사업자등록 후 지원금 최대 300만원이 입금됩니다.", "url": null}
]'
WHERE title = '부산 청년 창업 지원금';

-- ============================================================
-- 저축·적금 지원
-- ============================================================

-- 기쁨두배통장 — 부산시 온라인 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "자격 확인", "description": "부산 거주 만 18~34세, 중위소득 100% 이하 요건을 확인합니다.", "url": null},
  {"step": 2, "title": "서류 준비", "description": "주민등록등본, 소득금액증명원, 건강보험료 납부확인서, 통장 사본을 준비합니다.", "url": null},
  {"step": 3, "title": "부산시 온라인 신청", "description": "부산시 청년 정책 홈페이지에서 기쁨두배통장 신청서를 작성하고 서류를 첨부합니다.", "url": "https://www.busan.go.kr/youth/happydouble"},
  {"step": 4, "title": "심사 및 가입 확정", "description": "소득 기준 충족 여부를 확인한 후 가입이 확정됩니다. 약 2~3주 소요됩니다.", "url": null},
  {"step": 5, "title": "매달 저축 납입", "description": "3년간 매달 10만원을 납입하면 부산시가 동일 금액을 매칭하여 만기 시 약 720만원 이상을 수령합니다.", "url": null}
]'
WHERE title = '기쁨두배통장';
