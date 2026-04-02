# 마지미 PSST 사업계획서 예시페이지형 원고

## 1. 일반현황
- 창업아이템명: 마지미
- 분류: AI 기반 App 서비스
- 산출물(협약기간 내 목표): 모바일 App(PWA) 기반 맞춤 정책·장학금 추천 및 신청 준비 자동화 서비스 MVP
- 직업(협약 종료 1년 후): 기업(예정)명 마지미
- 팀 구성 현황(대표자 본인 포함)
  - 대표 / 개발 / 디자인 / 사업운영
  - 서비스 기획, 추천엔진 설계, UI/UX, 사업화 및 제휴 운영
  - 실제 인원/직책은 보유 팀 기준으로 교체

## 2. 창업 아이템 개요(요약)
부산·대구 19–29세 대학생·휴학생·취준생이 이번 달, 이번 학기에 받을 수 있는 정책·복지·장학금을 한 번에 찾고 놓치지 않게 해주는 맞춤형 혜택 실행 플랫폼 “마지미”

- 핵심기능 1: 개인 맞춤 추천 및 자격 사전판별
- 핵심기능 2: 놓친 돈 계산기와 혜택 비교
- 핵심기능 3: 마감 알림, 서류 보관함, 신청 상태 추적
- 핵심기능 4: PRO 전환 시 서류 입력 자동화 및 제휴처 한정 원클릭 신청

- 서비스 메커니즘: 온보딩 입력 → 추천엔진 → 적합도/마감/서류 분석 → 공식 신청처 연결
- 소비자 편익: “내가 받을 수 있는 것”을 바로 확인하고, “지금 해야 할 일”을 즉시 파악
- 비즈니스모델: FREE(추천·탐색·비교·보관함) + PRO(서류 입력 자동화·제휴처 원클릭 신청) + 제휴 수수료
- 핵심차별성: 정보 제공형 앱이 아니라 신청 준비와 실행까지 이어주는 실행형 플랫폼. 기존 서비스(온통청년·정부24·복지로 등)는 정보 나열과 링크 이동 중심이며, 자격 사전판별·서류 자동화·신청 추적을 통합 제공하는 서비스는 부재함.

[이미지 삽입 위치] 서비스 메커니즘 / 핵심 화면 목업 / 수익구조 / 사용자 흐름

## 3. 문제 인식 (Problem)
- 시장동향 및 증가양상: 청년 대상 정책·장학금·복지 프로그램은 매년 증가하고 있으나(2021년 중앙 308개+지자체 1,258개=1,566개 과제, 예산 2021년 23조→2025년 28조원 [[국무조정실 청년정책 시행계획](https://www.opm.go.kr/opm/info/youth_implementation.do)] [[KDI 2025년 청년정책 예산 분석](https://eiec.kdi.re.kr/policy/domesticView.do?ac=0000194123)]), 실제 사용자는 정부 사이트·지자체 포털·대학 공지에 분산된 정보를 직접 탐색해야 함.
- 문제점 ① 정보 파편화: 온통청년·복지로·정부24·고용24·부산청년플랫폼·대구청년정책 포털 등 7개 이상의 공식 채널이 분산 운영되고 있으며, KDI도 “개별 부처·사업 단위로 분산 구축 → 정보 전달력 저하”를 공식 지적함 [[KDI 나라경제](https://eiec.kdi.re.kr/publish/naraView.do?fcode=00002000040000100001&cidx=15178&sel_year=2025&sel_month=06)] [[온통청년 바로가기(14개 부처 링크 나열)](https://www.youthcenter.go.kr/youthPolicy/ythPlcyLinkMain)].
- 문제점 ② 신청 준비 부담: 청년 10명 중 4명(43.8%)이 정부 정책이 “실효성 없다”고 응답했으며, 임대차계약서·통장사본·가족관계증명서 등 방대한 제출 서류와 복잡한 절차로 신청 포기 사례가 다수 보고됨 [[뉴스핌](https://www.newspim.com/news/view/20240814000643)]. 청년정책에 관심이 있다고 응답한 비율은 73.1%이나 실제 수혜 경험은 43.7%에 불과해 약 30%p의 실행 갭이 존재함 [[한국청년재단 설문조사](https://kyf.or.kr/user/boardDetail.do?bbsId=BBSMSTR_000000000450&nttNo=7124)].
- 문제점 ③ 행동 유도 실패: 청년 521명 대상 조사에서 정책을 “상세히 안다” 15.5%, “들었거나 전혀 모른다” 84.5%로 인지율이 극히 낮으며, 저소득층 인지율은 7.1%로 고소득층(33.3%) 대비 4.7배 격차 존재 [[아시아경제](https://www.asiae.co.kr/article/2026022011075035575)] [[청년일보](https://www.youthdaily.co.kr/news/article.html?no=213550)]. 국가장학금의 경우 1차 마감 누락자를 위한 2차 구제 신청 제도를 별도 운영할 정도로 마감 누락이 구조적으로 발생함 [[KB의 생각](https://kbthink.com/life/daily/national-scholarship.html)].
- 소비자 Needs: “내가 받을 수 있는 것만 보여달라”, “지금 준비할 서류를 알려달라”, “마감 전에 놓치지 않게 해달라”.
- 정량적 기대효과: 추천 정확도 향상, 탐색 시간 단축, 신청 준비시간 절감, 마감 누락 감소를 목표로 함. 현재 고립·은둔 청년 54만명, 사회적 손실 연간 7조원으로 추정되며 [[보건복지부 보도자료](https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=1479278&act=view)], 정책 접근성 개선을 통한 사각지대 해소가 시급함.

[이미지 삽입 위치] 정책/장학금 정보 분산 구조도, 탐색 시간 문제 그래프, 사용자 pain point 인포그래픽

## 4. 실현 가능성 (Solution)
- 선행 준비현황: 부산·대구 19–29세 대학생·휴학생·취준생을 핵심 타깃으로 정의했고, MVP 핵심 기능을 온보딩 설문·추천 리스트·상세 자격 체크·마감 알림·서류 체크리스트·통합 대시보드로 확정함.
- 데이터 구축:
  - **행정안전부 공공서비스(혜택) 정보 API**: 정부24 기반 공공서비스 혜택 데이터 제공. 토스 '숨은 정부지원금' 등 상용 서비스에서 실사용 중인 검증된 API [[공공데이터포털 API 페이지](https://www.data.go.kr/data/15113968/openapi.do)]
  - **온통청년 Open API**: 청년정책 조회(getPlcy), 공간(getSpace), 콘텐츠(getContent) 등 엔드포인트 제공. 한국고용정보원 운영 [[온통청년 API 문서](https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc)] [[API 이용방법](https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiGuide)]
  - **부산 청년정책 포털**: 청년지원사업 목록 및 정책 캘린더 제공 [[부산청년플랫폼](https://young.busan.go.kr/)]
  - **대구 청년정책 포털**: 대구 청년정책 종합 안내, 청년커뮤니티 '젊프' 연계 [[대구 청년정책](https://www.daegu.go.kr/YouthPolicy)] [[젊프 커뮤니티](https://www.dgjump.com/)]
  - **한국장학재단**: 국가장학금·근로장학금·우수장학금 등 장학금 정보 및 공공데이터 제공 [[한국장학재단](https://www.kosaf.go.kr/ko/scholar.do?pg=scholarship_main)] [[공공데이터포털 학자금지원정보](https://www.data.go.kr/data/15028252/fileData.do)]
  - 상기 공개 API 및 포털 데이터를 기반으로, 공개 공지 수동 검수를 병행할 계획임.
- 추천엔진: 하드 필터(연령·지역·신분·마감일) + 룰 매칭 + 스코어링 방식으로 설명 가능한 추천을 구현함.
- 개발 프로세스: Next.js 프론트엔드, Rust Axum 백엔드, PostgreSQL, Redis, Docker 구조로 MVP를 구현하고 운영자 수정이 가능한 관리자 기능을 함께 설계함.
- 최종 산출물: 공식 신청처와 연결되는 모바일 App(PWA) 형태의 추천·관리 서비스 MVP를 협약기간 내 산출함.
- 차별성 요소: 단순 공고 나열이 아닌 자격 사전판별, 놓친 돈 계산, 서류 보관·자동화, 신청 상태 추적을 하나의 흐름으로 제공함.

[이미지 삽입 위치] 시스템 아키텍처, 데이터 수집-정규화-추천 프로세스, 서비스 플로우차트

## 5. 성장전략 (Scale-up)
- 경쟁사 분석 및 상대우위 요소: 기존 복지/정책 정보 서비스는 “정보 제공 → 링크 이동” 중심인 반면, 마지미는 “추천 → 비교 → 서류 준비 → 신청 도우미 → 상태 추적”의 실행 흐름을 제공함.
  - 주요 경쟁/유사 서비스: 온통청년 [[youthcenter.go.kr](https://www.youthcenter.go.kr/)], 정부24/보조금24 [[gov.kr](https://www.gov.kr/portal/rcvfvrSvc/main)], 복지로 [[bokjiro.go.kr](https://www.bokjiro.go.kr/)], 고용24 [[work24.go.kr](https://www.work24.go.kr)], 부산청년플랫폼 [[young.busan.go.kr](https://young.busan.go.kr/)], 대구청년정책 [[daegu.go.kr/YouthPolicy](https://www.daegu.go.kr/YouthPolicy)]
- 차별화 포인트 ①: 개인 조건 기반 추천과 자격 사전판별로 탐색 피로를 줄임.
- 차별화 포인트 ②: 마감일 알림, 신청 상태 추적, 혜택 중복 계산으로 반복 사용을 유도함.
- 차별화 포인트 ③: 유료 버전에서는 서류 입력 자동화와 제휴처 한정 원클릭 신청을 제공하여 실행까지 연결함.
- 목표시장(TAM/SAM/SOM):
  - **TAM**: 청년 정책·장학금 탐색이 필요한 전국 청년층. 청년정책 예산 연간 28조원(2025년 기준) [[국무조정실](https://www.opm.go.kr/opm/info/youthPolicy.do)], 국가장학금 연간 4조 4,447억원(2023년) 수혜 79.4만명 [[정책브리핑](https://www.korea.kr/news/policyNewsView.do?newsId=148911471)] [[공공데이터포털 장학금 통계연보](https://www.data.go.kr/data/3060496/fileData.do)]
  - **SAM**: 부산·대구 19–29세 대학생·휴학생·취준생. 부산 20-29세 333,602명, 대구 20-29세 249,677명(2026년 3월 기준) [[행정안전부 주민등록 인구통계](https://jumin.mois.go.kr/ageStatMonth.do)]. 대학생 수는 한국교육개발원 고등교육통계 참조 [[KEDI 고등교육통계](https://hi.kedi.re.kr/)] [[교육통계서비스 데이터셋](https://kess.kedi.re.kr/contents/dataset)]
  - **SOM**: 출시 초기 부산·대구 지역 내 핵심 사용자군
- 비즈니스 모델: FREE(추천/탐색/비교/보관함/기본 자동입력) + PRO(서류 입력 자동화/신청 항목 자동 매핑/제휴처 원클릭 신청) + 제휴 수수료.
- 마케팅 전략: 에브리타임(MAU 300만명 이상, 누적 가입자 662만명, Z세대 비율 85.3% [[디지털데일리](https://m.ddaily.co.kr/page/view/2023022011311623788)] [[플래텀](https://platum.kr/archives/263552)]), 대학 커뮤니티, 청년정책 포털 연계 콘텐츠, 대학생 대상 SNS·오픈채팅·캠퍼스 제휴 중심으로 초기 모객을 진행함. 청년재단 설문 기준 청년의 정책 정보 접근 경로 1위는 SNS(62.3%)로, 모바일·소셜 채널 중심 전략이 유효함 [[서울경제](https://www.sedaily.com/NewsView/2GY1WI49CK)].
- 성과지표: 설문 완료율, 추천 조회율, 북마크율, 공식 신청처 클릭률, 신청 상태 변경률, D-Day 알림 클릭률, 7일 재방문율을 핵심 KPI로 설정함.
- 전체 사업화 계획: 1단계 부산·대구 핵심 데이터 축적 → 2단계 PRO 자동화 도입 → 3단계 제휴처 확대 및 지역 확장.
- ESG 효과: 정책 접근성 격차를 줄이고 청년층의 정보 비대칭을 완화해 실질 수혜 기회를 높이는 사회적 가치를 보유함. 현재 저소득 청년의 정책 인지율(7.1%)은 고소득 청년(33.3%)의 1/5 수준으로 소득에 따른 정보 격차가 심각 [[아시아경제](https://www.asiae.co.kr/article/2026022011075035575)].

[이미지 삽입 위치] 경쟁사 비교표, TAM/SAM/SOM 도식, 수익구조도, 마케팅 퍼널

## 6. 팀 구성 (Team)
- 대표: 청년 정책·장학금 탐색의 실제 문제를 경험하거나 이해하고 있으며, 서비스 기획·사업화·제휴 운영을 총괄함.
- 개발: Next.js, Rust Axum, PostgreSQL, Docker 기반으로 추천 로직·데이터 파이프라인·관리자 도구를 구현할 수 있는 역량을 보유함.
- 디자인/운영: 온보딩, 추천 카드, 체크리스트, 신청 도우미 등 사용 흐름 중심의 UX 설계와 콘텐츠 운영을 담당함.
- 사업/마케팅: 대학 커뮤니티, 지역 청년정책 채널, 제휴처 발굴 및 운영, 유료 전환 실험을 담당함.
- 팀원 현황 및 고용계획: 핵심 기능 개발을 우선 수행하고, 데이터 검수·콘텐츠 운영·마케팅 영역은 협약기간 내 보강 채용 또는 외부 협업으로 확대할 계획임.
- 협력기관/기업: 부산·대구 청년정책 관련 기관, 대학 학생처, 장학재단, 제휴 금융·주거·교육 파트너와의 연계를 추진함.

[이미지 삽입 위치] 시작 화면 / 온보딩 설문 / 맞춤 추천 카드 / 혜택 비교 / 신청 도우미 / 서류 보관함 / PRO 서류 입력 자동화 / 원클릭 신청 화면 / 관리자 화면 / 데이터 파이프라인 / 알림 구조

## 7. 제목안
- [부산·대구 19–29세 청년을 위한] [AI 기반 정책·장학금 추천 및 신청 준비 자동화] [원스톱 App 플랫폼] [마지미]
- [받을 수 있는 혜택을 몰라 놓치는 대학생·휴학생·취준생을 위한] [맞춤 추천 + 마감·서류 관리] [실행형 App 서비스] [마지미]
- [부산·대구 청년의 혜택 누락 문제를 해결하는] [AI 맞춤 추천 + 신청 준비 자동화] [정책·장학금 실행 플랫폼] [마지미]

## 8. 요약문구
- 마지미는 부산·대구 19–29세 대학생·휴학생·취준생이 받을 수 있는 정책·복지·장학금을 한 번에 찾고 놓치지 않게 해주는 맞춤형 혜택 실행 플랫폼이다.
- 단순 정보 검색이 아니라 자격 사전판별, 예상 수혜액 계산, 마감 알림, 서류 보관·자동화, 공식 신청처 연결을 통합 제공한다.
- 초기에는 정확한 추천과 신청 준비 관리에 집중하고, 이후 PRO 자동화와 제휴처 한정 원클릭 신청으로 확장해 수익화한다.

---

## 참고 출처 (References)

### 정책·통계 데이터
| # | 출처 | URL |
|---|------|-----|
| 1 | 국무조정실 청년정책 시행계획 | https://www.opm.go.kr/opm/info/youth_implementation.do |
| 2 | 국무조정실 청년정책 개요 (예산 추이) | https://www.opm.go.kr/opm/info/youthPolicy.do |
| 3 | KDI 2025년 청년정책 예산 분석 | https://eiec.kdi.re.kr/policy/domesticView.do?ac=0000194123 |
| 4 | 제2차 청년정책 기본계획 ('26~'30) PDF | https://www.opm.go.kr/_res/opm/etc/opm_youth_plan2.pdf |
| 5 | 2024년 청년의 삶 실태조사 (정책브리핑) | https://www.korea.kr/briefing/pressReleaseView.do?newsId=156678299 |
| 6 | 행정안전부 주민등록 인구통계 (연령별) | https://jumin.mois.go.kr/ageStatMonth.do |
| 7 | KOSIS 성/연령별 추계인구 | https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1BPA001&conn_path=I2 |
| 8 | 공공데이터포털 지역별 연령별 주민등록 인구현황 | https://www.data.go.kr/data/3033304/fileData.do |

### 장학금·교육 통계
| # | 출처 | URL |
|---|------|-----|
| 9 | 국가장학금 지급 현황 (정책브리핑) | https://www.korea.kr/news/policyNewsView.do?newsId=148911471 |
| 10 | 공공데이터포털 장학금 통계연보 | https://www.data.go.kr/data/3060496/fileData.do |
| 11 | 공공데이터포털 국가장학금 신청·수혜인원 | https://www.data.go.kr/data/15114806/fileData.do |
| 12 | KEDI 고등교육통계 | https://hi.kedi.re.kr/ |
| 13 | 교육통계서비스 데이터셋 | https://kess.kedi.re.kr/contents/dataset |

### 문제 인식 근거 (설문·연구·보도)
| # | 출처 | URL |
|---|------|-----|
| 14 | 아시아경제: "청년 10명 중 8명 정책 계획 모른다" | https://www.asiae.co.kr/article/2026022011075035575 |
| 15 | 청년일보: "청년 10명 중 8명 세부 내용 모른다" | https://www.youthdaily.co.kr/news/article.html?no=213550 |
| 16 | KCI 논문: 청년정책 인식 탐색적 연구 (잠재계층분석) | https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002953804 |
| 17 | 한국청년재단 설문조사 결과보고서 | https://kyf.or.kr/user/boardDetail.do?bbsId=BBSMSTR_000000000450&nttNo=7124 |
| 18 | 서울경제: 청년재단 2025 청년정책 인식 설문 | https://www.sedaily.com/NewsView/2GY1WI49CK |
| 19 | 뉴스핌: "청년 10명 중 4명 일자리 정책 실효성 없다" | https://www.newspim.com/news/view/20240814000643 |
| 20 | KDI 나라경제: 정책 전달 체계 지적 | https://eiec.kdi.re.kr/publish/naraView.do?fcode=00002000040000100001&cidx=15178&sel_year=2025&sel_month=06 |
| 21 | 보건복지부: 고립·은둔 청년 54만명 보도자료 | https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=1479278&act=view |
| 22 | KB의 생각: 국가장학금 2차 구제 신청 제도 | https://kbthink.com/life/daily/national-scholarship.html |

### 데이터 수집 API·포털
| # | 출처 | URL |
|---|------|-----|
| 23 | 행정안전부 공공서비스(혜택) 정보 API | https://www.data.go.kr/data/15113968/openapi.do |
| 24 | 온통청년 Open API 문서 | https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc |
| 25 | 온통청년 API 이용방법 | https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiGuide |
| 26 | 한국장학재단 장학금 소개 | https://www.kosaf.go.kr/ko/scholar.do?pg=scholarship_main |
| 27 | 공공데이터포털 학자금지원정보 | https://www.data.go.kr/data/15028252/fileData.do |

### 경쟁·유사 서비스
| # | 서비스 | URL |
|---|--------|-----|
| 28 | 온통청년 | https://www.youthcenter.go.kr/ |
| 29 | 정부24 / 보조금24 | https://www.gov.kr/portal/rcvfvrSvc/main |
| 30 | 복지로 | https://www.bokjiro.go.kr/ |
| 31 | 고용24 | https://www.work24.go.kr |
| 32 | 부산청년플랫폼 | https://young.busan.go.kr/ |
| 33 | 대구 청년정책 포털 | https://www.daegu.go.kr/YouthPolicy |
| 34 | 대구 젊프 커뮤니티 | https://www.dgjump.com/ |
| 35 | 대학알리미 | https://www.academyinfo.go.kr |

### 마케팅 채널 근거
| # | 출처 | URL |
|---|------|-----|
| 36 | 디지털데일리: 에브리타임 MAU 289만, 누적 637만 | https://m.ddaily.co.kr/page/view/2023022011311623788 |
| 37 | 한국경제: 월 300만명 대학생 필수 앱 | https://www.hankyung.com/article/202210214791i |
| 38 | 플래텀: Z세대 85.3% 에브리타임 이용 | https://platum.kr/archives/263552 |
| 39 | 온통청년 바로가기 (14개 부처 링크) | https://www.youthcenter.go.kr/youthPolicy/ythPlcyLinkMain |
| 40 | 한국갤럽 SNS 연간 이용률 조사 | https://www.gallup.co.kr/gallupdb/reportContent.asp?seqNo=1586 |
