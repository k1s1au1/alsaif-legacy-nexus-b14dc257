import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { toast } from "sonner";
import {
  MessageSquare, Pin, Plus, Send, Trash2, Loader2, X, Users, ChevronLeft,
  Image as ImageIcon, Vote, BookOpen, HelpCircle, Camera, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUserRole } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/community")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ركن الأعضاء — السيف" },
      { name: "description", content: "مساحة الأعضاء لمشاركة اليوميات، الصور، والأسئلة مع تصويت العائلة." },
    ],
  }),
  component: CommunityPage,
});

type Post = {
  id: string;
  author_id: string;
  kind: "diary" | "photo" | "question" | string;
  title: string;
  body: string | null;
  image_urls: string[];
  poll_options: { label: string }[] | null;
  pinned: boolean;
  created_at: string;
  author?: { arabic_name: string | null; full_name: string | null; avatar_url: string | null };
};

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  diary: { label: "يوميات", icon: BookOpen, color: "bg-emerald-600" },
  photo: { label: "صور", icon: Camera, color: "bg-amber-600" },
  question: { label: "سؤال للعائلة", icon: HelpCircle, color: "bg-sky-600" },
};

function CommunityPage() {
  const { userId: meId, canManage } = useUserRole();
  const isHead = canManage("community");

  const [profile, setProfile] = useState({ name: "...", role: "...", initial: "ع", avatarPath: null as string | null });
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<string>("all");

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

      const { data: rawPosts } = await supabase.from("member_posts" as any).select("*");
      if (rawPosts) {
        const ids = Array.from(new Set((rawPosts as any[]).map(p => p.author_id).filter(Boolean)));
        const { data: profs } = ids.length
          ? await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").in("id", ids)
          : { data: [] };
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        const processed = (rawPosts as any[]).map(p => ({ ...p, author: map.get(p.author_id) || null }));
        processed.sort((a: any, b: any) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setPosts(processed as Post[]);
      }

      const { data: coms } = await supabase.from("member_post_comments" as any).select("*").order("created_at", { ascending: true });
      if (coms) {
        const ids = Array.from(new Set((coms as any[]).map((c: any) => c.author_id).filter(Boolean)));
        const { data: cp } = ids.length
          ? await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").in("id", ids)
          : { data: [] };
        const m = new Map((cp ?? []).map((p: any) => [p.id, p]));
        setComments((coms as any[]).map((c: any) => ({ ...c, author: m.get(c.author_id) || null })));
      }

      const { data: vs } = await supabase.from("member_post_votes" as any).select("*");
      setVotes((vs as any[]) || []);
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("community-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "member_posts" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "member_post_comments" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "member_post_votes" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const filtered = useMemo(
    () => filter === "all" ? posts : posts.filter(p => p.kind === filter),
    [posts, filter]
  );

  return (
    <AppShell title="ركن الأعضاء" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">
        <QuickActionsBanner />

        <section className="animate-fade-up px-4 md:px-0">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-emerald-800 via-[#0d2620] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5">
            <div className="absolute top-0 right-0 size-64 bg-gold-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 md:space-y-5 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">مساحة العائلة</span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">ركن الأعضاء</h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">شارك يومياتك، صورك، أو اطرح سؤالاً تأخذ فيه رأي العائلة بالتعليق أو التصويت.</p>
              </div>
              <div className="size-16 md:size-28 rounded-2xl md:rounded-[36px] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl self-center md:self-auto shrink-0">
                <Users className="size-8 md:size-14 text-gold-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </section>

        <div className="px-4 md:px-0 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="الكل" />
            {Object.entries(KIND_META).map(([k, m]) => (
              <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)} label={m.label} Icon={m.icon} />
            ))}
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-gold px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl text-sm font-black active:scale-95 transition-all">
            <Plus size={18} strokeWidth={3} /> <span>مشاركة جديدة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 px-4 md:px-0">
          {loading ? (
            <div className="py-20 text-center"><Loader2 className="animate-spin size-12 mx-auto text-primary opacity-20" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center bg-muted/20 rounded-[36px] border-4 border-dashed italic text-muted-foreground">
              لا توجد مشاركات بعد — كن أول من يبدأ
            </div>
          ) : (
            filtered.map(p => (
              <PostCard
                key={p.id}
                post={p}
                meId={meId}
                isHead={isHead}
                canDelete={isHead || p.author_id === meId}
                comments={comments.filter(c => c.post_id === p.id)}
                votes={votes.filter(v => v.post_id === p.id)}
                onRefresh={loadData}
              />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && <AddPostDialog meId={meId} onClose={() => setShowAdd(false)} onSaved={loadData} />}
      </AnimatePresence>
    </AppShell>
  );
}

function FilterChip({ active, onClick, label, Icon }: any) {
  return (
    <button onClick={onClick} className={cn(
      "px-4 py-2 rounded-2xl text-xs font-black border transition-all flex items-center gap-2",
      active ? "bg-primary text-white border-primary shadow-lg" : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
    )}>
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}

function PostCard({ post, meId, isHead, canDelete, comments, votes, onRefresh }: any) {
  const authorName = post.author?.arabic_name || post.author?.full_name || "عضو";
  const meta = KIND_META[post.kind] || KIND_META.diary;
  const Icon = meta.icon;

  const myVote = votes.find((v: any) => v.voter_id === meId);
  const totals: Record<number, number> = {};
  votes.forEach((v: any) => { totals[v.option_index] = (totals[v.option_index] || 0) + 1; });
  const totalVotes = votes.length;

  const castVote = async (idx: number) => {
    if (!meId) return;
    if (myVote) {
      await supabase.from("member_post_votes" as any).update({ option_index: idx } as any).eq("id", myVote.id);
    } else {
      await supabase.from("member_post_votes" as any).insert({ post_id: post.id, voter_id: meId, option_index: idx } as any);
    }
    onRefresh();
  };
  const removeVote = async () => {
    if (!myVote) return;
    await supabase.from("member_post_votes" as any).delete().eq("id", myVote.id);
    onRefresh();
  };

  const deletePost = async () => {
    if (!confirm("حذف المشاركة؟")) return;
    const { error } = await supabase.from("member_posts" as any).delete().eq("id", post.id);
    if (!error) { toast.success("تم الحذف"); onRefresh(); }
  };
  const togglePin = async () => {
    const { error } = await supabase.from("member_posts" as any).update({ pinned: !post.pinned } as any).eq("id", post.id);
    if (!error) onRefresh();
  };

  return (
    <motion.article layout className={cn(
      "card-surface p-6 md:p-10 relative overflow-hidden group transition-all duration-500 hover:shadow-2xl",
      post.pinned && "border-gold-primary/30 bg-gold-primary/[0.02]"
    )}>
      {post.pinned && (
        <div className="absolute top-0 left-0 bg-gold-primary text-white px-5 py-1.5 rounded-br-3xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg z-10">
          <Pin size={12} /> مثبت
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="flex-1 space-y-5 w-full min-w-0">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-[18px] border-2 border-primary/10 overflow-hidden shadow-lg shrink-0">
              <UserAvatar path={post.author?.avatar_url} name={authorName} className="size-full" userId={post.author_id} showBadges />
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-black text-primary truncate">{authorName}</h4>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {new Date(post.created_at).toLocaleDateString("ar-SA", { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <span className={cn("ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white shrink-0", meta.color)}>
              <Icon size={12} /> {meta.label}
            </span>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl md:text-2xl font-black text-primary leading-tight">{post.title}</h3>
            {post.body && <p className="text-sm md:text-base font-bold text-muted-foreground/90 dark:text-white/80 leading-relaxed whitespace-pre-wrap">{post.body}</p>}
          </div>

          {post.image_urls?.length > 0 && (
            <div className={cn("grid gap-2", post.image_urls.length === 1 ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3")}>
              {post.image_urls.map((url: string, i: number) => (
                <a href={url} target="_blank" rel="noreferrer" key={i} className="block aspect-square rounded-2xl overflow-hidden bg-muted">
                  <img src={url} alt="" className="size-full object-cover hover:scale-105 transition-transform" loading="lazy" />
                </a>
              ))}
            </div>
          )}

          {post.poll_options?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between gap-2 pt-3">
                <div className="flex items-center gap-2 text-[11px] font-black text-primary/70 uppercase tracking-widest">
                  <BarChart3 size={14} /> تصويت العائلة · {totalVotes} مشارك
                </div>
                {myVote && <button onClick={removeVote} className="text-[10px] font-bold text-rose-500 hover:underline">سحب التصويت</button>}
              </div>
              <div className="space-y-2">
                {post.poll_options.map((opt: any, i: number) => {
                  const count = totals[i] || 0;
                  const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                  const mine = myVote?.option_index === i;
                  return (
                    <button key={i} onClick={() => castVote(i)} className={cn(
                      "w-full relative overflow-hidden rounded-2xl border-2 px-4 py-3 text-right transition-all",
                      mine ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    )}>
                      <div className="absolute inset-y-0 right-0 bg-primary/10 transition-all" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-muted-foreground">{pct}% · {count}</span>
                        <span className="text-sm font-black text-foreground flex items-center gap-2">
                          {mine && <Vote size={14} className="text-primary" />}
                          {opt.label}
                        </span>
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
            {isHead && (
              <button onClick={togglePin} className={cn(
                "size-10 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                post.pinned ? "bg-gold-primary text-white" : "bg-gold-primary/10 text-gold-primary hover:bg-gold-primary hover:text-white"
              )} title="تثبيت"><Pin size={16} /></button>
            )}
            <button onClick={deletePost} className="size-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg" title="حذف">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <CommentsSection post={post} meId={meId} isHead={isHead} comments={comments} onRefresh={onRefresh} />
    </motion.article>
  );
}

function CommentsSection({ post, meId, isHead, comments, onRefresh }: any) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    if (!text.trim() || !meId) return;
    setSending(true);
    const { error } = await supabase.from("member_post_comments" as any).insert({ post_id: post.id, author_id: meId, body: text.trim() } as any);
    setSending(false);
    if (error) toast.error("تعذر إرسال التعليق"); else { setText(""); onRefresh(); }
  };
  const removeComment = async (id: string) => {
    if (!confirm("حذف التعليق؟")) return;
    const { error } = await supabase.from("member_post_comments" as any).delete().eq("id", id);
    if (!error) onRefresh();
  };

  return (
    <div className="mt-6 pt-5 border-t border-border/40">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs font-black text-primary/70 hover:text-primary transition-all">
        <MessageSquare size={16} />
        <span>{comments.length > 0 ? `${comments.length} تعليق` : "أضف تعليقاً"}</span>
        <ChevronLeft size={14} className={cn("transition-transform", open && "-rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 pt-5">
              {comments.map((c: any) => {
                const name = c.author?.arabic_name || c.author?.full_name || "عضو";
                const canDel = isHead || c.author_id === meId;
                return (
                  <div key={c.id} className="flex gap-3 items-start group/c">
                    <div className="size-9 rounded-2xl border border-primary/10 overflow-hidden shrink-0">
                      <UserAvatar path={c.author?.avatar_url} name={name} className="size-full" userId={c.author_id} />
                    </div>
                    <div className="flex-1 bg-muted/40 rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-black text-primary">{name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
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
                  className="flex-1 h-11 px-4 rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                <button disabled={sending || !text.trim()} type="submit" className="size-11 rounded-2xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 shadow-lg">
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

function AddPostDialog({ meId, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<"diary" | "photo" | "question">("diary");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [withPoll, setWithPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const upload = async (files: FileList | null) => {
    if (!files || !meId) return;
    setUploading(true);
    const urls: string[] = [];
    try {
      for (const f of Array.from(files)) {
        const path = `${meId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error } = await supabase.storage.from("community-media").upload(path, f, { upsert: false });
        if (error) { toast.error("تعذر رفع الصورة"); continue; }
        const { data } = await supabase.storage.from("community-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setImages(prev => [...prev, ...urls]);
    } finally { setUploading(false); }
  };

  const submit = async (e: any) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("أدخل عنواناً");
    const opts = withPoll ? pollOptions.map(o => o.trim()).filter(Boolean).map(label => ({ label })) : null;
    if (withPoll && (!opts || opts.length < 2)) return toast.error("التصويت يحتاج خيارَين على الأقل");
    setSaving(true);
    const { error } = await supabase.from("member_posts" as any).insert({
      author_id: meId, kind, title: title.trim(), body: body.trim() || null,
      image_urls: images, poll_options: opts,
    } as any);
    setSaving(false);
    if (error) toast.error("تعذر النشر: " + error.message);
    else { toast.success("تم النشر"); onSaved(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl" dir="rtl">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <header className="p-6 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg"><Plus size={22} strokeWidth={3} /></div>
            <h3 className="text-xl font-black text-primary">مشاركة جديدة</h3>
          </div>
          <button onClick={onClose} className="size-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"><X size={20} /></button>
        </header>
        <form onSubmit={submit} className="p-6 space-y-5 overflow-y-auto no-scrollbar flex-1 text-foreground">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(KIND_META).map(([k, m]) => {
              const I = m.icon; const active = kind === k;
              return (
                <button type="button" key={k} onClick={() => setKind(k as any)} className={cn(
                  "p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all",
                  active ? `${m.color} text-white border-transparent shadow-lg` : "bg-card text-muted-foreground border-border hover:border-primary/40"
                )}>
                  <I size={22} />
                  <span className="text-xs font-black">{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-1">العنوان</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان المشاركة..."
              className="w-full h-14 px-6 rounded-2xl bg-muted/40 border border-border/60 font-black text-base focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none" required />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-1">التفاصيل (اختياري)</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="اكتب تفاصيل المشاركة..." rows={5}
              className="w-full p-5 rounded-2xl bg-muted/40 border border-border/60 font-bold text-base focus:ring-4 focus:ring-primary/5 focus:border-primary resize-none outline-none" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-1 flex items-center gap-2">
              <ImageIcon size={12} /> صور (اختياري)
            </label>
            <div className="flex flex-wrap gap-2">
              {images.map((u, i) => (
                <div key={i} className="size-20 rounded-2xl overflow-hidden relative group">
                  <img src={u} className="size-full object-cover" alt="" />
                  <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="absolute top-1 left-1 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="size-20 rounded-2xl border-2 border-dashed border-border hover:border-primary cursor-pointer flex items-center justify-center text-muted-foreground hover:text-primary transition-all">
                {uploading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} />
              </label>
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/60">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={withPoll} onChange={e => setWithPoll(e.target.checked)} className="size-4 accent-primary" />
              <span className="text-sm font-black flex items-center gap-2"><Vote size={16} /> إضافة تصويت</span>
            </label>
            {withPoll && (
              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={opt} onChange={e => {
                      const copy = [...pollOptions]; copy[i] = e.target.value; setPollOptions(copy);
                    }} placeholder={`الخيار ${i + 1}`}
                      className="flex-1 h-11 px-4 rounded-xl bg-card border border-border/60 font-bold text-sm focus:border-primary outline-none" />
                    {pollOptions.length > 2 && (
                      <button type="button" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                        className="size-11 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><X size={16} /></button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button type="button" onClick={() => setPollOptions([...pollOptions, ""])}
                    className="w-full h-10 rounded-xl border-2 border-dashed border-border hover:border-primary text-xs font-black text-muted-foreground hover:text-primary">
                    + إضافة خيار
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl font-black text-muted-foreground hover:bg-muted">تراجع</button>
            <button disabled={saving} type="submit" className="flex-[2] btn-gold py-4 rounded-2xl font-black text-base shadow-2xl flex items-center justify-center gap-2 active:scale-[0.98]">
              {saving ? <Loader2 className="animate-spin size-5" /> : <><Send size={18} /> <span>نشر</span></>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
