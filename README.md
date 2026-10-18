# moire — 옷장 데이터화 · 코디 추천

내 실제 옷을 사진으로 등록해 데이터화하고, 날씨·기분·스타일에 맞는 코디를 추천받아 2D 캐릭터에 입혀보는 웹 서비스입니다.
로그인 없이 브라우저마다 독립적인 개인 옷장을 가집니다. 기준 기획: `옷장 데이터화 · 코디 추천 서비스 기획안 v0.2` (2026.10.16).

## 현재 상태
MVP 구현 완료(STEP 11), 전체 시험 진행(STEP 12).
- 설계 문서 10종 확정 (PRD v1.0 기준)
- frontend(Next.js)·backend(FastAPI) 동작 확인
- AI(Amazon Bedrock)·날씨 API는 키가 없으면 **더미 모드**로 동작합니다. 실제 호출은 아직 검증하지 않았습니다 (PLAN 남은 문제 참고).

## 프로젝트 문서
- README.md: 이 프로젝트의 소개와 현재 상태
- AGENTS.md: AI가 일할 때 지킬 규칙
- DECISIONS.md: 사람이 확정한 결정과 이유
- PLAN.md: 작업 목록, 상태, 실제 검증 결과, 다음 행동
- PRD.md: 무엇을 만들지 정한 요구 문서
- ARCHITECTURE.md: 화면·서버·저장소 구조와 기술
- SCREEN-SPEC.md: 화면별 정보·행동·빈 결과·처리 중·오류
- DATA-MODEL.md: IndexedDB 저장 구조와 필드 규칙
- API-SPEC.md: FastAPI 엔드포인트 계약
- TEST-PLAN.md: 시험 시나리오와 기대 결과
- frontend/: 화면 (Next.js · React · TypeScript · Tailwind CSS)
- backend/: AI 태깅·추천·날씨 API 서버 (FastAPI)

## 시작 방법
README.md와 AGENTS.md부터 읽고, PLAN.md의 "남은 문제와 다음 행동"을 확인합니다.

## 실행 방법
터미널 2개가 필요합니다. (실제로 실행해 확인한 명령)

터미널 1 — API 서버 (http://localhost:8000, 문서 /docs)
```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --port 8000
```

터미널 2 — 화면 (http://localhost:3000)
```bash
cd frontend
npm install
npm run dev
```

Bedrock·날씨를 실제로 쓰려면 `backend/.env.example`을 `backend/.env`로 복사해 값을 채웁니다. 비워 두면 더미 모드입니다.
화면이 API 서버를 찾는 주소는 `frontend/.env.local`의 `NEXT_PUBLIC_API_BASE`(기본 http://localhost:8000)입니다.

## 확인과 기록
- AI가 파일을 저장하면 실제 파일을 열어 내 결정과 같은지 확인합니다.
- 기능 확인 결과는 PLAN.md "실제 검증 결과"에, 시나리오는 TEST-PLAN.md에 적습니다.
- 개인 옷장은 브라우저(IndexedDB)에 저장됩니다. Chrome과 Edge, localhost와 배포 주소는 서로 다른 옷장입니다.
