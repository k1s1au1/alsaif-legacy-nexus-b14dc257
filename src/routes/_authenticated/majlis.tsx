import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/majlis")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "المجلس — السيف" },
      { name: "description", content: "مجلس العائلة للنقاش والإعلانات الرسمية." },
    ],
  }),
  component: MajlisPage,
});

type PostKind = "announcement" | "discussion" | "complaint";

type Profile = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Post = {
  id: string;
  author_id: string;
  kind: PostKind;
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
  return "عضو";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
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
  } | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft] = useState({ kind: "discussion" as PostKind, title: "", body: "" });
  const [filter, setFilter] = useState<"all" | PostKind>("all");

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
        supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const r = (roles ?? []).map((x) => x.role);
      const isAdmin = r.includes("admin");
      const isManager = r.includes("manager");
      const primary = isAdmin ? "admin" : isManager ? "manager" : "member";
      const name = p?.arabic_name?.trim() || p?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو";
      setMe({
        id: u.user.id,
        name,
        role: roleLabel(primary),
        initial: (name[0] ?? "س").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
        isAdmin,
        isManager,
      });
      await loadPosts();
      setLoading(false);
    })();
  }, [loadPosts]);

  useEffect(() => {
    const ch = supabase
      .channel("majlis-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_comments" }, (payload) => {
        const row = (payload.new ?? payload.old) as { post_id?: string } | null;
        if (row?.post_id && openComments[row.post_id]) loadComments(row.post_id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadPosts, loadComments, openComments]);

  const canPostOfficial = !!me && (me.isAdmin || me.isManager);

  async function submitPost() {
    if (!me) return;
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) {
      toast.error("العنوان والمحتوى مطلوبان");
      return;
    }
    const { error } = await supabase.from("majlis_posts").insert({
      author_id: me.id,
      kind: draft.kind,
      title,
      body,
    });
    if (error) {
      toast.error("تعذر النشر");
      return;
    }
    toast.success("تم نشر إعلانك بنجاح");
    setDraft({ kind: canPostOfficial ? "discussion" : "complaint", title: "", body: "" });
    setShowCompose(false);
    loadPosts();
  }

  async function togglePin(post: Post) {
    const { error } = await supabase
      .from("majlis_posts")
      .update({ pinned: !post.pinned })
      .eq("id", post.id);
    if (error) toast.error("تعذر التحديث");
    else loadPosts();
  }

  async function deletePost(post: Post) {
    if (!confirm("هل أنت متأكد من حذف هذا المنشور؟")) return;
    const { error } = await supabase.from("majlis_posts").delete().eq("id", post.id);
    if (error) toast.error("تعذر الحذف");
    else {
      toast.success("تم الحذف بنجاح");
      loadPosts();
    }
  }

  async function toggleComments(postId: string) {
    const willOpen = !openComments[postId];
    setOpenComments((p) => ({ ...p, [postId]: willOpen }));
    if (willOpen && !comments[postId]) await loadComments(postId);
  }

  async function submitComment(postId: string) {
    if (!me) return;
    const text = (commentDraft[postId] ?? "").trim();
    if (!text) return;
    const { error } = await supabase.from("majlis_comments").insert({
      post_id: postId,
      author_id: me.id,
      body: text,
    });
    if (error) {
      toast.error("تعذر إرسال التعليق");
      return;
    }
    setCommentDraft((p) => ({ ...p, [postId]: "" }));
    loadComments(postId);
  }

  async function deleteComment(c: Comment) {
    if (!confirm("حذف التعليق؟")) return;
    const { error } = await supabase.from("majlis_comments").delete().eq("id", c.id);
    if (error) toast.error("تعذر الحذف");
    else loadComments(c.post_id);
  }

  const filteredPosts = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter((p) => p.kind === filter);
  }, [posts, filter]);

  if (!me) {
    return (
      <AppShell title="المجلس" user={{ name: "...", role: "عضو", initial: "ص" }}>
        <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
           <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
           <p className="font-black">جاري تحضير المجلس...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="المجلس" user={{ name: me.name, role: me.role, initial: me.initial, avatarPath: me.avatarPath }}>
      <div className="max-w-5xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Alsaif Majlis Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-up">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="size-1 w-10 bg-gold-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">مجلس آل سيف</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary">إعلانات المجلس</h2>
            <p className="text-muted-foreground font-bold text-lg opacity-70">شارك أخبارك، نقاشاتك، أو تواصل مع المسؤولين.</p>
          </div>
          <button
            onClick={() => {
              setShowCompose(!showCompose);
              if (!canPostOfficial) setDraft((d) => ({ ...d, kind: "complaint" }));
            }}
            className="btn-gold px-8 py-4 flex items-center gap-3 shadow-2xl shadow-gold-primary/20 text-base"
          >
            {showCompose ? <X className="size-5" strokeWidth={3} /> : <Plus className="size-5" strokeWidth={3} />}
            <span>{showCompose ? "إلغاء الكتابة" : canPostOfficial ? "كتابة إعلان جديد" : "إرسال شكوى جديدة"}</span>
          </button>
        </section>

        {/* Filters Bar */}
        <section className="flex overflow-x-auto no-scrollbar items-center gap-3 p-1.5 bg-muted/30 rounded-[32px] border border-border/40 w-fit animate-fade-up" style={{ animationDelay: "100ms" }}>
           <NavTab active={filter === "all"} onClick={() => setFilter("all")} label="الكل" count={posts.length} />
           <NavTab active={filter === "announcement"} onClick={() => setFilter("announcement")} label="الإعلانات" count={posts.filter(p => p.kind === "announcement").length} />
           <NavTab active={filter === "discussion"} onClick={() => setFilter("discussion")} label="النقاشات" count={posts.filter(p => p.kind === "discussion").length} />
           <NavTab active={filter === "complaint"} onClick={() => setFilter("complaint")} label="الشكاوى" count={posts.filter(p => p.kind === "complaint").length} />
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
              <div className="card-surface p-8 md:p-10 space-y-8 shadow-2xl border-primary/10">
                 <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Plus className="size-6" /></div>
                    <h3 className="text-xl font-black text-primary">ماذا تود أن تشارك المجلس؟</h3>
                 </div>

                 <div className="grid gap-6">
                    {canPostOfficial && (
                      <div className="flex flex-wrap gap-3">
                         <TypeBtn active={draft.kind === "announcement"} onClick={() => setDraft(d => ({...d, kind: "announcement"}))} label="إعلان رسمي" color="gold" />
                         <TypeBtn active={draft.kind === "discussion"} onClick={() => setDraft(d => ({...d, kind: "discussion"}))} label="فتح نقاش" color="emerald" />
                         <TypeBtn active={draft.kind === "complaint"} onClick={() => setDraft(d => ({...d, kind: "complaint"}))} label="شكوى خاصة" color="rose" />
                      </div>
                    )}

                    {draft.kind === "complaint" && (
                      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3 text-amber-600">
                         <ShieldAlert className="size-5 shrink-0" />
                         <p className="text-xs font-bold leading-relaxed">تنبيه: الشكاوى تظهر فقط لمسؤولي النظام والمشرفين لضمان الخصوصية.</p>
                      </div>
                    )}

                    <div className="space-y-4">
                       <input
                        value={draft.title}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        placeholder="عنوان الموضوع..."
                        className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-black text-lg focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                      />
                      <textarea
                        value={draft.body}
                        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                        placeholder="اكتب المحتوى هنا بالتفصيل..."
                        rows={5}
                        className="w-full p-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm resize-none"
                      />
                    </div>
                 </div>

                 <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => setShowCompose(false)} className="px-8 py-4 rounded-2xl font-black text-sm text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
                    <button
                      onClick={submitPost}
                      className="btn-gold px-12 py-4 rounded-2xl font-black text-base shadow-2xl shadow-gold-primary/20 flex items-center gap-3"
                    >
                      <Send className="size-5" /> نشر الآن
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
          <div className="card-surface p-32 flex flex-col items-center text-center gap-6 border-dashed opacity-40">
            <Megaphone size={60} strokeWidth={1} />
            <p className="text-xl font-bold">لا توجد منشورات في هذا القسم حالياً</p>
          </div>
        ) : (
          <div className="grid gap-8">
            {filteredPosts.map((post, i) => (
              <PostCard
                key={post.id}
                post={post}
                me={me}
                author={profiles[post.author_id]}
                onTogglePin={togglePin}
                onDelete={deletePost}
                onToggleComments={toggleComments}
                comments={comments[post.id] ?? []}
                isOpen={!!openComments[post.id]}
                commentDraft={commentDraft[post.id] ?? ""}
                onCommentChange={(v: string) => setCommentDraft(prev => ({...prev, [post.id]: v}))}
                onCommentSubmit={() => submitComment(post.id)}
                onCommentDelete={deleteComment}
                profiles={profiles}
              />
            ))}
          </div>
        )}

      </div>
    </AppShell>
  );
}

function PostCard({ post, me, author, onTogglePin, onDelete, onToggleComments, comments, isOpen, commentDraft, onCommentChange, onCommentSubmit, onCommentDelete, profiles }: any) {
  const authorName = author?.arabic_name?.trim() || author?.full_name?.trim() || "عضو المجمس";
  const isAnnouncement = post.kind === "announcement";
  const canModerate = me.isAdmin || me.isManager || post.author_id === me.id;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "card-surface overflow-hidden border-none shadow-2xl transition-all duration-500",
        isAnnouncement ? "ring-2 ring-gold-primary/30 bg-gradient-to-br from-card to-gold-primary/5" : "hover:-translate-y-1"
      )}
    >
      <div className="p-8 md:p-10 space-y-8">
         <header className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
               <div className="relative">
                  <div className="size-14 rounded-[20px] ring-4 ring-primary/5 overflow-hidden shadow-lg bg-muted">
                    <UserAvatar path={author?.avatar_url} name={authorName} className="size-full" userId={post.author_id} />
                  </div>
                  {post.pinned && <div className="absolute -top-2 -right-2 size-7 rounded-full bg-primary text-white flex items-center justify-center border-2 border-card shadow-lg"><Pin size={12} strokeWidth={3} /></div>}
               </div>
               <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                     <h4 className="text-lg font-black text-primary tracking-tight">{authorName}</h4>
                     {isAnnouncement && <span className="px-3 py-0.5 rounded-full bg-gold-primary text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-gold-primary/20">إعلان رسمي</span>}
                     {post.kind === "complaint" && <span className="px-3 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest">شكوى إدارية</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground opacity-60 uppercase tracking-tighter">
                     <Clock className="size-3" /> {formatDate(post.created_at)}
                  </div>
               </div>
            </div>

            {canModerate && (
              <div className="flex items-center gap-1">
                 {(me.isAdmin || me.isManager) && (
                   <button onClick={() => onTogglePin(post)} className={cn("size-10 rounded-xl flex items-center justify-center transition-all", post.pinned ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                      {post.pinned ? <PinOff size={18} /> : <Pin size={18} />}
                   </button>
                 )}
                 <button onClick={() => onDelete(post)} className="size-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                    <Trash2 size={18} />
                 </button>
              </div>
            )}
         </header>

         <div className="space-y-4">
            <h3 className="text-2xl md:text-3xl font-black text-primary leading-tight">{post.title}</h3>
            <p className="text-base md:text-lg font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap">{post.body}</p>
         </div>

         <div className="h-px bg-border/40" />

         <footer className="flex flex-col gap-6">
            <button
              onClick={() => onToggleComments(post.id)}
              className="flex items-center gap-3 text-primary font-black text-xs uppercase tracking-widest hover:text-gold-primary transition-all w-fit"
            >
              <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center shadow-inner"><MessageSquare size={18} /></div>
              <span>{isOpen ? "إخفاء التعليقات" : `عرض التعليقات (${comments.length})`}</span>
              <ChevronLeft className={cn("size-4 transition-transform duration-500", isOpen ? "-rotate-90" : "")} />
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-6 overflow-hidden">
                   <div className="space-y-4">
                      {comments.map((c: any) => {
                         const ca = profiles[c.author_id];
                         const cName = ca?.arabic_name?.trim() || ca?.full_name?.trim() || "عضو";
                         return (
                            <div key={c.id} className="flex gap-4 p-5 rounded-3xl bg-muted/20 border border-border/40 group/comment">
                               <div className="size-10 rounded-2xl overflow-hidden shadow-md shrink-0 bg-muted">
                                  <UserAvatar path={ca?.avatar_url} name={cName} className="size-full" userId={c.author_id} />
                               </div>
                               <div className="flex-1 space-y-1.5 min-w-0">
                                  <div className="flex items-center justify-between gap-4">
                                     <span className="text-sm font-black text-primary">{cName}</span>
                                     <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-muted-foreground opacity-40">{formatDate(c.created_at)}</span>
                                        {(me.isAdmin || me.isManager || c.author_id === me.id) && (
                                           <button onClick={() => onCommentDelete(c)} className="opacity-0 group-hover/comment:opacity-100 text-rose-500 transition-all p-1"><X size={14} strokeWidth={3} /></button>
                                        )}
                                     </div>
                                  </div>
                                  <p className="text-sm font-bold text-muted-foreground leading-relaxed">{c.body}</p>
                               </div>
                            </div>
                         );
                      })}
                   </div>

                   <div className="flex gap-3">
                      <div className="flex-1 relative">
                         <input
                           value={commentDraft}
                           onChange={(e) => onCommentChange(e.target.value)}
                           onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), onCommentSubmit())}
                           placeholder="اكتب تعليقك هنا..."
                           className="w-full h-14 pr-6 pl-14 rounded-2xl bg-muted/40 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                         />
                         <button onClick={onCommentSubmit} className="absolute left-2 top-2 size-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"><Send className="size-4" /></button>
                      </div>
                   </div>
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
        "flex items-center gap-3 px-6 py-3 rounded-full text-sm font-black transition-all duration-300 whitespace-nowrap",
        active
          ? "bg-primary text-white shadow-xl shadow-primary/20"
          : "text-muted-foreground hover:text-primary hover:bg-white"
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <span className={cn(
          "min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center",
          active ? "bg-white text-primary" : "bg-primary text-white"
        )}>{count}</span>
      )}
    </button>
  );
}

function TypeBtn({ active, onClick, label, color }: any) {
  const styles: any = {
    gold: active ? "bg-gold-primary text-white border-gold-primary" : "bg-muted/40 text-muted-foreground border-border hover:border-gold-primary",
    emerald: active ? "bg-primary text-white border-primary" : "bg-muted/40 text-muted-foreground border-border hover:border-primary",
    rose: active ? "bg-rose-600 text-white border-rose-600" : "bg-muted/40 text-muted-foreground border-border hover:border-rose-500",
  };
  return (
    <button onClick={onClick} className={cn("px-5 py-2.5 rounded-xl border text-xs font-black transition-all", styles[color])}>
       {label}
    </button>
  );
}
