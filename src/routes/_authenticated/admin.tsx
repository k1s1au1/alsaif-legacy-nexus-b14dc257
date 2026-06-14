import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Shield, UserPlus, Check, X, Trash2, Phone, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

const TABS: { key: ReqRow["status"]; label: string }[] = [
  { key: "pending", label: "قيد المراجعة" },
  { key: "approved", label: "مقبولة" },
  { key: "rejected", label: "مرفوضة" },
];

function AdminPage() {
  const [profile, setProfile] = useState({
    name: "عضو العائلة",
    role: "عضو",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [isPriv, setIsPriv] = useState(false);
  const [tab, setTab] = useState<ReqRow["status"]>("pending");
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("account_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as ReqRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const name = p?.arabic_name?.trim() || p?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو العائلة";
      const rs = (roles ?? []).map((r) => r.role);
      const priv = rs.includes("admin") || rs.includes("manager");
      setProfile({
        name,
        role: roleLabel(rs[0] ?? null),
        initial: (name[0] ?? "س").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
      });
      setIsPriv(priv);
      if (priv) await load();
      else setLoading(false);
    })();

    const ch = supabase
      .channel("account-requests-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "account_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  async function setStatus(id: string, status: "approved" | "rejected") {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("account_requests")
      .update({ status, reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("تعذر التحديث");
    else toast.success(status === "approved" ? "تم القبول" : "تم الرفض");
  }

  async function remove(id: string) {
    if (!confirm("حذف الطلب نهائياً؟")) return;
    const { error } = await supabase.from("account_requests").delete().eq("id", id);
    if (error) toast.error("تعذر الحذف");
    else toast.success("تم الحذف");
  }

  const filtered = rows.filter((r) => r.status === tab);
  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  return (
    <AppShell title="الإدارة" user={profile}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3 p-5 rounded-2xl bg-card/60 border border-border">
          <div className="size-11 rounded-xl bg-gold-primary/10 ring-1 ring-gold-primary/30 grid place-items-center">
            <Shield className="size-5 text-gold-primary" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-medium text-ivory">لوحة الإدارة</h2>
            <p className="text-xs text-muted-foreground">مراجعة طلبات إنشاء الحسابات الواردة من خارج المنصة.</p>
          </div>
        </div>

        {!isPriv ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border">
            <Shield className="size-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.2} />
            <p className="text-sm text-muted-foreground">هذه الصفحة متاحة للمشرفين والمسؤولين فقط.</p>
          </div>
        ) : (
          <section className="card-surface p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-gold-primary" />
                <h3 className="text-base text-ivory">طلبات إنشاء حساب</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      tab === t.key
                        ? "bg-gold-primary/10 border-gold-primary/40 text-ivory"
                        : "bg-background/40 border-border text-muted-foreground hover:text-ivory"
                    }`}
                  >
                    {t.label}
                    <span className="ms-1.5 opacity-70">({counts[t.key]})</span>
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid place-items-center py-16 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-sm text-muted-foreground">لا توجد طلبات في هذه الفئة.</p>
            ) : (
              <ul className="space-y-3">
                {filtered.map((r) => {
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
                                onClick={() => setStatus(r.id, "approved")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300"
                              >
                                <Check className="size-3.5" strokeWidth={1.8} />
                                قبول
                              </button>
                              <button
                                onClick={() => setStatus(r.id, "rejected")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-destructive/15 hover:bg-destructive/25 text-destructive"
                              >
                                <X className="size-3.5" strokeWidth={1.8} />
                                رفض
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => remove(r.id)}
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

            {tab === "approved" && filtered.length > 0 && (
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                بعد القبول، يقوم المسؤول بإنشاء حساب العضو يدوياً من إعدادات النظام ثم التواصل معه.
              </p>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
