import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ArrowRight, Calendar, MapPin, Users, CheckCircle2, Tent } from "lucide-react";
import { TripImage } from "@/components/trip-image";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "تفاصيل الرحلة — السيف" }],
  }),
  component: TripDetail,
});

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

function statusLabel(status: string) {
  if (status === "upcoming") return "قادمة";
  if (status === "ongoing") return "جارية";
  if (status === "completed") return "منتهية";
  if (status === "cancelled") return "ملغاة";
  return status;
}

type Trip = {
  id: string;
  title: string;
  badge: string | null;
  location: string | null;
  location_url: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  image_url: string | null;
  status: string;
};

function formatRange(start: string | null, end: string | null) {
  if (!start) return "—";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} - ${fmt(end)}`;
}

function TripDetail() {
  const { tripId } = useParams({ from: "/_authenticated/trips/$tripId" });
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [going, setGoing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<
    { user_id: string; name: string; initial: string; avatarPath: string | null }[]
  >([]);
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });

  async function loadAttendees(tid: string) {
    const { data: rows } = await supabase
      .from("trip_attendees")
      .select("user_id, created_at")
      .eq("trip_id", tid)
      .order("created_at", { ascending: true });
    const ids = (rows ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setAttendees([]);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, arabic_name, full_name, avatar_url")
      .in("id", ids);
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    setAttendees(
      ids.map((id) => {
        const p = map.get(id);
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
        return {
          user_id: id,
          name,
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        };
      }),
    );
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        setUserId(u.user.id);
        const [{ data: p }, { data: r }] = await Promise.all([
          supabase
            .from("profiles")
            .select("arabic_name, full_name, avatar_url")
            .eq("id", u.user.id)
            .maybeSingle(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", u.user.id)
            .order("role")
            .limit(1)
            .maybeSingle(),
        ]);
        const name =
          p?.arabic_name?.trim() ||
          p?.full_name?.trim() ||
          u.user.email?.split("@")[0] ||
          "عضو العائلة";
        setProfile({
          name,
          role: roleLabel(r?.role ?? null),
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });

        const { data: mine } = await supabase
          .from("trip_attendees")
          .select("id")
          .eq("trip_id", tripId)
          .eq("user_id", u.user.id)
          .maybeSingle();
        setGoing(!!mine);
      }

      const { data: t } = await supabase
        .from("trips")
        .select("id,title,badge,location,location_url,start_date,end_date,description,image_url,status")
        .eq("id", tripId)
        .maybeSingle();
      setTrip((t as Trip | null) ?? null);
      await loadAttendees(tripId);
      setLoading(false);
    })();
  }, [tripId]);

  async function toggleAttendance() {
    if (!userId || saving) return;
    setSaving(true);
    if (going) {
      const { error } = await supabase
        .from("trip_attendees")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", userId);
      if (!error) setGoing(false);
    } else {
      const { error } = await supabase
        .from("trip_attendees")
        .insert({ trip_id: tripId, user_id: userId });
      if (!error) setGoing(true);
    }
    await loadAttendees(tripId);
    setSaving(false);
  }

  if (loading) {
    return (
      <AppShell title="الرحلات" user={profile}>
        <div className="card-surface p-10 text-center text-muted-foreground text-sm">
          جاري التحميل...
        </div>
      </AppShell>
    );
  }

  if (!trip) {
    return (
      <AppShell title="الرحلات" user={profile}>
        <div className="card-surface p-10 text-center">
          <p className="text-muted-foreground">لم يتم العثور على هذه الرحلة.</p>
          <Link to="/trips" className="mt-4 inline-flex items-center gap-2 text-gold-primary text-sm">
            <ArrowRight className="size-4" />
            العودة إلى قائمة الرحلات
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={trip.title} user={profile}>
      <div className="space-y-8 max-w-5xl">
        <Link
          to="/trips"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-gold-primary transition"
        >
          <ArrowRight className="size-4" />
          العودة إلى الرحلات
        </Link>

        <article className="card-surface overflow-hidden">
          <div className="relative h-56 sm:h-64">
            <TripImage
              path={trip.image_url}
              alt={trip.title}
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            <div className="absolute bottom-0 right-0 left-0 p-6">
              {trip.badge && (
                <span className="inline-block mb-2 px-2.5 py-1 bg-gold-primary/15 text-gold-primary text-[10px] rounded uppercase tracking-wider ring-1 ring-gold-primary/30">
                  {trip.badge}
                </span>
              )}
              <h2 className="text-2xl sm:text-3xl font-medium text-ivory">{trip.title}</h2>
            </div>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 border-b border-border">
            <Stat icon={Calendar} label="التاريخ" value={formatRange(trip.start_date, trip.end_date)} />
            <Stat icon={MapPin} label="الموقع" value={trip.location || "—"} />
            <Stat icon={CheckCircle2} label="الحالة" value={statusLabel(trip.status)} />
            <Stat icon={Users} label="المشاركون" value={`${attendees.length} مؤكدون`} />
            <Stat icon={Tent} label="الإقامة" value="مخيم عائلي" />
            {trip.badge && <Stat icon={CheckCircle2} label="الفئة" value={trip.badge} />}
          </div>

          {trip.location_url && (
            <div className="px-6 sm:px-8 py-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-ivory/80">
                <MapPin className="size-4 text-gold-primary" strokeWidth={1.5} />
                <span>رابط موقع الرحلة</span>
              </div>
              <a
                href={trip.location_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gold-primary/15 text-gold-primary text-xs ring-1 ring-gold-primary/30 hover:bg-gold-primary/25 transition"
              >
                <MapPin className="size-3.5" strokeWidth={1.5} />
                فتح في الخريطة
              </a>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <div className="eyebrow mb-2">وصف الرحلة</div>
              <p className="text-sm text-ivory/80 leading-relaxed whitespace-pre-line">
                {trip.description?.trim() || "لا يوجد وصف لهذه الرحلة."}
              </p>
            </div>
            <button
              onClick={toggleAttendance}
              disabled={saving || !userId}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition disabled:opacity-60 ${
                going
                  ? "bg-gold-primary/15 text-gold-primary ring-1 ring-gold-primary/30"
                  : "bg-gold-primary text-navy-base hover:brightness-110"
              }`}
            >
              <CheckCircle2 className="size-4" strokeWidth={2} />
              {going ? "تم تأكيد حضورك — إلغاء" : "تأكيد الحضور"}
            </button>
          </div>

          <div className="p-6 sm:p-8 border-t border-border space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-gold-primary" strokeWidth={1.5} />
                <h3 className="text-sm font-medium text-ivory">المؤكدون للحضور</h3>
              </div>
              <span className="text-xs text-muted-foreground">{attendees.length}</span>
            </div>

            {attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم يقم أحد بتأكيد الحضور بعد.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attendees.map((a) => (
                  <li
                    key={a.user_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/40 ring-1 ring-border"
                  >
                    <div className="size-9 rounded-full bg-gold-primary/15 ring-1 ring-gold-primary/30 grid place-items-center overflow-hidden text-gold-primary text-xs font-semibold">
                      <UserAvatar
                        path={a.avatarPath}
                        name={a.name}
                        initial={a.initial}
                        className="size-full"
                        fallbackClassName="text-xs"
                        userId={a.user_id}
                      />
                    </div>
                    <span className="text-sm text-ivory truncate">{a.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-9 rounded-lg bg-gold-primary/10 ring-1 ring-gold-primary/20 grid place-items-center">
        <Icon className="size-4 text-gold-primary" strokeWidth={1.5} />
      </div>
      <div>
        <div className="eyebrow mb-1">{label}</div>
        <div className="text-sm text-ivory">{value}</div>
      </div>
    </div>
  );
}
