import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { toast } from "sonner";
import {
  MessageSquare,
  Pin,
  Plus,
  Send,
  Trash2,
  Loader2,
  X,
  ShieldAlert,
  Clock,
  Vote,
  ListFilter,
  BarChart3,
  CheckCircle2,
  Newspaper,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { sendFcmNotification } from "@/lib/fcm";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/majlis")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الأخبار العائلية — السيف" },
      { name: "description", content: "مركز الأخبار، النقاشات، والإعلانات الرسمية لعائلة السيف." },
    ],
  }),
  component: MajlisPage,
});

type PostKind = "announcement" | "discussion" | "complaint";
type UiKind = "sharing" | "event" | "complaint" | "discussion";

type MajlisPost = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  kind: PostKind;
  pinned: boolean;
  created_at: string;
  uiKind?: UiKind;
  cleanBody?: string;
  author?: {
    arabic_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
};

const KINDS: { key: UiKind; dbKind: PostKind; label: string; color: string; icon: any }[] = [
  { key: "sharing", dbKind: "discussion", label: "مشاركات", color: "emerald", icon: MessageSquare },
  { key: "event", dbKind: "discussion", label: "مناسبات", color: "amber", icon: Clock },
  { key: "complaint", dbKind: "complaint", label: "طلبات", color: "rose", icon: ShieldAlert },
  { key: "discussion", dbKind: "discussion", label: "نقاشات", color: "blue", icon: Newspaper },
];

function MajlisPage() {
  const { userId: meId, isAdmin, isChairman, canManage: canManageSection } = useUserRole();
  const canManage = canManageSection("news");

  const [profile, setProfile] = useState({ name: "...", role: "...", initial: "ص", avatarPath: null as string | null });
  const [posts, setPosts] = useState<MajlisPost[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<UiKind | "all">("all");
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
          avatarPath: p.avatar_url
        });
      }

      // Using raw query to ensure we get results even if schema cache is slightly delayed
      const { data: rawPosts, error: postsErr } = await supabase
        .from("majlis_posts")
        .select("*")
        .neq("kind", "announcement");

      if (postsErr) {
        console.error("Posts fetch error:", postsErr);
        toast.error("فشل في تحميل الأخبار");
      }

      if (rawPosts) {
        // Fetch profiles for authors
        const authorIds = Array.from(new Set(rawPosts.map((p: any) => p.author_id).filter(Boolean)));
        const { data: authorProfiles } = authorIds.length
          ? await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").in("id", authorIds)
          : { data: [] };

        const profileMap = new Map((authorProfiles ?? []).map((p: any) => [p.id, p]));

        const processed = rawPosts.map((p: any) => {
          try {
            const kindMatch = p.body?.match(/---kind:(\w+)/);
            const uiKind = kindMatch ? kindMatch[1] : (p.kind === "complaint" ? "complaint" : "sharing");
            const cleanBody = (p.body || "")
              .replace(/---kind:.*?\n?/, "")
              .replace(/---poll:.*?--- \n?/, "")
              .trim();

            return {
              ...p,
              uiKind,
              cleanBody: cleanBody || p.body,
              author: profileMap.get(p.author_id) || null,
            };
          } catch (e) {
            return { ...p, uiKind: "discussion", cleanBody: p.body, author: profileMap.get(p.author_id) || null };
          }
        });

        // Sorting manually to ensure order
        processed.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setPosts(processed as any);
      }

      // Comments fetch
      const { data: coms } = await supabase
        .from("majlis_comments")
        .select("*")
        .order("created_at", { ascending: true });

      if (coms) {
        const commentAuthorIds = Array.from(new Set(coms.map((c: any) => c.author_id).filter(Boolean)));
        const { data: cProfs } = commentAuthorIds.length
          ? await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").in("id", commentAuthorIds)
          : { data: [] };

        const cMap = new Map((cProfs ?? []).map((p: any) => [p.id, p]));
        const enriched = coms.map((c: any) => ({ ...c, author: cMap.get(c.author_id) || null }));
        setComments(enriched);
      }

    } catch (err) {
      console.error("Load Majlis error:", err);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      if (p.kind === "complaint" && !isChairman && p.author_id !== meId) return false;
      if (activeTab === "all") return true;
      return p.uiKind === activeTab;
    });
  }, [posts, activeTab, isChairman, meId]);

  return (
    <AppShell title="الأخبار" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">
        <QuickActionsBanner />

        <section className="animate-fade-up px-4 md:px-0">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-primary via-[#0d2620] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
            <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
              <div
                className="size-28 md:size-64 logo-alsaif-banner"
                style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
              />
            </div>
            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
              <div className="space-y-3 md:space-y-5 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">أخبار السيف</span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">الأخبار العائلية</h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">تابع آخر المستجدات، شاركنا أفكارك، وتواصل مباشرة مع رئيس المجلس.</p>
              </div>
              <div className="size-16 md:size-28 rounded-2xl md:rounded-[36px] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl self-center md:self-auto shrink-0 group-hover:rotate-12 transition-transform duration-700">
                <Newspaper className="size-8 md:size-14 text-gold-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4 md:px-0">
          <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-3xl border border-border/40 overflow-x-auto no-scrollbar w-full md:w-auto">
             <Tab active={activeTab === "all"} onClick={() => setActiveTab("all")} label="الكل" icon={<ListFilter size={16} />} />
             {KINDS.map(k => <Tab key={k.key} active={activeTab === k.key} onClick={() => setActiveTab(k.key)} label={k.label} icon={<k.icon size={16} />} color={k.color} />)}
          </div>
          {canManage && (
            <button onClick={() => setShowAdd(true)} className="btn-gold px-8 py-3.5 rounded-2xl flex items-center justify-center gap-3 shadow-xl text-sm font-black w-full md:w-auto active:scale-95 transition-all">
               <Plus size={20} strokeWidth={3} /> <span>إضافة خبر</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 px-4 md:px-0">
           {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin size-12 mx-auto text-primary opacity-20" /></div> :
            filteredPosts.map(p => <PostCard key={p.id} post={p} meId={meId} isChairman={isAdmin || isChairman} canDelete={canManage || p.author_id === meId} onRefresh={loadData} comments={comments} />)}
           {!loading && filteredPosts.length === 0 && <div className="p-20 text-center bg-muted/20 rounded-[48px] border-4 border-dashed italic text-muted-foreground">لا توجد منشورات في هذا القسم حالياً.</div>}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && <AddPostDialog meId={meId} onClose={() => setShowAdd(false)} onSaved={loadData} />}
      </AnimatePresence>
    </AppShell>
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
    <button onClick={onClick} className={cn("px-6 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0 border-2", active ? (color ? styles[color] + " border-current shadow-lg scale-105" : "bg-primary text-white border-primary shadow-lg scale-105") : "bg-card text-muted-foreground border-transparent hover:bg-muted")}>
      {icon} <span>{label}</span>
    </button>
  );
}

function PostCard({ post, meId, isChairman, canDelete, onRefresh, comments }: any) {
  const authorName = post.author?.arabic_name || post.author?.full_name || "عضو";
  const kind = KINDS.find(k => k.key === post.uiKind) || KINDS[0];

  const deletePost = async () => {
    if (!confirm("حذف المنشور؟")) return;
    const { error } = await supabase.from("majlis_posts").delete().eq("id", post.id);
    if (!error) {
       toast.success("تم الحذف");
       onRefresh();
    }
  };

  const togglePin = async () => {
    const { error } = await supabase.from("majlis_posts").update({ pinned: !post.pinned }).eq("id", post.id);
    if (!error) onRefresh();
  };

  const pollData = useMemo(() => {
    if (!post.cleanBody?.startsWith("---poll:")) return null;
    try {
      const match = post.cleanBody.match(/^---poll:({.*?})---/s);
      return match ? JSON.parse(match[1]) : null;
    } catch { return null; }
  }, [post.cleanBody]);

  const displayBody = (post.cleanBody || "").replace(/^---poll:.*?---/s, "").trim();

  // Voting Logic
  const postComments = comments.filter((c: any) => c.post_id === post.id);
  const myVoteComment = postComments.find((c: any) => c.author_id === meId && c.body.startsWith("[VOTE]:"));
  const myVoteIndex = myVoteComment ? parseInt(myVoteComment.body.split(":")[1]) : -1;

  const voteCounts = useMemo(() => {
    if (!pollData) return [];
    const counts = new Array(pollData.options.length).fill(0);
    postComments.forEach((c: any) => {
      if (c.body.startsWith("[VOTE]:")) {
        const idx = parseInt(c.body.split(":")[1]);
        if (idx >= 0 && idx < counts.length) counts[idx]++;
      }
    });
    return counts;
  }, [pollData, postComments]);

  const totalVotes = voteCounts.reduce((a, b) => a + b, 0);

  const handleVote = async (idx: number) => {
    if (myVoteIndex !== -1) {
       toast.error("لقد قمت بالتصويت مسبقاً");
       return;
    }
    const { error } = await supabase.from("majlis_comments").insert({
      post_id: post.id,
      author_id: meId,
      body: `[VOTE]:${idx}`
    });
    if (!error) {
       toast.success("تم تسجيل صوتك");
       onRefresh();
    }
  };

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
                <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                  post.kind === "sharing" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                  post.kind === "event" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                  post.kind === "complaint" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                  "bg-blue-500/10 text-blue-600 border-blue-500/20"
                )}>
                   {kind.label}
                </div>
             </div>
             <div className="space-y-4">
                <h3 className="text-2xl md:text-3xl font-black text-primary leading-tight">{post.title}</h3>
                <p className="text-base md:text-lg font-bold text-muted-foreground/80 dark:text-white/80 leading-relaxed whitespace-pre-wrap">{displayBody}</p>
             </div>

             {pollData && (
                <div className="p-8 rounded-[40px] bg-primary/5 border-2 border-primary/10 space-y-6 mt-8">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-primary"><BarChart3 size={24} /><h5 className="text-xl font-black">{pollData.question}</h5></div>
                      <span className="text-xs font-bold text-primary opacity-60 bg-primary/10 px-3 py-1 rounded-full">{totalVotes} صوت</span>
                   </div>
                   <div className="grid gap-3">
                      {pollData.options.map((opt: string, i: number) => {
                        const count = voteCounts[i] || 0;
                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        const isMyVote = myVoteIndex === i;

                        return (
                          <button
                            key={i}
                            onClick={() => handleVote(i)}
                            disabled={myVoteIndex !== -1}
                            className={cn(
                              "relative p-5 rounded-2xl transition-all text-right font-black overflow-hidden group/opt",
                              isMyVote ? "bg-primary text-white border-2 border-primary shadow-lg" : "bg-white border-2 border-border/40 text-primary hover:border-primary"
                            )}
                          >
                            <div className={cn("absolute inset-y-0 right-0 transition-all duration-1000", isMyVote ? "bg-white/10" : "bg-primary/5")} style={{ width: `${pct}%` }} />
                            <div className="relative z-10 flex justify-between items-center">
                               <div className="flex items-center gap-3">
                                  {isMyVote ? <CheckCircle2 size={18} /> : <div className="size-4 rounded-full border-2 border-current opacity-30" />}
                                  <span>{opt}</span>
                               </div>
                               <span className="opacity-60">{pct}%</span>
                            </div>
                          </button>
                        );
                      })}
                   </div>
                   {myVoteIndex !== -1 && <p className="text-center text-[10px] font-black text-emerald-600 uppercase tracking-widest">شكراً لمشاركتك في التصويت</p>}
                </div>
             )}
          </div>
          {canDelete && (
             <div className="flex flex-row md:flex-col gap-2 md:opacity-0 md:group-hover:opacity-100 transition-all duration-500 self-end md:self-start shrink-0">
                {isChairman && <button onClick={togglePin} className={cn("size-12 rounded-2xl flex items-center justify-center transition-all shadow-lg", post.pinned ? "bg-gold-primary text-white" : "bg-gold-primary/10 text-gold-primary hover:bg-gold-primary hover:text-white")} title="تثبيت"><Pin size={20} /></button>}
                <button onClick={deletePost} className="size-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg" title="حذف"><Trash2 size={20} /></button>
             </div>
          )}
       </div>
       {post.kind !== "complaint" && (
          <CommentsSection post={post} meId={meId} isChairman={isChairman} comments={postComments.filter((c: any) => !c.body.startsWith("[VOTE]:"))} onRefresh={onRefresh} />
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
    const { error } = await supabase.from("majlis_comments").insert({
      post_id: post.id,
      author_id: meId,
      body: text.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("تعذر إرسال التعليق");
    } else {
      setText("");
      onRefresh();
    }
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
                const cn_name = c.author?.arabic_name || c.author?.full_name || "عضو";
                const canDelete = isChairman || c.author_id === meId;
                return (
                  <div key={c.id} className="flex gap-3 items-start group/c">
                    <div className="size-10 rounded-2xl border border-primary/10 overflow-hidden shrink-0">
                      <UserAvatar path={c.author?.avatar_url} name={cn_name} className="size-full" userId={c.author_id} />
                    </div>
                    <div className="flex-1 bg-muted/40 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-black text-primary">{cn_name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          {canDelete && <button onClick={() => removeComment(c.id)} className="opacity-0 group-hover/c:opacity-100 text-rose-500 hover:text-rose-700 transition-all"><Trash2 size={12} /></button>}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-foreground/80 whitespace-pre-wrap leading-relaxed">{c.body}</p>
                    </div>
                  </div>
                );
              })}
              {comments.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">لا توجد تعليقات بعد — كن أول من يعلق</p>}
              <form onSubmit={submit} className="flex gap-2 pt-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="اكتب تعليقك..."
                  className="flex-1 h-12 px-5 rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <button disabled={sending || !text.trim()} type="submit" className="size-12 rounded-2xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all shadow-lg">
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
  const [form, setForm] = useState({ title: "", body: "", kind: "sharing" as UiKind });
  const [isPoll, setIsPoll] = useState(false);
  const [poll, setPoll] = useState({ question: "", options: ["", ""] });

  const addOption = () => {
    if (poll.options.length < 5) setPoll({ ...poll, options: [...poll.options, ""] });
  };

  const updateOption = (idx: number, val: string) => {
    const next = [...poll.options];
    next[idx] = val;
    setPoll({ ...poll, options: next });
  };

  const removeOption = (idx: number) => {
    if (poll.options.length > 2) {
      setPoll({ ...poll, options: poll.options.filter((_, i) => i !== idx) });
    }
  };

  const submit = async (e: any) => {
    e.preventDefault();
    const title = form.title.trim();
    const body = form.body.trim();

    if (!title || !body) {
       toast.error("يرجى إكمال البيانات الأساسية");
       return;
    }
    setSaving(true);
    let finalBody = `---kind:${form.kind}\n${body}`;
    if (isPoll && poll.question.trim()) {
      const data = { question: poll.question.trim(), options: poll.options.filter(o => o.trim()) };
      finalBody = `---poll:${JSON.stringify(data)}---\n${finalBody}`;
    }

    const dbKind = KINDS.find(k => k.key === form.kind)?.dbKind || "discussion";

    try {
      const { error } = await supabase.from("majlis_posts").insert({
        title: form.title,
        body: finalBody,
        kind: dbKind,
        author_id: meId
      });

      if (!error) {
        toast.success("تم النشر بنجاح");

        sendFcmNotification({
          data: {
            title: "خبر جديد في الأخبار",
            body: form.title,
          }
        }).catch(err => console.warn("FCM error:", err));

        onSaved();
        onClose();
      } else {
        toast.error("تعذر النشر: " + error.message);
      }
    } catch (err: any) {
       toast.error("حدث خطأ غير متوقع");
    } finally {
       setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl" dir="rtl">
       <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card w-full max-w-2xl rounded-[48px] overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]">
          <header className="p-8 border-b border-border/40 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg"><Plus size={24} strokeWidth={3} /></div>
                <h3 className="text-2xl font-black text-primary">إضافة خبر جديد</h3>
             </div>
             <button onClick={onClose} className="size-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-all"><X size={24} /></button>
          </header>

          <form onSubmit={submit} className="p-8 space-y-6 overflow-y-auto no-scrollbar flex-1 text-foreground">
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">تصنيف الخبر</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {KINDS.map(k => (
                     <button key={k.key} type="button" onClick={() => setForm({...form, kind: k.key})} className={cn("py-3 rounded-2xl border-2 font-black text-xs transition-all", form.kind === k.key ? "bg-primary text-white border-primary shadow-lg" : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted")}>{k.label}</button>
                   ))}
                </div>
             </div>

             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">عنوان الخبر</label>
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="ماذا تريد أن تشارك مع العائلة؟" className="w-full h-16 px-8 rounded-3xl bg-muted/40 border border-border/60 font-black text-xl focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-inner text-foreground placeholder:text-muted-foreground/50" required />
             </div>

             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">تفاصيل المنشور</label>
                <textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} placeholder="اكتب تفاصيل الخبر هنا..." rows={4} className="w-full p-8 rounded-[40px] bg-muted/40 border border-border/60 font-bold text-lg focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none shadow-inner text-foreground placeholder:text-muted-foreground/50" required />
             </div>

             <div className="pt-4">
                <button type="button" onClick={() => setIsPoll(!isPoll)} className={cn("flex items-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all w-full md:w-auto", isPoll ? "bg-gold-primary text-white border-gold-primary shadow-lg" : "bg-muted/30 border-dashed border-border/60 text-muted-foreground")}>
                   <Vote size={20} />
                   <span className="font-black text-sm">{isPoll ? "إلغاء التصويت" : "إضافة استبيان/تصويت"}</span>
                </button>
             </div>

             <AnimatePresence>
                {isPoll && (
                   <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="p-8 rounded-[40px] bg-gold-primary/5 border-2 border-gold-primary/20 space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-gold-primary px-2">سؤال التصويت</label>
                         <input value={poll.question} onChange={e => setPoll({...poll, question: e.target.value})} placeholder="مثال: ما رأيكم في الموعد المقترح؟" className="w-full h-14 px-6 rounded-2xl bg-white border border-gold-primary/20 font-black text-sm focus:ring-4 focus:ring-gold-primary/5 outline-none" />
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-widest text-gold-primary px-2">الخيارات</label>
                         {poll.options.map((opt, i) => (
                            <div key={i} className="flex gap-2">
                               <input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`خيار ${i+1}...`} className="flex-1 h-12 px-6 rounded-xl bg-white border border-border/40 font-bold text-sm outline-none" />
                               {poll.options.length > 2 && <button type="button" onClick={() => removeOption(i)} className="size-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><X size={18} /></button>}
                            </div>
                         ))}
                         {poll.options.length < 5 && (
                           <button type="button" onClick={addOption} className="text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline px-2 flex items-center gap-1">+ إضافة خيار آخر</button>
                         )}
                      </div>
                   </motion.div>
                )}
             </AnimatePresence>

             <div className="flex gap-4 pt-6">
                <button type="button" onClick={onClose} className="flex-1 py-5 rounded-[28px] font-black text-muted-foreground hover:bg-muted transition-all">تراجع</button>
                <button disabled={saving} type="submit" className="flex-[2] btn-gold py-5 rounded-[28px] font-black text-xl shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all">
                   {saving ? <Loader2 className="animate-spin size-6" /> : <><Send size={24} /> <span>نشر الآن</span></>}
                </button>
             </div>
          </form>
       </motion.div>
    </div>
  );
}
