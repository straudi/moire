# moire API 명세

상태: 확정 · v1.0 · 기준 DECISIONS D-004, D-005, D-006

## 사용자 행동 계약
| 사용자 행동 | 호출 | 성공 | 실패 시 화면 |
|---|---|---|---|
| 앱 열기 | GET /health | 헤더 "AI 연결됨" 또는 "더미 모드" | "서버 연결 안 됨" |
| AI 태그 제안 | POST /api/tag | 폼 칸 채움(사용자가 수정 후 저장) | 직접 입력 안내 |
| 코디 찾기 | POST /api/recommend | 선택 조합 + 이유 | 규칙 기반 결과 |
| 날씨 불러오기 | GET /api/weather | 기온·하늘 | 직접 입력 유지 |
| (Later) 코디 평가 | POST /api/evaluate | 점수·근거·제안 | 숨김 |

옷 CRUD는 서버에 없다 — 브라우저 IndexedDB에서 처리한다.

## 공통 규칙
- 기본 주소: http://localhost:8000 (화면은 `NEXT_PUBLIC_API_BASE` 한 곳에서 관리)
- CORS: `ALLOWED_ORIGINS` 환경변수(기본 http://localhost:3000). `*` 금지
- 모든 응답 JSON. AI 응답에는 `mode: "bedrock" | "dummy"` 포함
- 오류 형식: `{"detail": "사람이 읽을 메시지"}` — 422(입력 오류), 413(크기 초과), 429(호출 제한), 502(AI·날씨 공급자 실패)
- 호출 제한: IP당 분당 20회(태그·추천·평가 합산, 메모리 카운터)
- 요청 본문·사진을 로그에 남기지 않고 저장하지 않는다
- 환경변수: AWS_REGION, BEDROCK_MODEL_ID, (AWS 자격 증명은 표준 체인), OPENWEATHER_API_KEY, ALLOWED_ORIGINS, AI_MODE(auto|dummy)

## 엔드포인트
### GET /health
→ 200 `{"status":"ok","ai":"bedrock"|"dummy","weather":"openweathermap"|"dummy"}`

### POST /api/tag
- 요청: multipart/form-data `image` (image/jpeg·png·webp, ≤ 5MB — 화면이 640px로 줄여 보냄)
- 응답 200: `{"mode","type","color","style","season","name"}`
  - type ∈ 템플릿 10종, color = #RRGGBB, style ∈ 5종, season ∈ 4종 — 서버가 검증, 벗어나면 그 필드는 null
- 실패: 415(형식), 413(크기), 502(AI 실패)

### POST /api/recommend
- 요청: `{"weather":{"temp":21,"sky":"맑음"},"style":"미니멀","mood":"편안한","candidates":[{"id":"c1","garmentIds":["g-1","sample-1","sample-2"],"items":[{"id","name","type","color","style","season"}]}]}`
  - candidates 1~8개, items 각 2~4벌
- 응답 200: `{"mode","picks":[{"candidateId":"c1","title":"...","reason":"..."}]}` — picks 1~2개
  - 서버가 candidateId가 요청에 있는지 검증, 없는 것은 버림. 모두 버려지면 502
- 실패: 422, 502

### POST /api/evaluate (Later — 계약만)
- 요청: `{"items":[...],"weather":{...},"occasion":"출근"}`
- 응답: `{"mode","score":0~100,"reasons":[...],"suggestions":[...]}` — 화면은 "AI의 참고 의견"으로 표시

### GET /api/weather?city=Seoul
- 응답 200: `{"source":"openweathermap"|"dummy","city","temp","sky":"맑음|흐림|비|눈","precipitation":bool}`
- 실패: 422(도시 빈 값), 502(공급자 실패)

## 요청·응답 예시
```http
POST /api/recommend
{"weather":{"temp":15,"sky":"흐림"},"style":"댄디","mood":"자신 있는",
 "candidates":[{"id":"c1","garmentIds":["sample-11","sample-13","sample-8","sample-3"],"items":[...]}]}

200 {"mode":"dummy","picks":[{"candidateId":"c1","title":"댄디, 자신 있는 하루","reason":"15°C 흐린 날에 맞춰 ..."}]}
```

## 이번에 구현하지 않는 항목
- /api/evaluate 실제 화면 연결 (Later), 이미지 평가, 서버 저장, 인증

## API 계약 결정 기록
| 항목 | 결정 | 이유 |
|---|---|---|
| 추천 입력 | 화면이 규칙으로 만든 후보 조합만 보냄 | 기획안 11장: 필요한 태그·후보만 전송 |
| ID 검증 | 서버·화면 둘 다 | 기획안 12장 |
| 더미 모드 | 키 없으면 자동, mode 필드로 명시 | D-006 |
