# moire 데이터 모델

상태: 확정 · v1.0 · 기준 DECISIONS D-002, D-003, D-007, D-008

## 데이터 의미
| 데이터 | 뜻 | 저장 위치 | 공유 범위 |
|---|---|---|---|
| 기본 캐릭터 SVG | 모든 사람이 같은 캐릭터 | frontend/public/avatars/base.svg (+ 렌더러 코드) | 모든 브라우저 동일 |
| 기본 옷 도형 SVG | 템플릿 10종 | frontend/public/garments/{templateId}.svg (+ 렌더러 코드) | 모든 브라우저 동일 |
| 샘플 옷 목록 | 처음부터 보이는 옷 20벌 | frontend/src/data/default-items.json | 읽기 전용 |
| garments | 사용자가 등록·수정한 옷 | IndexedDB `moire` / garments | 해당 브라우저·프로필·출처 |
| assets | 원본·편집 사진, SVG, 벡터 | IndexedDB / assets | 해당 브라우저 |
| outfits | 저장한 코디 | IndexedDB / outfits | 해당 브라우저 |
| history | 날짜별 착용 기록(OOTD) | IndexedDB / history | 해당 브라우저 |
| meta | 착용 맵, 숨긴 샘플, 직접 입력 날씨 | IndexedDB / meta | 해당 브라우저 |
| 화면 설정 | 마지막 카테고리 | localStorage `moire.ui` | 해당 브라우저 |

## Garment 필드
| 필드 | 형식 | 필수 | 규칙 |
|---|---|---|---|
| id | string | 예 | 개인: `g-` + crypto.randomUUID(). 샘플: `sample-0`~`sample-19` |
| name | string | 예 | 앞뒤 공백 제거 후 1~40자 |
| type | TemplateId | 예 | tee, longtee, knit, jacket, coat, jeans, slacks, skirt, sneakers, boots |
| color | string | 예 | `#RRGGBB`. 아니면 렌더 시 #aaa69a |
| style | Style | 예 | 미니멀, 캐주얼, 댄디, 로맨틱, Y2K |
| season | Season | 예 | 봄·가을, 여름, 겨울, 사계절 |
| brand | string | 아니요 | 0~30자 |
| templateId | TemplateId | 예 | 현재 type과 같음(템플릿 교체 대비 분리, 기획안 09장) |
| assetId | string \| null | 아니요 | assets.id |
| sample | boolean | - | 샘플을 수정한 경우 true (같은 id로 개인 garments에 저장되어 샘플 원본을 덮어 보여 줌) |
| createdAt | number | 예 | Date.now() |

부위(category)는 저장하지 않고 type에서 계산한다: 상의(tee, longtee, knit) · 아우터(jacket, coat) · 하의(jeans, slacks, skirt) · 신발(sneakers, boots)

## Asset 필드
| 필드 | 형식 | 설명 |
|---|---|---|
| id | string | `a-` + UUID |
| originalBlob | Blob | 사용자가 올린 원본(640px 축소본, PNG) |
| editedBlob | Blob \| null | 배경 정리·보정 결과 PNG (원본과 같은 크기, 다시 편집할 때 그대로 불러옴. 크롭은 벡터화 때 수행) |
| svgText | string | 의상 SVG 전체 문자열(비트맵 없음) — 다운로드용 |
| vectorData | VectorData \| null | {version:1, palette[≤12], paths[], base, mode, width, height} |
| templateVersion | number | 템플릿 좌표 버전 (현재 1) |

## Outfit · History · Meta
- outfits: { id, title, garmentIds: string[], reason, createdAt }
- history: { id: `YYYY-MM-DD`, date, garmentIds: string[] } — 같은 날은 덮어씀
- meta: { key: 'wear', value: { 상의?, 하의?, 아우터?, 신발? } } · { key: 'hiddenSamples', value: string[] } · { key: 'weather', value: Weather }

## 템플릿 좌표 (D-007)
- 공통 viewBox: `0 0 240 360`
- 레이어 순서: 그림자 → 머리 뒤 → 몸 → 이너 → 하의 → 상의 → 아우터 → 신발 → 얼굴·앞머리
- 무늬 박스(x, y, w, h): 벡터 path는 0~100 좌표로 저장하고 `translate(x y) scale(w/100 h/100)`로 붙인다

| templateId | 박스 |
|---|---|
| tee, longtee, knit, jacket | 59, 108, 122, 98 |
| coat | 58, 108, 124, 149 |
| jeans, slacks | 85, 185, 70, 127 |
| skirt | 73, 185, 94, 96 |
| sneakers | 75, 306, 90, 24 |
| boots | 75, 280, 90, 49 |

## SQLite 변환 초안
해당 없음 — 서버 DB를 쓰지 않는다 (D-004). 대안(로컬 FastAPI + SQLite)은 기획안 10장 참고.

## 검토 기록
- PRD 4장 필드 이름과 일치 확인 (name, type, color, style, season, brand)
- 기획안 09장 필드 전부 포함 (garments·assets·outfits·history)

## 데이터 규칙 결정 기록
| 규칙 | 결정 | 근거 |
|---|---|---|
| 옷 삭제 | 착용 해제 → outfits.garmentIds에서 제거(빈 코디는 삭제) → history는 기록이므로 유지하되 표시 시 없는 옷은 건너뜀 → 다른 옷이 참조하지 않는 asset 삭제 | D-008 |
| 샘플 삭제 | meta.hiddenSamples에 id 추가 | D-008 |
| 샘플 수정 | 같은 id로 garments에 저장(덮어쓰기 보기), 원본 JSON은 그대로 | D-003 |
| 저장 원자성 | garment·asset·meta는 한 트랜잭션. 실패하면 화면 상태를 바꾸지 않는다 | 기획안 09장 |
