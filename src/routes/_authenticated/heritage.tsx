import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import {
  BookOpen,
  History,
  Scroll,
  Music,
  Quote,
  Search,
  Plus,
  X,
  Heart,
  ChevronLeft,
  Loader2,
  Image as ImageIcon,
  Trash2,
  Pencil,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useUserRole } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/heritage")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إرث السيف — السيف" },
      { name: "description", content: "قصائد، قصص، وموروثات عائلة السيف." },
    ],
  }),
  component: HeritagePage,
});

type HeritageKind = "poem" | "story" | "proverb" | "historical";

interface HeritageItem {
  id: string;
  kind: HeritageKind;
  title: string;
  content: string;
  image_url: string | null;
  author_name: string | null;
  created_at: string;
  author_id: string;
}

const KIND_META: Record<HeritageKind, { label: string; icon: any; color: string; bg: string }> = {
  poem: { label: "قصيدة", icon: Music, color: "text-amber-500", bg: "bg-amber-500/10" },
  story: { label: "قصة", icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  proverb: { label: "حكمة/مثل", icon: Quote, color: "text-blue-500", bg: "bg-blue-500/10" },
  historical: { label: "تاريخي", icon: History, color: "text-purple-500", bg: "bg-purple-500/10" },
};

function HeritagePage() {
  const { userId, canManage: canManageSection, isAdmin, isChairman } = useUserRole();
  const canManage = canManageSection("heritage") || isAdmin || isChairman;
  const dynamicLogo = useSiteLogo();

  const [profile, setProfile] = useState({ name: "عضو العائلة", role: "عضو", initial: "س", avatarPath: null as string | null });
  const [items, setItems] = useState<HeritageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | HeritageKind>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowCompose] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    kind: "poem" as HeritageKind,
    title: "",
    content: "",
    author_name: ""
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data: posts, error } = await supabase
      .from("majlis_posts")
      .select("*")
      .eq("kind", "discussion")
      .ilike("title", "[إرث]%")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("تعذر تحميل الإرث");
    } else {
      const mapped: HeritageItem[] = await Promise.all((posts ?? []).map(async p => {
        const kindMatch = p.body.match(/^---kind:(.*)\n/);
        const imageMatch = p.body.match(/---image:(.*)\n/);

        const kind = (kindMatch ? kindMatch[1].trim() : "story") as HeritageKind;
        let image_url = imageMatch ? imageMatch[1].trim() : null;

        if (image_url && !image_url.startsWith('http')) {
           const { data } = await supabase.storage.from("trip-images").createSignedUrl(image_url, 60 * 60);
           image_url = data?.signedUrl || null;
        }

        return {
          id: p.id,
          kind: kind,
          title: p.title.replace("[إرث]", "").trim(),
          content: p.body.replace(/---kind:.*\n/, "").replace(/---image:.*\n/, ""),
          image_url: image_url,
          author_name: null,
          created_at: p.created_at,
          author_id: p.author_id
        };
      }));
      setItems(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      if (userId) {
        const { data: p } = await supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", userId).maybeSingle();
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو";
        setProfile({
          name,
          role: isAdmin ? "مسؤول النظام" : isChairman ? "رئيس المجلس" : "عضو",
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });
      }
      await loadAll();
    })();
  }, [loadAll, userId, isAdmin, isChairman]);

  const submitHeritage = async () => {
    if (!userId) return;
    if (!draft.title.trim() || !draft.content.trim()) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    setSubmitting(true);

    let uploadedImagePath = "";
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `heritage/${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("trip-images").upload(path, imageFile);
      if (!upErr) uploadedImagePath = path;
    }

    const finalBody = `---kind:${draft.kind}\n${uploadedImagePath ? `---image:${uploadedImagePath}\n` : ""}${draft.content.trim()}${draft.author_name ? `\n\n— بقلم: ${draft.author_name}` : ""}`;

    const { error } = await supabase.from("majlis_posts").insert({
      author_id: userId,
      kind: "discussion",
      title: `[إرث] ${draft.title.trim()}`,
      body: finalBody,
    });

    if (error) {
      toast.error("فشل النشر");
    } else {
      toast.success("تمت إضافة الإرث بنجاح");
      setDraft({ kind: "poem", title: "", content: "", author_name: "" });
      setImageFile(null);
      setImagePreview(null);
      setShowCompose(false);
      loadAll();
    }
    setSubmitting(false);
  };

  const deleteItem = async (id: string) => {
     if (!confirm("هل تريد حذف هذا الموروث؟")) return;
     const { error } = await supabase.from("majlis_posts").delete().eq("id", id);
     if (error) toast.error("تعذر الحذف");
     else {
        toast.success("تم الحذف");
        loadAll();
     }
  };

  const filteredItems = items.filter(it => {
    const k = filter === "all" || it.kind === filter;
    const s = !search || it.title.includes(search) || it.content.includes(search);
    return k && s;
  });

  return (
    <AppShell title="إرث السيف" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        {/* Heritage Header */}
        <section className="relative overflow-hidden rounded-[40px] md:rounded-[64px] bg-[#1a2b3c] p-8 md:p-20 text-white shadow-2xl border border-white/5 group">
           <div className="absolute inset-0 bg-gradient-to-br from-[#1a2b3c] via-[#0f172a] to-black opacity-90 z-0" />
           <div className="absolute top-1/2 left-0 -translate-y-1/2 opacity-10 pointer-events-none scale-[2] logo-alsaif z-1" style={{ '--logo-url': `url(${dynamicLogo || alsaifMark.url})` } as any} />

           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="space-y-4 text-center md:text-right">
                 <div className="flex items-center justify-center md:justify-start gap-3">
                    <div className="h-1 w-12 bg-gold-primary rounded-full shadow-[0_0_20px_rgba(212,175,55,0.6)]" />
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">موروث الأجيال</span>
                 </div>
                 <h2 className="text-4xl md:text-8xl font-black tracking-tighter leading-none">إرث<br/><span className="text-white/30">السيف</span></h2>
                 <p className="text-white/60 font-bold text-lg md:text-2xl max-w-xl">نحفظ قصص الأجداد، لتبقى فخراً للأحفاد.</p>
              </div>

              {canManage && (
                <button
                  onClick={() => setShowCompose(true)}
                  className="btn-gold px-10 py-5 md:px-14 md:py-7 rounded-[32px] text-lg md:text-xl font-black shadow-2xl shadow-gold-primary/30 flex items-center gap-4 hover:scale-105 active:scale-95 transition-all group w-full md:w-auto justify-center"
                >
                   <Scroll className="size-6 group-hover:rotate-12 transition-transform duration-500" />
                   إضافة موروث جديد
                </button>
              )}
           </div>
        </section>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-[28px] border border-border/40 overflow-x-auto no-scrollbar w-full md:w-auto">
              <FilterTab active={filter === "all"} onClick={() => setFilter("all")} label="الكل" count={items.length} />
              {(Object.entries(KIND_META) as [HeritageKind, any][]).map(([key, meta]) => (
                 <FilterTab
                   key={key}
                   active={filter === key}
                   onClick={() => setFilter(key)}
                   label={meta.label}
                   icon={<meta.icon size={14} />}
                   count={items.filter(i => i.kind === key).length}
                 />
              ))}
           </div>

           <div className="relative group w-full md:w-80">
              <Search className="size-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="ابحث في الإرث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-2xl pr-11 pl-4 py-3.5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
              />
           </div>
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 opacity-20">
             <Loader2 className="size-16 animate-spin text-primary" strokeWidth={3} />
             <p className="mt-4 font-black tracking-widest text-xs uppercase">جاري فتح سجلات التاريخ...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="card-surface p-24 md:p-40 flex flex-col items-center text-center gap-8 border-dashed border-4 opacity-40 rounded-[56px] bg-muted/20">
             <Scroll size={80} className="text-muted-foreground opacity-20" />
             <div className="space-y-2">
                <p className="text-3xl font-black text-primary">لا توجد موروثات حالياً</p>
                <p className="text-lg font-bold opacity-60">سيتم إضافة المحتوى قريباً من قبل مسؤولي الإرث.</p>
             </div>
          </div>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
             {filteredItems.map((item, idx) => (
                <HeritageCard key={item.id} item={item} index={idx} canDelete={canManage} onDelete={() => deleteItem(item.id)} />
             ))}
          </div>
        )}
      </div>

      {/* Compose Dialog */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#0D0F14] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-14 space-y-10 shadow-2xl rounded-[32px] md:rounded-[60px] relative custom-scrollbar border border-white/5"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-[#0D0F14] z-10 pb-4 border-b border-border/20">
                  <div className="space-y-1">
                     <h3 className="text-2xl md:text-3xl font-black text-primary tracking-tight">إضافة موروث</h3>
                     <p className="text-xs font-bold text-muted-foreground opacity-60">دون قصيدة أو قصة لتاريخ العائلة.</p>
                  </div>
                  <button onClick={() => setShowCompose(false)} className="size-12 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-all"><X size={20} /></button>
               </div>

               <div className="space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                     {(Object.entries(KIND_META) as [HeritageKind, any][]).map(([key, meta]) => (
                        <button
                          key={key}
                          onClick={() => setDraft(d => ({ ...d, kind: key }))}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                            draft.kind === key
                              ? cn("border-primary bg-primary/5", meta.color)
                              : "border-border/40 hover:border-primary/20 opacity-60"
                          )}
                        >
                           <meta.icon size={24} />
                           <span className="text-[10px] font-black">{meta.label}</span>
                        </button>
                     ))}
                  </div>

                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">العنوان</label>
                        <input
                          value={draft.title}
                          onChange={e => setDraft({...draft, title: e.target.value})}
                          placeholder="مثال: قصة شجاعة الجد..."
                          className="w-full h-16 px-8 rounded-[24px] bg-muted/30 border border-border/60 font-black text-lg focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
                        />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">صورة مرافقة (اختياري)</label>
                        <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-[32px] cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all group/upload">
                           {imagePreview ? (
                              <img src={imagePreview} className="h-40 w-full object-contain rounded-2xl shadow-xl" alt="Preview" />
                           ) : (
                              <>
                                 <Upload className="size-8 text-muted-foreground opacity-30 group-hover/upload:scale-110 transition-transform" />
                                 <span className="text-xs font-bold text-muted-foreground">اضغط لرفع صورة مرافقة</span>
                              </>
                           )}
                           <input
                             type="file"
                             hidden
                             accept="image/*"
                             onChange={(e) => {
                               const f = e.target.files?.[0];
                               if (f) {
                                 setImageFile(f);
                                 setImagePreview(URL.createObjectURL(f));
                               }
                             }}
                           />
                        </label>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">الاسم المرتبط (صاحب الموروث)</label>
                        <input
                          value={draft.author_name}
                          onChange={e => setDraft({...draft, author_name: e.target.value})}
                          placeholder="الاسم الثلاثي إن أمكن..."
                          className="w-full h-16 px-8 rounded-[24px] bg-muted/30 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">المحتوى</label>
                        <textarea
                          value={draft.content}
                          onChange={e => setDraft({...draft, content: e.target.value})}
                          placeholder="اكتب الأبيات أو القصة هنا..."
                          rows={8}
                          className={cn(
                            "w-full p-8 rounded-[32px] bg-muted/30 border border-border/60 font-bold text-base focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none shadow-inner",
                            draft.kind === 'poem' ? "text-center leading-loose font-arabic italic" : "leading-relaxed"
                          )}
                        />
                     </div>
                  </div>

                  <div className="flex gap-4 pt-8 sticky bottom-0 bg-white dark:bg-[#0D0F14] py-4 border-t border-border/20">
                     <button type="button" onClick={() => setShowCompose(false)} className="flex-1 py-5 rounded-[24px] font-black text-muted-foreground hover:bg-muted transition-all">تراجع</button>
                     <button
                       disabled={submitting}
                       onClick={submitHeritage}
                       className="flex-[2] btn-gold py-5 rounded-[24px] font-black text-lg shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                     >
                       {submitting ? <Loader2 className="size-6 animate-spin" /> : <><Scroll className="size-5" /> <span>تثبيت في السجل</span></>}
                     </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function HeritageCard({ item, index, canDelete, onDelete }: { item: HeritageItem; index: number; canDelete: boolean; onDelete: () => void }) {
  const meta = KIND_META[item.kind];

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="break-inside-avoid relative bg-white dark:bg-card border border-border/40 rounded-[32px] p-8 shadow-xl hover:shadow-2xl transition-all group overflow-hidden"
    >
       <div className={cn("absolute -top-6 -right-6 size-24 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-1000", meta.bg)} />
       <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
             <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5", meta.color, meta.bg, "border-transparent")}>
                <meta.icon size={10} />
                {meta.label}
             </div>
             <div className="flex items-center gap-2">
                <button className="text-muted-foreground hover:text-rose-500 transition-colors">
                   <Heart size={16} />
                </button>
                {canDelete && (
                  <button onClick={onDelete} className="text-muted-foreground hover:text-rose-600 transition-colors">
                     <Trash2 size={16} />
                  </button>
                )}
             </div>
          </div>

          <div className="space-y-4">
             {item.image_url && (
                <div className="rounded-2xl overflow-hidden shadow-lg border border-border/20">
                   <img src={item.image_url} alt={item.title} className="w-full h-auto object-cover max-h-64" />
                </div>
             )}
             <h3 className="text-2xl font-black text-primary leading-tight tracking-tight">{item.title}</h3>
             <div className={cn(
               "text-base font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap",
               item.kind === 'poem' ? "text-center font-arabic italic bg-muted/20 p-4 rounded-2xl" : ""
             )}>
                {item.content}
             </div>
          </div>

          <div className="pt-6 border-t border-border/20 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                   <Scroll size={14} />
                </div>
                <p className="text-[10px] font-black text-primary/60">{new Date(item.created_at).toLocaleDateString("ar-SA")}</p>
             </div>
             <ChevronLeft className="size-4 text-primary/20 group-hover:text-primary group-hover:-translate-x-1 transition-all" />
          </div>
       </div>
    </motion.article>
  );
}

function FilterTab({ active, onClick, label, icon, count }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-2xl text-[10px] md:text-xs font-black transition-all border flex items-center gap-2 shrink-0",
        active
          ? "bg-primary text-white border-primary shadow-xl shadow-primary/20 scale-105"
          : "bg-white dark:bg-card/50 border-border/40 text-muted-foreground hover:bg-muted hover:border-border"
      )}
    >
       {icon}
       <span>{label}</span>
       {count !== undefined && <span className={cn("min-w-[18px] h-4 px-1 rounded-md text-[8px] flex items-center justify-center", active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>{count}</span>}
    </button>
  );
}
