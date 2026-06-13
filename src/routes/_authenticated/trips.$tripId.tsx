import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ArrowRight, Calendar, MapPin, Users, CheckCircle2, Tent } from "lucide-react";
import tripImage from "@/assets/trip-alula.jpg";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "تفاصيل الرحلة — الصيف" }],
  }),
  component: TripDetail,
});

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
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
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
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
          initial: (name[0] ?? "ص").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });
      }

      const { data: t } = await supabase
        .from("trips")
        .select("id,title,badge,location,start_date,end_date,description,image_url,status")
        .eq("id", tripId)
        .maybeSingle();
      setTrip((t as Trip | null) ?? null);
      setLoading(false);
    })();
  }, [tripId]);

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
          <div className="relative h-72">
            <img
              src={trip.image_url || tripImage}
              alt={trip.title}
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            <div className="absolute bottom-0 right-0 left-0 p-8">
              {trip.badge && (
                <span className="inline-block mb-3 px-2.5 py-1 bg-gold-primary/15 text-gold-primary text-[10px] rounded uppercase tracking-wider ring-1 ring-gold-primary/30">
                  {trip.badge}
                </span>
              )}
              <h2 className="text-3xl font-medium text-ivory mb-2">{trip.title}</h2>
              {trip.location && (
                <div className="flex items-center gap-1.5 text-sm text-ivory/80">
                  <MapPin className="size-4" strokeWidth={1.5} />
                  {trip.location}
                </div>
              )}
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-border">
            <Stat icon={Calendar} label="التاريخ" value={formatRange(trip.start_date, trip.end_date)} />
            <Stat icon={Users} label="المشاركون" value="عائلي" />
            <Stat icon={Tent} label="الإقامة" value="مخيم عائلي" />
          </div>
          {trip.description && (
            <div className="p-8 space-y-6">
              <p className="text-sm text-ivory/80 leading-relaxed whitespace-pre-line">
                {trip.description}
              </p>
              <button
                onClick={() => setGoing((v) => !v)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition ${
                  going
                    ? "bg-gold-primary/15 text-gold-primary ring-1 ring-gold-primary/30"
                    : "bg-gold-primary text-navy-base hover:brightness-110"
                }`}
              >
                <CheckCircle2 className="size-4" strokeWidth={2} />
                {going ? "تم تأكيد حضورك" : "تأكيد الحضور"}
              </button>
            </div>
          )}
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
