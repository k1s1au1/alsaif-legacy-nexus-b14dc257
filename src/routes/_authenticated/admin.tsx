import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BackgroundUploader } from "@/components/background-uploader";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import {
  Shield,
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
  Plane,
  CalendarDays,
  Megaphone,
  Pencil
} from "lucide-react";

import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { approveAccountRequest } from "@/lib/api/account-requests.functions";
import { deleteMemberAccount } from "@/lib/api/members-admin.functions";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
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

type ReqRow = {
  id: string;
  first_name: string;
  father_name: string | null;
  grandfather_name: string | null;
  phone: string;
  email: string;
  status: string;
  note: string | null;
  created_at: string;
};

const REQ_TABS = [
  { key: "pending", label: "بانتظار المراجعة" },
  { key: "approved", label: "طلبات مقبولة" },
  { key: "rejected", label: "طلبات مرفوضة" },
];

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  if (role === "chairman") return "رئيس المجلس";
  if (role === "head_meetings") return "مسؤول الاجتماعات";
  if (role === "head_events") return "مسؤول المناسبات";
  if (role === "head_trips") return "مسؤول الترفيه";
  if (role === "head_finance") return "مسؤول الصندوق";
  if (role === "head_heritage") return "مسؤول إرث السيف";
  return "عضو";
}

function AdminPage() {
  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: "...", role: "...", initial: "ص", avatarPath: null as string | null });
  const [isPriv, setIsPriv] = useState(false);
  const [reqTab, setReqTab] = useState("pending");
  const [pendingReqs, setPendingReqs] = useState<ReqRow[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requests" | "members" | "announcements">("requests");
  const [reqCounts, setReqCounts] = useState<Record<string, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [memberSearch, setMemberSearch] = useState("");
  const dynamicLogo = useSiteLogo();

  // Announcement State
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annDraft, setAnnDraft] = useState({ id: "", title: "", body: "" });
  const [annImage, setAnnImage] = useState<File | null>(null);
  const [annImagePreview, setAnnImagePreview] = useState<string | null>(null);
  const [annSaving, setAnnSaving] = useState(false);

  const approveFn = useServerFn(approveAccountRequest);
  const deleteMemberFn = useServerFn(deleteMemberAccount);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setMeId(auth.user.id);

      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
      ]);

      const rs = (roles ?? []).map(r => r.role);
      const isA = rs.includes("admin") || rs.includes("manager") || rs.includes("chairman");
      setIsPriv(isA);

      if (p) {
        setProfile({
          name: p.arabic_name || p.full_name || "عضو",
          role: rs.includes("admin") ? "مسؤول النظام" : "مشرف",
          initial: (p.arabic_name?.[0] || "ع").toUpperCase(),
          avatarPath: p.avatar_url
        });
      }

      if (isA) {
        try {
          const [{ data: reqs }, { data: mems, error: memErr }, { data: anns }] = await Promise.all([
            supabase.from("account_requests").select("*").order("created_at", { ascending: false }),
            supabase.from("profiles").select("*, user_roles(role)").order("full_name"),
            supabase.from("majlis_posts").select("*").eq("kind", "announcement").order("created_at", { ascending: false })
          ]);

          if (memErr) {
            console.error("Members fetch error:", memErr);
            // Fallback: try fetching without the join if it fails
            const { data: simpleMems } = await supabase.from("profiles").select("*").order("full_name");
            setMembers(simpleMems || []);
          } else {
            setMembers(mems || []);
          }

          setPendingReqs(reqs || []);
          setAnnouncements(anns || []);

          const counts = { pending: 0, approved: 0, rejected: 0 };
          (reqs || []).forEach(r => counts[r.status as keyof typeof counts]++);
          setReqCounts(counts);
        } catch (err) {
          console.error("Admin data load error:", err);
          toast.error("فشل تحميل بعض البيانات الإدارية");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateReqStatus = async (id: string, status: string) => {
    if (status === "approved") {
      const { error } = await approveFn({ data: { requestId: id } });
      if (error) { toast.error("فشل قبول الطلب"); return; }
    } else {
      await supabase.from("account_requests").update({ status }).eq("id", id);
    }
    toast.success("تم تحديث حالة الطلب");
    loadData();
  };

  const deleteReq = async (id: string) => {
    if (!confirm("حذف الطلب نهائياً؟")) return;
    await supabase.from("account_requests").delete().eq("id", id);
    toast.success("تم الحذف");
    loadData();
  };

  const assignRole = async (uid: string, role: string) => {
    await supabase.from("user_roles").delete().eq("user_id", uid);
    await supabase.from("user_roles").insert({ user_id: uid, role });
    toast.success("تمت ترقية العضو");
    loadData();
  };

  const deleteMember = async (uid: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب ${name} نهائياً؟`)) return;
    const { error } = await deleteMemberFn({ data: { userId: uid } });
    if (error) toast.error("فشل الحذف");
    else { toast.success("تم حذف الحساب بنجاح"); loadData(); }
  };

  // Announcement Handlers
  const handleSaveAnn = async () => {
    if (!annDraft.title.trim() || !annDraft.body.trim()) return;
    setAnnSaving(true);
    let body = annDraft.body;
    if (annImage) {
      const path = `anns/${crypto.randomUUID()}`;
      await supabase.storage.from("trip-images").upload(path, annImage);
      body = `---image:${path}\n${body}`;
    }

    if (annDraft.id) {
       await supabase.from("majlis_posts").update({ title: annDraft.title, body }).eq("id", annDraft.id);
    } else {
       await supabase.from("majlis_posts").insert({ title: annDraft.title, body, kind: "announcement", author_id: meId });
    }
    toast.success("تم حفظ الإعلان");
    setAnnDraft({ id: "", title: "", body: "" });
    setAnnImage(null);
    setAnnImagePreview(null);
    setShowAnnForm(false);
    setAnnSaving(false);
    loadData();
  };

  if (loading && !profile.name) return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin size-10 text-primary" /></div>;

  const filteredMembers = members.filter(m => {
    const fn = (m.full_name || "").toLowerCase();
    const an = (m.arabic_name || "").toLowerCase();
    const s = memberSearch.toLowerCase();
    return fn.includes(s) || an.includes(s);
  });

  return (
    <AppShell title="الإدارة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">

        <section className="animate-fade-up px-4 md:px-0">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-primary via-emerald-950 to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
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
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">إدارة المجلس</span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">لوحة الإدارة</h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">إدارة طلبات الانضمام، الصلاحيات، وإعدادات الهوية البصرية.</p>
              </div>
              <div className="size-16 md:size-28 rounded-2xl md:rounded-[36px] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl self-center md:self-auto shrink-0 group-hover:rotate-12 transition-transform duration-700">
                <Shield className="size-8 md:size-14 text-gold-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </section>

        {!isPriv ? (
          <div className="card-surface p-20 flex flex-col items-center text-center gap-6 border-dashed opacity-60 animate-fade-up">
             <div className="size-20 rounded-[40px] bg-muted/50 flex items-center justify-center text-muted-foreground"><Shield size={40} /></div>
             <p className="text-xl font-black">الدخول محدود لمسؤولي النظام فقط.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-3xl border border-border/40 overflow-x-auto no-scrollbar mx-4 md:mx-0">
               <button onClick={() => setTab("requests")} className={cn("px-8 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0", tab === "requests" ? "bg-primary text-white shadow-xl" : "text-muted-foreground hover:bg-muted")}>
                 <UserPlus size={18} /> طلبات العضوية
               </button>
               <button onClick={() => setTab("members")} className={cn("px-8 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0", tab === "members" ? "bg-primary text-white shadow-xl" : "text-muted-foreground hover:bg-muted")}>
                 <Users size={18} /> إدارة الأعضاء
               </button>
               <button onClick={() => setTab("announcements")} className={cn("px-8 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0", tab === "announcements" ? "bg-primary text-white shadow-xl" : "text-muted-foreground hover:bg-muted")}>
                 <Megaphone size={18} /> الإعلانات
               </button>
            </div>

            {tab === "requests" && (
              <section className="space-y-8 animate-fade-up">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">تصنيف الطلبات</h3>
                      <div className="h-px w-24 bg-border/60" />
                    </div>
                    <div className="flex items-center gap-2">
                       {REQ_TABS.map((t) => (
                         <button key={t.key} onClick={() => setReqTab(t.key)} className={cn("px-5 py-2 rounded-full text-xs font-black transition-all border", reqTab === t.key ? "bg-primary text-white border-primary shadow-lg" : "bg-card text-muted-foreground border-border hover:bg-muted")}>
                           {t.label} <span className="ms-2 opacity-50">{reqCounts[t.key]}</span>
                         </button>
                       ))}
                    </div>
                  </div>
                  <div className="grid gap-6">
                    {pendingReqs.filter(r => r.status === reqTab).map(r => <RequestCard key={r.id} req={r} onStatus={updateReqStatus} onDelete={deleteReq} />)}
                    {pendingReqs.filter(r => r.status === reqTab).length === 0 && <div className="p-20 text-center text-muted-foreground italic bg-muted/20 rounded-[40px] border-2 border-dashed">لا توجد طلبات في هذا القسم حالياً.</div>}
                  </div>
              </section>
            )}

            {tab === "members" && (
              <section className="space-y-8 animate-fade-up">
                 <div className="relative">
                    <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                    <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="ابحث عن عضو بالاسم..." className="w-full h-16 pr-14 pl-8 rounded-3xl bg-card border-2 border-border/40 focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all font-bold" />
                 </div>
                 <div className="grid grid-cols-1 gap-4">
                    {filteredMembers.map(m => (
                      <MemberAdminRow
                        key={m.id}
                        member={m}
                        meId={meId}
                        currentRole={Array.isArray(m.user_roles) ? m.user_roles[0]?.role : (m.user_roles?.role || 'member')}
                        onAssignRole={assignRole}
                        onDelete={deleteMember}
                        fullName={m.arabic_name || m.full_name || "عضو"}
                      />
                    ))}
                    {filteredMembers.length === 0 && !loading && (
                      <div className="p-20 text-center bg-muted/10 rounded-[40px] border-2 border-dashed text-muted-foreground italic">
                        لا توجد نتائج مطابقة للبحث أو قائمة الأعضاء فارغة.
                      </div>
                    )}
                 </div>
              </section>
            )}

            {tab === "announcements" && (
              <section className="animate-fade-up">
                 <AnnouncementsManager
                   list={announcements}
                   formOpen={showAnnForm}
                   onOpenForm={() => { setAnnDraft({ id: "", title: "", body: "" }); setAnnImage(null); setAnnImagePreview(null); setShowAnnForm(true); }}
                   onCloseForm={() => setShowAnnForm(false)}
                   draft={annDraft}
                   setDraft={setAnnDraft}
                   imagePreview={annImagePreview}
                   onPickImage={(f) => { setAnnImage(f); setAnnImagePreview(URL.createObjectURL(f)); }}
                   onSave={handleSaveAnn}
                   onEdit={(a) => { setAnnDraft({ id: a.id, title: a.title, body: a.body.replace(/^---image:.*\n/, "") }); setAnnImagePreview(null); setShowAnnForm(true); }}
                   onDelete={async (id) => { if (confirm("حذف الإعلان؟")) { await supabase.from("majlis_posts").delete().eq("id", id); loadData(); } }}
                   saving={annSaving}
                 />
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function RoleToggleBtn({ active, onClick, icon, label, activeClass }: any) {
  return (
    <button onClick={onClick} disabled={active} className={cn("px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all duration-300 border", active ? cn("border-transparent shadow-lg scale-105", activeClass) : "bg-white text-muted-foreground border-border/60 hover:bg-muted hover:text-primary")}>
      {icon} <span>{label}</span>
    </button>
  );
}

function RequestCard({ req, onStatus, onDelete }: { req: ReqRow; onStatus: any; onDelete: any }) {
  const name = [req.first_name, req.father_name, req.grandfather_name].filter(Boolean).join(" ");
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-8 group">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
             <div className="size-16 rounded-[22px] bg-primary/5 border-2 border-gold-primary/10 flex items-center justify-center text-2xl font-black text-primary shadow-inner shrink-0">{req.first_name[0]}</div>
             <div className="space-y-2">
                <h4 className="text-xl font-black text-primary tracking-tight">{name}</h4>
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground opacity-70">
                   <span className="flex items-center gap-1.5" dir="ltr"><Phone className="size-3.5" /> {req.phone}</span>
                   <span className="flex items-center gap-1.5" dir="ltr"><Mail className="size-3.5" /> {req.email}</span>
                   <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {new Date(req.created_at).toLocaleDateString("ar-SA")}</span>
                </div>
                {req.note && <p className="text-sm font-bold text-muted-foreground/80 bg-muted/30 p-4 rounded-2xl border border-border/40 mt-3 italic">"{req.note}"</p>}
             </div>
          </div>
          <div className="flex items-center gap-3 self-end md:self-center">
             {req.status === "pending" && (
                <>
                  <button onClick={() => onStatus(req.id, "approved")} className="px-8 py-3 rounded-2xl bg-emerald-500 text-white font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"><Check className="size-4" strokeWidth={3} /> قبول</button>
                  <button onClick={() => onStatus(req.id, "rejected")} className="size-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><X size={5} /></button>
                </>
             )}
             <button onClick={() => onDelete(req.id)} className="size-12 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center hover:bg-primary hover:text-white transition-all"><Trash2 size={5} /></button>
          </div>
       </div>
    </motion.div>
  );
}

function MemberAdminRow({ member, meId, currentRole, onAssignRole, onDelete, fullName }: any) {
  const isMe = member.id === meId;
  const roles = [
    { key: "admin", label: "مسؤول" },
    { key: "manager", label: "مدير" },
    { key: "chairman", label: "رئيس" },
    { key: "head_meetings", label: "الاجتماعات" },
    { key: "head_events", label: "الفعاليات" },
    { key: "head_trips", label: "الترفيه" },
    { key: "head_finance", label: "المالية" },
    { key: "head_heritage", label: "الإرث" },
    { key: "member", label: "عضو" },
  ];

  return (
    <div className="card-surface p-4 md:p-5 hover:bg-primary/5 transition-all group">
       <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <div className="size-12 rounded-[16px] border-2 border-gold-primary/20 overflow-hidden shadow-lg relative shrink-0">
                <UserAvatar path={member.avatar_url} name={fullName} className="size-full" userId={member.id} />
                {isMe && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><UserIcon className="size-4 text-white" /></div>}
             </div>
             <div className="min-w-0">
                <h4 className="text-base font-black text-primary truncate tracking-tight">{fullName} {isMe && <span className="text-[10px] text-gold-primary opacity-60 mr-2">(أنت)</span>}</h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{roleLabel(currentRole)}</p>
             </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
             <select
               value={currentRole}
               onChange={(e) => onAssignRole(member.id, e.target.value)}
               className="bg-muted/50 border border-border/40 rounded-xl px-4 py-2 text-xs font-black text-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none"
             >
               {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
             </select>
             {!isMe && currentRole !== "admin" && <button onClick={() => onDelete(member.id, fullName)} className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>}
          </div>
       </div>
    </div>
  );
}

function AnnouncementsManager({ list, formOpen, onOpenForm, onCloseForm, draft, setDraft, imagePreview, onPickImage, onSave, onEdit, onDelete, saving }: any) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-primary tracking-tight">إدارة الإعلانات</h3>
          <p className="text-sm font-bold text-muted-foreground opacity-60">نشر وتعديل الإعلانات التي تظهر في اللوحة الرئيسية للمجلس.</p>
        </div>
        <button onClick={onOpenForm} className="btn-gold px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-black shadow-xl">
          <Plus size={18} strokeWidth={3} /> <span>إعلان جديد</span>
        </button>
      </div>
      <AnimatePresence>
        {formOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card-surface p-8 space-y-6 border-gold-primary/20">
              <div className="flex items-center justify-between">
                 <h4 className="text-lg font-black text-primary">تفاصيل الإعلان</h4>
                 <button onClick={onCloseForm} className="size-10 rounded-full bg-muted flex items-center justify-center"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                 <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="عنوان جذاب..." className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-black text-base focus:ring-4 focus:ring-primary/5 transition-all" />
                 <textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} placeholder="اكتب المحتوى هنا..." rows={4} className="w-full p-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:ring-4 focus:ring-primary/5 transition-all resize-none" />
                 <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-[32px] cursor-pointer hover:bg-primary/5 transition-all">
                    {imagePreview ? <img src={imagePreview} className="h-40 w-full object-contain rounded-2xl" alt="Preview" /> : <><ImageIcon className="size-8 opacity-30" /><span className="text-xs font-bold text-muted-foreground">صورة الإعلان</span></>}
                    <input type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f); }} />
                 </label>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                 <button onClick={onCloseForm} className="px-8 py-3 rounded-xl font-black text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
                 <button disabled={saving} onClick={onSave} className="btn-gold px-12 py-3 rounded-xl font-black flex items-center gap-2 shadow-xl">
                   {saving ? <Loader2 className="animate-spin size-5" /> : <Check size={20} strokeWidth={3} />} <span>نشر</span>
                 </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {list.map((a: any) => (
          <div key={a.id} className="card-surface p-6 flex flex-col justify-between group">
             <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                   <h4 className="text-lg font-black text-primary line-clamp-2">{a.title}</h4>
                   <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(a)} className="size-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all"><Pencil size={16} /></button>
                      <button onClick={() => onDelete(a.id)} className="size-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={16} /></button>
                   </div>
                </div>
                <p className="text-sm font-bold text-muted-foreground line-clamp-3 leading-relaxed opacity-70">{a.body.replace(/^---image:.*\n/, "")}</p>
             </div>
             <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{new Date(a.created_at).toLocaleDateString("ar-SA")}</span>
                <div className="flex items-center gap-2 text-gold-primary">
                   <Megaphone className="size-4" /> <span className="text-[10px] font-black uppercase tracking-widest">إعلان منشور</span>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
