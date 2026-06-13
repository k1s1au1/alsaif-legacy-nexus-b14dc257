import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { MapPin, Calendar, Users, ChevronLeft, Plane, Clock } from "lucide-react";
import tripImage from "@/assets/trip-alula.jpg";

export const Route = createFileRoute("/_authenticated/trips")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الرحلات — الصيف" },
      { name: "description", content: "رحلات العائلة القادمة والسابقة، تفاصيل الوجهة والمشاركين." },
    ],
  }),
  component: TripsPage,
});

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

type Trip = {
  id: string;
  title: string;
  badge: string;
  location: string;
  dates: string;
  participants: number;
  description: string;
  image: string;
  status: "upcoming" | "planning" | "past";
};

const TRIPS: Trip[] = [
  {
    id: "alula-winter",
    title: "رحلة الشتاء السنوية",
    badge: "الرحلة الكبرى",
    location: "مخيم العلا، المملكة العربية السعودية",
    dates: "12 - 15 فبراير",
    participants: 24,
    description:
      "اجتماع شمل العائلة في قلب الطبيعة التاريخية للعلا، نجمع بين التراث والاسترخاء. تتضمن الرحلة جولات في المواقع الأثرية وأمسيات حول النار وبرنامج خاص للأطفال.",
    image: tripImage,
    status: "upcoming",
  },
  {
    id: "taif-spring",
    title: "نزهة الربيع في الطائف",
    badge: "نزهة قصيرة",
    location: "الطائف، المملكة العربية السعودية",
    dates: "20 - 22 أبريل",
    participants: 12,
    description: "عطلة نهاية أسبوع بين بساتين الورد ومرتفعات الهدا.",
    image: tripImage,
    status: "planning",
  },
];

function statusChip(status: Trip["status"]) {
  if (status === "upcoming")
    return { label: "قادمة", className: "bg-gold-primary/15 text-gold-primary ring-gold-primary/30" };
  if (status === "planning")
    return { label: "قيد التخطيط", className: "bg-secondary text-ivory/70 ring-border" };
  return { label: "سابقة", className: "bg-secondary/50 text-muted-foreground ring-border" };
}

function TripsPage() {
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
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
    })();
  }, []);

  return (
    <AppShell title="الرحلات" user={profile}>
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="eyebrow mb-2">رحلات العائلة</div>
            <h2 className="text-2xl font-medium text-ivory">جدول الرحلات والوجهات</h2>
            <p className="text-sm text-muted-foreground mt-1">
              استكشف الرحلات القادمة، سجّل حضورك، وتابع التفاصيل اللوجستية.
            </p>
          </div>
          <Link
            to="/trips/$tripId"
            params={{ tripId: TRIPS[0].id }}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
          >
            <Plane className="size-4" strokeWidth={2} />
            الرحلة المميزة
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {TRIPS.map((trip) => {
            const chip = statusChip(trip.status);
            return (
              <article
                key={trip.id}
                className="card-surface overflow-hidden flex flex-col animate-fade-up"
              >
                <div className="relative h-56">
                  <img
                    src={trip.image}
                    alt={trip.title}
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                  <span
                    className={`absolute top-4 right-4 px-2.5 py-1 text-[10px] rounded uppercase tracking-wider ring-1 ${chip.className}`}
                  >
                    {chip.label}
                  </span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="px-2 py-0.5 bg-gold-primary/10 text-gold-primary text-[10px] rounded uppercase tracking-wider ring-1 ring-gold-primary/20">
                      {trip.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-medium text-ivory mb-2">{trip.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                    <MapPin className="size-3.5" strokeWidth={1.5} />
                    {trip.location}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    {trip.description}
                  </p>
                  <div className="mt-6 pt-5 border-t border-border flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-2 text-xs text-ivory/80">
                        <Calendar className="size-3.5 text-gold-primary" strokeWidth={1.5} />
                        {trip.dates}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-ivory/80">
                        <Users className="size-3.5 text-gold-primary" strokeWidth={1.5} />
                        {trip.participants} مشارك
                      </div>
                    </div>
                    <Link
                      to="/trips/$tripId"
                      params={{ tripId: trip.id }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-primary hover:brightness-110 transition"
                    >
                      عرض التفاصيل
                      <ChevronLeft className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <article className="card-surface p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="size-4 text-gold-primary" strokeWidth={1.5} />
            <h3 className="eyebrow">الإعلانات اللوجستية</h3>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• يرجى تأكيد الحضور قبل 30 يناير لتسهيل الحجوزات.</li>
            <li>• وسائل النقل ستنطلق من مجلس المضيافة الساعة 8:00 صباحاً.</li>
            <li>• راجع قائمة المشتريات في صفحة المهام لاستكمال التحضيرات.</li>
          </ul>
        </article>
      </div>
    </AppShell>
  );
}
