# 프로젝트 작업 규칙

## 목적
moire: 내 옷 사진을 데이터화하고 날씨·스타일·기분 기반 코디를 추천받아 2D 캐릭터에 입혀보는 웹 서비스를 만든다.
AI(Amazon Bedrock)는 **태깅·추천 이유·(선택)코디 평가**에만 쓴다. 의상 시각화(배경 제거·색상·무늬 SVG)는 Canvas·SVG 알고리즘으로 하며 생성형 AI를 호출하지 않는다 (D-005).

## 환경
- 화면: frontend/ — Next.js 15 · React 19 · TypeScript · Tailwind CSS 4, 포트 3000
- 서버: backend/ — Python 3.13 · FastAPI · uvicorn, 포트 8000
- 개발 PC 확인 버전: Node.js v24.20.0, npm 11.19.0, Python 3.13.15 (uv 없음 → venv + pip 사용)
- 개인 데이터: 브라우저 IndexedDB (DB 이름 `moire`), 화면 설정만 localStorage
- 공통 에셋: frontend/public/avatars, frontend/public/garments, frontend/src/data/default-items.json (Git 관리)

## 작업 전
- 작업 요청을 받을 때마다, 파일을 바꾸거나 명령을 실행하기 전에 README, DECISIONS, PLAN, PRD를 읽는다. 없는 파일은 없다고 말한다.
- 설계와 관련된 작업이면 ARCHITECTURE, SCREEN-SPEC, DATA-MODEL, API-SPEC, TEST-PLAN 중 해당 문서를 읽는다.
- 이해한 내용과 작업 계획(바꿀 파일, 확인 방법)을 먼저 설명한다.
- 정보가 부족하면 추측하지 말고 질문한다.

## 변경 범위
- 사람이 승인한 작업만 한다. 한 번에 작은 작업 하나만 한다.
- 결정은 사람이 한다. 확정되지 않은 내용을 확정처럼 적지 않는다.
- DECISIONS와 다른 요청이 오면 멈추고 사람에게 확인한다.
- 한 파일을 바꾸면 함께 고쳐야 할 파일이 있는지 알려 준다.
- SVG 좌표(viewBox 0 0 240 360, 부위 박스, 레이어 순서)는 DATA-MODEL의 값을 바꾸지 않는다. 바꿔야 하면 먼저 문서와 DECISIONS를 고친다.
- 공통 에셋(public/, default-items.json)은 사용자 편집으로 바뀌지 않는다. 개인 상태는 IndexedDB에만 쓴다.

## 완료 확인
- 실제로 바꾼 파일을 보고한다.
- 실행한 명령과 결과를 구분해 적는다.
- 실행하지 않은 검사는 "미실행"으로 적는다. 더미 모드로 확인한 것을 실제 Bedrock 확인으로 적지 않는다.

## 안전
- AWS 인증정보, 날씨 API 키, 개인정보를 파일·채팅·Git 기록에 넣지 않는다. 키는 backend/.env (Git 제외)에만 둔다.
- 브라우저 코드에 키를 넣지 않는다.
- 서버는 사진과 요청 본문을 저장하거나 로그에 남기지 않는다.
- 삭제, 덮어쓰기, 설치, 관리자 권한이 필요한 명령은 실행 전에 설명하고 다시 승인받는다.
