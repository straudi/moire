# 아키텍처

## 문서 상태
- 상태: 확정 · 버전 v1.0 · 승인일 2026-10-18 · 기준 DECISIONS: D-002, D-003, D-004, D-005, D-006, D-007

## 적용 범위와 전체 구조
PRD v1.0 Must 전체에 적용한다.

```
 브라우저 (Next.js 화면, :3000)                         FastAPI 서버 (:8000, 저장 없음)
 ┌───────────────────────────────────────┐           ┌──────────────────────────────┐
 │ 페이지: / (내 캐릭터) /closet /recommend │  fetch    │ GET  /health                 │
 │ 이미지 처리: Canvas 2D · Pointer Events │ ───────▶ │ POST /api/tag       ─┐       │
 │ 렌더링: SVG · clipPath · transform     │           │ POST /api/recommend ─┼▶ Amazon Bedrock
 │ 저장: IndexedDB(moire) / localStorage  │ ◀─────── │ POST /api/evaluate  ─┘ (선택)  │
 │ 공통 에셋: public/ + default-items.json │   JSON    │ GET  /api/weather   ──▶ OpenWeatherMap
 └───────────────────────────────────────┘           └──────────────────────────────┘
```

## 기술과 실행 환경
| 영역 | 선택 | 근거 |
|---|---|---|
| 화면 | Next.js(App Router) · React · TypeScript | D-004 |
| 스타일 | Tailwind CSS | D-004 |
| 이미지 처리 | Canvas 2D · Pointer Events | D-005 |
| 캐릭터 렌더링 | SVG 문자열 합성 · clipPath · transform | D-007 |
| 개인 데이터 | IndexedDB (idb 라이브러리 없이 직접 래핑) | D-002 |
| 화면 설정 | localStorage (마지막 탭, 카테고리) | D-002 |
| 서버 | FastAPI · uvicorn · pydantic · httpx · boto3 | D-004 |
| AI | Amazon Bedrock Converse API, 모델 ID는 환경변수 | D-005 |
| 날씨 | OpenWeatherMap (키 없으면 더미) | PRD 8장 |
| 배포 후보 | Vercel(화면) + Render 또는 Railway(서버) | 기획안 04장 |

## 구성 요소와 책임
| 구성 요소 | 위치 | 책임 |
|---|---|---|
| 공통 타입 | frontend/src/lib/types.ts | Garment·Asset·Outfit·History·Weather 타입, 템플릿 10종 |
| 템플릿 렌더러 | frontend/src/lib/garments.ts | 템플릿 path, 부위 박스, 의상 SVG(벡터 무늬 clip) 생성 |
| 캐릭터 | frontend/src/components/Character.tsx | 몸 → 하의 → 상의 → 아우터 → 신발 → 얼굴 합성 |
| 이미지 처리 | frontend/src/lib/imaging.ts, vectorize.ts | 축소, 배경 Flood Fill, 크롭, K-means, 색상 구간 path |
| 사진 편집기 | frontend/src/components/PhotoEditor.tsx | 지우개·복원·되돌리기, 배경 민감도 |
| 저장 계층 | frontend/src/lib/db.ts | IndexedDB 스토어 4개 + meta, 삭제 시 참조 정리 |
| 앱 상태 | frontend/src/lib/store.tsx | 샘플+개인 옷 병합, 착용, 날씨, 저장 오류 전파 |
| 추천 규칙 | frontend/src/lib/recommend.ts | 계절·기온 필터, 점수, 조합 생성 |
| API 클라이언트 | frontend/src/lib/api.ts | 서버 주소 한 곳(NEXT_PUBLIC_API_BASE), 타임아웃 |
| 서버 | backend/app/main.py | 라우팅, CORS, 입력 검증, 크기 제한 |
| AI 어댑터 | backend/app/ai.py | Bedrock 호출 / 더미 응답, JSON·옷 ID 검증 |
| 날씨 어댑터 | backend/app/weather.py | OpenWeatherMap / 더미 |

## 주요 데이터 흐름
### 앱 시작
default-items.json 로드 → IndexedDB(garments, meta) 읽기 → 숨긴 샘플 제외 후 병합 → 렌더링

### 옷 등록
사진 선택 → Canvas 축소(640px) → 모서리 배경색 + Flood Fill → (수동 보정) → 크롭 → K-means(기본 7색) → 색상 구간 path → [AI 태그 제안: 사진 JPEG(최대 640px)를 /api/tag로] → 사용자 수정 → assets·garments 저장

### 옷 착용
착용 맵(meta.wear) → 옷의 templateId·vectorData 조회 → 템플릿 path를 clipPath로 무늬 path를 부위 박스에 transform → 레이어 합성

### 코디 추천
옷장 → 기온·계절 필터 → 점수 → 조합 후보(최대 8개) → 후보 메타데이터만 /api/recommend → 응답 ID 검증 → 카드 → 입혀보기

## 실패 흐름
| 실패 | 처리 | 근거 |
|---|---|---|
| 서버 연결 안 됨 | 헤더 상태 "서버 연결 안 됨", 태깅은 직접 입력, 추천은 규칙 결과 | D-006 |
| Bedrock 오류·타임아웃(20초) | 서버가 502 + 메시지, 화면이 대체 경로 | D-006 |
| AI가 잘못된 JSON·ID | 서버가 검증해 버리고 규칙 결과, 화면도 ID 재검증 | 기획안 12장 |
| IndexedDB 쓰기 실패(용량 등) | 저장 실패 안내, 창 유지, 상태 되돌림 | 기획안 09장 |
| 벡터화 실패 | 대표 색상 템플릿 | D-006 |
| 날씨 실패 | 직접 입력 날씨 유지 + 안내 | D-006 |

## 승인 확인
- [x] 서버에 영구 저장이 없다 (D-004)
- [x] AWS 키가 서버 환경변수에만 있다
- [x] Must마다 데이터 흐름과 실패 흐름이 있다

## 상세 설계 연결
SCREEN-SPEC.md(화면), DATA-MODEL.md(IndexedDB·SVG 좌표), API-SPEC.md(서버 계약), TEST-PLAN.md(시험)
