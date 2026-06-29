import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import {
  MessageSquare, Plus, Send, Trash2, Loader2, X, ShieldAlert, Clock, Vote,
  ListFilter, BarChart3, CheckCircle2, Newspaper, ChevronLeft, Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { sendFcmNotification } from "@/lib/fcm";

type PostKind = "announcement" | "discussion" | "complaint";
type UiKind = "event" | "complaint" | "discussion";

type Post = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  kind: PostKind;
  pinned: boolean;
  created_at: string;
  uiKind?: UiKind;
  cleanBody?: string;
  author?: { arabic_name: string | null; full_name: string | null; avatar_url: string | null };
};

const KINDS: { key: UiKind; dbKind: PostKind; label: string; color: string; icon: any }[] = [
  { key: "discussion", dbKind: "discussion", label: "نقاشات", color: "blue", icon: Newspaper },
  { key: "event", dbKind: "discussion", label: "مناسبات", color: "amber", icon: Clock },
  { key: "complaint", dbKind: "complaint", label: "طلبات", color: "rose", icon: ShieldAlert },
];

export function MeetingDiscussions({ meId, isAdmin, isChairman, canManage }: {
  meId: string | null; isAdmin: boolean; isChairman: boolean; canManage: boolean;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<UiKind | "all">("all");
  const [showAdd, setShowAdd] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rawPosts } = await supabase
        .from("majlis_posts")
        .select("*")
        .neq("kind", "announcement");

      if (rawPosts) {
        const authorIds = Array.from(new Set(rawPosts.map((p: any) => p.author_id).filter(Boolean)));
        const { data: authorProfiles } = authorIds.length
          ? await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").in("id", authorIds)
          : { data: [] };
        const profileMap = new Map((authorProfiles ?? []).map((p: any) => [p.id, p]));

        const processed = rawPosts.map((p: any) => {
          const kindMatch = p.body?.match(/---kind:(\w+)/);
          const uiKind = (kindMatch ? kindMatch[1] : (p.kind === "complaint" ? "complaint" : "discussion")) as UiKind;
          const cleanBody = (p.body || "")
            .replace(/---kind:.*?\n?/, "")
            .replace(/---poll:.*?--- \n?/, "")
            .trim();
          return { ...p, uiKind, cleanBody: cleanBody || p.body, author: profileMap.get(p.author_id) || null };
        }).filter((p: any) => p.uiKind !== "sharing");

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
  }, []);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("meeting-discussions-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_comments" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const filtered = useMemo(() => posts.filter(p => {
    if (p.kind === "complaint" && !isChairman && p.author_id !== meId) return false;
    if (activeTab === "all") return true;
    return p.uiKind === activeTab;
  }), [posts, activeTab, isChairman, meId]);

  return (
    <section className="space-y-8 animate-fade-up" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs">
          <MessageSquare className="size-4 text-gold-primary" /> النقاشات و الاقتراحات و المناسبات
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-gold px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl text-xs font-black active:scale-95 transition-all">
          <Plus size={18} strokeWidth={3} /><span>إضافة</span>
        </button>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-3xl border border-border/40 overflow-x-auto no-scrollbar w-fit">
        <Tab active={activeTab === "all"} onClick={() => setActiveTab("all")} label="الكل" icon={<ListFilter size={16} />} />
        {KINDS.map(k => <Tab key={k.key} active={activeTab === k.key} onClick={() => setActiveTab(k.key)} label={k.label} icon={<k.icon size={16} />} color={k.color} />)}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? <div className="py-12 text-center"><Loader2 className="animate-spin size-10 mx-auto text-primary opacity-30" /></div> :
          filtered.map(p => (
            <PostCard key={p.id} post={p} meId={meId} isChairman={isAdmin || isChairman}
              canDelete={canManage || p.author_id === meId} onRefresh={loadData} comments={comments} />
          ))}
        {!loading && filtered.length === 0 && (
          <div className="p-12 text-center bg-muted/20 rounded-[32px] border-2 border-dashed text-muted-foreground text-sm">
            لا توجد عناصر في هذا القسم حالياً.
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddDialog meId={meId} isChairman={isAdmin || isChairman} onClose={() => setShowAdd(false)} onSaved={loadData} />}
      </AnimatePresence>
    </section>
  );
}

function Tab({ active, onClick, label, icon, color }: any) {
  const styles: any = {
    emerald: "border-emerald-500/20 text-emerald-600 bg-emerald-50",
    amber: "border-amber-500/20 text-amber-600 bg-amber-50",
    rose: "border-rose-500/20 text-rose-600 bg-rose-50",
    blue: "border-blue-500/20 text-blue-600 bg-blue-50",
  };
  return (
    <button onClick={onClick} className={cn("px-5 py-2.5 rounded-[20px] text-xs font-black transition-all flex items-center gap-2 shrink-0 border-2",
      active ? (color ? styles[color] + " border-current shadow-md scale-105" : "bg-primary text-white border-primary shadow-md scale-105")
        : "bg-card text-muted-foreground border-transparent hover:bg-muted")}>
      {icon}<span>{label}</span>
    </button>
  );
}

function PostCard({ post, meId, isChairman, canDelete, onRefresh, comments }: any) {
  const authorName = post.author?.arabic_name || post.author?.full_name || "عضو";
  const kind = KINDS.find(k => k.key === post.uiKind) || KINDS[0];

  const deletePost = async () => {
    if (!confirm("حذف العنصر؟")) return;
    const { error } = await supabase.from("majlis_posts").delete().eq("id", post.id);
    if (!error) { toast.success("تم الحذف"); onRefresh(); }
  };
  const togglePin = async () => {
    const { error } = await supabase.from("majlis_posts").update({ pinned: !post.pinned }).eq("id", post.id);
    if (!error) onRefresh();
  };

  const pollData = useMemo(() => {
    if (!post.cleanBody?.startsWith("---poll:")) return null;
    try { const m = post.cleanBody.match(/^---poll:({.*?})---/s); return m ? JSON.parse(m[1]) : null; } catch { return null; }
  }, [post.cleanBody]);

  const displayBody = (post.cleanBody || "").replace(/^---poll:.*?---/s, "").trim();
  const postComments = comments.filter((c: any) => c.post_id === post.id);
  const myVote = postComments.find((c: any) => c.author_id === meId && c.body.startsWith("[VOTE]:"));
  const myVoteIndex = myVote ? parseInt(myVote.body.split(":")[1]) : -1;

  const voteCounts = useMemo(() => {
    if (!pollData) return [];
    const counts = new Array(pollData.options.length).fill(0);
    postComments.forEach((c: any) => {
      if (c.body.startsWith("[VOTE]:")) {
        const i = parseInt(c.body.split(":")[1]);
        if (i >= 0 && i < counts.length) counts[i]++;
      }
    });
    return counts;
  }, [pollData, postComments]);
  const total = voteCounts.reduce((a, b) => a + b, 0);

  const handleVote = async (idx: number) => {
    if (myVoteIndex !== -1) return toast.error("لقد قمت بالتصويت مسبقاً");
    const { error } = await supabase.from("majlis_comments").insert({ post_id: post.id, author_id: meId, body: `[VOTE]:${idx}` });
    if (!error) { toast.success("تم تسجيل صوتك"); onRefresh(); }
  };

  return (
    <motion.article layout className={cn("card-surface p-6 md:p-10 relative overflow-hidden group transition-all duration-500 hover:shadow-2xl", post.pinned && "border-gold-primary/30 bg-gold-primary/[0.02]")}>
      {post.pinned && <div className="absolute top-0 left-0 bg-gold-primary text-white px-5 py-1 rounded-br-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg z-10"><Pin size={12} /> مثبت</div>}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="flex-1 space-y-5 w-full">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="size-12 rounded-2xl border-2 border-primary/10 overflow-hidden shadow">
              <UserAvatar path={post.author?.avatar_url} name={authorName} className="size-full" userId={post.author_id} showBadges />
            </div>
            <div>
              <h4 className="text-base font-black text-primary">{authorName}</h4>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(post.created_at).toLocaleDateString("ar-SA", { day: 'numeric', month: 'long' })}</p>
            </div>
            <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
              post.uiKind === "event" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
              post.uiKind === "complaint" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
              "bg-blue-500/10 text-blue-600 border-blue-500/20")}>{kind.label}</div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xl md:text-2xl font-black text-primary leading-tight">{post.title}</h3>
            <p className="text-sm md:text-base font-bold text-muted-foreground/80 dark:text-white/80 leading-relaxed whitespace-pre-wrap">{displayBody}</p>
          </div>

          {pollData && (
            <div className="p-6 rounded-[32px] bg-primary/5 border-2 border-primary/10 space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-primary"><BarChart3 size={20} /><h5 className="text-base font-black">{pollData.question}</h5></div>
                <span className="text-[10px] font-bold text-primary opacity-60 bg-primary/10 px-2.5 py-1 rounded-full">{total} صوت</span>
              </div>
              <div className="grid gap-2">
                {pollData.options.map((opt: string, i: number) => {
                  const count = voteCounts[i] || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const isMine = myVoteIndex === i;
                  return (
                    <button key={i} onClick={() => handleVote(i)} disabled={myVoteIndex !== -1}
                      className={cn("relative p-4 rounded-xl transition-all text-right font-black overflow-hidden",
                        isMine ? "bg-primary text-white border-2 border-primary" : "bg-white border-2 border-border/40 text-primary hover:border-primary")}>
                      <div className={cn("absolute inset-y-0 right-0 transition-all duration-700", isMine ? "bg-white/10" : "bg-primary/5")} style={{ width: `${pct}%` }} />
                      <div className="relative z-10 flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          {isMine ? <CheckCircle2 size={16} /> : <div className="size-3.5 rounded-full border-2 border-current opacity-30" />}
                          <span>{opt}</span>
                        </div>
                        <span className="opacity-60 text-xs">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {canDelete && (
          <div className="flex flex-row md:flex-col gap-2 md:opacity-0 md:group-hover:opacity-100 transition-all duration-500 self-end md:self-start shrink-0">
            {isChairman && <button onClick={togglePin} className={cn("size-10 rounded-xl flex items-center justify-center transition-all shadow",
              post.pinned ? "bg-gold-primary text-white" : "bg-gold-primary/10 text-gold-primary hover:bg-gold-primary hover:text-white")} title="تثبيت"><Pin size={18} /></button>}
            <button onClick={deletePost} className="size-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow" title="حذف"><Trash2 size={18} /></button>
          </div>
        )}
      </div>
      {post.kind !== "complaint" && (
        <CommentsSection post={post} meId={meId} isChairman={isChairman}
          comments={postComments.filter((c: any) => !c.body.startsWith("[VOTE]:"))} onRefresh={onRefresh} />
      )}
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
    <div className="mt-6 pt-5 border-t border-border/40">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs font-black text-primary/70 hover:text-primary">
        <MessageSquare size={14} />
        <span>{comments.length > 0 ? `${comments.length} تعليق` : "أضف تعليقاً"}</span>
        <ChevronLeft size={12} className={cn("transition-transform", open && "-rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 pt-5">
              {comments.map((c: any) => {
                const name = c.author?.arabic_name || c.author?.full_name || "عضو";
                const canDel = isChairman || c.author_id === meId;
                return (
                  <div key={c.id} className="flex gap-3 items-start group/c">
                    <div className="size-9 rounded-xl border border-primary/10 overflow-hidden shrink-0">
                      <UserAvatar path={c.author?.avatar_url} name={name} className="size-full" userId={c.author_id} />
                    </div>
                    <div className="flex-1 bg-muted/40 rounded-2xl p-3">
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
              {comments.length === 0 && <p className="text-center text-xs text-muted-foreground py-3">لا توجد تعليقات بعد</p>}
              <form onSubmit={submit} className="flex gap-2 pt-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب تعليقك..."
                  className="flex-1 h-11 px-5 rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                <button disabled={sending || !text.trim()} type="submit" className="size-11 rounded-2xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 shadow">
                  {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddDialog({ meId, isChairman, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", kind: "discussion" as UiKind });
  const [isPoll, setIsPoll] = useState(false);
  const [poll, setPoll] = useState({ question: "", options: ["", ""] });

  const addOption = () => { if (poll.options.length < 5) setPoll({ ...poll, options: [...poll.options, ""] }); };
  const updateOption = (i: number, v: string) => { const n = [...poll.options]; n[i] = v; setPoll({ ...poll, options: n }); };
  const removeOption = (i: number) => { if (poll.options.length > 2) setPoll({ ...poll, options: poll.options.filter((_, x) => x !== i) }); };

  const submit = async (e: any) => {
    e.preventDefault();
    const title = form.title.trim(), body = form.body.trim();
    if (!title || !body) return toast.error("يرجى إكمال البيانات الأساسية");
    setSaving(true);
    let finalBody = `---kind:${form.kind}\n${body}`;
    if (isPoll && poll.question.trim()) {
      const data = { question: poll.question.trim(), options: poll.options.filter(o => o.trim()) };
      finalBody = `---poll:${JSON.stringify(data)}---\n${finalBody}`;
    }
    const dbKind = KINDS.find(k => k.key === form.kind)?.dbKind || "discussion";
    try {
      const { error } = await supabase.from("majlis_posts").insert({ title, body: finalBody, kind: dbKind, author_id: meId });
      if (!error) {
        toast.success("تم النشر");
        sendFcmNotification({ data: { title: "نقاش جديد في الاجتماعات", body: title } }).catch(() => {});
        onSaved(); onClose();
      } else toast.error("تعذر النشر: " + error.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl" dir="rtl">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <header className="p-6 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg"><Plus size={22} strokeWidth={3} /></div>
            <h3 className="text-xl font-black text-primary">إضافة نقاش / مناسبة</h3>
          </div>
          <button onClick={onClose} className="size-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"><X size={20} /></button>
        </header>
        <form onSubmit={submit} className="p-6 space-y-5 overflow-y-auto no-scrollbar flex-1 text-foreground">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">التصنيف</label>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map(k => (
                <button key={k.key} type="button" onClick={() => setForm({ ...form, kind: k.key })}
                  className={cn("py-3 rounded-2xl border-2 font-black text-xs transition-all",
                    form.kind === k.key ? "bg-primary text-white border-primary shadow-lg" : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted")}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">العنوان</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="عنوان النقاش أو المناسبة"
              className="w-full h-14 px-6 rounded-2xl bg-muted/40 border border-border/60 font-black text-lg focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">التفاصيل</label>
            <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="اكتب التفاصيل هنا..." rows={4}
              className="w-full p-6 rounded-[28px] bg-muted/40 border border-border/60 font-bold text-base focus:ring-4 focus:ring-primary/5 focus:border-primary resize-none outline-none" required />
          </div>
          {isChairman && (
            <div>
              <button type="button" onClick={() => setIsPoll(!isPoll)}
                className={cn("flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all",
                  isPoll ? "bg-gold-primary text-white border-gold-primary shadow-lg" : "bg-muted/30 border-dashed border-border/60 text-muted-foreground")}>
                <Vote size={18} />
                <span className="font-black text-xs">{isPoll ? "إلغاء التصويت" : "إضافة استبيان / تصويت (رئيس المجلس)"}</span>
              </button>
            </div>
          )}
          <AnimatePresence>
            {isPoll && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="p-6 rounded-[28px] bg-gold-primary/5 border-2 border-gold-primary/20 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gold-primary px-2">سؤال التصويت</label>
                  <input value={poll.question} onChange={e => setPoll({ ...poll, question: e.target.value })} placeholder="مثال: ما رأيكم في الموعد المقترح؟"
                    className="w-full h-12 px-5 rounded-xl bg-white border border-gold-primary/20 font-black text-sm outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gold-primary px-2">الخيارات</label>
                  {poll.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`خيار ${i + 1}...`}
                        className="flex-1 h-11 px-5 rounded-xl bg-white border border-border/40 font-bold text-sm outline-none" />
                      {poll.options.length > 2 && <button type="button" onClick={() => removeOption(i)} className="size-11 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white"><X size={16} /></button>}
                    </div>
                  ))}
                  {poll.options.length < 5 && <button type="button" onClick={addOption} className="text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline px-2">+ إضافة خيار</button>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl font-black text-muted-foreground hover:bg-muted">تراجع</button>
            <button disabled={saving} type="submit" className="flex-[2] btn-gold py-4 rounded-2xl font-black text-lg shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 active:scale-[0.98]">
              {saving ? <Loader2 className="animate-spin size-5" /> : <><Send size={20} /><span>نشر</span></>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
