import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { approveAccountRequest } from "@/lib/api/account-requests.functions";

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

type Section = "requests" | "roles";

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
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("account_requests")
      .update({ status, reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("تعذر التحديث");
    else toast.success(status === "approved" ? "تم القبول" : "تم الرفض");
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
    // Replace the user's roles with a single canonical role
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
      // Always keep at least the member role
      await supabase.from("user_roles").insert({ user_id: userId, role: "member" });
    }
    toast.success("تم تحديث الصلاحيات");
    loadMembers();
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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3 p-5 rounded-2xl bg-card/60 border border-border">
          <div className="size-11 rounded-xl bg-gold-primary/10 ring-1 ring-gold-primary/30 grid place-items-center">
            <Shield className="size-5 text-gold-primary" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-medium text-ivory">لوحة الإدارة</h2>
            <p className="text-xs text-muted-foreground">
              إدارة طلبات الانضمام وتعيين المسؤولين والمشرفين.
            </p>
          </div>
        </div>

        {!isPriv ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border">
            <Shield className="size-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.2} />
            <p className="text-sm text-muted-foreground">هذه الصفحة متاحة للمشرفين والمسؤولين فقط.</p>
          </div>
        ) : (
          <>
            {/* Section switch */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSection("requests")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition ${
                  section === "requests"
                    ? "bg-gold-primary/10 border-gold-primary/40 text-ivory"
                    : "bg-card/40 border-border text-muted-foreground hover:text-ivory"
                }`}
              >
                <UserPlus className="size-4" strokeWidth={1.6} />
                طلبات إنشاء حساب
                <span className="opacity-70 text-xs">({reqCounts.pending})</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setSection("roles")}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition ${
                    section === "roles"
                      ? "bg-gold-primary/10 border-gold-primary/40 text-ivory"
                      : "bg-card/40 border-border text-muted-foreground hover:text-ivory"
                  }`}
                >
                  <UserCog className="size-4" strokeWidth={1.6} />
                  تعيين المسؤولين والمشرفين
                </button>
              )}
            </div>

            {loading ? (
              <div className="grid place-items-center py-16 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : section === "requests" ? (
              <section className="card-surface p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <UserPlus className="size-5 text-gold-primary" />
                    <h3 className="text-base text-ivory">طلبات إنشاء حساب</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {REQ_TABS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setReqTab(t.key)}
                        className={`px-3 py-1.5 rounded-lg border transition ${
                          reqTab === t.key
                            ? "bg-gold-primary/10 border-gold-primary/40 text-ivory"
                            : "bg-background/40 border-border text-muted-foreground hover:text-ivory"
                        }`}
                      >
                        {t.label}
                        <span className="ms-1.5 opacity-70">({reqCounts[t.key]})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {filteredReqs.length === 0 ? (
                  <p className="text-center py-12 text-sm text-muted-foreground">لا توجد طلبات في هذه الفئة.</p>
                ) : (
                  <ul className="space-y-3">
                    {filteredReqs.map((r) => {
                      const fullName = `${r.first_name} ${r.father_name} ${r.grandfather_name}`;
                      return (
                        <li key={r.id} className="p-4 rounded-xl bg-background/40 border border-border">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-ivory font-medium">{fullName}</p>
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5" dir="ltr">
                                  <Phone className="size-3.5" strokeWidth={1.5} />
                                  {r.phone}
                                </span>
                                {r.email && (
                                  <span className="inline-flex items-center gap-1.5" dir="ltr">
                                    <Mail className="size-3.5" strokeWidth={1.5} />
                                    {r.email}
                                  </span>
                                )}
                                <span>
                                  {new Date(r.created_at).toLocaleDateString("ar-SA", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                              {r.note && (
                                <p className="mt-2 text-xs text-muted-foreground/90 leading-relaxed whitespace-pre-wrap">
                                  {r.note}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {r.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => setReqStatus(r.id, "approved")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300"
                                  >
                                    <Check className="size-3.5" strokeWidth={1.8} />
                                    قبول
                                  </button>
                                  <button
                                    onClick={() => setReqStatus(r.id, "rejected")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-destructive/15 hover:bg-destructive/25 text-destructive"
                                  >
                                    <X className="size-3.5" strokeWidth={1.8} />
                                    رفض
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => removeReq(r.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-ivory"
                                title="حذف"
                              >
                                <Trash2 className="size-3.5" strokeWidth={1.5} />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : (
              <section className="card-surface p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <UserCog className="size-5 text-gold-primary" />
                    <h3 className="text-base text-ivory">تعيين المسؤولين والمشرفين</h3>
                  </div>
                  <input
                    type="text"
                    placeholder="بحث بالاسم..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-background/60 border border-border text-ivory placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  اختر الدور المناسب لكل عضو. مسؤول النظام يملك كامل الصلاحيات، والمشرف يساعد في إدارة المحتوى والطلبات.
                </p>

                {filteredMembers.length === 0 ? (
                  <p className="text-center py-12 text-sm text-muted-foreground">لا يوجد أعضاء.</p>
                ) : (
                  <ul className="space-y-2">
                    {filteredMembers.map((m) => {
                      const role = highestRole(m.roles);
                      const isMe = m.id === meId;
                      return (
                        <li
                          key={m.id}
                          className="p-3 rounded-xl bg-background/40 border border-border flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-10 rounded-full bg-gold-primary/15 ring-1 ring-gold-primary/30 overflow-hidden grid place-items-center text-gold-primary">
                              <UserAvatar
                                path={m.avatar_url}
                                name={memberFullName(m)}
                                initial={(memberFullName(m)[0] ?? "ع").toUpperCase()}
                                className="size-full"
                                fallbackClassName=""
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-ivory truncate">
                                {memberFullName(m)}
                                {isMe && <span className="ms-2 text-[10px] text-muted-foreground">(أنت)</span>}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{roleLabel(role)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <RoleBtn
                              active={role === "admin"}
                              onClick={() => assignRole(m.id, "admin")}
                              icon={<Crown className="size-3.5" strokeWidth={1.8} />}
                              label="مسؤول"
                              tone="gold"
                            />
                            <RoleBtn
                              active={role === "manager"}
                              onClick={() => assignRole(m.id, "manager")}
                              icon={<Star className="size-3.5" strokeWidth={1.8} />}
                              label="مشرف"
                              tone="emerald"
                            />
                            <RoleBtn
                              active={role === "member"}
                              onClick={() => assignRole(m.id, "member")}
                              icon={<UserIcon className="size-3.5" strokeWidth={1.8} />}
                              label="عضو"
                              tone="neutral"
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function RoleBtn({
  active,
  onClick,
  icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "gold" | "emerald" | "neutral";
}) {
  const tones: Record<string, string> = {
    gold: active
      ? "bg-gold-primary/20 text-gold-primary ring-1 ring-gold-primary/40"
      : "bg-background/40 text-muted-foreground hover:text-gold-primary border border-border",
    emerald: active
      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
      : "bg-background/40 text-muted-foreground hover:text-emerald-300 border border-border",
    neutral: active
      ? "bg-secondary text-ivory ring-1 ring-border"
      : "bg-background/40 text-muted-foreground hover:text-ivory border border-border",
  };
  return (
    <button
      onClick={onClick}
      disabled={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition ${tones[tone]} ${active ? "cursor-default" : ""}`}
    >
      {icon}
      {label}
    </button>
  );
}
