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
  CalendarPlus,
  Palette,
  ChevronLeft,
  Users,
  Search,
} from "lucide-react";

import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { approveAccountRequest } from "@/lib/api/account-requests.functions";
import { deleteMemberAccount } from "@/lib/api/members-admin.functions";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الإدارة — السيف" },
      { name: "description", content: "لوحة إدارة النظام والأعضاء." },
    ],
  }),
  component: AdminPage,
});

type ReqRow = {
  id: string;
  first_name: string;
  father_name: string;
  grandfather_name: string;
  phone: string;
  email: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type AppRole = "admin" | "manager" | "member";

type MemberRow = {
  id: string;
  first_name: string | null;
  father_name: string | null;
  grandfather_name: string | null;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  roles: AppRole[];
};

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مشرف";
  return "عضو";
}

const REQ_TABS: { key: ReqRow["status"]; label: string }[] = [
  { key: "pending", label: "قيد المراجعة" },
  { key: "approved", label: "مقبولة" },
  { key: "rejected", label: "مرفوضة" },
];

type Section = "requests" | "roles" | "site";

function AdminPage() {
  const [profile, setProfile] = useState({
    name: "عضو العائلة",
    role: "عضو",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPriv, setIsPriv] = useState(false);
  const [section, setSection] = useState<Section>("requests");
  const [reqTab, setReqTab] = useState<ReqRow["status"]>("pending");
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string>("");
  const approveFn = useServerFn(approveAccountRequest);
  const deleteAccountFn = useServerFn(deleteMemberAccount);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("account_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as ReqRow[]);
  }, []);

  const loadMembers = useCallback(async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, father_name, grandfather_name, arabic_name, full_name, avatar_url")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (!profiles) return;
    const roleMap = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      roleMap.set(r.user_id, arr);
    });
    setMembers(
      profiles.map((p) => ({
        ...p,
        roles: roleMap.get(p.id) ?? ["member"],
      })) as MemberRow[],
    );
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setMeId(u.user.id);
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const name = p?.arabic_name?.trim() || p?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو العائلة";
      const rs = (roles ?? []).map((r) => r.role);
      const admin = rs.includes("admin");
      const priv = admin || rs.includes("manager");
      setProfile({
        name,
        role: roleLabel(rs[0] ?? null),
        initial: (name[0] ?? "س").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
      });
      setIsAdmin(admin);
      setIsPriv(priv);
      if (priv) await Promise.all([load(), loadMembers()]);
      setLoading(false);
    })();

    const ch = supabase
      .channel("admin-page-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "account_requests" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => loadMembers())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, loadMembers]);

  async function setReqStatus(id: string, status: "approved" | "rejected") {
    if (status === "approved") {
      try {
        await approveFn({ data: { id } });
        toast.success("تم قبول الطلب وإنشاء الحساب");
        load();
        loadMembers();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر إنشاء الحساب");
      }
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("account_requests")
      .update({ status, reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("تعذر التحديث");
    else toast.success("تم الرفض");
  }

  async function removeReq(id: string) {
    if (!confirm("حذف الطلب نهائياً؟")) return;
    const { error } = await supabase.from("account_requests").delete().eq("id", id);
    if (error) toast.error("تعذر الحذف");
    else toast.success("تم الحذف");
  }

  async function assignRole(userId: string, role: AppRole) {
    if (userId === meId && role !== "admin") {
      if (!confirm("سيتم تعديل صلاحياتك الشخصية. هل أنت متأكد؟")) return;
    }
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) {
      toast.error("تعذر تحديث الصلاحيات");
      return;
    }
    if (role !== "member") {
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (insErr) {
        toast.error("تعذر تعيين الدور");
        return;
      }
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: "member" });
    }
    toast.success("تم تحديث الصلاحيات");
    loadMembers();
  }

  async function deleteMember(userId: string, name: string) {
    if (userId === meId) {
      toast.error("لا يمكنك حذف حسابك الخاص");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف حساب "${name}" نهائياً؟ لا يمكن التراجع.`)) return;
    try {
      await deleteAccountFn({ data: { userId } });
      toast.success("تم حذف الحساب");
      loadMembers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر حذف الحساب");
    }
  }

  const filteredReqs = rows.filter((r) => r.status === reqTab);
  const reqCounts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.trim();
    if (!q) return true;
    const name = `${m.first_name ?? ""} ${m.father_name ?? ""} ${m.grandfather_name ?? ""} ${m.arabic_name ?? ""} ${m.full_name ?? ""}`;
    return name.includes(q);
  });

  function memberFullName(m: MemberRow) {
    const triple = [m.first_name, m.father_name, m.grandfather_name].filter(Boolean).join(" ");
    return triple || m.arabic_name || m.full_name || "عضو";
  }

  function highestRole(roles: AppRole[]): AppRole {
    if (roles.includes("admin")) return "admin";
    if (roles.includes("manager")) return "manager";
    return "member";
  }

  return (
    <AppShell title="الإدارة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Royal Header Section */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-up">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="size-1 w-10 bg-gold-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">إدارة المجلس</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary">لوحة الإدارة</h2>
            <p className="text-muted-foreground font-bold text-lg opacity-70">إدارة طلبات الانضمام، الصلاحيات، وإعدادات الهوية البصرية.</p>
          </div>
          <div className="size-20 rounded-[32px] bg-primary/5 border-2 border-gold-primary/20 flex items-center justify-center shadow-xl md:mb-2">
            <Shield className="size-10 text-gold-primary" strokeWidth={1.5} />
          </div>
        </section>

        {!isPriv ? (
          <div className="card-surface p-20 flex flex-col items-center text-center gap-6 border-dashed opacity-60 animate-fade-up">
             <div className="size-20 rounded-[40px] bg-muted/50 flex items-center justify-center text-muted-foreground"><Shield size={40} /></div>
             <div className="space-y-1">
                <p className="text-xl font-black">الدخول محدود</p>
                <p className="text-sm font-bold opacity-60">هذه الصفحة متاحة فقط لمسؤولي النظام ومديري مجلس العائلة.</p>
             </div>
          </div>
        ) : (
          <>
            {/* Section Switch Tabs */}
            <div className="flex sm:inline-flex items-center gap-2 p-1.5 bg-muted/30 rounded-2xl md:rounded-[32px] border border-border/40 w-full sm:w-auto overflow-x-auto no-scrollbar animate-fade-up" style={{ animationDelay: "100ms" }}>
              <NavTab
                active={section === "requests"}
                onClick={() => setSection("requests")}
                icon={<UserPlus className="size-4" />}
                label="الطلبات"
                badge={reqCounts.pending}
              />
              {isAdmin && (
                <NavTab
                  active={section === "roles"}
                  onClick={() => setSection("roles")}
                  icon={<UserCog className="size-4" />}
                  label="الصلاحيات"
                />
              )}
              <NavTab
                active={section === "site"}
                onClick={() => setSection("site")}
                icon={<Palette className="size-4" />}
                label="التخصيص"
              />
            </div>

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40"
                >
                  <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <p className="font-black">جاري تحميل بيانات الإدارة...</p>
                </motion.div>
              ) : section === "requests" ? (
                <motion.div
                  key="requests"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">تصنيف الطلبات</h3>
                      <div className="h-px w-24 bg-border/60" />
                    </div>
                    <div className="flex items-center gap-2">
                       {REQ_TABS.map((t) => (
                         <button
                           key={t.key}
                           onClick={() => setReqTab(t.key)}
                           className={cn(
                             "px-5 py-2 rounded-full text-xs font-black transition-all border",
                             reqTab === t.key
                               ? "bg-primary text-white border-primary shadow-lg"
                               : "bg-card text-muted-foreground border-border hover:bg-muted"
                           )}
                         >
                           {t.label}
                           <span className="ms-2 opacity-50">{reqCounts[t.key]}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="grid gap-6">
                    {filteredReqs.length === 0 ? (
                      <div className="card-surface p-20 flex flex-col items-center text-center gap-6 border-dashed opacity-40">
                        <Users className="size-16" strokeWidth={1} />
                        <p className="text-lg font-bold">لا توجد طلبات في هذا القسم حالياً</p>
                      </div>
                    ) : (
                      filteredReqs.map((r) => (
                        <RequestCard
                          key={r.id}
                          req={r}
                          onStatus={setReqStatus}
                          onDelete={removeReq}
                        />
                      ))
                    )}
                  </div>
                </motion.div>
              ) : section === "roles" ? (
                <motion.div
                  key="roles"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-primary tracking-tight">إدارة الصلاحيات</h3>
                      <p className="text-sm font-bold text-muted-foreground opacity-60">تعيين المسؤولين والمشرفين لمتابعة شؤون العائلة.</p>
                    </div>
                    <div className="relative group min-w-[300px]">
                      <Search className="size-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        placeholder="ابحث عن عضو بالعائلة..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="w-full bg-muted/30 border border-border rounded-2xl pr-11 pl-4 py-3.5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {filteredMembers.map((m) => (
                      <MemberAdminRow
                        key={m.id}
                        member={m}
                        meId={meId}
                        currentRole={highestRole(m.roles)}
                        onAssignRole={assignRole}
                        onDelete={deleteMember}
                        fullName={memberFullName(m)}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="site"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8"
                >
                  {/* Page Backgrounds Card */}
                  <div className="card-surface p-8 sm:p-10 space-y-8 relative overflow-hidden">
                    <div className="space-y-2 relative z-10">
                      <div className="size-12 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary mb-4 shadow-inner">
                        <ImageIcon className="size-6" />
                      </div>
                      <h3 className="text-2xl font-black text-primary">خلفيات الموقع</h3>
                      <p className="text-sm font-bold text-muted-foreground opacity-60">قم بتخصيص المظهر العام لصفحات المجلس.</p>
                    </div>
                    <div className="grid gap-6 relative z-10">
                       <div className="space-y-4">
                          <p className="text-xs font-black uppercase tracking-widest opacity-40">صفحة الدخول</p>
                          <BackgroundUploader inline settingKey="auth_bg" label="تغيير خلفية تسجيل الدخول" />
                       </div>
                       <div className="space-y-4 pt-6 border-t border-border/40">
                          <p className="text-xs font-black uppercase tracking-widest opacity-40">لوحة التحكم</p>
                          <BackgroundUploader inline settingKey="dashboard_bg" label="تغيير خلفية اللوحة الرئيسية" />
                       </div>
                    </div>
                  </div>

                  {/* Meetings Actions Card */}
                  <div className="card-surface p-8 sm:p-10 space-y-8 flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-inner">
                          <CalendarPlus className="size-6" />
                        </div>
                        <h3 className="text-2xl font-black text-primary">إدارة الاجتماعات</h3>
                        <p className="text-sm font-bold text-muted-foreground opacity-60">جدولة لقاءات عائلية جديدة ودعوة الأعضاء.</p>
                      </div>
                      <div className="p-6 rounded-[28px] bg-primary/5 border border-primary/10 space-y-2">
                         <p className="text-xs font-black text-primary uppercase tracking-widest">تنبيه</p>
                         <p className="text-sm font-bold text-primary/70 leading-relaxed">سيتم إرسال إشعار فوري لجميع أفراد العائلة المسجلين عند تأكيد إنشاء الاجتماع.</p>
                      </div>
                    </div>
                    <Link
                      to="/meetings"
                      hash="new"
                      className="btn-gold w-full py-5 rounded-[28px] text-center text-lg font-black shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-3"
                    >
                      <Plus className="size-6" strokeWidth={3} />
                      إنشاء اجتماع جديد
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </AppShell>
  );
}

function NavTab({ active, onClick, icon, label, badge }: any) {
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
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={cn(
          "min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center",
          active ? "bg-white text-primary" : "bg-primary text-white"
        )}>{badge}</span>
      )}
    </button>
  );
}

function RequestCard({ req, onStatus, onDelete }: { req: ReqRow; onStatus: any; onDelete: any }) {
  const fullName = `${req.first_name} ${req.father_name} ${req.grandfather_name}`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-8 group">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
             <div className="size-16 rounded-[22px] bg-primary/5 border-2 border-gold-primary/10 flex items-center justify-center text-2xl font-black text-primary shadow-inner shrink-0">
               {(req.first_name || "ع")[0]}
             </div>
             <div className="space-y-2">
                <h4 className="text-xl font-black text-primary tracking-tight">{fullName}</h4>
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground opacity-70">
                   <span className="flex items-center gap-1.5" dir="ltr"><Phone className="size-3.5" /> {req.phone}</span>
                   <span className="flex items-center gap-1.5" dir="ltr"><Mail className="size-3.5" /> {req.email}</span>
                   <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {new Date(req.created_at).toLocaleDateString("ar-SA")}</span>
                </div>
                {req.note && (
                  <p className="text-sm font-bold text-muted-foreground/80 bg-muted/30 p-4 rounded-2xl border border-border/40 mt-3 italic">"{req.note}"</p>
                )}
             </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center">
             {req.status === "pending" && (
                <>
                  <button onClick={() => onStatus(req.id, "approved")} className="px-8 py-3 rounded-2xl bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                    <Check className="size-4" strokeWidth={3} /> قبول العضوية
                  </button>
                  <button onClick={() => onStatus(req.id, "rejected")} className="size-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm">
                    <X className="size-5" />
                  </button>
                </>
             )}
             <button onClick={() => onDelete(req.id)} className="size-12 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                <Trash2 className="size-5" />
             </button>
          </div>
       </div>
    </motion.div>
  );
}

function MemberAdminRow({ member, meId, currentRole, onAssignRole, onDelete, fullName }: any) {
  const isMe = member.id === meId;

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
             <RoleToggleBtn active={currentRole === "admin"} onClick={() => onAssignRole(member.id, "admin")} icon={<Crown className="size-3.5" />} label="مسؤول" activeClass="bg-gold-primary text-white shadow-gold-primary/30" />
             <RoleToggleBtn active={currentRole === "manager"} onClick={() => onAssignRole(member.id, "manager")} icon={<Star className="size-3.5" />} label="مشرف" activeClass="bg-emerald-600 text-white shadow-emerald-600/30" />
             <RoleToggleBtn active={currentRole === "member"} onClick={() => onAssignRole(member.id, "member")} icon={<UserIcon className="size-3.5" />} label="عضو" activeClass="bg-primary text-white shadow-primary/30" />

             {!isMe && currentRole !== "admin" && (
                <button onClick={() => onDelete(member.id, fullName)} className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm">
                   <Trash2 className="size-4" />
                </button>
             )}
          </div>
       </div>
    </div>
  );
}

function RoleToggleBtn({ active, onClick, icon, label, activeClass }: any) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className={cn(
        "px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all duration-300 border",
        active
          ? cn("border-transparent shadow-lg scale-105", activeClass)
          : "bg-white text-muted-foreground border-border/60 hover:bg-muted hover:text-primary"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
