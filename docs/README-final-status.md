# moire — 옷장 데이터화 · 코디 추천

> ⚠️ **미리보기 문서입니다.** 프로젝트가 다 완성됐을 때(STEP 12 기준점 · STEP 18 배포 준비 완료)를 가정한 README 초안입니다.
> `〈 〉` 표시는 아직 정해지지 않았거나 실행해 보지 않은 값이라 완성 시점에 실제 값으로 바꿔야 합니다.

내 실제 옷을 사진으로 등록해 데이터화하고, 현재 위치의 날씨와 그날의 기분·스타일에 맞는 코디를 추천받아 2D 캐릭터에 입혀 보는 웹 서비스입니다.
로그인 없이 브라우저마다 독립적인 개인 옷장을 가집니다.

- 서비스 주소: 〈https://moire.vercel.app〉
- API 주소: 〈https://moire-api.onrender.com〉 (문서: `/docs`)
- 저장소: https://github.com/straudi/moire
- 기준 기획: 옷장 데이터화 · 코디 추천 서비스 기획안 v0.2 (2026.10.16)

## 현재 상태
**MVP 완성 · 배포 완료** (〈2026-10-22〉)
- PRD v1.0 Must 전체 구현, TEST-PLAN 시나리오 T-01~T-31 〈전부 통과〉
- 날씨: OpenWeatherMap 실시간 (현재 위치 기반, 권한 거부 시 도시)
- AI: Amazon Bedrock 〈모델 ID〉 실호출 확인 (태깅·추천 이유)
- 다음 버전 후보는 PRD "다음 버전 후보" 참고 (AI 코디 평가 화면, 옷장 내보내기·가져오기, 기상청 연동)

## 제품 기준점
| 항목 | 값 |
|---|---|
| 기준 커밋 | 〈커밋 해시〉 (태그 `v1.0.0`) |
| 확인 날짜 | 〈2026-10-22〉 |
| 확인 환경 | Windows 11 · Chrome 〈버전〉 / Android Chrome |
| 확인 결과 | PLAN.md "실제 검증 결과" 참고 |

## 주요 기능
| 화면 | 할 수 있는 일 |
|---|---|
| 내 캐릭터 `/` | 착용 중인 코디를 캐릭터로 보기, 현재 위치 날씨, 부위별 벗기, 기본 코디로 되돌리기, 캐릭터 SVG 다운로드, "오늘 입었어요" 기록(OOTD) |
| 나의 옷장 `/closet` | 사진 등록 → 자동 배경 제거 → 지우개·복원 보정 → 무늬를 SVG로 변환 → AI 태그 제안 → 확인 후 저장, 카테고리·스타일 필터, 검색, 수정·삭제, 입혀보기 |
| 코디 추천 `/recommend` | 날씨·스타일·기분 선택 → 규칙으로 후보 조합 → AI가 2벌 고르고 이유 설명 → 캐릭터에 입혀보기, 코디 저장 |

- 옷 템플릿 10종: 반팔·긴팔·니트 / 자켓·코트 / 청바지·슬랙스·치마 / 스니커즈·부츠
- AI가 실패하면 규칙 기반 추천, 태깅 실패는 직접 입력, 무늬 변환 실패는 대표 색상으로 이어집니다.
- AI 점수·이유는 정답이 아닌 "AI의 참고 의견"입니다.

## 프로젝트 문서
| 문서 | 역할 |
|---|---|
| README.md | 소개, 현재 상태, 실행 방법 (이 문서) |
| AGENTS.md | AI가 이 저장소에서 일할 때 지킬 규칙 |
| DECISIONS.md | 팀이 확정한 결정과 이유 (D-001~) |
| PLAN.md | 작업 목록, 실제 검증 결과, 다음 행동 |
| PRD.md | 무엇을 만드는지 — 요구사항, 인수 조건, 업무 규칙 |
| ARCHITECTURE.md | 화면·서버·저장소 구조와 기술 |
| SCREEN-SPEC.md | 화면별 정보·행동·빈 결과·처리 중·오류 |
| DATA-MODEL.md | IndexedDB 구조, SVG 좌표 규격 |
| API-SPEC.md | FastAPI 엔드포인트 계약 |
| TEST-PLAN.md | 시험 시나리오와 기대 결과 |
| frontend/ | 화면 — Next.js · React · TypeScript · Tailwind CSS |
| backend/ | AI·날씨 API 서버 — FastAPI (영구 저장 없음) |

## 시작 방법
1. README.md와 AGENTS.md를 읽습니다.
2. PLAN.md의 "남은 문제와 다음 행동"에서 할 일을 확인합니다.
3. 아래 "실행 방법"으로 로컬에서 두 서버를 켭니다.

## 실행 방법
필요한 도구: Node.js 〈24〉 이상, Python 3.13, Git. 터미널 2개가 필요합니다.

### 1. 저장소 받기
```bash
git clone https://github.com/straudi/moire.git
cd moire
```

### 2. 환경변수 준비
`backend/.env.example`을 `backend/.env`로 복사하고 값을 채웁니다. **`.env`는 Git에 올리지 않습니다.**

| 변수 | 설명 | 비우면 |
|---|---|---|
| `OPENWEATHER_API_KEY` | OpenWeatherMap 키 | 더미 날씨 |
| `BEDROCK_MODEL_ID` | 계정·리전에서 호출 가능한 Bedrock 모델 ID | AI 더미 모드 |
| `AWS_REGION` | Bedrock 리전 | us-east-1 |
| `ALLOWED_ORIGINS` | 화면 주소(쉼표 구분) | http://localhost:3000 |
| `AI_MODE` | `auto` 또는 `dummy` | auto |

AWS 자격 증명은 표준 방식(`aws configure`, 환경변수, 실행 역할)을 씁니다. 화면이 API를 찾는 주소는 `frontend/.env.local`의 `NEXT_PUBLIC_API_BASE`이며 기본값은 http://localhost:8000 입니다.

### 3. API 서버 (터미널 1 · http://localhost:8000)
```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --port 8000
```
macOS·Linux는 `.venv/bin/pip`, `.venv/bin/uvicorn`을 씁니다.

### 4. 화면 (터미널 2 · http://localhost:3000)
```bash
cd frontend
npm install
npm run dev
```

### 5. 검사
```bash
cd backend && .venv\Scripts\python -m pytest -q
cd frontend && npx tsc --noEmit && npx eslint src && npm run build
```

### 6. 공통 에셋 다시 만들기
`frontend/src/data/templates.json`을 바꾼 뒤 `npm run assets`로 `public/avatars`, `public/garments`의 SVG를 다시 만듭니다. SVG 좌표(viewBox 0 0 240 360)는 DECISIONS D-007 없이 바꾸지 않습니다.

## 배포
| 대상 | 플랫폼 | 설정 |
|---|---|---|
| 화면 | 〈Vercel〉 | Root `frontend`, 환경변수 `NEXT_PUBLIC_API_BASE`=API 주소 |
| API | 〈Render / Railway〉 | Root `backend`, 시작 명령 `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, 위 환경변수 + `ALLOWED_ORIGINS`=화면 주소 |

## 데이터와 개인정보
- 기본 캐릭터·옷 도형·샘플 옷 20벌은 Git으로 배포되어 모든 브라우저에서 같게 보입니다.
- 내가 등록한 옷·사진·코디·기록은 **이 브라우저의 IndexedDB에만** 저장됩니다. Chrome과 Edge, localhost와 배포 주소는 서로 다른 옷장이며, 사이트 데이터를 지우면 함께 사라집니다.
- AI 태그 제안을 누를 때만 사진이 서버와 Bedrock으로 전송되며 서버는 저장·로그하지 않습니다.
- 위치는 약 1km 단위로 줄여 날씨 조회에만 쓰고 저장하지 않습니다.

## 확인과 기록
- AI가 바꾼 파일은 직접 열어 문서·결정과 같은지 확인합니다.
- 기능 확인 결과는 PLAN.md "실제 검증 결과", 시나리오는 TEST-PLAN.md에 적습니다.
- 브랜치는 기능별로 만들고 PR로 합칩니다. 커밋 메시지는 `feat:`, `fix:`, `docs:`, `chore:`로 시작합니다.

## 팀
| 역할 | 담당 |
|---|---|
| A. 캐릭터·이미지 | 〈이름〉 |
| B. 옷장·저장 | 〈이름〉 |
| C. 추천 | 〈이름〉 |
| D. API·통합·발표 | 〈이름〉 |
