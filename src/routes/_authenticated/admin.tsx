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
  Plane,
  CalendarDays,
  Newspaper,
  Pencil,
  Megaphone,
  BarChart3,
  Archive,
  ClipboardList,
  History,
  CheckCircle2,
  MapPin,
} from "lucide-react";

import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { approveAccountRequest } from "@/lib/api/account-requests.functions";
import { deleteMemberAccount } from "@/lib/api/members-admin.functions";
import { assignUserRole } from "@/lib/api/roles.functions";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { useSiteLogo } from "@/hooks/use-site-logo";

import { IntegratedHub } from "@/components/dashboard/integrated-hub";
import { sendFcmNotification } from "@/lib/fcm.functions";
import { finalizePoll } from "@/lib/api/shura.functions";

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

// Main Admin Page Component for Alsaif Family Hub
function AdminPage() {
  const {
    userId: meId,
    isAdmin: isSystemAdmin,
    isChairman: isSiteChairman,
    isPrivileged: isA,
  } = useUserRole();

  const isPowerUser = isSiteChairman || isSystemAdmin;

  const [profile, setProfile] = useState({
    name: "...",
    role: "...",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [reqTab, setReqTab] = useState("pending");
  const [pendingReqs, setPendingReqs] = useState<ReqRow[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [memberRequests, setMemberRequests] = useState<any[]>([]);
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [archiveData, setArchiveData] = useState({
    meetings: [] as any[],
    trips: [] as any[],
    tasks: [] as any[],
    community: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requests" | "members" | "member_requests" | "polls" | "bugs" | "master_archive">(
    "requests",
  );
  const [reqCounts, setReqCounts] = useState<Record<string, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [fcmTokenCount, setFcmTokenCount] = useState(0);
  const [memberSearch, setMemberSearch] = useState("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const dynamicLogo = useSiteLogo();

  // Announcement State
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annDraft, setAnnDraft] = useState({ id: "", title: "", body: "" });
  const [annImage, setAnnImage] = useState<File | null>(null);
  const [annImagePreview, setAnnImagePreview] = useState<string | null>(null);
  const [annSaving, setAnnSaving] = useState(false);

  const approveFn = useServerFn(approveAccountRequest);
  const deleteMemberFn = useServerFn(deleteMemberAccount);
  const assignRoleFn = useServerFn(assignUserRole);
  const sendFcm = useServerFn(sendFcmNotification);

  const loadData = useCallback(async () => {
    if (!meId) return;
    setLoading(true);
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select(
          "id, arabic_name, full_name, avatar_url, is_active, first_name, father_name, grandfather_name",
        )
        .eq("id", meId)
        .maybeSingle();

      if (p) {
        setProfile({
          name: p.arabic_name || p.full_name || "عضو",
          role: roleLabel(isSiteChairman ? "chairman" : isSystemAdmin ? "admin" : "manager"),
          initial: (p.arabic_name?.[0] || "ع").toUpperCase(),
          avatarPath: p.avatar_url,
        });
      }

      if (isA) {
        try {
          const [
            { data: reqs },
            { data: mems, error: memErr },
            { data: allRoles },
            { data: allHeads },
            { data: mreqs },
            { data: bugs },
            { data: pollList },
          ] = await Promise.all([
            supabase.from("account_requests").select("*").order("created_at", { ascending: false }),
            supabase
              .from("profiles")
              .select(
                "id, arabic_name, full_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at",
              )
              .order("full_name"),
            supabase.from("user_roles").select("user_id, role"),
            supabase.from("section_heads" as any).select("user_id, section"),
            isSiteChairman
              ? supabase
                  .from("member_posts" as any)
                  .select("*")
                  .eq("kind", "request")
                  .order("created_at", { ascending: false })
              : Promise.resolve({ data: [] }),
            isSystemAdmin || isSiteChairman
              ? supabase
                  .from("bug_reports" as any)
                  .select("*")
                  .order("created_at", { ascending: false })
              : Promise.resolve({ data: [] }),
            supabase
              .from("majlis_posts")
              .select("*")
              .like("body", "%---poll:%")
              .order("created_at", { ascending: false }),
          ]);

          if (memErr) {
            console.error("Members fetch error:", memErr);
            setMembers([]);
          } else {
            const rolesByUser = new Map<string, { role: string }[]>();
            (allRoles || []).forEach((r: any) => {
              const arr = rolesByUser.get(r.user_id) || [];
              arr.push({ role: r.role });
              rolesByUser.set(r.user_id, arr);
            });
            const headsByUser = new Map<string, string[]>();
            ((allHeads as any[]) || []).forEach((h: any) => {
              const arr = headsByUser.get(h.user_id) || [];
              arr.push(h.section);
              headsByUser.set(h.user_id, arr);
            });
            setMembers(
              (mems || []).map((m: any) => ({
                ...m,
                user_roles: rolesByUser.get(m.id) || [],
                section_heads: headsByUser.get(m.id) || [],
              })),
            );
          }

          setPendingReqs(reqs || []);
          setPolls(pollList || []);
          // Enrich member requests with author profile
          const mreqList = (mreqs as any[]) || [];
          const aids = Array.from(new Set(mreqList.map((p) => p.author_id).filter(Boolean)));
          const authMap = new Map<string, any>();
          if (aids.length) {
            const { data: aps } = await supabase
              .from("profiles")
              .select("id, arabic_name, full_name, avatar_url")
              .in("id", aids);
            (aps || []).forEach((a: any) => authMap.set(a.id, a));
          }
          setMemberRequests(
            mreqList.map((p) => ({ ...p, author: authMap.get(p.author_id) || null })),
          );

          // Enrich bug reports with reporter profile
          const bugList = (bugs as any[]) || [];
          const bids = Array.from(new Set(bugList.map((b) => b.reporter_id).filter(Boolean)));
          const bMap = new Map<string, any>();
          if (bids.length) {
            const { data: bps } = await supabase
              .from("profiles")
              .select("id, arabic_name, full_name, avatar_url")
              .in("id", bids);
            (bps || []).forEach((a: any) => bMap.set(a.id, a));
          }
          setBugReports(bugList.map((b) => ({ ...b, reporter: bMap.get(b.reporter_id) || null })));

          // Fetch FCM Token Count via security-definer RPC (admin/chairman only)
          const { data: tcCount } = await supabase.rpc("count_fcm_tokens" as any);
          setFcmTokenCount((tcCount as number | null) ?? 0);

          // 4. Fetch Master Archive Data
          const [
            { data: archMeetings },
            { data: archAttendees },
            { data: archTrips },
            { data: archTasks },
            { data: archProfiles },
          ] = await Promise.all([
            supabase.from("meetings").select("*").order("scheduled_at", { ascending: false }),
            supabase.from("meeting_attendees").select("*"),
            supabase.from("trips").select("*").order("start_date", { ascending: false }),
            supabase.from("tasks").select("*").order("created_at", { ascending: false }),
            supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
          ]);

          const profMap = new Map<string, any>((archProfiles || []).map(p => [p.id, p]));

          const attendeesByMeeting = new Map<string, any[]>();
          (archAttendees || []).forEach((a: any) => {
            const arr = attendeesByMeeting.get(a.meeting_id) || [];
            arr.push({ ...a, profiles: profMap.get(a.user_id) });
            attendeesByMeeting.set(a.meeting_id, arr);
          });

          setArchiveData({
            meetings: (archMeetings || []).map(m => ({ ...m, attendees: attendeesByMeeting.get(m.id) || [] })),
            trips: archTrips || [],
            tasks: (archTasks || []).map(t => ({ ...t, assignee: profMap.get(t.assignee_id) })),
            community: pollList || [],
          });

          const counts = { pending: 0, approved: 0, rejected: 0 };
          (reqs || []).forEach((r) => {
            if (counts[r.status as keyof typeof counts] !== undefined) {
              counts[r.status as keyof typeof counts]++;
            }
          });
          setReqCounts(counts);
        } catch (err) {
          console.error("Admin data load error:", err);
          toast.error("فشل تحميل بعض البيانات الإدارية");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [meId, isA, isSystemAdmin, isSiteChairman]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // "Member requests" tab is chairman-only; fall back to requests if not chairman
  useEffect(() => {
    if (!isSiteChairman && tab === "member_requests") setTab("requests");
  }, [isSiteChairman, tab]);

  const updateReqStatus = async (id: string, status: "approved" | "pending" | "rejected") => {
    try {
      if (status === "approved") {
        const res = await approveFn({ data: { id } });
        if (res.ok) {
          toast.success("تم قبول العضو وإنشاء الحساب بنجاح");
        }
      } else {
        await supabase.from("account_requests").update({ status }).eq("id", id);
        toast.success("تم تحديث حالة الطلب");
      }
      loadData();
    } catch (err: any) {
      console.error("Approve error:", err);
      toast.error("فشل تحديث الطلب: " + (err.message || "خطأ غير معروف"));
    }
  };

  const deleteReq = async (id: string) => {
    if (!confirm("حذف الطلب نهائياً؟")) return;
    await supabase.from("account_requests").delete().eq("id", id);
    toast.success("تم الحذف");
    loadData();
  };

  const assignRole = async (uid: string, role: string) => {
    // Constraint: Max 2 Technical Admins (admin role)
    if (role === "admin") {
      const currentAdmins = members.filter((m) => {
        const r = Array.isArray(m.user_roles)
          ? m.user_roles[0]?.role
          : m.user_roles?.role || "member";
        return r === "admin";
      });
      if (currentAdmins.length >= 2 && !currentAdmins.find((a) => a.id === uid)) {
        toast.error("عذراً، لا يمكن تعيين أكثر من 2 مسؤولين تقنيين في النظام.");
        return;
      }
    }

    // Constraint: Max 2 Chairmen (chairman role)
    if (role === "chairman") {
      const currentChairmen = members.filter((m) => {
        const r = Array.isArray(m.user_roles)
          ? m.user_roles[0]?.role
          : m.user_roles?.role || "member";
        return r === "chairman";
      });
      if (currentChairmen.length >= 2 && !currentChairmen.find((c) => c.id === uid)) {
        toast.error("عذراً، لا يمكن تعيين أكثر من 2 رؤساء مجلس في النظام.");
        return;
      }
    }

    setUpdatingRole(uid);
    try {
      await assignRoleFn({ data: { userId: uid, role } });
      toast.success("تم تحديث الصلاحية بنجاح");

      // Update local state immediately for better UX
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === uid) {
            return { ...m, user_roles: [{ role }] };
          }
          return m;
        }),
      );

      await loadData();
    } catch (err: any) {
      toast.error("فشل تعيين الصلاحية", { description: err.message });
    } finally {
      setUpdatingRole(null);
    }
  };

  const deleteMember = async (uid: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب ${name} نهائياً؟`)) return;
    try {
      await deleteMemberFn({ data: { userId: uid } });
      toast.success("تم حذف الحساب بنجاح");
      loadData();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const toggleSectionHead = async (uid: string, section: string, currentlyHead: boolean) => {
    try {
      if (currentlyHead) {
        const { error } = await supabase
          .from("section_heads" as any)
          .delete()
          .eq("user_id", uid)
          .eq("section", section);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("section_heads" as any)
          .insert({ user_id: uid, section } as any);
        if (error) throw error;
      }
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id !== uid) return m;
          const cur: string[] = m.section_heads || [];
          return {
            ...m,
            section_heads: currentlyHead ? cur.filter((s) => s !== section) : [...cur, section],
          };
        }),
      );
      toast.success("تم تحديث مسؤولية القسم");
    } catch (err: any) {
      toast.error("فشل التحديث: " + (err.message || ""));
    }
  };

  // Announcement Handlers
  const onPickImage = async (file: File) => {
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `anns/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("trip-images").upload(path, file);
      if (upErr) throw upErr;

      const { data: sign } = await supabase.storage
        .from("trip-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      setAnnImagePreview(sign?.signedUrl || URL.createObjectURL(file));
      setAnnImage(file);
    } catch (err: any) {
      toast.error("فشل معالجة الصورة");
    }
  };

  const handleSaveAnn = async () => {
    if (!annDraft.title.trim() || !annDraft.body.trim()) return;
    setAnnSaving(true);
    let body = annDraft.body;

    try {
      if (annImage) {
        const ext = annImage.name.split(".").pop() || "jpg";
        const path = `anns/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("trip-images").upload(path, annImage);
        if (upErr) throw upErr;
        body = `---image:${path}\n${body}`;
      } else if (annDraft.id) {
        // Keep existing image if not uploading a new one during edit
        const existing = memberRequests.find((a: any) => a.id === annDraft.id);
        const imgMatch = existing?.body?.match(/^---image:.*\n/);
        if (imgMatch) body = imgMatch[0] + body;
      }

      if (annDraft.id) {
        const { error } = await supabase
          .from("majlis_posts")
          .update({ title: annDraft.title, body })
          .eq("id", annDraft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("majlis_posts").insert({
          title: annDraft.title,
          body,
          kind: "announcement",
          author_id: meId!,
        });
        if (error) throw error;
      }

      toast.success("تم حفظ الإعلان بنجاح");

      if (!annDraft.id) {
        sendFcm({
          data: {
            title: "📢 إعلان رسمي جديد",
            body: annDraft.title,
          },
        }).catch((err) => console.warn("FCM error:", err));
      }

      setAnnDraft({ id: "", title: "", body: "" });
      setAnnImage(null);
      setAnnImagePreview(null);
      setShowAnnForm(false);
      loadData();
    } catch (err: any) {
      console.error("Save announcement error:", err);
      toast.error("تعذر حفظ الإعلان: " + err.message);
    } finally {
      setAnnSaving(false);
    }
  };

  if (loading && !profile.name)
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin size-10 text-primary" />
      </div>
    );

  const filteredMembers = members.filter((m) => {
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
                style={{ "--logo-url": `url(${dynamicLogo || ""})` } as any}
              />
            </div>

            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
              <div className="space-y-3 md:space-y-5 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">
                    إدارة المجلس
                  </span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl">
                  لوحة الإدارة
                </h2>
                <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">
                  إدارة طلبات الانضمام، الصلاحيات، ونظام الشورى.
                </p>
              </div>
              <div className="size-16 md:size-28 rounded-2xl md:rounded-[36px] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl self-center md:self-auto shrink-0 group-hover:rotate-12 transition-transform duration-700">
                <Shield className="size-8 md:size-14 text-gold-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </section>

        {!isA ? (
          <div className="card-surface p-20 flex flex-col items-center text-center gap-6 border-dashed opacity-60 animate-fade-up">
            <div className="size-20 rounded-[40px] bg-muted/50 flex items-center justify-center text-muted-foreground">
              <Shield size={40} />
            </div>
            <p className="text-xl font-black">الدخول محدود لمسؤولي النظام فقط.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-3xl border border-border/40 overflow-x-auto no-scrollbar mx-4 md:mx-0">
              <button
                onClick={() => setTab("requests")}
                className={cn(
                  "px-8 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0",
                  tab === "requests"
                    ? "bg-primary text-white shadow-xl"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <UserPlus size={18} /> طلبات العضوية
              </button>
              <button
                onClick={() => setTab("members")}
                className={cn(
                  "px-8 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0",
                  tab === "members"
                    ? "bg-primary text-white shadow-xl"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Users size={18} /> إدارة الأعضاء
              </button>
              <button
                onClick={() => setTab("polls")}
                className={cn(
                  "px-8 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0",
                  tab === "polls"
                    ? "bg-primary text-white shadow-xl"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <BarChart3 size={18} /> الشورى
              </button>
              {isSiteChairman && (
                <button
                  onClick={() => setTab("member_requests")}
                  className={cn(
                    "px-8 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0",
                    tab === "member_requests"
                      ? "bg-primary text-white shadow-xl"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Megaphone size={18} /> طلبات
                  {memberRequests.length > 0 && (
                    <span className="ms-1 size-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                      {memberRequests.length}
                    </span>
                  )}
                </button>
              )}
              {(isSystemAdmin || isSiteChairman) && (
                <button
                  onClick={() => setTab("master_archive")}
                  className={cn(
                    "px-8 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0",
                    tab === "master_archive"
                      ? "bg-primary text-white shadow-xl"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Archive size={18} /> الأرشيف الشامل
                </button>
              )}
              {(isSystemAdmin || isSiteChairman) && (
                <button
                  onClick={() => setTab("bugs")}
                  className={cn(
                    "px-8 py-3 rounded-[22px] text-sm font-black transition-all flex items-center gap-2 shrink-0",
                    tab === "bugs"
                      ? "bg-primary text-white shadow-xl"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Shield size={18} /> بلاغات تقنية
                  {bugReports.filter((b: any) => b.status === "open").length > 0 && (
                    <span className="ms-1 size-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                      {bugReports.filter((b: any) => b.status === "open").length}
                    </span>
                  )}
                </button>
              )}
            </div>

            {tab === "requests" && (
              <section className="space-y-8 animate-fade-up">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">
                      تصنيف الطلبات
                    </h3>
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
                            : "bg-card text-muted-foreground border-border hover:bg-muted",
                        )}
                      >
                        {t.label} <span className="ms-2 opacity-50">{reqCounts[t.key]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-6">
                  {pendingReqs
                    .filter((r) => r.status === reqTab)
                    .map((r) => (
                      <RequestCard
                        key={r.id}
                        req={r}
                        onStatus={updateReqStatus}
                        onDelete={deleteReq}
                        canManage={isPowerUser}
                      />
                    ))}
                  {pendingReqs.filter((r) => r.status === reqTab).length === 0 && (
                    <div className="p-20 text-center text-muted-foreground italic bg-muted/20 rounded-[40px] border-2 border-dashed">
                      لا توجد طلبات في هذا القسم حالياً.
                    </div>
                  )}
                </div>
              </section>
            )}

            {tab === "members" && (
              <section className="space-y-8 animate-fade-up">
                <div className="relative">
                  <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="ابحث عن عضو بالاسم..."
                    className="w-full h-16 pr-14 pl-8 rounded-3xl bg-card border-2 border-border/40 focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all font-bold"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {filteredMembers.map((m) => (
                    <MemberAdminRow
                      key={m.id}
                      member={m}
                      meId={meId}
                      currentRole={
                        Array.isArray(m.user_roles)
                          ? m.user_roles[0]?.role
                          : m.user_roles?.role || "member"
                      }
                      sectionHeads={m.section_heads || []}
                      onAssignRole={assignRole}
                      onToggleSectionHead={toggleSectionHead}
                      onDelete={deleteMember}
                      fullName={m.arabic_name || m.full_name || "عضو"}
                      canManageSections={isPowerUser}
                      canManageRoles={isPowerUser}
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

            {tab === "polls" && <PollsManager list={polls} meId={meId} onRefresh={loadData} />}

            {tab === "master_archive" && (
              <MasterArchive data={archiveData} onRefresh={loadData} />
            )}

            {tab === "member_requests" && (
              <section className="animate-fade-up space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-primary tracking-tight">طلبات الأعضاء</h3>
                  <p className="text-sm font-bold text-muted-foreground opacity-60">
                    الطلبات التي ينشرها الأعضاء من ركن الأعضاء — يطّلع عليها رئيس المجلس مباشرة.
                  </p>
                </div>
                <div className="grid gap-4">
                  {memberRequests.length === 0 && (
                    <div className="p-16 text-center text-muted-foreground italic bg-muted/20 rounded-[36px] border-2 border-dashed">
                      لا توجد طلبات من الأعضاء حالياً.
                    </div>
                  )}
                  {memberRequests.map((r: any) => {
                    const author = r.author?.arabic_name || r.author?.full_name || "عضو";
                    const cleanBody = (r.body || "").replace(/^---image:.*\n/, "");
                    return (
                      <div key={r.id} className="card-surface p-6 md:p-8 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-12 rounded-2xl border-2 border-gold-primary/20 overflow-hidden shrink-0">
                              <UserAvatar
                                path={r.author?.avatar_url}
                                name={author}
                                className="size-full"
                                userId={r.author_id}
                              />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-base font-black text-primary truncate">
                                {author}
                              </h4>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {new Date(r.created_at).toLocaleDateString("ar-SA", {
                                  day: "numeric",
                                  month: "long",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm("حذف الطلب؟")) return;
                              const { error } = await supabase
                                .from("member_posts" as any)
                                .delete()
                                .eq("id", r.id);
                              if (error) toast.error("تعذر الحذف");
                              else {
                                toast.success("تم الحذف");
                                loadData();
                              }
                            }}
                            className="size-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shrink-0"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <h5 className="text-lg font-black text-foreground leading-tight">
                            {r.title}
                          </h5>
                          {cleanBody && (
                            <p className="text-sm font-bold text-muted-foreground/90 whitespace-pre-wrap leading-relaxed">
                              {cleanBody}
                            </p>
                          )}
                        </div>
                        <div className="pt-3 border-t border-border/40 flex justify-end">
                          <Link
                            to="/community"
                            className="text-xs font-black text-primary hover:underline"
                          >
                            عرض في ركن الأعضاء ←
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {tab === "bugs" && (isSystemAdmin || isSiteChairman) && (
              <section className="animate-fade-up space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-primary tracking-tight">
                    بلاغات الدعم التقني
                  </h3>
                  <p className="text-sm font-bold text-muted-foreground opacity-60">
                    البلاغات التي يرسلها الأعضاء عن الأخطاء التقنية في النظام.
                  </p>
                </div>
                <div className="grid gap-4">
                  {bugReports.length === 0 && (
                    <div className="p-16 text-center text-muted-foreground italic bg-muted/20 rounded-[36px] border-2 border-dashed">
                      لا توجد بلاغات تقنية حالياً.
                    </div>
                  )}
                  {bugReports.map((b: any) => {
                    const name = b.reporter?.arabic_name || b.reporter?.full_name || "عضو";
                    const isResolved = b.status === "resolved";
                    return (
                      <div
                        key={b.id}
                        className={cn(
                          "card-surface p-6 md:p-8 space-y-4",
                          isResolved && "opacity-60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-12 rounded-2xl border-2 border-gold-primary/20 overflow-hidden shrink-0">
                              <UserAvatar
                                path={b.reporter?.avatar_url}
                                name={name}
                                className="size-full"
                                userId={b.reporter_id}
                              />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-base font-black text-primary truncate">{name}</h4>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {new Date(b.created_at).toLocaleDateString("ar-SA", {
                                  day: "numeric",
                                  month: "long",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                                isResolved
                                  ? "bg-emerald-500/15 text-emerald-600"
                                  : "bg-rose-500/15 text-rose-600",
                              )}
                            >
                              {isResolved ? "مُعالَج" : "مفتوح"}
                            </span>
                            <button
                              onClick={async () => {
                                const next = isResolved ? "open" : "resolved";
                                const { error } = await supabase
                                  .from("bug_reports" as any)
                                  .update({ status: next })
                                  .eq("id", b.id);
                                if (error) toast.error("تعذر التحديث");
                                else {
                                  toast.success(
                                    next === "resolved" ? "تم تعليمه كمُعالَج" : "تمت إعادة الفتح",
                                  );
                                  loadData();
                                }
                              }}
                              className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"
                              title={isResolved ? "إعادة فتح" : "تعليم كمُعالَج"}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm("حذف البلاغ نهائياً؟")) return;
                                const { error } = await supabase
                                  .from("bug_reports" as any)
                                  .delete()
                                  .eq("id", b.id);
                                if (error) toast.error("تعذر الحذف");
                                else {
                                  toast.success("تم الحذف");
                                  loadData();
                                }
                              }}
                              className="size-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
                              title="حذف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {b.body}
                        </p>
                        {b.image_url && (
                          <a href={b.image_url} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={b.image_url}
                              alt="لقطة شاشة"
                              className="max-h-80 w-auto rounded-2xl border border-border/40"
                            />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function MasterArchive({ data, onRefresh }: { data: any; onRefresh: () => void }) {
  const [subTab, setSubTab] = useState<"meetings" | "trips" | "tasks" | "community">("meetings");

  return (
    <section className="animate-fade-up space-y-8">
      <div className="space-y-1">
        <h3 className="text-xl font-black text-primary tracking-tight">الأرشيف الشامل للنظام</h3>
        <p className="text-sm font-bold text-muted-foreground opacity-60">
          سجل كامل لجميع الأنشطة والبيانات التاريخية للمجلس.
        </p>
      </div>

      <div className="flex items-center gap-2 p-1 bg-muted/20 rounded-2xl w-fit">
        <button
          onClick={() => setSubTab("meetings")}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black transition-all",
            subTab === "meetings" ? "bg-white text-primary shadow-sm" : "text-muted-foreground",
          )}
        >
          الاجتماعات
        </button>
        <button
          onClick={() => setSubTab("trips")}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black transition-all",
            subTab === "trips" ? "bg-white text-primary shadow-sm" : "text-muted-foreground",
          )}
        >
          الترفيه
        </button>
        <button
          onClick={() => setSubTab("tasks")}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black transition-all",
            subTab === "tasks" ? "bg-white text-primary shadow-sm" : "text-muted-foreground",
          )}
        >
          المهام
        </button>
      </div>

      <div className="grid gap-6">
        {subTab === "meetings" && (
          <div className="space-y-4">
            {data.meetings.map((m: any) => (
              <div key={m.id} className="card-surface p-6 md:p-8 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-primary">{m.title}</h4>
                    <p className="text-xs font-bold text-muted-foreground">
                      {new Date(m.scheduled_at).toLocaleDateString("ar-SA", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-black text-primary uppercase tracking-widest">
                    {m.status === "completed" ? "مكتمل" : "مجدول"}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gold-primary">
                    <Users size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      قائمة الحضور ({m.attendees.filter((a: any) => a.rsvp === "going").length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {m.attendees.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">لا توجد ردود بعد.</p>
                    ) : (
                      m.attendees.map((a: any) => (
                        <div
                          key={a.user_id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all",
                            a.rsvp === "going"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                              : a.rsvp === "not_going"
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-600"
                                : "bg-muted border-border text-muted-foreground",
                          )}
                        >
                          <div className="size-5 rounded-full overflow-hidden shrink-0">
                            <UserAvatar
                              path={a.profiles?.avatar_url}
                              name={a.profiles?.arabic_name || a.profiles?.full_name || "عضو"}
                              className="size-full"
                            />
                          </div>
                          <span>{a.profiles?.arabic_name || a.profiles?.full_name || "عضو"}</span>
                          {a.companions_count > 0 && (
                            <span className="ms-1 opacity-60">+{a.companions_count}</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {subTab === "trips" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.trips.map((t: any) => (
              <div key={t.id} className="card-surface overflow-hidden group">
                <div className="h-40 bg-muted relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                  <div className="absolute bottom-4 right-4 z-20 text-white">
                    <h4 className="text-lg font-black">{t.title}</h4>
                    <p className="text-[10px] opacity-80">
                      {t.start_date ? new Date(t.start_date).toLocaleDateString("ar-SA") : "لم يحدد موعد"}
                    </p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-sm font-bold text-muted-foreground line-clamp-2">
                    {t.description}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <div className="flex items-center gap-2 text-gold-primary">
                      <MapPin size={14} />
                      <span className="text-xs font-bold">{t.location || "غير محدد"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {subTab === "tasks" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Completed Tasks */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <CheckCircle2 className="text-emerald-500" size={20} />
                  <h4 className="text-sm font-black text-emerald-600 uppercase tracking-widest">
                    المهام المنجزة
                  </h4>
                </div>
                {data.tasks.filter((t: any) => t.status === "done").map((t: any) => (
                  <div key={t.id} className="card-surface p-4 opacity-70">
                    <h5 className="font-black text-sm text-primary mb-2 line-clamp-1">{t.title}</h5>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full overflow-hidden">
                          <UserAvatar
                            path={t.assignee?.avatar_url}
                            name={t.assignee?.arabic_name || "عضو"}
                            className="size-full"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {t.assignee?.arabic_name || "غير معين"}
                        </span>
                      </div>
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        مكتمل
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pending Tasks */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <Clock className="text-amber-500" size={20} />
                  <h4 className="text-sm font-black text-amber-600 uppercase tracking-widest">
                    مهام قيد التنفيذ
                  </h4>
                </div>
                {data.tasks.filter((t: any) => t.status !== "done").map((t: any) => (
                  <div key={t.id} className="card-surface p-4">
                    <h5 className="font-black text-sm text-primary mb-2 line-clamp-1">{t.title}</h5>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full overflow-hidden">
                          <UserAvatar
                            path={t.assignee?.avatar_url}
                            name={t.assignee?.arabic_name || "عضو"}
                            className="size-full"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {t.assignee?.arabic_name || "غير معين"}
                        </span>
                      </div>
                      <span className="text-[9px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {t.status === "todo" ? "قيد الانتظار" : "جاري العمل"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function RoleToggleBtn({ active, onClick, icon, label, activeClass, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={active || disabled}
      className={cn(
        "px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all duration-300 border",
        active
          ? cn("border-transparent shadow-lg scale-105", activeClass)
          : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-primary",
        disabled &&
          !active &&
          "opacity-50 cursor-not-allowed hover:bg-card hover:text-muted-foreground",
      )}
    >
      {icon} <span>{label}</span>
    </button>
  );
}

function RequestCard({ req, onStatus, onDelete, canManage }: { req: ReqRow; onStatus: any; onDelete: any; canManage: boolean }) {
  const name = [req.first_name, req.father_name, req.grandfather_name].filter(Boolean).join(" ");
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-surface p-8 group"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-5">
          <div className="size-16 rounded-[22px] bg-primary/5 border-2 border-gold-primary/10 flex items-center justify-center text-2xl font-black text-primary shadow-inner shrink-0">
            {req.first_name[0]}
          </div>
          <div className="space-y-2">
            <h4 className="text-xl font-black text-primary tracking-tight">{name}</h4>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground opacity-70">
              <span className="flex items-center gap-1.5" dir="ltr">
                <Phone className="size-3.5" /> {req.phone}
              </span>
              <span className="flex items-center gap-1.5" dir="ltr">
                <Mail className="size-3.5" /> {req.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />{" "}
                {new Date(req.created_at).toLocaleDateString("ar-SA")}
              </span>
            </div>
            {req.note && (
              <p className="text-sm font-bold text-muted-foreground/80 bg-muted/30 p-4 rounded-2xl border border-border/40 mt-3 italic">
                "{req.note}"
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 self-end md:self-center">
          {req.status === "pending" && canManage && (
            <>
              <button
                onClick={() => onStatus(req.id, "approved")}
                className="px-8 py-3 rounded-2xl bg-emerald-500 text-white font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Check className="size-4" strokeWidth={3} /> قبول
              </button>
              <button
                onClick={() => onStatus(req.id, "rejected")}
                className="size-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </>
          )}
          {canManage && (
            <button
              onClick={() => onDelete(req.id)}
              className="size-12 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center hover:bg-primary hover:text-white transition-all"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const SECTION_OPTIONS: { key: string; label: string }[] = [
  { key: "meetings", label: "الاجتماعات" },
  { key: "events", label: "المهام" },
  { key: "trips", label: "الترفيه" },
  { key: "finance", label: "المالية" },
  { key: "heritage", label: "إرث السيف" },
  { key: "majlis", label: "الأخبار" },
  { key: "community", label: "ركن الأعضاء" },
];

function MemberAdminRow({
  member,
  meId,
  currentRole,
  sectionHeads = [],
  onAssignRole,
  onToggleSectionHead,
  onDelete,
  fullName,
  canManageSections = false,
  canManageRoles = false,
}: any) {
  const isMe = member.id === meId;
  const handleRole = (uid: string, role: string) => {
    if (!canManageRoles) {
      toast.error("هذه الصلاحية متاحة لرئيس المجلس والمسؤول التقني فقط");
      return;
    }
    onAssignRole(uid, role);
  };

  return (
    <div className="card-surface p-4 md:p-5 hover:bg-primary/5 transition-all group">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-[16px] border-2 border-gold-primary/20 overflow-hidden shadow-lg relative shrink-0">
            <UserAvatar
              path={member.avatar_url}
              name={fullName}
              className="size-full"
              userId={member.id}
            />
            {isMe && (
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <UserIcon className="size-4 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-base font-black text-primary truncate tracking-tight">
              {fullName}{" "}
              {isMe && <span className="text-[10px] text-gold-primary opacity-60 mr-2">(أنت)</span>}
            </h4>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
              {roleLabel(currentRole)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn("flex items-center gap-1.5 flex-wrap", !canManageRoles && "opacity-60")}
            title={
              !canManageRoles ? "تعديل الصلاحيات متاح لرئيس المجلس والمسؤول التقني فقط" : undefined
            }
          >
            <RoleToggleBtn
              disabled={!canManageRoles}
              active={currentRole === "chairman"}
              onClick={() => handleRole(member.id, "chairman")}
              icon={<ShieldCheck className="size-3.5" />}
              label="رئيس المجلس"
              activeClass="bg-emerald-950 text-white shadow-xl ring-2 ring-gold-primary"
            />
            <RoleToggleBtn
              disabled={!canManageRoles}
              active={currentRole === "admin"}
              onClick={() => handleRole(member.id, "admin")}
              icon={<Crown className="size-3.5" />}
              label="مسؤول تقني"
              activeClass="bg-gold-primary text-white shadow-gold-primary/30"
            />
            <RoleToggleBtn
              disabled={!canManageRoles}
              active={currentRole === "manager"}
              onClick={() => handleRole(member.id, "manager")}
              icon={<Star className="size-3.5" />}
              label="مسؤول قسم"
              activeClass="bg-emerald-600 text-white shadow-emerald-600/30"
            />
            <RoleToggleBtn
              disabled={!canManageRoles}
              active={currentRole === "member"}
              onClick={() => handleRole(member.id, "member")}
              icon={<UserIcon className="size-3.5" />}
              label="عضو"
              activeClass="bg-primary text-white shadow-primary/30"
            />
          </div>
          {!isMe && currentRole !== "admin" && canManageRoles && (
            <button
              onClick={() => onDelete(member.id, fullName)}
              className="size-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-border/40">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-2">
          مسؤوليات الأقسام
          {!canManageSections && <span className="mr-2 opacity-70 normal-case">(للرئيس فقط)</span>}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SECTION_OPTIONS.map((s) => {
            const active = sectionHeads.includes(s.key);
            return (
              <button
                key={s.key}
                disabled={!canManageSections}
                onClick={() => canManageSections && onToggleSectionHead(member.id, s.key, active)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-black border transition-all",
                  active
                    ? "bg-gold-primary text-white border-gold-primary shadow-md"
                    : "bg-card text-muted-foreground border-border hover:border-gold-primary/40 hover:text-primary",
                  !canManageSections &&
                    "opacity-50 cursor-not-allowed hover:border-border hover:text-muted-foreground",
                )}
              >
                {active && <Check className="size-3 inline ml-1" strokeWidth={3} />}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PollsManager({ list, meId, onRefresh }: any) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    question: "",
    options: ["", ""],
    durationDays: "1",
    pollType: "general" as "general" | "manager" | "chairman",
  });
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const runFinalize = useServerFn(finalizePoll);

  const handleSave = async () => {
    if (!draft.title || !draft.question || draft.options.some((o) => !o))
      return toast.error("يرجى إكمال البيانات");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(draft.durationDays || "1"));

    const pollData = {
      question: draft.question,
      options: draft.options,
      expires_at: expiresAt.toISOString(),
      type: draft.pollType,
      target_committee_only: draft.pollType !== "general",
    };

    const { error } = await supabase.from("majlis_posts").insert({
      title: draft.title,
      body: `---poll:${JSON.stringify(pollData)}---`,
      kind: "announcement",
      author_id: meId,
    });
    if (!error) {
      toast.success("تم نشر التصويت بنجاح");
      setShowForm(false);
      setDraft({
        title: "",
        question: "",
        options: ["", ""],
        durationDays: "1",
        pollType: "general",
      });
      onRefresh();
    }
  };

  const handleFinalize = async (postId: string) => {
    if (
      !confirm("هل أنت متأكد من إغلاق التصويت واستخراج المحضر الرسمي؟ سيتم حفظ التقرير في الخزنة.")
    )
      return;
    setFinalizing(postId);
    try {
      const res = await runFinalize({ data: { postId } });
      if (res.success) {
        toast.success("تم استخراج المحضر وحفظه في الخزنة بنجاح ✨");
        onRefresh();
      }
    } catch (e: any) {
      toast.error(e.message || "فشل استخراج المحضر");
    } finally {
      setFinalizing(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-gold px-8 py-3.5 rounded-2xl flex items-center gap-3 text-sm font-black shadow-xl"
        >
          <Plus size={20} strokeWidth={3} /> <span>تصويت جديد</span>
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card-surface p-8 space-y-6 border-gold-primary/20">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="العنوان..."
                className="w-full h-14 px-6 rounded-2xl bg-muted/40 border border-border font-black text-foreground"
              />
              <input
                value={draft.question}
                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                placeholder="السؤال..."
                className="w-full h-14 px-6 rounded-2xl bg-muted/40 border border-border font-bold text-foreground"
              />
              <div className="space-y-3">
                {draft.options.map((opt, i) => (
                  <input
                    key={i}
                    value={opt}
                    onChange={(e) => {
                      const next = [...draft.options];
                      next[i] = e.target.value;
                      setDraft({ ...draft, options: next });
                    }}
                    placeholder={`الخيار ${i + 1}`}
                    className="w-full h-12 px-5 rounded-xl bg-muted/20 border border-border font-bold text-sm text-foreground"
                  />
                ))}
                <button
                  onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}
                  className="text-xs font-black text-primary"
                >
                  + إضافة خيار
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/20">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-[0.2em]">
                    مدة التصويت (بالأيام)
                  </label>
                  <input
                    type="number"
                    value={draft.durationDays}
                    onChange={(e) => setDraft({ ...draft, durationDays: e.target.value })}
                    className="w-full h-12 px-5 rounded-xl bg-muted/20 border border-border font-bold text-sm"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-primary/40 mr-1 tracking-[0.2em]">
                    الفئة المستهدفة بالتصويت
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, pollType: "general" })}
                      className={cn(
                        "py-2 px-1 rounded-lg font-black text-[10px] transition-all border",
                        draft.pollType === "general"
                          ? "bg-primary text-white border-primary shadow-md"
                          : "bg-card text-muted-foreground border-border",
                      )}
                    >
                      الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, pollType: "manager" })}
                      className={cn(
                        "py-2 px-1 rounded-lg font-black text-[10px] transition-all border",
                        draft.pollType === "manager"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                          : "bg-card text-muted-foreground border-border",
                      )}
                    >
                      المسؤولين
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, pollType: "chairman" })}
                      className={cn(
                        "py-2 px-1 rounded-lg font-black text-[10px] transition-all border",
                        draft.pollType === "chairman"
                          ? "bg-gold-primary text-white border-gold-primary shadow-md"
                          : "bg-card text-muted-foreground border-border",
                      )}
                    >
                      رئيس المجلس
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={handleSave} className="w-full btn-gold py-4 rounded-2xl font-black">
                نشر للجميع
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {list.map((p: any) => {
          const bodyStr = p.body || "";
          const match = bodyStr.match(/---poll:({.*?})---/s);
          let pollData: any = null;
          try {
            pollData = JSON.parse(match![1]);
          } catch (e) {}

          const isFinalized = pollData?.status === "finalized";
          const pType = pollData?.type || "general";

          return (
            <div key={p.id} className="card-surface p-6 flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-black text-primary leading-tight line-clamp-2">
                        {p.title}
                      </h4>
                      <span
                        className={cn(
                          "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter",
                          pType === "chairman"
                            ? "bg-gold-primary text-emerald-950"
                            : pType === "manager"
                              ? "bg-emerald-600 text-white"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {pType === "chairman"
                          ? "رئيس المجلس"
                          : pType === "manager"
                            ? "المسؤولين"
                            : "عام"}
                      </span>
                    </div>
                    {isFinalized && (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        تم الأرشفة
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!isFinalized && (
                      <button
                        onClick={() => handleFinalize(p.id)}
                        disabled={finalizing === p.id}
                        className="size-9 rounded-lg bg-gold-primary/10 text-gold-primary flex items-center justify-center hover:bg-gold-primary hover:text-white transition-all shadow-sm"
                        title="استخراج المحضر"
                      >
                        {finalizing === p.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ShieldCheck size={18} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm("حذف؟"))
                          supabase
                            .from("majlis_posts")
                            .delete()
                            .eq("id", p.id)
                            .then(() => onRefresh());
                      }}
                      className="size-9 rounded-lg bg-rose-500/10 text-rose-500 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gold-primary">
                  <BarChart3 size={14} />{" "}
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    {isFinalized ? "تصويت منتهي" : "تصويت نشط"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
