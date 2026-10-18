# 작업 계획

## 이번 목표와 범위
- 완료할 목표: 기획안 v0.2를 todo-app STEP 가이드 순서대로 문서화(STEP 1~10)하고, PRD Must를 동작하는 웹앱으로 만들기(STEP 11)
- 이번에 하지 않을 일: PRD에 없는 기능, 로그인·동기화, 실제 Bedrock·날씨 키 연결, 배포(인터넷 공개)
- 참고할 문서: 기획안 v0.2, README, AGENTS, DECISIONS, PRD, ARCHITECTURE, SCREEN-SPEC, DATA-MODEL, API-SPEC, TEST-PLAN
- 기존 자산: moire-closet-source v0.1(Vanilla JS 프로토타입)의 SVG 좌표·배경 제거·벡터화 알고리즘을 TypeScript로 옮김

## 작업 목록
| 번호 | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| P-01 | README 작성 | 현재 상태·실행 방법이 실제와 같음 | 완료 |
| P-02 | AGENTS 작성 | 규칙·환경 칸이 채워짐 | 완료 (새 대화 시험: 미실행) |
| P-03 | DECISIONS D-001~D-008 | 기획안에서 확정된 결정만 있음 | 완료 — 팀 확인 필요 |
| P-04 | PRD | Must마다 인수 조건 4종 | 완료 — 팀 확인 필요 |
| P-05 | ARCHITECTURE | 흐름·실패 흐름 정의 | 완료 |
| P-06 | SCREEN-SPEC | 모든 영역에 빈 결과·처리 중·오류 | 완료 |
| P-07 | DATA-MODEL | 필드가 기획안 09장과 일치 | 완료 |
| P-08 | API-SPEC | 엔드포인트마다 성공·실패 | 완료 |
| P-09 | TEST-PLAN | Must마다 시나리오 | 완료 |
| P-10 | 도구 확인 | Node·Python 버전 확인 | 완료 |
| P-11 | 화면 틀 (Next.js) | localhost:3000 표시 | 완료 |
| P-12 | 서버 틀 (FastAPI) | /health 응답 | 완료 |
| P-13 | 화면·서버 연결 | 헤더 서버 상태 표시, CORS 3000만 허용 | 완료 |
| P-14 | 공통 에셋·캐릭터 착용 | 템플릿 10종·캐릭터 합성 | 완료 |
| P-15 | 옷 등록(사진 편집·벡터화·AI 태그) | T-02~T-08 | 완료 (T-07·T-08 미실행) |
| P-16 | 옷장 목록·필터·수정·삭제 | T-09~T-13 | 완료 (일부 미실행, 아래 참고) |
| P-17 | 코디 추천 | T-16~T-20 | 완료 (T-17·T-18 미실행) |
| P-18 | 날씨·저장 코디·OOTD·다운로드 | T-22~T-24 | 일부 확인 |
| P-19 | 껐다 켜고 다시 실행 | README 명령으로 재실행 | 미실행 |
| P-20 | 전체 시험과 기준점 (STEP 12) | TEST-PLAN 전체 통과 | 예정 |

## 실제 검증 결과
2026-10-18, Windows 11, Node v24.20.0, Python 3.13.15. AI·날씨는 **더미 모드**에서만 확인했다.

실행한 명령
- `backend: .venv\Scripts\python -m pytest -q` → 8 passed (health, 415 거절, 더미 태깅, 더미 추천, 잘못된 기분 422, 없는 후보 ID 제외, 태그 어휘 검증, 날씨·빈 도시 422)
- `frontend: npx tsc --noEmit`, `npx eslint src` → 오류 없음
- `frontend: npx next build` → 성공 (/, /closet, /recommend 정적 생성)

브라우저(내장 브라우저, localhost:3000)에서 확인한 시나리오
| 시나리오 | 결과 |
|---|---|
| T-01 첫 실행 | 캐릭터가 라일락 니트·크림 팬츠·스니커즈, 옷장 20벌, 헤더 "AI 더미 모드" |
| T-02 사진 등록 | 줄무늬 티셔츠 사진 → 투명 배경 미리보기 + 줄무늬 SVG 썸네일 |
| T-03 수동 보정 | 지우개 드래그로 지워짐 → 되돌리기로 복구 |
| T-04 AI 태그 제안 | 더미 모드 안내와 함께 이름·종류·색·스타일·계절 채워짐, 저장 전 카드 없음 |
| T-05 저장·유지 | 저장 후 새로고침 → "SVG OUTFIT" 카드 유지 (21벌) |
| T-06 빈 이름 | 공백 3칸 → 저장 안 됨, "이름을 입력하세요." |
| T-13 삭제·재등장 없음 | 착용 중인 샘플(크림 와이드 팬츠) 삭제 → 새로고침 후 20벌, 착용 맵·저장 코디에서 빠짐, hiddenSamples 기록 |
| T-14 착용·유지 | 등록한 긴팔 입혀보기 → 홈 캐릭터에 줄무늬로 표시, 새로고침 후 유지 |
| T-16 추천 | 16°C 더미 날씨, 미니멀·편안한 → LOOK 2개 + "더미 모드 설명" |
| T-19 추천 대체 | API 서버 종료 → "서버에 연결되지 않아 규칙 기반으로 추천했어요." + LOOK 2개 |
| T-22 날씨(시작 시) | 서버에서 더미 날씨 Seoul 16°C 표시 |
| T-23 일부 | ♡ 저장 → IndexedDB outfits에 저장 확인 |
| T-24 | 저장된 asset.svgText에 `<image` 없음 (7색 stripes path) |
| T-26 좁은 화면 | 375px에서 세 탭 모두 scrollWidth = 375 |

미실행: T-07, T-08, T-10, T-11, T-12, T-15, T-17, T-18, T-20, T-21(서버 단위 테스트로만), T-23 OOTD, T-25(다른 브라우저), T-27(단위 테스트로만), P-19, 실제 Bedrock·OpenWeatherMap 호출

2026-10-19 날씨 실호출 (backend/.env에 OPENWEATHER_API_KEY 설정)
- `/health` → `"weather":"openweathermap"`
- `/api/weather` 서울·부산·대구·인천·제주·강남구·Seoul → 200 실측값 (예: 부산광역시 21°C 비), 없는 도시 → 404
- 한글 도시명이 처음엔 404 → 원인: Current Weather의 `q=`가 한글을 못 찾음 → 수정: Geocoding API로 위경도를 먼저 구함
- 화면: 홈 날씨 카드에서 "부산" 불러오기 → "부산광역시 · 실시간 · 21°C · 비" 표시 (T-22 실제 모드 통과)
- `pytest -q` → 10 passed (테스트는 conftest에서 키를 비워 실호출하지 않음, 지오코딩·404·키 오류는 가짜 응답으로 검사)

## 구현 인계
- 승인한 작업 범위: P-10~P-18 (완료), 다음은 P-19·P-20
- 유지할 동작과 금지할 변경: PRD에 없는 기능 금지, SVG 좌표(D-007)·필드 이름(DATA-MODEL) 변경 금지, 서버에 영구 저장 추가 금지(D-004)
- 읽을 문서: PRD, ARCHITECTURE, SCREEN-SPEC, DATA-MODEL, API-SPEC, TEST-PLAN
- 다음 실행 위치와 확인할 명령: README "실행 방법"으로 두 서버 실행 → TEST-PLAN 미실행 항목
- 중단 조건과 복구 방법: 문서끼리 다르거나 정하지 않은 것이 나오면 멈추고 질문

## 남은 문제와 다음 행동
- Bedrock 실호출: 계정·리전에서 호출 가능한 모델 ID 확인 → backend/.env의 BEDROCK_MODEL_ID → T-04를 실제 모드로 재시험 (기획안 1일차 D 담당)
- 날씨: 2026-10-19 OpenWeatherMap 실호출 확인 (키는 backend/.env, Git 제외). 팀원은 각자 backend/.env에 키를 넣어야 함. 기상청은 Later
- Git: 2026-10-19 GitHub straudi/moire에 main 푸시, origin/main 추적
- 배포: Vercel(frontend, NEXT_PUBLIC_API_BASE) + Render/Railway(backend, ALLOWED_ORIGINS) — 미착수
- Later: /api/evaluate 화면 연결, 옷장 내보내기·가져오기
- 다음에 할 일: P-19 껐다 켜고 다시 실행 → P-20 TEST-PLAN 전체 시험 (STEP 12)
