import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { ArrowRight, Calendar, Eye, EyeOff, KeyRound, Loader2, Mail, Phone, User as UserIcon } from "lucide-react";
import { getMemberCredential } from "@/lib/api/member-credentials.functions";
import { PresenceDot, presenceFromLastSeen, presenceLabel } from "@/lib/presence";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/members/$userId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ملف العضو — السيف" },
      { name: "description", content: "عرض تفاصيل ملف العضو." },
    ],
  }),
  component: MemberProfilePage,
});

type ProfileRow = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  first_name: string | null;
  father_name: string | null;
  grandfather_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
};

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

function MemberProfilePage() {
  const { userId } = useParams({ from: "/_authenticated/members/$userId" });
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [credential, setCredential] = useState<{ email: string | null; password: string | null } | null>(null);
  const [credLoading, setCredLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const fetchCredential = useServerFn(getMemberCredential);
  const [me, setMe] = useState<{ name: string; initial: string; avatarPath: string | null }>({
    name: "...",
    initial: "س",
    avatarPath: null,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, arabic_name, full_name, first_name, father_name, grandfather_name, phone, avatar_url, created_at",
          )
          .eq("id", userId)
          .maybeSingle<ProfileRow>(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .order("role")
          .limit(1)
          .maybeSingle(),
      ]);
      setProfile(p ?? null);
      setRole((r?.role as string | null) ?? null);

      if (u.user) {
        const [{ data: mine }, { data: adminCheck }] = await Promise.all([
          supabase
            .from("profiles")
            .select("arabic_name, full_name, avatar_url")
            .eq("id", u.user.id)
            .maybeSingle(),
          supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
        ]);
        const name =
          mine?.arabic_name?.trim() ||
          mine?.full_name?.trim() ||
          u.user.email?.split("@")[0] ||
          "عضو";
        setMe({
          name,
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: mine?.avatar_url ?? null,
        });
        setIsAdmin(!!adminCheck);
      }
      setLoading(false);
    })();

    const loadPresence = async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("last_seen_at")
        .eq("user_id", userId)
        .maybeSingle();
      setLastSeen(data?.last_seen_at ?? null);
    };
    loadPresence();
    const channel = supabase
      .channel(`presence-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence", filter: `user_id=eq.${userId}` },
        loadPresence,
      )
      .subscribe();
    const tick = window.setInterval(loadPresence, 30_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(tick);
    };
  }, [userId]);

  const presenceState = presenceFromLastSeen(lastSeen);

  const displayName =
    profile?.arabic_name?.trim() ||
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.father_name, profile?.grandfather_name]
      .filter(Boolean)
      .join(" ") ||
    "عضو";
  const initial = (displayName[0] ?? "س").toUpperCase();

  return (
    <AppShell
      title="ملف العضو"
      user={{ name: me.name, role: "عضو", initial: me.initial, avatarPath: me.avatarPath }}
    >
      <div className="max-w-3xl space-y-6">
        <Link
          to="/members"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold-primary transition"
        >
          <ArrowRight className="size-4" />
          العودة إلى الأعضاء
        </Link>

        {loading ? (
          <div className="grid place-items-center py-24 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : !profile ? (
          <p className="card-surface p-8 text-center text-muted-foreground">
            لم يتم العثور على هذا العضو.
          </p>
        ) : (
          <>
            <section className="card-surface p-8 flex flex-col sm:flex-row items-center gap-6 animate-fade-up">
              <div className="relative size-24 rounded-full ring-2 ring-gold-primary/30 bg-gold-primary/10 grid place-items-center overflow-hidden shrink-0">
                <UserAvatar
                  path={profile.avatar_url}
                  name={displayName}
                  initial={initial}
                  className="size-full"
                  fallbackClassName="text-3xl text-gold-primary font-medium"
                />
                <PresenceDot state={presenceState} className="absolute bottom-1 left-1 size-3.5" />
              </div>
              <div className="text-center sm:text-right">
                <h2 className="text-2xl font-medium text-ivory">{displayName}</h2>
                <p className="text-sm text-gold-primary/80 mt-1">{roleLabel(role)}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PresenceDot state={presenceState} withRing={false} className="size-2" />
                  <span>{presenceLabel(presenceState)}</span>
                </div>
                {profile.full_name && profile.arabic_name && (
                  <p className="text-xs text-muted-foreground mt-1">{profile.full_name}</p>
                )}
              </div>
            </section>

            <section className="card-surface p-6 space-y-4 animate-fade-up">
              <h3 className="eyebrow">المعلومات</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {profile.first_name && (
                  <InfoItem icon={<UserIcon className="size-4" />} label="الاسم الأول" value={profile.first_name} />
                )}
                {profile.father_name && (
                  <InfoItem icon={<UserIcon className="size-4" />} label="اسم الأب" value={profile.father_name} />
                )}
                {profile.grandfather_name && (
                  <InfoItem icon={<UserIcon className="size-4" />} label="اسم الجد" value={profile.grandfather_name} />
                )}
                {profile.phone && (
                  <InfoItem icon={<Phone className="size-4" />} label="الهاتف" value={profile.phone} />
                )}
                <InfoItem
                  icon={<Calendar className="size-4" />}
                  label="تاريخ الانضمام"
                  value={new Date(profile.created_at).toLocaleDateString("ar-SA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
              </dl>
            </section>

            {isAdmin && (
              <section className="card-surface p-6 space-y-4 animate-fade-up border-gold-primary/30">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="eyebrow flex items-center gap-2">
                    <KeyRound className="size-4 text-gold-primary" />
                    بيانات تسجيل الدخول
                  </h3>
                  <span className="text-[10px] text-muted-foreground">للمسؤول فقط</span>
                </div>
                {credential ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <InfoItem
                      icon={<Mail className="size-4" />}
                      label="البريد الإلكتروني"
                      value={credential.email ?? "غير متوفر"}
                    />
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border">
                      <div className="text-gold-primary mt-0.5"><KeyRound className="size-4" /></div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">كلمة المرور</dt>
                        <dd className="text-sm text-ivory mt-0.5 flex items-center gap-2">
                          {credential.password ? (
                            <>
                              <span className="font-mono truncate">
                                {showPwd ? credential.password : "•".repeat(Math.min(credential.password.length, 12))}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowPwd((v) => !v)}
                                className="text-gold-primary/80 hover:text-gold-primary transition shrink-0"
                                aria-label={showPwd ? "إخفاء" : "إظهار"}
                              >
                                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                              </button>
                            </>
                          ) : (
                            <span className="text-muted-foreground">غير محفوظة</span>
                          )}
                        </dd>
                      </div>
                    </div>
                  </dl>
                ) : (
                  <button
                    type="button"
                    disabled={credLoading}
                    onClick={async () => {
                      setCredLoading(true);
                      try {
                        const res = await fetchCredential({ data: { userId } });
                        setCredential(res);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "تعذر تحميل البيانات");
                      } finally {
                        setCredLoading(false);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-gold-primary/10 border border-gold-primary/30 text-gold-primary text-sm hover:bg-gold-primary/20 transition inline-flex items-center gap-2"
                  >
                    {credLoading && <Loader2 className="size-4 animate-spin" />}
                    عرض بيانات الدخول
                  </button>
                )}
                <p className="text-[11px] text-muted-foreground">
                  تُعرض كلمة المرور المحفوظة عند إنشاء الحساب فقط. إذا قام العضو بتغييرها لاحقاً فلن تظهر هنا.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border">
      <div className="text-gold-primary mt-0.5">{icon}</div>
      <div className="min-w-0">
        <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</dt>
        <dd className="text-sm text-ivory mt-0.5 truncate">{value}</dd>
      </div>
    </div>
  );
}
