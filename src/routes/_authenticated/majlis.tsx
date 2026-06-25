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

type PostKind = "announcement" | "sharing" | "event" | "complaint" | "discussion";

type MajlisPost = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  kind: PostKind;
  pinned: boolean;
  is_poll: boolean;
  poll_only_voting: boolean;
  created_at: string;
  author?: {
    arabic_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
};

const KINDS: { key: PostKind; label: string; color: string; icon: any }[] = [
  { key: "sharing", label: "مشاركات", color: "emerald", icon: MessageSquare },
  { key: "event", label: "مناسبات", color: "amber", icon: Clock },
  { key: "complaint", label: "طلبات", color: "rose", icon: ShieldAlert },
  { key: "discussion", label: "نقاشات", color: "blue", icon: Megaphone },
];

function MajlisPage() {
  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: "...", role: "...", initial: "ص", avatarPath: null as string | null });
  const [posts, setPosts] = useState<MajlisPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChairman, setIsChairman] = useState(false);
  const [activeTab, setActiveTab] = useState<PostKind | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const dynamicLogo = useSiteLogo();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMeId(user.id);

    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    const rs = (roles ?? []).map(r => r.role);
    setIsChairman(rs.includes("chairman") || rs.includes("admin"));

    if (p) {
      setProfile({
        name: p.arabic_name || p.full_name || "عضو",
        role: rs.includes("chairman") ? "رئيس المجلس" : rs.includes("admin") ? "مسؤول النظام" : "عضو",
        initial: (p.arabic_name?.[0] || "ع").toUpperCase(),
        avatarPath: p.avatar_url
      });
    }

    const { data: rawPosts } = await supabase
      .from("majlis_posts")
      .select("*, author:profiles(arabic_name, full_name, avatar_url)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    setPosts((rawPosts || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      if (p.kind === "complaint" && !isChairman && p.author_id !== meId) return false;
      if (activeTab === "all") return true;
      return p.kind === activeTab;
    });
  }, [posts, activeTab, isChairman, meId]);

  return (
    <AppShell title="أخبار العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">
        <QuickActionsBanner />

        <section className="animate-fade-up px-4 md:px-0">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-primary via-[#0d2620] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
            <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
              <div
                className="size-28 md:size-64 logo-alsaif-banner"
                style={{ "--logo-url": `url(${dynamicLogo || alsaifMark.url})` } as any}
              />
            </div>
            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
              <div className="space-y-3 md:space-y-5 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">أخبار السيف</span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">أخبار العائلة</h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">تابع آخر المستجدات، شاركنا أفكارك، وتواصل مباشرة مع رئيس المجلس.</p>
              </div>
              <button onClick={() => setShowAdd(true)} className="btn-gold px-8 py-4 md:px-12 md:py-6 rounded-2xl md:rounded-[32px] flex items-center justify-center gap-3 shadow-2xl text-sm md:text-xl font-black shrink-0 active:scale-95 transition-all">
                <Plus size={24} strokeWidth={3} /> <span>إضافة خبر</span>
              </button>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-3xl border border-border/40 overflow-x-auto no-scrollbar mx-4 md:mx-0">
           <Tab active={activeTab === "all"} onClick={() => setActiveTab("all")} label="الكل" icon={<ListFilter size={16} />} />
           {KINDS.map(k => <Tab key={k.key} active={activeTab === k.key} onClick={() => setActiveTab(k.key)} label={k.label} icon={<k.icon size={16} />} color={k.color} />)}
        </div>

        <div className="grid grid-cols-1 gap-8 px-4 md:px-0">
           {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin size-12 mx-auto text-primary opacity-20" /></div> :
            filteredPosts.map(p => <PostCard key={p.id} post={p} meId={meId} isChairman={isChairman} onRefresh={loadData} />)}
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

function PostCard({ post, meId, isChairman, onRefresh }: any) {
  const [showPoll, setShowPoll] = useState(false);
  const [voted, setVoted] = useState(false);
  const [votes, setVotes] = useState<any[]>([]);
  const authorName = post.author?.arabic_name || post.author?.full_name || "عضو";
  const kind = KINDS.find(k => k.key === post.kind) || KINDS[0];

  const deletePost = async () => {
    if (!confirm("حذف المنشور؟")) return;
    await supabase.from("majlis_posts").delete().eq("id", post.id);
    toast.success("تم الحذف");
    onRefresh();
  };

  const togglePin = async () => {
    await supabase.from("majlis_posts").update({ pinned: !post.pinned }).eq("id", post.id);
    onRefresh();
  };

  const pollData = useMemo(() => {
    if (!post.body.startsWith("---poll:")) return null;
    try {
      const match = post.body.match(/^---poll:({.*?})---/s);
      return match ? JSON.parse(match[1]) : null;
    } catch { return null; }
  }, [post.body]);

  const cleanBody = post.body.replace(/^---poll:.*?---/s, "").trim();

  return (
    <motion.article layout className={cn("card-surface p-8 md:p-12 relative overflow-hidden group transition-all duration-500 hover:shadow-2xl", post.pinned && "border-gold-primary/30 bg-gold-primary/[0.02]")}>
       {post.pinned && <div className="absolute top-0 left-0 bg-gold-primary text-white px-6 py-1.5 rounded-br-3xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg"><Pin size={12} /> مثبت</div>}
       <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="flex-1 space-y-6">
             <div className="flex items-center gap-4">
                <div className="size-14 rounded-[22px] border-2 border-primary/10 overflow-hidden shadow-lg"><UserAvatar path={post.author?.avatar_url} name={authorName} className="size-full" userId={post.author_id} /></div>
                <div>
                   <h4 className="text-lg font-black text-primary">{authorName}</h4>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(post.created_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border", `bg-${kind.color}-500/10 text-${kind.color}-600 border-${kind.color}-500/20`)}>
                   {kind.label}
                </div>
             </div>
             <div className="space-y-4">
                <h3 className="text-2xl md:text-3xl font-black text-primary leading-tight">{post.title}</h3>
                <p className="text-base md:text-lg font-bold text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">{cleanBody}</p>
             </div>
             {pollData && (
                <div className="p-8 rounded-[40px] bg-primary/5 border-2 border-primary/10 space-y-6">
                   <div className="flex items-center gap-3 text-primary"><BarChart3 size={24} /><h5 className="text-xl font-black">{pollData.question}</h5></div>
                   <div className="grid gap-3">
                      {pollData.options.map((opt: string, i: number) => (
                        <button key={i} className="p-5 rounded-2xl bg-white border-2 border-border/40 text-right font-black hover:border-primary transition-all flex justify-between items-center group/opt">
                           <span>{opt}</span>
                           <div className="size-6 rounded-full border-2 border-border group-hover/opt:border-primary transition-all" />
                        </button>
                      ))}
                   </div>
                </div>
             )}
          </div>
          {(isChairman || post.author_id === meId) && (
             <div className="flex flex-row md:flex-col gap-2 md:opacity-0 md:group-hover:opacity-100 transition-all duration-500 self-end md:self-start">
                {isChairman && <button onClick={togglePin} className="size-12 rounded-2xl bg-gold-primary/10 text-gold-primary flex items-center justify-center hover:bg-gold-primary hover:text-white transition-all"><Pin size={20} /></button>}
                <button onClick={deletePost} className="size-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={20} /></button>
             </div>
          )}
       </div>
    </motion.article>
  );
}

function AddPostDialog({ meId, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", kind: "sharing" as PostKind, is_poll: false });
  const [poll, setPoll] = useState({ question: "", options: ["", ""] });

  const submit = async (e: any) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    let finalBody = form.body;
    if (form.is_poll && poll.question.trim()) {
      const data = { question: poll.question.trim(), options: poll.options.filter(o => o.trim()) };
      finalBody = `---poll:${JSON.stringify(data)}---\n${finalBody}`;
    }
    const { error } = await supabase.from("majlis_posts").insert({ ...form, body: finalBody, author_id: meId });
    setSaving(false);
    if (!error) { toast.success("تم النشر بنجاح"); onSaved(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl" dir="rtl">
       <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-card w-full max-w-2xl rounded-[48px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          <header className="p-8 border-b border-border flex items-center justify-between">
             <h3 className="text-2xl font-black text-primary">إضافة خبر جديد</h3>
             <button onClick={onClose} className="size-12 rounded-full bg-muted flex items-center justify-center"><X size={24} /></button>
          </header>
          <form onSubmit={submit} className="p-8 space-y-6 overflow-y-auto no-scrollbar">
             <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-primary/60 px-2">تصنيف الخبر</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {KINDS.map(k => (
                     <button key={k.key} type="button" onClick={() => setForm({...form, kind: k.key})} className={cn("py-3 rounded-2xl border-2 font-black text-xs transition-all", form.kind === k.key ? "bg-primary text-white border-primary shadow-lg" : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted")}>{k.label}</button>
                   ))}
                </div>
             </div>
             <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="عنوان الخبر..." className="w-full h-16 px-8 rounded-3xl bg-muted/30 border border-border font-black text-xl focus:ring-4 focus:ring-primary/5 transition-all" required />
             <textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} placeholder="اكتب تفاصيل الخبر هنا..." rows={5} className="w-full p-8 rounded-[40px] bg-muted/30 border border-border font-bold text-lg focus:ring-4 focus:ring-primary/5 transition-all resize-none" required />
             <div className="flex gap-4">
                <button type="button" onClick={onClose} className="flex-1 py-5 rounded-[28px] font-black text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
                <button disabled={saving} type="submit" className="flex-[2] btn-gold py-5 rounded-[28px] font-black text-xl shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3">
                   {saving ? <Loader2 className="animate-spin size-6" /> : <Send size={24} />} <span>نشر الخبر</span>
                </button>
             </div>
          </form>
       </motion.div>
    </div>
  );
}
