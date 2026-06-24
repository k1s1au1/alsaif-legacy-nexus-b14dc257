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
  Clock,
  Users,
  Search,
  ImagePlus,
  Plus,
  ClipboardList,
  Plane,
  CalendarDays,
  UserCheck,
  Megaphone,
  Pencil
} from "lucide-react";

import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { approveAccountRequest } from "@/lib/api/account-requests.functions";
import { deleteMemberAccount } from "@/lib/api/members-admin.functions";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  first_name: string | null;
  father_name: string | null;
  grandfather_name: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type AppRole = "admin" | "manager" | "member" | "chairman" | "head_meetings" | "head_events" | "head_trips" | "head_finance" | "head_heritage";

type SpecialRole = "chairman" | "head_meetings" | "head_events" | "head_trips" | "head_finance" | "head_heritage";

const SPECIAL_ROLES: { key: SpecialRole; label: string; desc: string }[] = [
  { key: "chairman", label: "رئيس المجلس", desc: "شخص واحد فقط" },
  { key: "head_meetings", label: "مسؤول الاجتماعات", desc: "يمكن تعيين أكثر من شخص" },
  { key: "head_events", label: "مسؤول الفعاليات", desc: "يمكن تعيين أكثر من شخص" },
  { key: "head_trips", label: "مسؤول الرحلات", desc: "يمكن تعيين أكثر من شخص" },
  { key: "head_finance", label: "مسؤول المالية", desc: "يمكن تعيين أكثر من شخص" },
  { key: "head_heritage", label: "مسؤول إرث السيف", desc: "يمكن تعيين أكثر من شخص" },
];

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
  if (role === "chairman") return "رئيس المجلس";
  if (role === "head_meetings") return "مسؤول الاجتماعات";
  if (role === "head_events") return "مسؤول الفعاليات";
  if (role === "head_trips") return "مسؤول الرحلات";
  if (role === "head_finance") return "مسؤول المالية";
  if (role === "head_heritage") return "مسؤول إرث السيف";
  return "عضو";
}

const REQ_TABS: { key: ReqRow["status"]; label: string }[] = [
  { key: "pending", label: "قيد المراجعة" },
  { key: "approved", label: "مقبولة" },
  { key: "rejected", label: "مرفوضة" },
];

type Section = "requests" | "roles" | "attendance" | "announcements";

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
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [editingAnn, setEditingAnn] = useState<any>(null);
  const [annDraft, setAnnDraft] = useState({ title: "", body: "", image_path: "" });
  const [annImageFile, setAnnImageFile] = useState<File | null>(null);
  const [annImagePreview, setAnnImagePreview] = useState<string | null>(null);
  const [annSaving, setAnnSaving] = useState(false);

  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string>("");
  const approveFn = useServerFn(approveAccountRequest);
  const deleteAccountFn = useServerFn(deleteMemberAccount);

  const loadAnnouncements = useCallback(async () => {
    const { data } = await supabase.from("majlis_posts").select("*").eq("kind", "announcement").order("created_at", { ascending: false });
    setAnnouncements(data || []);
  }, []);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("account_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setRows(data as ReqRow[]);
    } catch (e) {
      console.error("Failed to load requests", e);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
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
    } catch (e) {
      console.error("Failed to load members", e);
    }
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
      if (priv) await Promise.all([load(), loadMembers(), loadAnnouncements()]);
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
    // Only remove base roles (admin/manager/member); keep special roles intact
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("role", ["admin", "manager", "member"] as any);
    if (delErr) {
      toast.error("تعذر تحديث الصلاحيات");
      return;
    }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role } as any);
    if (insErr) {
      toast.error("تعذر تعيين الدور");
      return;
    }
    toast.success("تم تحديث الصلاحيات");
    loadMembers();
  }

  async function assignSpecialRole(role: SpecialRole, userId: string, action: 'add' | 'remove') {
    if (role === "chairman" && action === "add") {
      // Remove previous chairman first
      await supabase.from("user_roles").delete().eq("role", "chairman" as any);
    }

    if (action === "add") {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role } as any);
      if (error) toast.error("تعذر تعيين المنصب");
      else toast.success("تم تعيين المنصب بنجاح");
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
      if (error) toast.error("تعذر إزالة المنصب");
      else toast.success("تمت الإزالة");
    }
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

        {/* Alsaif Header Section */}
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
                active={section === "announcements"}
                onClick={() => setSection("announcements")}
                icon={<Megaphone className="size-4" />}
                label="الإعلانات"
              />
              <NavTab
                active={section === "attendance"}
                onClick={() => setSection("attendance")}
                icon={<ClipboardList className="size-4" />}
                label="الحضور"
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

                  {/* Special positions (singleton roles) */}
                  <div className="card-surface p-6 sm:p-8 space-y-6 border-2 border-gold-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                        <Crown className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-primary">المناصب الخاصة</h4>
                        <p className="text-xs font-bold text-muted-foreground opacity-60">رئيس المجلس شخص واحد، أما مسؤولو الأقسام فيمكن تعيين أكثر من شخص لكل قسم.</p>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {SPECIAL_ROLES.map((sr) => {
                        const holders = members.filter((m) => m.roles.includes(sr.key));
                        return (
                          <div key={sr.key} className="flex flex-col gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                               <div className="flex-1 min-w-0">
                                  <p className="text-sm font-black text-primary">{sr.label}</p>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">{sr.desc}</p>
                               </div>
                               <select
                                 value=""
                                 onChange={(e) => e.target.value && assignSpecialRole(sr.key, e.target.value, 'add')}
                                 className="bg-white border border-border rounded-xl px-4 py-2 text-xs font-bold text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary min-w-[200px]"
                               >
                                 <option value="">+ إضافة مسؤول...</option>
                                 {members.filter(m => !m.roles.includes(sr.key)).map((m) => (
                                   <option key={m.id} value={m.id}>{memberFullName(m)}</option>
                                 ))}
                               </select>
                            </div>

                            {holders.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-2">
                                 {holders.map(h => (
                                   <div key={h.id} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/10">
                                      <span className="text-[10px] font-black">{memberFullName(h)}</span>
                                      <button onClick={() => assignSpecialRole(sr.key, h.id, 'remove')} className="hover:text-rose-500 transition-colors">
                                         <X size={12} strokeWidth={3} />
                                      </button>
                                   </div>
                                 ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
              ) : section === "announcements" ? (
                <AnnouncementsManager
                  list={announcements}
                  formOpen={showAnnForm}
                  onOpenForm={() => { setEditingAnn(null); setAnnDraft({ title: "", body: "", image_path: "" }); setAnnImageFile(null); setAnnImagePreview(null); setShowAnnForm(true); }}
                  onCloseForm={() => setShowAnnForm(false)}
                  draft={annDraft}
                  setDraft={setAnnDraft}
                  imagePreview={annImagePreview}
                  onPickImage={(file: File) => { setAnnImageFile(file); setAnnImagePreview(URL.createObjectURL(file)); }}
                  onSave={async () => {
                    if (!annDraft.title.trim() || !annDraft.body.trim()) return toast.error("أكمل البيانات");
                    setAnnSaving(true);
                    let path = annDraft.image_path;
                    if (annImageFile) {
                      const ext = annImageFile.name.split(".").pop();
                      const filePath = `announcements/${meId}/${crypto.randomUUID()}.${ext}`;
                      const { error: upErr } = await supabase.storage.from("trip-images").upload(filePath, annImageFile);
                      if (!upErr) path = filePath;
                    }
                    const finalBody = path ? `---image:${path}\n${annDraft.body}` : annDraft.body;
                    const { error } = editingAnn
                      ? await supabase.from("majlis_posts").update({ title: annDraft.title, body: finalBody }).eq("id", editingAnn.id)
                      : await supabase.from("majlis_posts").insert({ author_id: meId, kind: "announcement", title: annDraft.title, body: finalBody });

                    if (!error) {
                      toast.success("تم الحفظ");
                      setShowAnnForm(false);
                      loadAnnouncements();
                    } else toast.error("خطأ في الحفظ");
                    setAnnSaving(false);
                  }}
                  onEdit={(a: any) => {
                    const imgMatch = a.body.match(/^---image:(.*)\n/);
                    const cleanBody = imgMatch ? a.body.replace(/^---image:.*\n/, "") : a.body;
                    setEditingAnn(a);
                    setAnnDraft({ title: a.title, body: cleanBody, image_path: imgMatch ? imgMatch[1] : "" });
                    setAnnImagePreview(null);
                    setAnnImageFile(null);
                    setShowAnnForm(true);
                  }}
                  onDelete={async (id: string) => {
                    if (!confirm("حذف الإعلان؟")) return;
                    await supabase.from("majlis_posts").delete().eq("id", id);
                    loadAnnouncements();
                  }}
                  saving={annSaving}
                />
              ) : (
                <AttendanceSection />
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </AppShell>
  );
}

function AttendanceSection() {
  const [tab, setTab] = useState<"trips" | "meetings">("trips");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ id: string; title: string; attendees: any[] }[]>([]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url");
      const profMap = new Map((profiles || []).map(p => [p.id, p]));

      if (tab === "trips") {
        const { data: trips } = await supabase.from("trips").select("id, title").order("start_date", { ascending: false });

        // Try with status, fallback if error
        const { data: attendees, error } = await supabase.from("trip_attendees").select("trip_id, user_id, status");

        const finalAttendees = (error && error.message?.includes('status'))
          ? (await supabase.from("trip_attendees").select("trip_id, user_id")).data || []
          : attendees || [];

        const result = (trips || []).map(t => ({
          id: t.id,
          title: t.title,
          attendees: (finalAttendees as any[])
            .filter((a: any) => a.trip_id === t.id && (!a.status || a.status === 'going'))
            .map((a: any) => profMap.get(a.user_id))
            .filter(Boolean)

        }));
        setData(result);
      } else {
        const { data: meetings } = await supabase.from("meetings").select("id, title").order("scheduled_at", { ascending: false });
        const { data: attendees } = await supabase.from("meeting_attendees").select("meeting_id, user_id, rsvp");

        const result = (meetings || []).map(m => ({
          id: m.id,
          title: m.title,
          attendees: (attendees || [])
            .filter(a => a.meeting_id === m.id && a.rsvp === 'going')
            .map(a => profMap.get(a.user_id))
            .filter(Boolean)
        }));
        setData(result);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-2xl w-fit">
        <button onClick={() => setTab("trips")} className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all", tab === "trips" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted")}>الرحلات</button>
        <button onClick={() => setTab("meetings")} className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all", tab === "meetings" ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:bg-muted")}>الاجتماعات</button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
      ) : data.length === 0 ? (
        <div className="card-surface p-20 text-center opacity-40 border-dashed">لا توجد بيانات حالياً</div>
      ) : (
        <div className="grid gap-6">
          {data.map(item => (
            <div key={item.id} className="card-surface p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <h4 className="text-xl font-black text-primary">{item.title}</h4>
                <span className="px-4 py-1 bg-gold-primary/10 text-gold-primary rounded-full text-xs font-black">{item.attendees.length} حاضر</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {item.attendees.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic col-span-full">لا يوجد مؤكدون للحضور بعد.</p>
                ) : (
                  item.attendees.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/40">
                      <div className="size-10 rounded-xl overflow-hidden border-2 border-white/5 shadow-md shrink-0">
                        <UserAvatar path={p.avatar_url} name={p.arabic_name || p.full_name} className="size-full" userId={p.id} />
                      </div>
                      <span className="text-sm font-black text-primary truncate">{p.arabic_name || p.full_name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
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
  const firstName = req?.first_name || "ع";
  const fatherName = req?.father_name || "";
  const grandName = req?.grandfather_name || "";
  const fullName = [firstName, fatherName, grandName].filter(Boolean).join(" ");

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-8 group">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
             <div className="size-16 rounded-[22px] bg-primary/5 border-2 border-gold-primary/10 flex items-center justify-center text-2xl font-black text-primary shadow-inner shrink-0">
               {firstName[0] || "ع"}
             </div>
             <div className="space-y-2">
                <h4 className="text-xl font-black text-primary tracking-tight">{fullName}</h4>
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground opacity-70">
                   <span className="flex items-center gap-1.5" dir="ltr"><Phone className="size-3.5" /> {req?.phone || "—"}</span>
                   <span className="flex items-center gap-1.5" dir="ltr"><Mail className="size-3.5" /> {req?.email || "—"}</span>
                   <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {req?.created_at ? new Date(req.created_at).toLocaleDateString("ar-SA") : "—"}</span>
                </div>
                {req?.note && (
                  <p className="text-sm font-bold text-muted-foreground/80 bg-muted/30 p-4 rounded-2xl border border-border/40 mt-3 italic">"{req.note}"</p>
                )}
             </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center">
             {req?.status === "pending" && (
                <>
                  <button onClick={() => onStatus(req.id, "approved")} className="px-8 py-3 rounded-2xl bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                    <Check className="size-4" strokeWidth={3} /> قبول العضوية
                  </button>
                  <button onClick={() => onStatus(req.id, "rejected")} className="size-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm">
                    <X className="size-5" />
                  </button>
                </>
             )}
             <button onClick={() => onDelete(req?.id)} className="size-12 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center hover:bg-primary hover:text-white transition-all">
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
             <div className="flex items-center gap-1.5 flex-wrap">
               <RoleToggleBtn active={currentRole === "admin"} onClick={() => onAssignRole(member.id, "admin")} icon={<Crown className="size-3.5" />} label="مسؤول" activeClass="bg-gold-primary text-white shadow-gold-primary/30" />
               <RoleToggleBtn active={currentRole === "manager"} onClick={() => onAssignRole(member.id, "manager")} icon={<Star className="size-3.5" />} label="مشرف" activeClass="bg-emerald-600 text-white shadow-emerald-600/30" />
               <RoleToggleBtn active={currentRole === "member"} onClick={() => onAssignRole(member.id, "member")} icon={<UserIcon className="size-3.5" />} label="عضو" activeClass="bg-primary text-white shadow-primary/30" />
             </div>

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

function AnnouncementsManager({ list, formOpen, onOpenForm, onCloseForm, draft, setDraft, imagePreview, onPickImage, onSave, onEdit, onDelete, saving }: any) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-primary tracking-tight">إدارة الإعلانات</h3>
          <p className="text-sm font-bold text-muted-foreground opacity-60">نشر وتعديل الإعلانات التي تظهر في اللوحة الرئيسية للمجلس.</p>
        </div>
        <button
          onClick={onOpenForm}
          className="btn-gold px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-black shadow-xl shadow-gold-primary/20"
        >
          <Plus size={18} strokeWidth={3} />
          <span>إعلان جديد</span>
        </button>
      </div>

      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card-surface p-8 space-y-6 border-gold-primary/20">
              <div className="flex items-center justify-between">
                 <h4 className="text-lg font-black text-primary">تفاصيل الإعلان</h4>
                 <button onClick={onCloseForm} className="size-10 rounded-full bg-muted flex items-center justify-center"><X size={20} /></button>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">عنوان الإعلان</label>
                    <input
                      value={draft.title}
                      onChange={e => setDraft({ ...draft, title: e.target.value })}
                      placeholder="عنوان جذاب..."
                      className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-black text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">نص الإعلان</label>
                    <textarea
                      value={draft.body}
                      onChange={e => setDraft({ ...draft, body: e.target.value })}
                      placeholder="اكتب المحتوى هنا..."
                      rows={4}
                      className="w-full p-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-2">صورة الإعلان (اختياري)</label>
                    <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-[32px] cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all group/upload">
                       {imagePreview ? (
                          <img src={imagePreview} className="h-40 w-full object-contain rounded-2xl shadow-xl" alt="Preview" />
                       ) : (
                          <>
                             <ImageIcon className="size-8 text-muted-foreground opacity-30 group-hover/upload:scale-110 transition-transform" />
                             <span className="text-xs font-bold text-muted-foreground">اضغط لرفع صورة الإعلان</span>
                          </>
                       )}
                       <input
                         type="file"
                         hidden
                         accept="image/*"
                         onChange={(e) => {
                           const f = e.target.files?.[0];
                           if (f) onPickImage(f);
                         }}
                       />
                    </label>
                 </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                 <button onClick={onCloseForm} className="px-8 py-3 rounded-xl font-black text-muted-foreground hover:bg-muted transition-all">إلغاء</button>
                 <button
                   disabled={saving}
                   onClick={onSave}
                   className="btn-gold px-12 py-3 rounded-xl font-black flex items-center gap-2 shadow-xl shadow-gold-primary/20 disabled:opacity-50"
                 >
                   {saving ? <Loader2 className="animate-spin size-5" /> : <Check size={20} strokeWidth={3} />}
                   <span>نشر الإعلان</span>
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
                   <Megaphone className="size-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest">إعلان منشور</span>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

