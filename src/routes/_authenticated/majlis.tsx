import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { toast } from "sonner";
import {
  MessageSquare, Pin, Plus, Send, Trash2, Loader2, X, Newspaper, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { sendFcmNotification } from "@/lib/fcm";
import { useUserRole } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/majlis")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الأخبار العائلية — السيف" },
      { name: "description", content: "منشورات وأخبار عائلة السيف." },
    ],
  }),
  component: MajlisPage,
});

type MajlisPost = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  kind: string;
  pinned: boolean;
  created_at: string;
  cleanBody?: string;
  author?: { arabic_name: string | null; full_name: string | null; avatar_url: string | null };
};

function MajlisPage() {
  const { userId: meId, isAdmin, isChairman, canManage: canManageSection } = useUserRole();
  const canManage = canManageSection("news");

  const [profile, setProfile] = useState({ name: "...", role: "...", initial: "ص", avatarPath: null as string | null });
  const [posts, setPosts] = useState<MajlisPost[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const dynamicLogo = useSiteLogo();

  const loadData = useCallback(async () => {
    if (!meId) return;
    setLoading(true);
    try {
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", meId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", meId),
      ]);
      const rs = (roles ?? []).map(r => r.role);
      if (p) {
        setProfile({
          name: p.arabic_name || p.full_name || "عضو",
          role: rs.includes("chairman") ? "رئيس المجلس" : rs.includes("admin") ? "مسؤول تقني" : rs.includes("manager") ? "مسؤول قسم" : "عضو",
          initial: (p.arabic_name?.[0] || "ع").toUpperCase(),
          avatarPath: p.avatar_url,
        });
      }

      const { data: rawPosts, error } = await supabase
        .from("majlis_posts")
        .select("*");
      if (error) console.error("Posts fetch error:", error);

      if (rawPosts) {
        const authorIds = Array.from(new Set(rawPosts.map((p: any) => p.author_id).filter(Boolean)));
        const { data: authorProfiles } = authorIds.length
          ? await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").in("id", authorIds)
          : { data: [] };
        const profileMap = new Map((authorProfiles ?? []).map((p: any) => [p.id, p]));

        // Only "sharing" — meaning no poll and uiKind=sharing (or legacy kind=discussion without kind tag)
        const processed = rawPosts.map((p: any) => {
          const kindMatch = p.body?.match(/---kind:(\w+)/);
          const uiKind = kindMatch
            ? kindMatch[1]
            : (p.kind === "announcement" ? "announcement" : p.kind === "complaint" ? "complaint" : "sharing");
          const cleanBody = (p.body || "")
            .replace(/---kind:.*?\n?/, "")
            .replace(/---poll:.*?--- \n?/, "")
            .replace(/^---poll:.*?---/s, "")
            .trim();
          return { ...p, uiKind, cleanBody: cleanBody || p.body, author: profileMap.get(p.author_id) || null };
        }).filter((p: any) => p.uiKind === "sharing" || p.uiKind === "announcement" || p.kind === "announcement");

        processed.sort((a: any, b: any) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setPosts(processed as any);
      }

      const { data: coms } = await supabase
        .from("majlis_comments")
        .select("*")
        .order("created_at", { ascending: true });
      if (coms) {
        const ids = Array.from(new Set(coms.map((c: any) => c.author_id).filter(Boolean)));
        const { data: cProfs } = ids.length
          ? await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").in("id", ids)
          : { data: [] };
        const cMap = new Map((cProfs ?? []).map((p: any) => [p.id, p]));
        setComments(coms.map((c: any) => ({ ...c, author: cMap.get(c.author_id) || null })));
      }
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("majlis-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_comments" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  return (
    <AppShell title="الأخبار" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">
        <QuickActionsBanner />

        <section className="animate-fade-up px-4 md:px-0">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-primary via-[#0d2620] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
            <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
              <div className="size-28 md:size-64 logo-alsaif-banner" style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any} />
            </div>
            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
              <div className="space-y-3 md:space-y-5 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">أخبار السيف</span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">الأخبار العائلية</h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">منشورات وأخبار العائلة. للنقاشات والتصويت، توجّه إلى صفحة الاجتماعات.</p>
              </div>
              <div className="size-16 md:size-28 rounded-2xl md:rounded-[36px] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl self-center md:self-auto shrink-0 group-hover:rotate-12 transition-transform duration-700">
                <Newspaper className="size-8 md:size-14 text-gold-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </section>

        {canManage && (
          <div className="px-4 md:px-0 flex justify-end">
            <button onClick={() => setShowAdd(true)} className="btn-gold px-8 py-3.5 rounded-2xl flex items-center justify-center gap-3 shadow-xl text-sm font-black active:scale-95 transition-all">
              <Plus size={20} strokeWidth={3} /> <span>إضافة منشور</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 px-4 md:px-0">
          {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin size-12 mx-auto text-primary opacity-20" /></div> :
            posts.map(p => <PostCard key={p.id} post={p} meId={meId} isChairman={isAdmin || isChairman} canDelete={canManage || p.author_id === meId} onRefresh={loadData} comments={comments} />)}
          {!loading && posts.length === 0 && <div className="p-20 text-center bg-muted/20 rounded-[48px] border-4 border-dashed italic text-muted-foreground">لا توجد منشورات حالياً.</div>}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && <AddPostDialog meId={meId} onClose={() => setShowAdd(false)} onSaved={loadData} />}
      </AnimatePresence>
    </AppShell>
  );
}

function PostCard({ post, meId, isChairman, canDelete, onRefresh, comments }: any) {
  const authorName = post.author?.arabic_name || post.author?.full_name || "عضو";

  const deletePost = async () => {
    if (!confirm("حذف المنشور؟")) return;
    const { error } = await supabase.from("majlis_posts").delete().eq("id", post.id);
    if (!error) { toast.success("تم الحذف"); onRefresh(); }
  };
  const togglePin = async () => {
    const { error } = await supabase.from("majlis_posts").update({ pinned: !post.pinned }).eq("id", post.id);
    if (!error) onRefresh();
  };

  const postComments = comments.filter((c: any) => c.post_id === post.id && !c.body.startsWith("[VOTE]:"));

  return (
    <motion.article layout className={cn("card-surface p-8 md:p-12 relative overflow-hidden group transition-all duration-500 hover:shadow-2xl", post.pinned && "border-gold-primary/30 bg-gold-primary/[0.02]")}>
      {post.pinned && <div className="absolute top-0 left-0 bg-gold-primary text-white px-6 py-1.5 rounded-br-3xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg z-10"><Pin size={12} /> مثبت</div>}
      <div className="flex flex-col md:flex-row justify-between items-start gap-8">
        <div className="flex-1 space-y-6 w-full">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-[22px] border-2 border-primary/10 overflow-hidden shadow-lg">
              <UserAvatar path={post.author?.avatar_url} name={authorName} className="size-full" userId={post.author_id} showBadges />
            </div>
            <div>
              <h4 className="text-lg font-black text-primary">{authorName}</h4>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(post.created_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
          <div className="space-y-4">
            {post.kind === "announcement" && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-primary/15 text-gold-primary text-[10px] font-black uppercase tracking-widest">
                <Pin size={10} /> إعلان المجلس
              </span>
            )}
            <h3 className="text-2xl md:text-3xl font-black text-primary leading-tight">{post.title}</h3>
            <p className="text-base md:text-lg font-bold text-muted-foreground/80 dark:text-white/80 leading-relaxed whitespace-pre-wrap">{post.cleanBody}</p>
          </div>
        </div>
        {canDelete && (
          <div className="flex flex-row md:flex-col gap-2 md:opacity-0 md:group-hover:opacity-100 transition-all duration-500 self-end md:self-start shrink-0">
            {isChairman && <button onClick={togglePin} className={cn("size-12 rounded-2xl flex items-center justify-center transition-all shadow-lg", post.pinned ? "bg-gold-primary text-white" : "bg-gold-primary/10 text-gold-primary hover:bg-gold-primary hover:text-white")} title="تثبيت"><Pin size={20} /></button>}
            <button onClick={deletePost} className="size-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg" title="حذف"><Trash2 size={20} /></button>
          </div>
        )}
      </div>
      <CommentsSection post={post} meId={meId} isChairman={isChairman} comments={postComments} onRefresh={onRefresh} />
    </motion.article>
  );
}

function CommentsSection({ post, meId, isChairman, comments, onRefresh }: any) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    if (!text.trim() || !meId) return;
    setSending(true);
    const { error } = await supabase.from("majlis_comments").insert({ post_id: post.id, author_id: meId, body: text.trim() });
    setSending(false);
    if (error) toast.error("تعذر إرسال التعليق"); else { setText(""); onRefresh(); }
  };
  const removeComment = async (id: string) => {
    if (!confirm("حذف التعليق؟")) return;
    const { error } = await supabase.from("majlis_comments").delete().eq("id", id);
    if (!error) onRefresh();
  };

  return (
    <div className="mt-8 pt-6 border-t border-border/40">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs font-black text-primary/70 hover:text-primary transition-all">
        <MessageSquare size={16} />
        <span>{comments.length > 0 ? `${comments.length} تعليق` : "أضف تعليقاً"}</span>
        <ChevronLeft size={14} className={cn("transition-transform", open && "-rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-4 pt-6">
              {comments.map((c: any) => {
                const name = c.author?.arabic_name || c.author?.full_name || "عضو";
                const canDel = isChairman || c.author_id === meId;
                return (
                  <div key={c.id} className="flex gap-3 items-start group/c">
                    <div className="size-10 rounded-2xl border border-primary/10 overflow-hidden shrink-0">
                      <UserAvatar path={c.author?.avatar_url} name={name} className="size-full" userId={c.author_id} />
                    </div>
                    <div className="flex-1 bg-muted/40 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-black text-primary">{name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          {canDel && <button onClick={() => removeComment(c.id)} className="opacity-0 group-hover/c:opacity-100 text-rose-500 hover:text-rose-700"><Trash2 size={12} /></button>}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-foreground/80 whitespace-pre-wrap leading-relaxed">{c.body}</p>
                    </div>
                  </div>
                );
              })}
              {comments.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">لا توجد تعليقات بعد — كن أول من يعلق</p>}
              <form onSubmit={submit} className="flex gap-2 pt-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب تعليقك..."
                  className="flex-1 h-12 px-5 rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                <button disabled={sending || !text.trim()} type="submit" className="size-12 rounded-2xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 shadow-lg">
                  {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddPostDialog({ meId, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });

  const submit = async (e: any) => {
    e.preventDefault();
    const title = form.title.trim(), body = form.body.trim();
    if (!title || !body) return toast.error("يرجى إكمال البيانات الأساسية");
    setSaving(true);
    const finalBody = `---kind:sharing\n${body}`;
    try {
      const { error } = await supabase.from("majlis_posts").insert({
        title, body: finalBody, kind: "discussion", author_id: meId,
      });
      if (!error) {
        toast.success("تم النشر بنجاح");
        sendFcmNotification({ data: { title: "منشور جديد", body: title } }).catch(() => {});
        onSaved(); onClose();
      } else toast.error("تعذر النشر: " + error.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl" dir="rtl">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card w-full max-w-2xl rounded-[48px] overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <header className="p-8 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg"><Plus size={24} strokeWidth={3} /></div>
            <h3 className="text-2xl font-black text-primary">منشور جديد</h3>
          </div>
          <button onClick={onClose} className="size-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"><X size={24} /></button>
        </header>
        <form onSubmit={submit} className="p-8 space-y-6 overflow-y-auto no-scrollbar flex-1 text-foreground">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">عنوان المنشور</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="عنوان المنشور..."
              className="w-full h-16 px-8 rounded-3xl bg-muted/40 border border-border/60 font-black text-xl focus:ring-4 focus:ring-primary/5 focus:border-primary shadow-inner outline-none" required />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">تفاصيل المنشور</label>
            <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="اكتب تفاصيل المنشور هنا..." rows={6}
              className="w-full p-8 rounded-[40px] bg-muted/40 border border-border/60 font-bold text-lg focus:ring-4 focus:ring-primary/5 focus:border-primary resize-none shadow-inner outline-none" required />
          </div>
          <div className="flex gap-4 pt-6">
            <button type="button" onClick={onClose} className="flex-1 py-5 rounded-[28px] font-black text-muted-foreground hover:bg-muted">تراجع</button>
            <button disabled={saving} type="submit" className="flex-[2] btn-gold py-5 rounded-[28px] font-black text-xl shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 active:scale-[0.98]">
              {saving ? <Loader2 className="animate-spin size-6" /> : <><Send size={24} /> <span>نشر الآن</span></>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
