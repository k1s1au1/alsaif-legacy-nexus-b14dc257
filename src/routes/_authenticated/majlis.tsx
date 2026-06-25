import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { toast } from "sonner";
import {
  Megaphone,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Send,
  Trash2,
  Loader2,
  X,
  ShieldAlert,
  Clock,
  ChevronLeft,
  Vote,
  ListFilter,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";

export const Route = createFileRoute("/_authenticated/majlis")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "أخبار العائلة — السيف" },
      { name: "description", content: "مركز أخبار عائلة السيف ونقاشاتها." },
    ],
  }),
  component: MajlisPage,
});

type PostKind = "announcement" | "discussion" | "complaint" | "post";

type Profile = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Post = {
  id: string;
  author_id: string;
  kind: "announcement" | "discussion" | "complaint";
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مشرف";
  if (role === "chairman") return "رئيس المجلس";
  return "عضو";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function MajlisPage() {
  const [me, setMe] = useState<{
    id: string;
    name: string;
    role: string;
    initial: string;
    avatarPath: string | null;
    isAdmin: boolean;
    isManager: boolean;
    isChairman: boolean;
  } | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [showCompose, setShowCompose] = useState(false);
  const [filter, setFilter] = useState<"all" | "post" | "announcement" | "complaint" | "discussion">(
    "all",
  );
  const dynamicLogo = useSiteLogo();

  // Compose state
  const [draft, setDraft] = useState({
    kind: "discussion" as "announcement" | "discussion" | "complaint",
    isPost: false,
    title: "",
    body: "",
    pollOptions: [] as string[],
    isVoteOnly: false,
  });

  const loadProfiles = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, arabic_name, full_name, avatar_url")
      .in("id", ids);
    if (data) {
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of data as Profile[]) next[p.id] = p;
        return next;
      });
    }
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("majlis_posts")
      .select("*")
      .not("title", "ilike", "[إرث]%")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذر تحميل المنشورات");
      return;
    }
    const list = (data ?? []) as Post[];
    setPosts(list);
    await loadProfiles([...new Set(list.map((p) => p.author_id))]);
  }, [loadProfiles]);

  const loadComments = useCallback(
    async (postId: string) => {
      const { data } = await supabase
        .from("majlis_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      const list = (data ?? []) as Comment[];
      setComments((prev) => ({ ...prev, [postId]: list }));
      await loadProfiles([...new Set(list.map((c) => c.author_id))]);
    },
    [loadProfiles],
  );

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("arabic_name, full_name, avatar_url")
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const r = (roles ?? []).map((x) => x.role);
      const isAdmin = r.includes("admin");
      const isManager = r.includes("manager");
      const isChairman = r.includes("chairman");
      const primary = isAdmin ? "admin" : isManager ? "manager" : isChairman ? "chairman" : "member";
      const name = p?.arabic_name?.trim() || p?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو";
      setMe({
        id: u.user.id,
        name,
        role: roleLabel(primary),
        initial: (name[0] ?? "س").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
        isAdmin,
        isManager,
        isChairman,
      });
      await loadPosts();
      setLoading(false);
    })();
  }, [loadPosts]);

  useEffect(() => {
    const ch = supabase
      .channel("majlis-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () =>
        loadPosts(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_comments" }, (payload) => {
        const row = (payload.new ?? payload.old) as { post_id?: string } | null;
        if (row?.post_id && openComments[row.post_id]) loadComments(row.post_id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadPosts, loadComments, openComments]);

  const canPostOfficial = !!me && (me.isAdmin || me.isManager || me.isChairman);

  async function submitPost() {
    if (!me) return;
    const title = draft.title.trim();
    let body = draft.body.trim();
    if (!title || !body) {
      toast.error("العنوان والمحتوى مطلوبان");
      return;
    }

    // Add prefix for "مشاركات"
    const finalTitle = draft.isPost ? `[مشاركة] ${title}` : title;

    // Handle poll data in body
    if (draft.pollOptions.length > 0) {
      const pollData = {
        options: draft.pollOptions.filter((o) => o.trim()),
        voteOnly: draft.isVoteOnly,
      };
      body = `---poll:${JSON.stringify(pollData)}---\n${body}`;
    }

    const { error } = await supabase.from("majlis_posts").insert({
      author_id: me.id,
      kind: draft.kind,
      title: finalTitle,
      body,
    });

    if (error) {
      toast.error("تعذر النشر");
      return;
    }
    toast.success("تم النشر بنجاح");
    setDraft({
      kind: "discussion",
      isPost: false,
      title: "",
      body: "",
      pollOptions: [],
      isVoteOnly: false,
    });
    setShowCompose(false);
    loadPosts();
  }

  async function handleVote(postId: string, optionIndex: number) {
    if (!me) return;

    // Check if user already voted (checking comments for [VOTE]:X)
    const postComments = comments[postId] || (await (async () => {
      const { data } = await supabase.from("majlis_comments").select("*").eq("post_id", postId);
      return data || [];
    })());

    const hasVoted = postComments.some(
      (c) => c.author_id === me.id && c.body.startsWith("[VOTE]:"),
    );
    if (hasVoted) {
      toast.error("لقد قمت بالتصويت مسبقاً");
      return;
    }

    const { error } = await supabase.from("majlis_comments").insert({
      post_id: postId,
      author_id: me.id,
      body: `[VOTE]:${optionIndex}`,
    });

    if (error) {
      toast.error("فشل تسجيل التصويت");
      return;
    }
    toast.success("تم تسجيل صوتك");
    loadComments(postId);
  }

  const filteredPosts = useMemo(() => {
    let list = posts;

    // Visibility filter for 'complaint' (Requests)
    // Only Chairman can see ALL complaints. Others see only their OWN.
    list = list.filter((p) => {
      if (p.kind !== "complaint") return true;
      if (!me) return false;
      return me.isChairman || p.author_id === me.id;
    });

    if (filter === "all") return list;

    if (filter === "post") return list.filter((p) => p.title.startsWith("[مشاركة]"));
    if (filter === "announcement") return list.filter((p) => p.kind === "announcement");
    if (filter === "complaint") return list.filter((p) => p.kind === "complaint");
    if (filter === "discussion")
      return list.filter((p) => p.kind === "discussion" && !p.title.startsWith("[مشاركة]"));

    return list;
  }, [posts, filter, me]);

  if (!me) {
    return (
      <AppShell title="أخبار العائلة" user={{ name: "...", role: "عضو", initial: "ص" }}>
        <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
          <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="font-black">جاري تحضير الأخبار...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="أخبار العائلة"
      user={{ name: me.name, role: me.role, initial: me.initial, avatarPath: me.avatarPath }}
    >
      <div
        className="max-w-5xl mx-auto space-y-8 md:space-y-12 px-4 md:px-0 pb-20 md:pb-24"
        dir="rtl"
      >
        <QuickActionsBanner />

        {/* Alsaif Majlis Header — Banner Style */}
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-[#064E3B] via-[#0d2620] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
            {/* Left Decorative Logo */}
            <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
              <div
                className="size-28 md:size-64 logo-alsaif-banner"
                style={{ "--logo-url": `url(${dynamicLogo || alsaifMark?.url || ""})` } as any}
              />
            </div>

            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
              <div className="space-y-3 md:space-y-5 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">
                    أخبار السيف
                  </span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">
                  أخبار العائلة
                </h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">
                  تابع آخر المستجدات، شاركنا أفكارك، وتواصل مباشرة مع رئيس المجلس.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowCompose(!showCompose);
                  // Default to 'isPost: true' for everyone
                  setDraft((d) => ({ ...d, isPost: true, kind: "discussion" }));
                }}
                className="btn-gold relative px-8 py-4 md:px-12 md:py-6 rounded-2xl md:rounded-[32px] flex items-center justify-center gap-3 shadow-2xl shadow-gold-primary/30 text-sm md:text-xl font-black group/btn self-center md:self-auto shrink-0 active:scale-95 transition-all"
              >
                {showCompose ? (
                  <X className="size-5 md:size-7" strokeWidth={3} />
                ) : (
                  <Plus className="size-5 md:size-7" strokeWidth={3} />
                )}
                <span>{showCompose ? "إلغاء الكتابة" : "إضافة خبر/نقاش"}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Filters Bar */}
        <section
          className="flex overflow-x-auto no-scrollbar items-center gap-2 md:gap-3 p-1 bg-muted/30 rounded-full md:rounded-[32px] border border-border/40 w-full md:w-fit animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          <NavTab
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="الكل"
            count={posts.length}
          />
          <NavTab
            active={filter === "post"}
            onClick={() => setFilter("post")}
            label="مشاركات"
            count={posts.filter((p) => p.title.startsWith("[مشاركة]")).length}
          />
          <NavTab
            active={filter === "announcement"}
            onClick={() => setFilter("announcement")}
            label="مناسبات"
            count={posts.filter((p) => p.kind === "announcement").length}
          />
          <NavTab
            active={filter === "complaint"}
            onClick={() => setFilter("complaint")}
            label="طلبات"
            count={posts.filter((p) => p.kind === "complaint").length}
          />
          <NavTab
            active={filter === "discussion"}
            onClick={() => setFilter("discussion")}
            label="نقاشات"
            count={posts.filter((p) => p.kind === "discussion" && !p.title.startsWith("[مشاركة]")).length}
          />
        </section>

        {/* Compose Section */}
        <AnimatePresence>
          {showCompose && (
            <motion.section
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="overflow-hidden"
            >
              <div className="card-surface p-6 md:p-10 space-y-6 md:space-y-8 shadow-2xl border-primary/10">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <Plus className="size-5 md:size-6" />
                  </div>
                  <h3 className="text-lg md:text-xl font-black text-primary">إضافة موضوع جديد</h3>
                </div>

                <div className="grid gap-6">
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    <TypeBtn
                      active={draft.isPost}
                      onClick={() => setDraft((d) => ({ ...d, isPost: true, kind: "discussion" }))}
                      label="مشاركة عائلية"
                      color="emerald"
                    />
                    {canPostOfficial && (
                      <TypeBtn
                        active={draft.kind === "announcement" && !draft.isPost}
                        onClick={() =>
                          setDraft((d) => ({ ...d, kind: "announcement", isPost: false }))
                        }
                        label="مناسبة رسمية"
                        color="gold"
                      />
                    )}
                    <TypeBtn
                      active={draft.kind === "discussion" && !draft.isPost}
                      onClick={() =>
                        setDraft((d) => ({ ...d, kind: "discussion", isPost: false }))
                      }
                      label="نقاش مفتوح"
                      color="indigo"
                    />
                    <TypeBtn
                      active={draft.kind === "complaint"}
                      onClick={() => setDraft((d) => ({ ...d, kind: "complaint", isPost: false }))}
                      label="طلب خاص للرئيس"
                      color="rose"
                    />
                  </div>

                  {draft.kind === "complaint" && (
                    <div className="p-3 md:p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3 text-amber-600">
                      <ShieldAlert className="size-4 md:size-5 shrink-0" />
                      <p className="text-[10px] md:text-xs font-bold leading-relaxed">
                        تنبيه: الطلبات تظهر فقط لرئيس المجلس لضمان الخصوصية وسرعة المعالجة.
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      placeholder="عنوان الموضوع..."
                      className="w-full h-12 md:h-14 px-5 md:px-6 rounded-xl md:rounded-2xl bg-muted/30 border border-border font-black text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                    />
                    <textarea
                      value={draft.body}
                      onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                      placeholder="اكتب التفاصيل هنا..."
                      rows={4}
                      className="w-full p-5 md:p-6 rounded-xl md:rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm resize-none"
                    />
                  </div>

                  {/* Poll System - only for posts and discussions */}
                  {(draft.isPost || draft.kind === "discussion") && (
                    <div className="space-y-4 p-6 rounded-3xl bg-muted/20 border border-dashed border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                          <Vote className="size-5" />
                          <span className="text-sm font-black">إضافة تصويت</span>
                        </div>
                        {draft.pollOptions.length > 0 && (
                          <button
                            onClick={() => setDraft((d) => ({ ...d, pollOptions: [], isVoteOnly: false }))}
                            className="text-xs font-bold text-rose-500"
                          >
                            حذف التصويت
                          </button>
                        )}
                      </div>

                      {draft.pollOptions.length === 0 ? (
                        <button
                          onClick={() => setDraft((d) => ({ ...d, pollOptions: ["", ""] }))}
                          className="px-4 py-2 rounded-xl bg-primary/5 text-primary text-xs font-bold border border-primary/10 hover:bg-primary hover:text-white transition-all"
                        >
                          + إضافة خيارات للتصويت
                        </button>
                      ) : (
                        <div className="space-y-3">
                          {draft.pollOptions.map((opt, i) => (
                            <div key={i} className="flex gap-2">
                              <input
                                value={opt}
                                onChange={(e) => {
                                  const next = [...draft.pollOptions];
                                  next[i] = e.target.value;
                                  setDraft((d) => ({ ...d, pollOptions: next }));
                                }}
                                placeholder={`الخيار ${i + 1}`}
                                className="flex-1 h-10 px-4 rounded-xl bg-white border border-border text-sm font-bold"
                              />
                              {draft.pollOptions.length > 2 && (
                                <button
                                  onClick={() =>
                                    setDraft((d) => ({
                                      ...d,
                                      pollOptions: d.pollOptions.filter((_, idx) => idx !== i),
                                    }))
                                  }
                                  className="text-rose-500 p-2"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                          <div className="flex items-center justify-between gap-4">
                            {draft.pollOptions.length < 5 && (
                              <button
                                onClick={() => setDraft((d) => ({ ...d, pollOptions: [...d.pollOptions, ""] }))}
                                className="text-xs font-bold text-primary"
                              >
                                + إضافة خيار آخر
                              </button>
                            )}
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={draft.isVoteOnly}
                                onChange={(e) => setDraft((d) => ({ ...d, isVoteOnly: e.target.checked }))}
                                className="size-4 accent-primary"
                              />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                المشاركة تصويت فقط (بدون تعليقات)
                              </span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowCompose(false)}
                    className="px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-sm text-muted-foreground hover:bg-muted transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={submitPost}
                    className="btn-gold px-8 md:px-12 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-sm md:text-base shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3"
                  >
                    <Send className="size-5" /> نشر في الأخبار
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Posts Feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="card-surface p-16 md:p-32 flex flex-col items-center text-center gap-6 border-dashed opacity-40">
            <Megaphone className="size-12 md:size-[60px]" strokeWidth={1} />
            <p className="text-lg md:text-xl font-bold">لا توجد منشورات حالياً في هذا القسم</p>
          </div>
        ) : (
          <div className="grid gap-6 md:gap-8">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                me={me}
                author={profiles[post.author_id]}
                onTogglePin={() => {
                  supabase
                    .from("majlis_posts")
                    .update({ pinned: !post.pinned })
                    .eq("id", post.id)
                    .then(() => loadPosts());
                }}
                onDelete={() => {
                  if (!confirm("حذف هذا المنشور؟")) return;
                  supabase
                    .from("majlis_posts")
                    .delete()
                    .eq("id", post.id)
                    .then(() => loadPosts());
                }}
                onToggleComments={() => {
                  const willOpen = !openComments[post.id];
                  setOpenComments((p) => ({ ...p, [post.id]: willOpen }));
                  if (willOpen && !comments[post.id]) loadComments(post.id);
                }}
                onVote={(idx: number) => handleVote(post.id, idx)}
                comments={comments[post.id] ?? []}
                isOpen={!!openComments[post.id]}
                commentDraft={commentDraft[post.id] ?? ""}
                onCommentChange={(v: string) => setCommentDraft((prev) => ({ ...prev, [post.id]: v }))}
                onCommentSubmit={() => submitComment(post.id)}
                onCommentDelete={(c: Comment) => {
                  if (!confirm("حذف التعليق؟")) return;
                  supabase
                    .from("majlis_comments")
                    .delete()
                    .eq("id", c.id)
                    .then(() => loadComments(post.id));
                }}
                profiles={profiles}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PostCard({
  post,
  me,
  author,
  onTogglePin,
  onDelete,
  onToggleComments,
  onVote,
  comments,
  isOpen,
  commentDraft,
  onCommentChange,
  onCommentSubmit,
  onCommentDelete,
  profiles,
}: any) {
  const authorName = author?.arabic_name?.trim() || author?.full_name?.trim() || "عضو العائلة";
  const canModerate = me.isAdmin || me.isManager || me.isChairman || post.author_id === me.id;

  // Extract poll and clean body
  const pollMatch = post.body.match(/^---poll:(.*)---/);
  const pollData = pollMatch ? JSON.parse(pollMatch[1]) : null;
  const cleanBody = pollMatch ? post.body.replace(/^---poll:.*---\n?/, "") : post.body;

  // Calculate poll results
  const votes = comments.filter((c: any) => c.body.startsWith("[VOTE]:"));
  const myVote = votes.find((v: any) => v.author_id === me.id);
  const myVoteIdx = myVote ? parseInt(myVote.body.split(":")[1]) : null;

  const voteCounts = pollData?.options.map(
    (_: string, i: number) => votes.filter((v: any) => v.body === `[VOTE]:${i}`).length,
  );
  const totalVotes = votes.length;

  const displayTitle = post.title.replace("[مشاركة]", "").trim();
  const isPostKind = post.title.startsWith("[مشاركة]");

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "card-surface overflow-hidden border-none shadow-2xl transition-all duration-500",
        post.kind === "announcement"
          ? "ring-2 ring-gold-primary/30 bg-gradient-to-br from-card to-gold-primary/5"
          : "hover:-translate-y-1",
      )}
    >
      <div className="p-5 md:p-10 space-y-6 md:space-y-8">
        <header className="flex items-start justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="size-11 md:size-14 rounded-2xl md:rounded-[20px] ring-4 ring-primary/5 overflow-hidden shadow-lg bg-muted">
                <UserAvatar
                  path={author?.avatar_url}
                  name={authorName}
                  className="size-full"
                  userId={post.author_id}
                />
              </div>
              {post.pinned && (
                <div className="absolute -top-1.5 -right-1.5 size-6 md:size-7 rounded-full bg-primary text-white flex items-center justify-center border-2 border-card shadow-lg">
                  <Pin size={10} md:size={12} strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="space-y-0.5 md:space-y-1 min-w-0">
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <h4 className="text-base md:text-lg font-black text-primary tracking-tight truncate">
                  {authorName}
                </h4>
                {post.kind === "announcement" && (
                  <span className="px-2 md:px-3 py-0.5 rounded-full bg-gold-primary text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest shadow-md">
                    مناسبة
                  </span>
                )}
                {isPostKind && (
                  <span className="px-2 md:px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] md:text-[10px] font-black uppercase tracking-widest">
                    مشاركة
                  </span>
                )}
                {post.kind === "complaint" && (
                  <span className="px-2 md:px-3 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[8px] md:text-[10px] font-black uppercase tracking-widest">
                    طلب خاص
                  </span>
                )}
                {pollData && (
                  <span className="px-2 md:px-3 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                    <Vote size={10} /> تصويت
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-black text-muted-foreground opacity-60 uppercase tracking-tighter">
                <Clock className="size-3" /> {formatDate(post.created_at)}
              </div>
            </div>
          </div>

          {canModerate && (
            <div className="flex items-center gap-1 shrink-0">
              {(me.isAdmin || me.isManager || me.isChairman) && (
                <button
                  onClick={onTogglePin}
                  className={cn(
                    "size-8 md:size-10 rounded-lg md:rounded-xl flex items-center justify-center transition-all",
                    post.pinned ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {post.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                </button>
              )}
              <button
                onClick={onDelete}
                className="size-8 md:size-10 rounded-lg md:rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </header>

        <div className="space-y-4">
          <h3 className="text-xl md:text-3xl font-black text-primary leading-tight line-clamp-2 md:line-clamp-none">
            {displayTitle}
          </h3>
          <p className="text-sm md:text-lg font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {cleanBody}
          </p>

          {/* Poll Render */}
          {pollData && (
            <div className="space-y-3 p-6 md:p-8 rounded-[32px] bg-primary/5 border border-primary/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-primary">
                  <BarChart3 size={18} />
                  <span className="font-black text-sm">استطلاع رأي</span>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {totalVotes} صوت
                </span>
              </div>

              <div className="grid gap-3">
                {pollData.options.map((opt: string, idx: number) => {
                  const count = voteCounts[idx];
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const isWinner = totalVotes > 0 && count === Math.max(...voteCounts);

                  return (
                    <button
                      key={idx}
                      disabled={!!myVote}
                      onClick={() => onVote(idx)}
                      className={cn(
                        "relative w-full h-12 md:h-14 rounded-2xl overflow-hidden border transition-all text-right",
                        myVoteIdx === idx
                          ? "border-primary bg-primary/10"
                          : "border-border/60 bg-white hover:border-primary/40",
                      )}
                    >
                      {/* Progress Bar */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        className={cn(
                          "absolute inset-y-0 right-0 opacity-10",
                          isWinner ? "bg-primary" : "bg-muted-foreground",
                        )}
                      />
                      <div className="relative h-full flex items-center justify-between px-5 md:px-6">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-sm md:text-base text-primary">
                            {opt}
                          </span>
                          {myVoteIdx === idx && (
                            <CheckCircle2 size={16} className="text-primary" />
                          )}
                        </div>
                        <span className="text-xs md:text-sm font-black text-primary/40">
                          {pct}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {myVote && (
                <p className="text-[10px] font-bold text-primary/60 text-center uppercase tracking-widest pt-2">
                  شكراً لمشاركتك في التصويت
                </p>
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-border/40" />

        <footer className="flex flex-col gap-5 md:gap-6">
          <div className="flex items-center justify-between">
            <button
              onClick={onToggleComments}
              disabled={pollData?.voteOnly && !canModerate}
              className={cn(
                "flex items-center gap-3 text-primary font-black text-[10px] md:text-xs uppercase tracking-widest hover:text-gold-primary transition-all w-fit disabled:opacity-30 disabled:cursor-not-allowed",
              )}
            >
              <div className="size-9 md:size-10 rounded-lg md:rounded-xl bg-primary/5 flex items-center justify-center shadow-inner">
                <MessageSquare className="size-4 md:size-[18px]" />
              </div>
              <span>
                {isOpen
                  ? "إخفاء الردود"
                  : pollData?.voteOnly
                    ? "التعليقات مغلقة لهذا التصويت"
                    : `عرض الردود (${comments.filter((c: any) => !c.body.startsWith("[VOTE]:")).length})`}
              </span>
              {!pollData?.voteOnly && (
                <ChevronLeft
                  className={cn("size-4 transition-transform duration-500", isOpen ? "-rotate-90" : "")}
                />
              )}
            </button>
          </div>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-5 md:space-y-6 overflow-hidden"
              >
                <div className="space-y-3 md:space-y-4">
                  {comments
                    .filter((c: any) => !c.body.startsWith("[VOTE]:"))
                    .map((c: any) => {
                      const ca = profiles[c.author_id];
                      const cName = ca?.arabic_name?.trim() || ca?.full_name?.trim() || "عضو";
                      return (
                        <div
                          key={c.id}
                          className="flex gap-3 md:gap-4 p-4 md:p-5 rounded-2xl md:rounded-3xl bg-muted/20 border border-border/40 group/comment"
                        >
                          <div className="size-8 md:size-10 rounded-xl md:rounded-2xl overflow-hidden shadow-md shrink-0 bg-muted">
                            <UserAvatar
                              path={ca?.avatar_url}
                              name={cName}
                              className="size-full"
                              userId={c.author_id}
                            />
                          </div>
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs md:text-sm font-black text-primary">
                                {cName}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground opacity-40">
                                  {formatDate(c.created_at)}
                                </span>
                                {(me.isAdmin || me.isManager || me.isChairman || c.author_id === me.id) && (
                                  <button onClick={() => onCommentDelete(c)} className="text-rose-500 p-1">
                                    <X size={12} strokeWidth={3} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-xs md:text-sm font-bold text-muted-foreground leading-relaxed">
                              {c.body}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {!pollData?.voteOnly && (
                  <div className="flex gap-2 md:gap-3">
                    <div className="flex-1 relative">
                      <input
                        value={commentDraft}
                        onChange={(e) => onCommentChange(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && !e.shiftKey && (e.preventDefault(), onCommentSubmit())
                        }
                        placeholder="اكتب ردك هنا..."
                        className="w-full h-11 md:h-14 pr-4 md:pr-6 pl-12 md:pl-14 rounded-xl md:rounded-2xl bg-muted/40 border border-border font-bold text-xs md:text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                      />
                      <button
                        onClick={onCommentSubmit}
                        className="absolute left-1.5 top-1.5 size-8 md:size-10 rounded-lg md:rounded-xl bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                      >
                        <Send className="size-3.5 md:size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </footer>
      </div>
    </motion.article>
  );
}

function NavTab({ active, onClick, label, count }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3 rounded-full text-[11px] md:text-sm font-black transition-all duration-300 whitespace-nowrap shrink-0",
        active
          ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105"
          : "bg-white dark:bg-card/50 border-border/40 text-muted-foreground hover:bg-muted hover:text-primary",
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "min-w-[18px] md:min-w-[20px] h-4 md:h-5 px-1 md:px-1.5 rounded-full text-[9px] md:text-[10px] font-black flex items-center justify-center",
            active ? "bg-white text-primary" : "bg-primary text-white",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function TypeBtn({ active, onClick, label, color }: any) {
  const styles: any = {
    gold: active
      ? "bg-gold-primary text-white border-gold-primary"
      : "bg-muted/40 text-muted-foreground border-border hover:border-gold-primary",
    emerald: active
      ? "bg-primary text-white border-primary"
      : "bg-muted/40 text-muted-foreground border-border hover:border-primary",
    indigo: active
      ? "bg-indigo-600 text-white border-indigo-600"
      : "bg-muted/40 text-muted-foreground border-border hover:border-indigo-500",
    rose: active
      ? "bg-rose-600 text-white border-rose-600"
      : "bg-muted/40 text-muted-foreground border-border hover:border-rose-500",
  };
  return (
    <button
      onClick={onClick}
      className={cn("px-5 py-2.5 rounded-xl border text-xs font-black transition-all", styles[color])}
    >
      {label}
    </button>
  );
}
