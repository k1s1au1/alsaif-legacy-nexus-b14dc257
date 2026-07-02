import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackgroundUploader } from "@/components/background-uploader";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import {
  Shield,
  ShieldCheck,
  UserPlus,
  Check,
  X,
  Trash2,
  Phone,
  Mail,
  Loader2,
  UserCog,
  Crown,
  Star,
  User as UserIcon,
  Image as ImageIcon,
  Palette,
  Clock,
  Users,
  Search,
  Plus,
  BarChart3,
  Megaphone,
  Newspaper,
  Pencil
} from "lucide-react";

import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { approveAccountRequest } from "@/lib/api/account-requests.functions";
import { deleteMemberAccount } from "@/lib/api/members-admin.functions";
import { assignUserRole } from "@/lib/api/roles.functions";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الإدارة — السيف" },
      { name: "description", content: "مركز إدارة عائلة السيف." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { userId: meId, isAdmin, isChairman, isPrivileged: isA } = useUserRole();
  const [profile, setProfile] = useState<any>(null);
  const [pendingReqs, setPendingReqs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requests" | "members" | "polls" | "bugs">("requests");
  const [memberSearch, setMemberSearch] = useState("");
  const dynamicLogo = useSiteLogo();

  const approveFn = useServerFn(approveAccountRequest);
  const assignRoleFn = useServerFn(assignUserRole);
  const deleteMemberFn = useServerFn(deleteMemberAccount);

  const loadData = useCallback(async () => {
    if (!meId) return;
    setLoading(true);
    try {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", meId).maybeSingle();
      if (p) setProfile(p);

      if (isA) {
        const [{ data: reqs }, { data: mems }, { data: allRoles }, { data: pollList }, { data: bugs }] = await Promise.all([
          supabase.from("account_requests").select("*").order("created_at", { ascending: false }),
          supabase.from("profiles").select("*").order("full_name"),
          supabase.from("user_roles").select("*"),
          supabase.from("majlis_posts").select("*").like("body", "%---poll:%").order("created_at", { ascending: false }),
          supabase.from("bug_reports" as any).select("*").order("created_at", { ascending: false }),
        ]);

        setPendingReqs(reqs || []);
        setMembers((mems || []).map(m => ({
          ...m,
          primaryRole: (allRoles || []).find(r => r.user_id === m.id)?.role || 'member'
        })));
        setPolls(pollList || []);
        setBugReports(bugs || []);
      }
    } catch (e) {
      console.error("Admin Load Error", e);
    } finally {
      setLoading(false);
    }
  }, [meId, isA]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && !profile) return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <AppShell title="الإدارة" user={{ name: profile?.arabic_name || "عضو", role: roleLabel(isChairman ? "chairman" : isAdmin ? "admin" : "member"), initial: "ع" } as any}>
      <div className="max-w-6xl mx-auto space-y-10 pb-24 px-4 md:px-0" dir="rtl">

        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-primary via-emerald-950 to-black p-8 md:p-14 text-white shadow-2xl border border-white/5 group">
            <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none transition-transform duration-1000 group-hover:scale-110">
              <div className="size-32 md:size-64 logo-alsaif-banner" style={{ "--logo-url": `url(${dynamicLogo || alsaifMark?.url || ""})` } as any} />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-0.5 w-10 bg-gold-primary" />
                <span className="text-xs font-black uppercase tracking-[0.4em] text-gold-primary">إدارة المجلس</span>
              </div>
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter">لوحة الإدارة</h2>
              <p className="text-white/60 font-bold text-sm md:text-xl max-w-2xl">إدارة طلبات الانضمام، صلاحيات الأعضاء، ونظام الشورى.</p>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-3xl border border-border/40 overflow-x-auto no-scrollbar">
          <button onClick={() => setTab("requests")} className={cn("px-8 py-3.5 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0", tab === "requests" ? "bg-primary text-white shadow-xl" : "text-muted-foreground hover:bg-muted")}>
            <UserPlus size={18} /> الطلبات ({pendingReqs.filter(r => r.status === 'pending').length})
          </button>
          <button onClick={() => setTab("members")} className={cn("px-8 py-3.5 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0", tab === "members" ? "bg-primary text-white shadow-xl" : "text-muted-foreground hover:bg-muted")}>
            <Users size={18} /> الأعضاء ({members.length})
          </button>
          <button onClick={() => setTab("polls")} className={cn("px-8 py-3.5 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0", tab === "polls" ? "bg-primary text-white shadow-xl" : "text-muted-foreground hover:bg-muted")}>
            <BarChart3 size={18} /> الشورى
          </button>
          <button onClick={() => setTab("bugs")} className={cn("px-8 py-3.5 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0", tab === "bugs" ? "bg-primary text-white shadow-xl" : "text-muted-foreground hover:bg-muted")}>
            <Shield size={18} /> البلاغات
          </button>
        </div>

        <div className="grid gap-6">
          {tab === "requests" && pendingReqs.filter(r => r.status === 'pending').map(r => (
            <div key={r.id} className="card-surface p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
               <div className="flex items-start gap-5">
                  <div className="size-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center text-xl font-black text-primary shadow-inner shrink-0">{r.first_name[0]}</div>
                  <div className="space-y-1">
                     <h4 className="text-xl font-black text-primary">{r.first_name} {r.father_name}</h4>
                     <p className="text-xs font-bold text-muted-foreground opacity-70" dir="ltr">{r.phone} · {r.email}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 self-end md:self-center">
                  <button onClick={() => approveFn({ data: { id: r.id } }).then(() => loadData())} className="px-8 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-lg hover:scale-105 transition-all flex items-center gap-2"><Check size={16} strokeWidth={3} /> قبول</button>
                  <button onClick={() => { if(confirm("حذف الطلب؟")) supabase.from("account_requests").delete().eq("id", r.id).then(() => loadData()) }} className="size-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><X size={20} /></button>
               </div>
            </div>
          ))}

          {tab === "members" && (
            <div className="space-y-6">
               <div className="relative">
                  <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                  <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="ابحث عن عضو..." className="w-full h-16 pr-14 pl-8 rounded-3xl bg-card border-2 border-border/40 focus:border-primary transition-all font-bold" />
               </div>
               <div className="grid grid-cols-1 gap-4">
                  {members.filter(m => (m.arabic_name||m.full_name||"").includes(memberSearch)).map(m => (
                    <div key={m.id} className="card-surface p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                       <div className="flex items-center gap-4">
                          <UserAvatar path={m.avatar_url} name={m.arabic_name} className="size-12 rounded-xl shadow-lg" userId={m.id} />
                          <div>
                             <h4 className="text-base font-black text-primary">{m.arabic_name || m.full_name}</h4>
                             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{roleLabel(m.primaryRole)}</p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          {['member', 'admin', 'chairman'].map(role => (
                            <button key={role} onClick={() => assignRoleFn({ data: { userId: m.id, role } }).then(() => loadData())} className={cn("px-4 py-2 rounded-xl text-[10px] font-black border transition-all", m.primaryRole === role ? "bg-primary text-white border-primary shadow-md" : "text-muted-foreground hover:bg-muted")}>{roleLabel(role)}</button>
                          ))}
                          {m.id !== meId && <button onClick={() => deleteMemberFn({ data: { userId: m.id } }).then(() => loadData())} className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {tab === "polls" && (
            <PollsManager list={polls} meId={meId} onRefresh={loadData} />
          )}

          {tab === "bugs" && (
            <div className="grid gap-4">
               {bugReports.map(b => (
                 <div key={b.id} className="card-surface p-6 space-y-4">
                    <div className="flex justify-between items-start">
                       <div>
                          <h4 className="font-black text-primary">بلاغ فني</h4>
                          <p className="text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleString("ar-SA")}</p>
                       </div>
                       <button onClick={() => supabase.from("bug_reports" as any).delete().eq("id", b.id).then(() => loadData())} className="size-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center"><Trash2 size={16} /></button>
                    </div>
                    <p className="text-sm font-bold text-foreground">{b.body}</p>
                    {b.image_url && <img src={b.image_url} className="max-h-64 rounded-xl border border-border" alt="" />}
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function PollsManager({ list, meId, onRefresh }: any) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ title: "", question: "", options: ["", ""] });

  const handleSave = async () => {
    if (!draft.title || !draft.question || draft.options.some(o => !o)) return toast.error("يرجى إكمال البيانات");
    const pollData = { question: draft.question, options: draft.options };
    const { error } = await supabase.from("majlis_posts").insert({
      title: draft.title,
      body: `---poll:${JSON.stringify(pollData)}---`,
      kind: "announcement",
      author_id: meId
    });
    if (!error) { toast.success("تم نشر التصويت"); setShowForm(false); setDraft({ title: "", question: "", options: ["", ""] }); onRefresh(); }
  };

  return (
    <div className="space-y-8">
       <div className="flex justify-end">
          <button onClick={() => setShowForm(!showForm)} className="btn-gold px-8 py-3.5 rounded-2xl flex items-center gap-3 text-sm font-black shadow-xl">
            <Plus size={20} strokeWidth={3} /> <span>تصويت جديد</span>
          </button>
       </div>
       <AnimatePresence>
         {showForm && (
           <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="card-surface p-8 space-y-6">
              <input value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})} placeholder="العنوان..." className="w-full h-14 px-6 rounded-2xl bg-muted/40 border border-border font-black text-foreground" />
              <input value={draft.question} onChange={e => setDraft({...draft, question: e.target.value})} placeholder="السؤال..." className="w-full h-14 px-6 rounded-2xl bg-muted/40 border border-border font-bold text-foreground" />
              <div className="space-y-3">
                 {draft.options.map((opt, i) => (
                   <input key={i} value={opt} onChange={e => { const next = [...draft.options]; next[i] = e.target.value; setDraft({...draft, options: next}); }} placeholder={`الخيار ${i+1}`} className="w-full h-12 px-5 rounded-xl bg-muted/20 border border-border font-bold text-sm text-foreground" />
                 ))}
                 <button onClick={() => setDraft({...draft, options: [...draft.options, ""]})} className="text-xs font-black text-primary">+ إضافة خيار</button>
              </div>
              <button onClick={handleSave} className="w-full btn-gold py-4 rounded-2xl font-black">نشر للجميع</button>
           </motion.div>
         )}
       </AnimatePresence>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {list.map((p: any) => (
            <div key={p.id} className="card-surface p-6 flex flex-col justify-between group">
               <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <h4 className="text-lg font-black text-primary leading-tight line-clamp-2">{p.title}</h4>
                    <button onClick={() => { if(confirm("حذف؟")) supabase.from("majlis_posts").delete().eq("id", p.id).then(() => onRefresh()) }} className="size-9 rounded-lg bg-rose-500/10 text-rose-500 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex items-center gap-2 text-gold-primary">
                    <BarChart3 size={14} /> <span className="text-[10px] font-black uppercase tracking-[0.2em]">تصويت نشط</span>
                  </div>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
}
