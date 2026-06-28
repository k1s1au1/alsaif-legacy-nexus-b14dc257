import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Presentation,
  Plus,
  X,
  Trash2,
  Pencil,
  Play,
  Upload,
  Link as LinkIcon,
  FileText,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ExternalLink,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Slide = { title: string; body: string; image_url?: string | null };
type Kind = "slides" | "file" | "link";

type Presentation = {
  id: string;
  meeting_id: string;
  title: string;
  kind: Kind;
  slides: Slide[];
  file_path: string | null;
  external_url: string | null;
  created_by: string;
  created_at: string;
};

export function MeetingPresentations({
  meetingId,
  canManage,
  userId,
}: {
  meetingId: string;
  canManage: boolean;
  userId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<Presentation | "new" | null>(null);
  const [presenting, setPresenting] = useState<Presentation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("meeting_presentations" as any)
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذر تحميل العروض");
    setItems(((data ?? []) as unknown as Presentation[]));
    setLoading(false);
  }, [meetingId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const removeOne = async (p: Presentation) => {
    if (!confirm("هل تريد حذف هذا العرض؟")) return;
    if (p.file_path) {
      await supabase.storage.from("meeting-presentations").remove([p.file_path]);
    }
    const { error } = await supabase
      .from("meeting_presentations" as any)
      .delete()
      .eq("id", p.id);
    if (error) toast.error("تعذر الحذف");
    else {
      toast.success("تم الحذف");
      load();
    }
  };

  const openItem = async (p: Presentation) => {
    if (p.kind === "slides") {
      setPresenting(p);
    } else if (p.kind === "file" && p.file_path) {
      const { data } = await supabase.storage
        .from("meeting-presentations")
        .createSignedUrl(p.file_path, 60 * 60);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      else toast.error("تعذر فتح الملف");
    } else if (p.kind === "link" && p.external_url) {
      window.open(p.external_url, "_blank");
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl bg-gold-primary/15 hover:bg-gold-primary hover:text-black text-gold-primary border border-gold-primary/30 transition-all text-[10px] md:text-xs font-black uppercase tracking-widest"
      >
        <Presentation size={14} />
        العرض التقديمي
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-gold-primary/15 grid place-items-center text-gold-primary">
                    <Presentation size={20} />
                  </div>
                  <h3 className="text-lg font-black text-primary">العروض التقديمية</h3>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <button
                      onClick={() => setEditor("new")}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-primary text-black text-xs font-black hover:opacity-90"
                    >
                      <Plus size={14} /> إضافة عرض
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="size-9 rounded-full bg-muted hover:bg-muted/70 grid place-items-center">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-5 space-y-3 flex-1">
                {loading ? (
                  <div className="text-center text-muted-foreground py-10 text-sm">جاري التحميل…</div>
                ) : items.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Presentation size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">لا توجد عروض حتى الآن</p>
                  </div>
                ) : (
                  items.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-secondary/40 border border-border hover:bg-secondary/60 transition"
                    >
                      <div className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
                        {p.kind === "slides" ? <Presentation size={18} /> : p.kind === "file" ? <FileText size={18} /> : <LinkIcon size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-primary truncate">{p.title}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {p.kind === "slides" ? `${p.slides.length} شريحة` : p.kind === "file" ? "ملف مرفوع" : "رابط خارجي"}
                        </p>
                      </div>
                      <button
                        onClick={() => openItem(p)}
                        className="size-10 rounded-xl bg-gold-primary text-black grid place-items-center hover:opacity-90"
                        title="عرض"
                      >
                        {p.kind === "slides" ? <Play size={16} /> : p.kind === "file" ? <Download size={16} /> : <ExternalLink size={16} />}
                      </button>
                      {canManage && (
                        <>
                          {p.kind === "slides" && (
                            <button
                              onClick={() => setEditor(p)}
                              className="size-10 rounded-xl bg-muted hover:bg-muted/70 grid place-items-center"
                              title="تعديل"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => removeOne(p)}
                            className="size-10 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white grid place-items-center"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {editor && userId && (
        <PresentationEditor
          meetingId={meetingId}
          userId={userId}
          initial={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            load();
          }}
        />
      )}

      {presenting && (
        <SlidesPresenter slides={presenting.slides} title={presenting.title} onClose={() => setPresenting(null)} />
      )}
    </>
  );
}

function PresentationEditor({
  meetingId,
  userId,
  initial,
  onClose,
  onSaved,
}: {
  meetingId: string;
  userId: string;
  initial: Presentation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "slides");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slides, setSlides] = useState<Slide[]>(initial?.slides?.length ? initial.slides : [{ title: "", body: "" }]);
  const [externalUrl, setExternalUrl] = useState(initial?.external_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initial;

  const addSlide = () => setSlides((s) => [...s, { title: "", body: "" }]);
  const updateSlide = (i: number, patch: Partial<Slide>) =>
    setSlides((s) => s.map((sl, idx) => (idx === i ? { ...sl, ...patch } : sl)));
  const removeSlide = (i: number) => setSlides((s) => s.filter((_, idx) => idx !== i));

  const uploadSlideImage = async (i: number, f: File) => {
    const path = `${meetingId}/${crypto.randomUUID()}-${f.name}`;
    const { error } = await supabase.storage.from("meeting-presentations").upload(path, f);
    if (error) {
      toast.error("تعذر رفع الصورة");
      return;
    }
    const { data } = await supabase.storage.from("meeting-presentations").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (data?.signedUrl) updateSlide(i, { image_url: data.signedUrl });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("العنوان مطلوب");
    if (kind === "slides" && slides.every((s) => !s.title.trim() && !s.body.trim())) {
      return toast.error("أضف محتوى لشريحة واحدة على الأقل");
    }
    if (kind === "link" && !externalUrl.trim()) return toast.error("الرابط مطلوب");
    if (kind === "file" && !isEdit && !file) return toast.error("اختر ملفاً للرفع");

    setSaving(true);
    try {
      let filePath: string | null = initial?.file_path ?? null;
      if (kind === "file" && file) {
        if (initial?.file_path) {
          await supabase.storage.from("meeting-presentations").remove([initial.file_path]);
        }
        const path = `${meetingId}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("meeting-presentations")
          .upload(path, file);
        if (upErr) throw upErr;
        filePath = path;
      }

      const payload = {
        meeting_id: meetingId,
        title: title.trim(),
        kind,
        slides: kind === "slides" ? slides.filter((s) => s.title.trim() || s.body.trim() || s.image_url) : [],
        file_path: kind === "file" ? filePath : null,
        external_url: kind === "link" ? externalUrl.trim() : null,
        created_by: userId,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("meeting_presentations" as any)
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meeting_presentations" as any).insert(payload);
        if (error) throw error;
      }

      toast.success("تم الحفظ");
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-black text-primary">{isEdit ? "تعديل العرض" : "عرض تقديمي جديد"}</h3>
          <button onClick={onClose} className="size-9 rounded-full bg-muted hover:bg-muted/70 grid place-items-center">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto p-5 space-y-5 flex-1">
          <div>
            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest block mb-2">عنوان العرض</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-gold-primary outline-none"
              placeholder="مثال: أجندة الاجتماع"
            />
          </div>

          {!isEdit && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "slides" as Kind, label: "محرر شرائح", icon: Presentation },
                { v: "file" as Kind, label: "رفع ملف", icon: Upload },
                { v: "link" as Kind, label: "رابط", icon: LinkIcon },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setKind(opt.v)}
                    className={cn(
                      "flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition",
                      kind === opt.v
                        ? "bg-gold-primary/10 border-gold-primary text-primary"
                        : "bg-secondary/40 border-border text-muted-foreground hover:text-primary",
                    )}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-black">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {kind === "slides" && (
            <div className="space-y-3">
              {slides.map((s, i) => (
                <div key={i} className="p-4 rounded-2xl bg-secondary/40 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">شريحة {i + 1}</span>
                    {slides.length > 1 && (
                      <button type="button" onClick={() => removeSlide(i)} className="text-rose-500 hover:text-rose-600">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={s.title}
                    onChange={(e) => updateSlide(i, { title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-border text-sm font-bold text-slate-900 placeholder:text-slate-400"
                    placeholder="عنوان الشريحة"
                  />
                  <textarea
                    value={s.body}
                    onChange={(e) => updateSlide(i, { body: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-border text-sm text-slate-900 placeholder:text-slate-400"
                    placeholder="محتوى الشريحة (اختياري)"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border text-xs cursor-pointer hover:bg-muted">
                      <ImageIcon size={14} />
                      {s.image_url ? "تغيير الصورة" : "إضافة صورة"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadSlideImage(i, f);
                        }}
                      />
                    </label>
                    {s.image_url && (
                      <>
                        <img src={s.image_url} alt="" className="size-10 rounded-lg object-cover" />
                        <button type="button" onClick={() => updateSlide(i, { image_url: null })} className="text-rose-500 text-xs">
                          إزالة
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addSlide}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-border hover:border-gold-primary text-muted-foreground hover:text-primary text-sm font-black flex items-center justify-center gap-2"
              >
                <Plus size={16} /> إضافة شريحة
              </button>
            </div>
          )}

          {kind === "file" && (
            <div>
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest block mb-2">
                ملف العرض (PowerPoint / PDF)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pptx,.ppt,.pdf,.key,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border"
              />
              {initial?.file_path && !file && (
                <p className="text-[10px] text-muted-foreground mt-2">ملف موجود حالياً — اختر ملفاً جديداً للاستبدال</p>
              )}
            </div>
          )}

          {kind === "link" && (
            <div>
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest block mb-2">
                رابط خارجي (Google Slides / Canva / غيره)
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-gold-primary outline-none"
                placeholder="https://"
                dir="ltr"
              />
            </div>
          )}
        </form>

        <div className="p-5 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-muted text-sm font-black hover:bg-muted/70">
            إلغاء
          </button>
          <button
            onClick={submit as any}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gold-primary text-black text-sm font-black disabled:opacity-60"
          >
            {saving ? "جاري الحفظ…" : "حفظ"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SlidesPresenter({ slides, title, onClose }: { slides: Slide[]; title: string; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const total = slides.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIdx((i) => Math.min(i + 1, total - 1));
      else if (e.key === "ArrowRight") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onClose]);

  if (total === 0) return null;
  const s = slides[idx];

  return (
    <div className="fixed inset-0 z-[140] bg-black text-white flex flex-col" dir="rtl">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Presentation className="text-gold-primary" size={20} />
          <span className="font-black text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-white/60">
            {idx + 1} / {total}
          </span>
          <button onClick={onClose} className="size-9 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-16 relative">
        <button
          onClick={() => setIdx((i) => Math.max(i - 1, 0))}
          disabled={idx === 0}
          className="absolute right-4 size-12 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center disabled:opacity-30"
        >
          <ChevronRight size={22} />
        </button>
        <button
          onClick={() => setIdx((i) => Math.min(i + 1, total - 1))}
          disabled={idx === total - 1}
          className="absolute left-4 size-12 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center disabled:opacity-30"
        >
          <ChevronLeft size={22} />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="max-w-5xl w-full text-center space-y-8"
          >
            {s.title && (
              <h2 className="text-4xl md:text-7xl font-black tracking-tight text-gold-primary drop-shadow-2xl">{s.title}</h2>
            )}
            {s.image_url && (
              <img src={s.image_url} alt="" className="mx-auto max-h-[50vh] rounded-2xl object-contain shadow-2xl" />
            )}
            {s.body && (
              <p className="text-xl md:text-3xl leading-relaxed text-white/85 whitespace-pre-wrap">{s.body}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-1.5 p-4 border-t border-white/10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === idx ? "w-8 bg-gold-primary" : "w-1.5 bg-white/20 hover:bg-white/40",
            )}
          />
        ))}
      </div>
    </div>
  );
}
