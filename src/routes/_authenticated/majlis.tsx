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
} from "lucide-react";

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

type PostKind = "announcement" | "discussion";

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
    return new Date(iso).toLocaleString("ar", {
      dateStyle: "medium",
      timeStyle: "short",
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

  const canPost = !!me && (me.isAdmin || me.isManager);

  const filteredPosts = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter((p) => p.kind === filter);
  }, [posts, filter]);

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
    toast.success("تم النشر");
    setDraft({ kind: "discussion", title: "", body: "" });
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
    if (!confirm("حذف المنشور؟")) return;
    const { error } = await supabase.from("majlis_posts").delete().eq("id", post.id);
    if (error) toast.error("تعذر الحذف");
    else {
      toast.success("تم الحذف");
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

  if (!me) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-gold-primary" />
      </div>
    );
  }

  return (
    <AppShell title="المجلس" user={{ name: me.name, role: me.role, initial: me.initial, avatarPath: me.avatarPath }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header & filters */}
        <section className="card-surface p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Megaphone className="size-6 text-gold-primary" strokeWidth={1.5} />
            <div>
              <h2 className="text-xl text-ivory">مجلس العائلة</h2>
              <p className="text-xs text-muted-foreground">إعلانات رسمية ونقاشات بين الأعضاء</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-background border border-border p-1 text-xs">
              {([
                { k: "all", l: "الكل" },
                { k: "announcement", l: "إعلانات" },
                { k: "discussion", l: "نقاشات" },
              ] as const).map((t) => (
                <button
                  key={t.k}
                  onClick={() => setFilter(t.k)}
                  className={`px-3 py-1.5 rounded-md transition ${
                    filter === t.k
                      ? "bg-gold-primary/15 text-gold-primary"
                      : "text-muted-foreground hover:text-ivory"
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>
            {canPost && (
              <button
                onClick={() => setShowCompose((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary text-navy-base text-sm font-medium hover:opacity-90 transition"
              >
                {showCompose ? <X className="size-4" /> : <Plus className="size-4" />}
                {showCompose ? "إلغاء" : "منشور جديد"}
              </button>
            )}
          </div>
        </section>

        {/* Compose */}
        {showCompose && canPost && (
          <section className="card-surface p-5 space-y-3 animate-fade-up">
            <div className="flex items-center gap-2 text-xs">
              {(["discussion", "announcement"] as PostKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setDraft((d) => ({ ...d, kind: k }))}
                  className={`px-3 py-1.5 rounded-md border transition ${
                    draft.kind === k
                      ? "border-gold-primary/50 bg-gold-primary/10 text-gold-primary"
                      : "border-border text-muted-foreground hover:text-ivory"
                  }`}
                >
                  {k === "announcement" ? "إعلان رسمي" : "نقاش"}
                </button>
              ))}
            </div>
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="عنوان المنشور"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-ivory placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
            />
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="اكتب المحتوى هنا..."
              rows={5}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-ivory placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold-primary/40 resize-y"
            />
            <div className="flex justify-end">
              <button
                onClick={submitPost}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary text-navy-base text-sm font-medium hover:opacity-90 transition"
              >
                <Send className="size-4" />
                نشر
              </button>
            </div>
          </section>
        )}

        {/* Posts list */}
        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-6 animate-spin text-gold-primary" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="card-surface p-12 text-center text-muted-foreground text-sm">
            لا توجد منشورات بعد.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => {
              const author = profiles[post.author_id];
              const authorName =
                author?.arabic_name?.trim() || author?.full_name?.trim() || "عضو";
              const isAnnouncement = post.kind === "announcement";
              const canModerate =
                me.isAdmin || me.isManager || post.author_id === me.id;
              const postComments = comments[post.id] ?? [];
              const isOpen = !!openComments[post.id];

              return (
                <article
                  key={post.id}
                  className={`card-surface p-5 space-y-4 animate-fade-up ${
                    isAnnouncement ? "border-gold-primary/30" : ""
                  }`}
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="size-10 rounded-full ring-1 ring-gold-primary/30 bg-gold-primary/10 overflow-hidden shrink-0">
                        <UserAvatar
                          path={author?.avatar_url ?? null}
                          name={authorName}
                          className="size-full"
                          fallbackClassName="text-base text-gold-primary"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-ivory truncate">{authorName}</span>
                          {isAnnouncement && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-primary/15 text-gold-primary border border-gold-primary/30">
                              إعلان رسمي
                            </span>
                          )}
                          {post.pinned && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-ivory/70 flex items-center gap-1">
                              <Pin className="size-3" /> مثبّت
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{formatDate(post.created_at)}</p>
                      </div>
                    </div>
                    {canModerate && (
                      <div className="flex items-center gap-1">
                        {(me.isAdmin || me.isManager) && (
                          <button
                            onClick={() => togglePin(post)}
                            className="p-2 rounded-md text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
                            title={post.pinned ? "إلغاء التثبيت" : "تثبيت"}
                          >
                            {post.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => deletePost(post)}
                          className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                          title="حذف"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </header>

                  <div>
                    <h3 className="text-lg text-ivory mb-2">{post.title}</h3>
                    <p className="text-sm text-ivory/80 whitespace-pre-wrap leading-relaxed">{post.body}</p>
                  </div>

                  <footer className="pt-3 border-t border-border">
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-gold-primary transition"
                    >
                      <MessageSquare className="size-4" />
                      {isOpen ? "إخفاء التعليقات" : "عرض التعليقات"}
                      {postComments.length > 0 && (
                        <span className="text-gold-primary">({postComments.length})</span>
                      )}
                    </button>

                    {isOpen && (
                      <div className="mt-4 space-y-3">
                        {postComments.map((c) => {
                          const ca = profiles[c.author_id];
                          const cName =
                            ca?.arabic_name?.trim() || ca?.full_name?.trim() || "عضو";
                          const canDel =
                            me.isAdmin || me.isManager || c.author_id === me.id;
                          return (
                            <div
                              key={c.id}
                              className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border"
                            >
                              <div className="size-8 rounded-full ring-1 ring-gold-primary/30 bg-gold-primary/10 overflow-hidden shrink-0">
                                <UserAvatar
                                  path={ca?.avatar_url ?? null}
                                  name={cName}
                                  className="size-full"
                                  fallbackClassName="text-xs text-gold-primary"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-ivory">{cName}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatDate(c.created_at)}
                                    </span>
                                    {canDel && (
                                      <button
                                        onClick={() => deleteComment(c)}
                                        className="text-muted-foreground hover:text-destructive transition"
                                        title="حذف"
                                      >
                                        <Trash2 className="size-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-ivory/80 mt-1 whitespace-pre-wrap">{c.body}</p>
                              </div>
                            </div>
                          );
                        })}

                        <div className="flex items-center gap-2">
                          <input
                            value={commentDraft[post.id] ?? ""}
                            onChange={(e) =>
                              setCommentDraft((p) => ({ ...p, [post.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                submitComment(post.id);
                              }
                            }}
                            placeholder="اكتب تعليقاً..."
                            className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-ivory placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
                          />
                          <button
                            onClick={() => submitComment(post.id)}
                            className="p-2 rounded-lg bg-gold-primary text-navy-base hover:opacity-90 transition"
                          >
                            <Send className="size-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
