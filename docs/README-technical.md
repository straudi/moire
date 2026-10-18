# moire — 나의 작은 옷장

내 실제 옷을 사진으로 등록해 데이터화하고, 현재 위치의 날씨와 그날의 스타일·기분에 맞는 코디를 추천받아 2D 캐릭터에 입혀 보는 웹 서비스입니다.

- 사이트: 〈배포 주소〉
- 저장소: https://github.com/straudi/moire
- 작성 기준: `main` 브랜치 〈기준 커밋〉 소스 코드
- 프런트엔드: Next.js(App Router) + React + TypeScript + Tailwind CSS
- 서버: FastAPI(Python) — AI·날씨 연동 전용 API, 영구 저장 없음
- 데이터베이스: 브라우저 IndexedDB (사용자별 옷장) — 서버 DB 없음
- AI: Amazon Bedrock (Converse API)
- 날씨: OpenWeatherMap (Geocoding + Current Weather)
- 호스팅: 〈Vercel(화면) + Render 또는 Railway(API)〉

> `〈 〉` 표시는 아직 정해지지 않았거나 확인하지 않은 값입니다.

## 1. 주요 기능

| 기능 | 구현 내용 |
|---|---|
| 옷 사진 등록 | JPG·PNG·WEBP(10MB 이하) 선택, 640px로 축소 |
| 자동 배경 제거 | 네 모서리에서 배경색 추정 → 색상 거리 + Flood Fill로 투명화 |
| 수동 보정 | 지우개·복원 붓, 붓 크기·배경 민감도 조절, 되돌리기(12단계), 원본으로 |
| 무늬 벡터화 | K-means 색상 양자화(2~12색) → 같은 색 구간을 SVG path로 변환, 가로 줄무늬 자동 감지 |
| AI 태그 제안 | 사진을 보고 종류·대표 색·스타일·계절·이름 제안 → 사용자가 확인·수정 후 저장 |
| 옷장 관리 | 카테고리(상의·하의·아우터·신발)·스타일 필터, 이름·브랜드 검색, 수정·삭제 |
| 캐릭터 착용 | 옷 템플릿 10종을 부위별로 입히기·벗기기, 기본 코디로 되돌리기 |
| 현재 위치 날씨 | 브라우저 위치로 지역 이름·기온·하늘 조회, 거부 시 도시 이름 입력, 기온 직접 입력 |
| 코디 추천 | 날씨·계절 규칙으로 후보 조합 → AI가 2벌을 골라 제목·이유 작성 → 캐릭터에 입혀보기 |
| 코디 저장·기록 | 추천 코디 저장(♡), "오늘 입었어요" 날짜별 기록(OOTD) |
| SVG 다운로드 | 의상 SVG, 캐릭터 SVG 파일 저장 (원본 비트맵 없이 벡터 경로만) |
| 샘플 옷장 | 처음 접속하면 샘플 옷 20벌과 기본 코디 제공 |
| 반응형 화면 | 375px 폭에서 가로 스크롤 없이 1단 배치 |
| 접근성 | 키보드 조작, 포커스 표시, `aria-live` 알림, 대화상자 Esc 닫기 |
| 오류 처리 | 서버 연결 안 됨·AI 실패·날씨 실패·위치 거부·저장 실패 안내와 대체 경로 |

옷의 실제 재단·핏·주름은 재현하지 않습니다. 선택한 옷 종류의 고정 실루엣에 단순화한 무늬를 입히므로 작은 글씨·로고·복잡한 패턴은 달라질 수 있습니다.

## 2. 전체 동작 구조

```text
 브라우저 (Next.js 화면)                                FastAPI 서버 (저장 없음)
 ┌────────────────────────────────────────┐          ┌───────────────────────────┐
 │ /  /closet  /recommend                  │  fetch   │ GET  /health              │
 │ Canvas 2D: 배경 제거·보정·벡터화          │ ───────▶ │ POST /api/tag       ──┐   │
 │ SVG: 캐릭터·의상 합성                     │          │ POST /api/recommend ──┼──▶ Amazon Bedrock
 │ IndexedDB: 옷·사진·코디·기록              │ ◀─────── │ POST /api/evaluate  ──┘   │
 │ public/ + JSON: 공통 캐릭터·옷 도형·샘플   │   JSON   │ GET  /api/weather   ──────▶ OpenWeatherMap
 └────────────────────────────────────────┘          └───────────────────────────┘
```

### 앱 시작
1. `default-items.json`(샘플 20벌)과 `templates.json`(옷 도형 10종)을 읽습니다.
2. IndexedDB `moire`에서 개인 옷·사진·착용 상태·숨긴 샘플·날씨 설정을 읽습니다.
3. 샘플과 개인 옷을 합쳐 화면을 그립니다.
4. `/health`로 서버 상태(AI 연결·더미 모드·연결 안 됨)를 헤더에 표시합니다.
5. 날씨 방식이 위치 기반이면 브라우저 위치를 묻고 날씨를 조회합니다.

### 옷 등록
1. 사진을 고르면 Canvas에서 축소하고 배경을 지웁니다.
2. 사용자가 지우개·복원으로 다듬을 때마다 크롭 → 128×160으로 다시 샘플링 → 벡터화합니다.
3. "AI 태그 제안"을 누르면 JPEG로 변환한 사진을 `/api/tag`로 보냅니다.
4. 서버가 Bedrock 결과를 정해진 값(종류 10종·스타일 5종·계절 4종·#RRGGBB)으로 검증해 돌려줍니다.
5. 사용자가 폼을 확인·수정하고 저장하면 IndexedDB의 `garments`와 `assets`에 한 트랜잭션으로 씁니다.

### 코디 추천
1. 브라우저가 옷장에서 기온·계절에 맞는 옷만 고릅니다.
2. 스타일·기분 점수로 상의·하의·신발 조합 최대 8개를 만들고, 18°C 미만이면 아우터를 더합니다.
3. 후보의 이름·종류·색·스타일·계절만 `/api/recommend`로 보냅니다. 사진은 보내지 않습니다.
4. Bedrock이 고른 후보 ID를 서버와 화면이 각각 검증하고, 없는 ID는 버립니다.
5. 서버나 AI가 실패하면 규칙 기반 결과를 보여 줍니다.

### 날씨 조회
1. 브라우저 Geolocation으로 좌표를 받고 소수 둘째 자리(약 1km)로 줄입니다.
2. 서버가 OpenWeatherMap Reverse Geocoding으로 지역 이름(한국어 우선)을 찾고 Current Weather를 조회합니다.
3. 위치를 거부하면 마지막 도시(처음엔 서울)로 조회합니다. 도시 이름은 Geocoding을 거치므로 "서울", "강남구" 같은 한글도 됩니다.

**사진·옷 정보·코디는 서버에 저장하지 않습니다. 모든 개인 데이터는 사용자의 브라우저 IndexedDB에만 있습니다.**

## 3. 핵심 기술과 역할

버전은 설치된 패키지 기준입니다.

| 기술 | 버전 | 역할 |
|---|---|---|
| Next.js | 15.5.28 | App Router 라우팅(`/`, `/closet`, `/recommend`), 빌드·개발 서버 |
| React / React DOM | 19.1.0 | 컴포넌트와 상태로 화면 구현 |
| TypeScript | 5.9.3 | 옷·에셋·코디·날씨·API 타입 정의 |
| Tailwind CSS | 4.3.3 | 반응형 레이아웃, `@theme` 색상 토큰, `@utility` 버튼·칩·카드 |
| Canvas 2D API | 브라우저 | 픽셀 분석, 배경 제거, 지우개·복원 합성(`destination-out`) |
| Pointer Events | 브라우저 | 마우스·터치·펜 공통 붓질, 포인터 캡처 |
| SVG | 직접 작성 | 캐릭터·옷 템플릿, `clipPath`·`transform`으로 무늬 합성 |
| IndexedDB | 브라우저 | 옷·사진 Blob·벡터·코디·기록 저장 (라이브러리 없이 직접 래핑) |
| Geolocation API | 브라우저 | 현재 위치 좌표 |
| localStorage | 브라우저 | 마지막으로 고른 옷장 카테고리만 저장 |
| next/font | Next.js 내장 | Noto Sans KR 글꼴 |
| ESLint | 9.39.5 | `eslint-config-next` 15.5.28 규칙 검사 |
| Python | 3.13 | 서버 실행 |
| FastAPI | 0.115.12 | API 라우팅, 입력 검증, `/docs` 자동 문서 |
| Pydantic | 2.14.1 | 요청 본문 스키마와 값 범위 검증 |
| Uvicorn | 0.34.2 | ASGI 서버 |
| python-multipart | 0.0.20 | 사진 업로드(multipart) 수신 |
| Pillow | 11.2.1 | 업로드 이미지 확인, 더미 모드 대표 색 계산 |
| boto3 | 1.38.8 | Amazon Bedrock Runtime `converse` 호출 |
| HTTPX | 0.28.1 | OpenWeatherMap 호출 |
| python-dotenv | 1.1.0 | `backend/.env` 환경변수 읽기 |
| pytest | 8.3.5 | 서버 단위 테스트 |
| Amazon Bedrock | 〈모델 ID〉 | 이미지 태깅, 추천 선택·이유, (선택) 코디 평가 |
| OpenWeatherMap | Geocoding 1.0 / Current 2.5 | 지역 이름·기온·하늘 상태 |
| Node.js / npm | 24.20.0 / 11.19.0 | 설치·개발·빌드 도구 실행 (개발 PC 확인 버전) |
| Git · GitHub | — | 소스 이력, 협업 |

Redux, Zustand, React Query, ORM, 서버 DB는 사용하지 않습니다. 앱 상태는 React Context 하나(`store.tsx`)와 기본 `fetch()`로 처리합니다.

## 4. React 화면 구현

### 페이지와 컴포넌트

| 파일 | 역할 |
|---|---|
| `src/app/layout.tsx` | 공통 HTML, 한국어 설정, 글꼴, 헤더·알림·Store Provider |
| `src/app/page.tsx` | 내 캐릭터: 피팅룸, 날씨, 지금 입은 옷, 옷장 미리보기, OOTD 기록 |
| `src/app/closet/page.tsx` | 나의 옷장: 필터·검색·옷 카드 목록 |
| `src/app/recommend/page.tsx` | 코디 추천: 날씨·스타일·기분 선택, 추천 카드, 저장한 코디 |
| `src/components/Header.tsx` | 탭 이동, 서버 상태 배지 |
| `src/components/Gate.tsx` | IndexedDB를 다 읽은 뒤에만 페이지 표시, 저장소 오류 배너 |
| `src/components/Character.tsx` | 착용 맵을 캐릭터 SVG로 렌더링 |
| `src/components/GarmentCard.tsx` | 옷 썸네일, 출처 라벨, 입혀보기·수정 버튼 |
| `src/components/GarmentModal.tsx` | 옷 등록·수정 대화상자, AI 태그 제안, 저장·삭제 |
| `src/components/PhotoEditor.tsx` | Canvas 사진 편집기 (배경 제거·붓·되돌리기·벡터 옵션) |
| `src/components/WeatherCard.tsx` | 날씨 표시, 현재 위치·도시·직접 입력 전환 |
| `src/components/Toast.tsx` | `aria-live` 알림 |
| `src/components/Svg.tsx` | 검증된 SVG 문자열 렌더링 |

모든 페이지는 `'use client'` 클라이언트 컴포넌트입니다. IndexedDB와 Canvas가 브라우저에만 있기 때문에, 저장소를 다 읽기 전에는 "옷장을 여는 중"만 보여 줘서 서버·클라이언트 렌더링 불일치를 막습니다.

### React Hooks

| Hook | 실제 사용 |
|---|---|
| `createContext` / `useContext` | 옷장·착용·날씨·서버 상태와 동작을 앱 전체에 공유 (`useStore`) |
| `useState` | 옷 목록, 착용 맵, 필터, 폼 값, 편집 도구, 추천 결과, 로딩·오류 |
| `useEffect` | IndexedDB 로드, 서버 확인, 시작 시 날씨 조회, 사진 로드, Esc 닫기 |
| `useRef` | Canvas 원본·작업본, 되돌리기 스택, 붓질 위치, 최신 날씨 참조 |
| `useCallback` | 저장·삭제·착용·날씨 조회 함수 참조 유지 |
| `useMemo` | 샘플+개인 옷 병합, ID 색인, 썸네일·캐릭터 SVG 문자열 |

## 5. 이미지 처리 (Canvas)

| 단계 | 처리 | 결과 |
|---|---|---|
| 1. 사진 읽기 | 긴 변 640px로 축소해 Canvas에 그림 | 처리용 이미지 |
| 2. 배경 정리 | 모서리 4곳 픽셀을 색상 구간으로 묶어 가장 많은 색을 배경으로 추정, 가장자리에서 Flood Fill | 투명 배경 PNG |
| 3. 수동 보정 | 지우개 = `destination-out`, 복원 = 원본을 원형 클립으로 다시 그림, 12단계 되돌리기 | 다듬은 PNG |
| 4. 색상 단순화 | 밝기 분위수로 초기값을 잡은 K-means 9회 반복 | 대표 색 팔레트 |
| 5. 무늬 벡터화 | 행마다 같은 색 구간을 이어 사각형 path로 합침 (0~100 좌표) | 색상별 SVG path |
| 6. 템플릿 적용 | 옷 실루엣을 `clipPath`로, 무늬를 부위 박스에 `translate·scale` | 캐릭터용 의상 |
| 7. 저장 | 원본·편집본 PNG Blob, 벡터 데이터, 의상 SVG 문자열을 IndexedDB에 | 다시 입을 수 있는 옷 |

가로 줄무늬는 가운데 40% 영역의 행별 대표 색이 14번 이상 바뀌면 자동 감지합니다. 벡터 데이터는 팔레트 12색 이하, path 문자 패턴 검사를 통과해야 렌더링하며 실패하면 대표 색상 템플릿으로 그립니다.

## 6. 캐릭터와 SVG 좌표

- 모든 캐릭터·옷 템플릿은 `viewBox="0 0 240 360"` 하나를 씁니다.
- 합성 순서: 그림자·머리 뒤 → 몸 → 이너 → 하의 → 상의 → 아우터 → 신발 → 얼굴·앞머리
- 옷 템플릿 10종

| 부위 | 템플릿 |
|---|---|
| 상의 | `tee` 반팔, `longtee` 긴팔, `knit` 니트 |
| 아우터 | `jacket` 자켓, `coat` 코트 |
| 하의 | `jeans` 청바지, `slacks` 슬랙스, `skirt` 치마 |
| 신발 | `sneakers` 스니커즈, `boots` 부츠 |

도형 원본은 `src/data/templates.json`이고, `npm run assets`가 같은 데이터로 `public/avatars/base.svg`와 `public/garments/*.svg`를 만듭니다. 좌표를 바꾸면 모든 저장된 무늬의 위치가 달라지므로 DECISIONS D-007을 먼저 고칩니다.

## 7. 추천 규칙

| 규칙 | 내용 |
|---|---|
| 계절 | 여름 옷은 20°C 이상, 겨울 옷은 12°C 미만, 봄·가을 옷은 8~25°C, 사계절은 항상 |
| 종류 | 코트 15°C 미만, 자켓 22°C 미만, 부츠 18°C 미만, 반팔 15°C 이상 |
| 아우터 | 18°C 미만이면 가장 점수 높은 아우터 추가 |
| 스타일 점수 | 고른 스타일과 같으면 +7 |
| 기분 점수 | 편안한(티·니트·청바지·스니커즈 +4), 차분한(미니멀·댄디 +3), 설레는(로맨틱 +5), 자신 있는(자켓·부츠·슬랙스 +4) |
| 다양성 | 상의·하의가 모두 같은 조합은 후보에서 제외 |
| 부족 | 날씨에 맞는 상의·하의·신발 중 없는 부위가 있으면 "○○이 부족해요" |

AI는 이 후보 안에서만 고릅니다. 이유와 점수는 "AI의 참고 의견"으로 표시합니다.

## 8. 서버 API

구현 파일: `backend/app/main.py`

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/health` | 서버 상태와 AI·날씨 모드 |
| POST | `/api/tag` | 사진(multipart `image`) → 종류·색·스타일·계절·이름 |
| POST | `/api/recommend` | 날씨·스타일·기분·후보 조합 → 고른 후보 ID·제목·이유 |
| POST | `/api/evaluate` | 착용 조합 → 점수·근거·개선 제안 (화면 연결은 다음 버전) |
| GET | `/api/weather` | `lat`·`lon` 또는 `city` → 지역 이름·기온·하늘·강수 여부 |

### POST `/api/recommend` 요청

```json
{
  "weather": { "temp": 16, "sky": "맑음" },
  "style": "미니멀",
  "mood": "편안한",
  "candidates": [
    {
      "id": "c1",
      "garmentIds": ["sample-0", "sample-1", "sample-2"],
      "items": [{ "id": "sample-0", "name": "소프트 라일락 니트", "type": "knit", "color": "#a69ab4", "style": "미니멀", "season": "봄·가을" }]
    }
  ]
}
```

### 정상 응답

```json
{
  "mode": "bedrock",
  "picks": [{ "candidateId": "c1", "title": "미니멀, 편안한 하루", "reason": "16°C 맑은 날씨에 맞춰…" }]
}
```

### GET `/api/weather?lat=35.16&lon=129.16`

```json
{ "source": "openweathermap", "city": "부산광역시", "temp": 21, "sky": "비", "precipitation": true }
```

| 상태 코드 | 의미 |
|---|---|
| 200 | 정상 처리 |
| 404 | 도시를 찾지 못함 |
| 413 | 사진이 5MB 초과 |
| 415 | JPG·PNG·WEBP가 아닌 파일 |
| 422 | 잘못된 입력 (빈 도시, 범위 밖 좌표, 목록에 없는 스타일·기분·종류 등) |
| 429 | IP당 분당 20회 초과 (태그·추천·평가) |
| 502 | Bedrock·날씨 공급자 실패, 키 오류, AI가 유효한 후보를 고르지 않음 |

- 모든 AI 응답에 `mode: "bedrock" | "dummy"`가 있어 더미 결과를 실제 AI로 오해하지 않습니다.
- 키가 없으면 자동으로 더미 모드로 동작합니다 (`AI_MODE=dummy`로 강제 가능).
- CORS는 `ALLOWED_ORIGINS`의 화면 주소만 허용합니다. `*`는 쓰지 않습니다.
- Bedrock 호출은 읽기 20초 타임아웃, 재시도 1회입니다.

## 9. 데이터베이스 (IndexedDB)

서버 DB는 없습니다. 로그인 없이 브라우저마다 독립 옷장을 갖기 위해 브라우저의 IndexedDB `moire`(버전 1)를 직접 래핑해 씁니다.

| 저장소 | 키 | 내용 |
|---|---|---|
| `garments` | `id` | id, name, type, color, style, season, brand, templateId, assetId, sample, createdAt |
| `assets` | `id` | originalBlob, editedBlob, svgText, vectorData, templateVersion |
| `outfits` | `id` | title, garmentIds, reason, createdAt |
| `history` | `id`(YYYY-MM-DD) | date, garmentIds — 같은 날은 덮어씀 |
| `meta` | `key` | `wear`(부위별 착용 ID), `hiddenSamples`(삭제한 샘플), `weather`(마지막 날씨와 위치 방식) |

- 옷과 사진은 한 트랜잭션으로 저장하고, 커밋이 끝나야 성공으로 표시합니다.
- 옷을 삭제하면 착용 해제 → 저장 코디에서 제거(빈 코디는 삭제) → 다른 옷이 쓰지 않는 사진 삭제를 한 트랜잭션으로 처리합니다.
- 샘플 옷은 Git 파일이라 지울 수 없으므로 `hiddenSamples`에 기록해 다시 나타나지 않게 합니다.
- 샘플을 수정하면 같은 ID로 개인 저장소에 덮어써 보여 주고 원본 JSON은 그대로 둡니다.
- 위치 좌표는 저장하지 않습니다. `meta.weather`에는 지역 이름·기온·하늘과 방식(`geo`·`city`·`manual`)만 있습니다.

IndexedDB는 브라우저·프로필·출처(프로토콜·호스트·포트)마다 분리됩니다. Chrome과 Edge, localhost와 배포 주소는 서로 다른 옷장이고, 사이트 데이터를 지우면 함께 사라집니다.

## 10. 외부 API

### OpenWeatherMap

| 용도 | 엔드포인트 | 사용하는 값 |
|---|---|---|
| 도시 이름 → 좌표 | `GET /geo/1.0/direct?q=&limit=1` | `lat`, `lon`, `local_names.ko` |
| 좌표 → 지역 이름 | `GET /geo/1.0/reverse?lat=&lon=&limit=1` | `local_names.ko`, `name` |
| 현재 날씨 | `GET /data/2.5/weather?lat=&lon=&units=metric&lang=kr` | `main.temp`, `weather[0].main` |

`weather[0].main`을 맑음(Clear)·비(Rain·Drizzle·Thunderstorm)·눈(Snow)·흐림(그 밖)으로 바꿉니다. 키는 서버에만 있으며 브라우저에서 직접 호출하지 않습니다. 오류 메시지에 요청 주소(키 포함)를 넣지 않습니다.

### Amazon Bedrock

- `bedrock-runtime`의 `converse` API, 모델 ID는 `BEDROCK_MODEL_ID` 환경변수
- 태깅: 이미지 블록 + "정해진 값 중에서 JSON 하나만" 지시 → 서버가 JSON 추출·검증
- 추천: 후보 메타데이터만 텍스트로 전달 → `picks` JSON → 후보 ID 검증

## 11. 보안·개인정보

- AWS 자격 증명과 OpenWeatherMap 키는 서버 환경변수(`backend/.env`, Git 제외)에만 둡니다.
- 사진은 "AI 태그 제안"을 누를 때만 서버와 Bedrock으로 가며, 서버는 저장하지 않고 요청 본문을 로그에 남기지 않습니다.
- 추천에는 사진 없이 필요한 태그와 후보만 보냅니다.
- 위치는 브라우저와 서버 양쪽에서 약 1km로 줄이고 저장하지 않습니다.
- 사용자 입력이 들어가는 SVG 문자열은 이스케이프하고, 벡터 path는 허용 문자만 통과시킵니다.
- 로그인이 없으므로 AI API에 IP별 호출 제한과 업로드 크기 제한을 둡니다.

## 12. 파일 구성

| 경로 | 내용 |
|---|---|
| `README.md` … `TEST-PLAN.md` | 기획·설계 문서 10종 (AGENTS, DECISIONS, PLAN, PRD, ARCHITECTURE, SCREEN-SPEC, DATA-MODEL, API-SPEC, TEST-PLAN) |
| `frontend/src/app/` | 페이지 3개, 레이아웃, 전역 CSS |
| `frontend/src/components/` | 화면 컴포넌트 |
| `frontend/src/lib/types.ts` | 공통 타입과 어휘(종류·스타일·계절·기분·하늘) |
| `frontend/src/lib/garments.ts` | 템플릿 렌더러, 캐릭터 합성, SVG 다운로드 |
| `frontend/src/lib/imaging.ts` | Canvas 축소·배경 제거·크롭 |
| `frontend/src/lib/vectorize.ts` | K-means, 줄무늬 감지, path 생성 |
| `frontend/src/lib/db.ts` | IndexedDB 저장 계층 |
| `frontend/src/lib/store.tsx` | 앱 상태 Context |
| `frontend/src/lib/recommend.ts` | 추천 규칙과 후보 생성 |
| `frontend/src/lib/api.ts` | 서버 주소 관리, API 호출, 위치 확인 |
| `frontend/src/data/` | `templates.json`(도형), `default-items.json`(샘플 20벌) |
| `frontend/public/` | 공통 캐릭터·옷 도형 SVG |
| `frontend/scripts/build-assets.mjs` | JSON에서 공통 SVG 생성 |
| `backend/app/main.py` | 라우팅, CORS, 입력 검증, 호출 제한 |
| `backend/app/ai.py` | Bedrock 호출·더미 모드·결과 검증 |
| `backend/app/weather.py` | OpenWeatherMap 호출·더미 모드 |
| `backend/app/vocab.py` | 화면과 같은 어휘 목록 |
| `backend/app/config.py` | 환경변수 |
| `backend/tests/` | API 단위 테스트 (실제 외부 API는 호출하지 않음) |
| `backend/.env.example` | 환경변수 예시 |

## 13. 개발과 실행 명령

터미널 2개가 필요합니다.

```bash
# 1) API 서버 — http://localhost:8000 (문서 /docs)
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env        # 키 입력, 비우면 더미 모드
.venv\Scripts\uvicorn app.main:app --port 8000

# 2) 화면 — http://localhost:3000
cd frontend
npm install
npm run dev
```

| 명령 | 역할 |
|---|---|
| `npm run dev` | 화면 개발 서버 |
| `npm run build` | 화면 운영 빌드 |
| `npm run lint` | ESLint 검사 |
| `npx tsc --noEmit` | TypeScript 타입 검사 |
| `npm run assets` | `templates.json`에서 공통 SVG 다시 생성 |
| `.venv\Scripts\python -m pytest -q` | 서버 단위 테스트 |

| 환경변수 (`backend/.env`) | 설명 | 비우면 |
|---|---|---|
| `OPENWEATHER_API_KEY` | OpenWeatherMap 키 | 더미 날씨 |
| `BEDROCK_MODEL_ID` | 호출 가능한 Bedrock 모델 ID | AI 더미 모드 |
| `AWS_REGION` | Bedrock 리전 | us-east-1 |
| `ALLOWED_ORIGINS` | 허용할 화면 주소 (쉼표 구분) | http://localhost:3000 |
| `AI_MODE` | `auto` / `dummy` | auto |

화면의 API 주소는 `frontend/.env.local`의 `NEXT_PUBLIC_API_BASE`이며 기본값은 http://localhost:8000 입니다.

## 14. 배포

| 대상 | 플랫폼 | 설정 |
|---|---|---|
| 화면 | 〈Vercel〉 | Root `frontend`, `NEXT_PUBLIC_API_BASE`=API 주소 |
| API | 〈Render 또는 Railway〉 | Root `backend`, 시작 `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, 환경변수 + `ALLOWED_ORIGINS`=화면 주소 |

위치 기능은 HTTPS(또는 localhost)에서만 동작합니다. 배포 주소가 바뀌면 `ALLOWED_ORIGINS`도 함께 바꿉니다.

## 15. 확인한 항목과 구현 범위

확인한 것
- 서버 단위 테스트 12개 통과 (태깅·추천 검증, 후보 ID 검증, 날씨 좌표·도시·404·키 오류, 입력 거절)
- TypeScript 타입 검사, ESLint, Next.js 운영 빌드
- 브라우저: 사진 등록 → 배경 제거 → 지우개·되돌리기 → AI 태그(더미) → 저장 → 새로고침 유지
- 착용·새로고침 유지, 착용 중인 샘플 삭제 후 재등장 없음·저장 코디 정리
- 추천(더미 AI), 서버 종료 시 규칙 기반 대체
- OpenWeatherMap 실제 호출: 한글 도시명, 좌표 → 지역 이름, 위치 거부 시 도시 대체
- 375px 화면 가로 스크롤 없음, 저장된 SVG에 `<image>` 없음

확인하지 않은 것
- 〈Bedrock 실제 호출〉, 실제 기기 GPS 위치 허용, 다른 브라우저 분리, 배포 환경

구현하지 않은 것
- 로그인·기기 간 동기화, 서버 DB, 3D·실제 핏, 로고·글자 완전 재현, AI 코디 평가 화면, 옷장 내보내기·가져오기, 기상청 연동, 여러 날 예보

## 16. 프로젝트 소개 문장

> Next.js·React·TypeScript로 옷 사진을 Canvas에서 배경 제거·색상 양자화해 SVG 의상으로 바꾸고 2D 캐릭터에 입히는 화면을 구현했습니다. 개인 옷장은 로그인 없이 브라우저 IndexedDB에 저장하며, FastAPI 서버가 Amazon Bedrock으로 옷 태그와 코디 추천 이유를, OpenWeatherMap으로 현재 위치 날씨를 제공합니다.
