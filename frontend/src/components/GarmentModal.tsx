"use client";
// 옷 등록·수정 창: 사진 편집 → AI 태그 제안 → 사용자 확인·수정 → IndexedDB 저장 (US-01, US-02).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { canvasToBlob, checkFile, toTaggingJpeg } from "@/lib/imaging";
import { categoryOf, downloadText, garmentFileSVG, label, safeColor, TEMPLATE_VERSION, thumbSVG } from "@/lib/garments";
import { postTag, type AiMode } from "@/lib/api";
import { SEASONS, STYLES, TEMPLATE_IDS, type Asset, type ClosetItem, type Garment, type Season, type Style, type TemplateId } from "@/lib/types";
import PhotoEditor, { type EditorResult } from "./PhotoEditor";
import Svg from "./Svg";

interface Props {
  item: ClosetItem | null; // null = 새 옷
  onClose: () => void;
}

export default function GarmentModal({ item, onClose }: Props) {
  const { assets, saveItem, deleteItem, showToast } = useStore();
  const existingAsset = item?.assetId ? assets.get(item.assetId) ?? null : null;

  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState<TemplateId>(item?.type ?? "tee");
  const [color, setColor] = useState(safeColor(item?.color ?? "#d9d4c7"));
  const [style, setStyle] = useState<Style>(item?.style ?? "캐주얼");
  const [season, setSeason] = useState<Season>(item?.season ?? "사계절");
  const [brand, setBrand] = useState(item?.brand ?? "");

  const [photo, setPhoto] = useState<{ original: Blob; edited: Blob | null } | null>(
    existingAsset ? { original: existingAsset.originalBlob, edited: existingAsset.editedBlob } : null,
  );
  const [photoChanged, setPhotoChanged] = useState(false);
  const editor = useRef<EditorResult | null>(null);
  const [vector, setVector] = useState(item?.vector ?? null);

  const [nameError, setNameError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [tagging, setTagging] = useState(false);
  const [tagNote, setTagNote] = useState<{ mode: AiMode } | { error: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onResult = useCallback((r: EditorResult) => {
    editor.current = r;
    setVector(r.vector);
    if (r.vector) setColor(r.vector.base);
    setPhotoChanged(true);
  }, []);

  // The first emit after loading an existing asset is not a user change.
  const firstEmit = useRef(!!existingAsset);
  const handleResult = useCallback(
    (r: EditorResult) => {
      if (firstEmit.current) {
        firstEmit.current = false;
        editor.current = r;
        setVector(r.vector);
        return;
      }
      onResult(r);
    },
    [onResult],
  );

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = checkFile(file);
    setFileError(err);
    if (err) return;
    firstEmit.current = false;
    setTagNote(null);
    setPhoto({ original: file, edited: null });
  }

  function removePhoto() {
    setPhoto(null);
    editor.current = null;
    setVector(null);
    setPhotoChanged(true);
  }

  async function suggestTags() {
    if (!editor.current) return;
    setTagging(true);
    setTagNote(null);
    try {
      const res = await postTag(await toTaggingJpeg(editor.current.base));
      if (res.type) setType(res.type);
      if (res.style) setStyle(res.style);
      if (res.season) setSeason(res.season);
      if (res.color && !editor.current.vector) setColor(res.color);
      if (res.name && !name.trim()) setName(res.name);
      setTagNote({ mode: res.mode });
    } catch (e) {
      setTagNote({ error: `AI 태깅에 실패했어요. 직접 입력해 주세요. (${e instanceof Error ? e.message : e})` });
    } finally {
      setTagging(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setNameError("이름을 입력하세요.");
      nameRef.current?.focus();
      return;
    }
    setNameError(null);
    setFormError(null);
    setSaving(true);
    try {
      let asset: Asset | null = null;
      let assetId = item?.assetId ?? null;
      const usedVector = photo ? vector : null;
      if (!photo) assetId = null;
      else if (photoChanged && editor.current) {
        asset = {
          id: `a-${crypto.randomUUID()}`,
          originalBlob: await canvasToBlob(editor.current.base),
          editedBlob: await canvasToBlob(editor.current.work),
          vectorData: usedVector,
          svgText: garmentFileSVG({ type, color, vector: usedVector }),
          templateVersion: TEMPLATE_VERSION,
        };
        assetId = asset.id;
      }
      const g: Garment = {
        id: item?.id ?? `g-${crypto.randomUUID()}`,
        name: clean.slice(0, 40),
        type,
        templateId: type,
        color: safeColor(color),
        style,
        season,
        brand: brand.trim().slice(0, 30),
        assetId,
        sample: item?.id.startsWith("sample-") ? true : undefined,
        createdAt: item?.createdAt || Date.now(),
      };
      await saveItem(g, asset);
      showToast(item ? "옷 정보를 수정했어요." : "옷장에 새 옷을 등록했어요.");
      onClose();
    } catch (err) {
      setFormError(`저장하지 못했어요. ${err instanceof Error ? err.message : ""} 사진을 줄이거나 다른 옷을 정리한 뒤 다시 시도해 주세요.`);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item || !confirm(`'${item.name}'을(를) 옷장에서 삭제할까요? 착용 중이거나 저장한 코디에서도 빠져요.`)) return;
    try {
      await deleteItem(item.id);
      showToast("옷을 삭제했어요.");
      onClose();
    } catch (err) {
      setFormError(`삭제하지 못했어요. ${err instanceof Error ? err.message : ""}`);
    }
  }

  const preview = useMemo(() => thumbSVG({ type, color, vector: photo ? vector : null, name: name || "미리보기" }), [type, color, vector, photo, name]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="garment-dialog-title"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-bg p-5 outline-none sm:rounded-2xl sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <span className="eyebrow">{item ? "EDIT A PIECE" : "ADD A NEW PIECE"}</span>
            <h2 id="garment-dialog-title" className="mt-1 text-xl font-medium">{item ? "옷 정보 수정" : "새로운 옷 등록"}</h2>
          </div>
          <button type="button" className="text-2xl text-muted" aria-label="닫기" onClick={onClose}>×</button>
        </div>

        <form onSubmit={save} className="grid gap-6 md:grid-cols-[1.2fr_1fr]" noValidate>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn cursor-pointer">
                {photo ? "사진 바꾸기" : "📷 사진 선택"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickFile} />
              </label>
              {photo && <button type="button" className="btn" onClick={removePhoto}>사진 빼기</button>}
              {photo && (
                <button type="button" className="btn" onClick={suggestTags} disabled={tagging || !editor.current}>
                  {tagging ? "AI가 태그를 제안하는 중…" : "✧ AI 태그 제안"}
                </button>
              )}
            </div>
            {fileError && <p role="alert" className="text-xs text-danger">{fileError}</p>}
            {tagNote && "error" in tagNote && <p role="alert" className="text-xs text-danger">{tagNote.error}</p>}
            {tagNote && "mode" in tagNote && (
              <p className="text-xs text-moss">
                {tagNote.mode === "dummy" ? "더미 모드 제안이에요(실제 AI 아님)." : "AI 제안이에요."} 아래 값을 확인·수정한 뒤 저장하세요.
              </p>
            )}
            {photo ? (
              <PhotoEditor original={photo.original} edited={photo.edited} onResult={handleResult} onError={(m) => setFileError(m)} />
            ) : (
              <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
                사진 없이 색상만으로도 등록할 수 있어요.<br />사진을 올리면 배경을 정리하고 무늬를 SVG로 바꿔요.
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Svg markup={preview} className="h-28 w-28 shrink-0 rounded-xl bg-lilac p-2" />
              <div className="text-xs text-muted">
                SVG 미리보기 · {label(type)} ({categoryOf(type)})
                <br />
                <button type="button" className="mt-2 underline" onClick={() => downloadText(garmentFileSVG({ type, color, vector: photo ? vector : null }), `${name.trim() || "garment"}.svg`)}>
                  SVG 다운로드
                </button>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="g-name">이름 *</label>
              <input id="g-name" ref={nameRef} className="field" maxLength={40} value={name} aria-invalid={!!nameError} aria-describedby={nameError ? "g-name-err" : undefined} onChange={(e) => setName(e.target.value)} />
              {nameError && <p id="g-name-err" className="mt-1 text-xs text-danger">{nameError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="g-type">종류 *</label>
                <select id="g-type" className="field" value={type} onChange={(e) => setType(e.target.value as TemplateId)}>
                  {TEMPLATE_IDS.map((t) => (
                    <option key={t} value={t}>{categoryOf(t)} · {label(t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="g-color">대표 색 *</label>
                <input id="g-color" type="color" className="field h-[38px] p-1" value={color} onChange={(e) => setColor(e.target.value)} disabled={!!(photo && vector)} title={photo && vector ? "사진의 무늬에서 계산된 색이에요" : undefined} />
              </div>
              <div>
                <label className="label" htmlFor="g-style">스타일</label>
                <select id="g-style" className="field" value={style} onChange={(e) => setStyle(e.target.value as Style)}>
                  {STYLES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="g-season">계절</label>
                <select id="g-season" className="field" value={season} onChange={(e) => setSeason(e.target.value as Season)}>
                  {SEASONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="g-brand">브랜드 (선택)</label>
              <input id="g-brand" className="field" maxLength={30} value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>

            {formError && <p role="alert" className="rounded-lg bg-[#f8ebe8] px-3 py-2 text-xs text-danger">{formError}</p>}

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="submit" className="btn btn-primary flex-1" disabled={saving}>{saving ? "저장 중…" : "옷장에 저장"}</button>
              {item && <button type="button" className="btn text-danger" onClick={remove}>삭제</button>}
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
