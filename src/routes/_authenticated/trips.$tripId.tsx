import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ArrowRight, Calendar, MapPin, Users, CheckCircle2, Tent, Mountain, Sparkles } from "lucide-react";
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

const TRIP_DETAILS: Record<
  string,
  {
    title: string;
    location: string;
    dates: string;
    participants: number;
    description: string;
    itinerary: { day: string; title: string; details: string }[];
  }
> = {
  "alula-winter": {
    title: "رحلة الشتاء السنوية",
    location: "مخيم العلا، المملكة العربية السعودية",
    dates: "12 - 15 فبراير",
    participants: 24,
    description:
      "أربعة أيام في قلب العلا، نجمع بين الجولات التاريخية، الأمسيات العائلية، وأنشطة الأطفال.",
    itinerary: [
      { day: "اليوم الأول", title: "الوصول والاستقبال", details: "تجمع المخيم، عشاء ترحيبي حول النار." },
      { day: "اليوم الثاني", title: "زيارة الحجر", details: "جولة مرشدة في موقع مدائن صالح." },
      { day: "اليوم الثالث", title: "وادي العذيب", details: "نزهة عائلية مع برنامج خاص للأطفال." },
      { day: "اليوم الرابع", title: "العودة", details: "إفطار جماعي ثم انطلاق القافلة." },
    ],
  },
  "taif-spring": {
    title: "نزهة الربيع في الطائف",
    location: "الطائف، المملكة العربية السعودية",
    dates: "20 - 22 أبريل",
    participants: 12,
    description: "عطلة قصيرة بين بساتين الورد ومرتفعات الهدا.",
    itinerary: [
      { day: "اليوم الأول", title: "الوصول", details: "استقرار في الشاليه، عشاء عائلي." },
      { day: "اليوم الثاني", title: "بساتين الورد", details: "زيارة معامل الورد الطائفي." },
      { day: "اليوم الثالث", title: "العودة", details: "صباح هادئ في الهدا ثم العودة." },
    ],
  },
};

function TripDetail() {
  const { tripId } = useParams({ from: "/_authenticated/trips/$tripId" });
  const trip = TRIP_DETAILS[tripId];
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

  if (!trip) {
    return (
      <AppShell title="الرحلات" user={profile}>
        <div className="card-surface p-10 text-center">
          <p className="text-muted-foreground">لم يتم العثور على هذه الرحلة.</p>
          <Link
            to="/trips"
            className="mt-4 inline-flex items-center gap-2 text-gold-primary text-sm"
          >
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
              src={tripImage}
              alt={trip.title}
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            <div className="absolute bottom-0 right-0 left-0 p-8">
              <h2 className="text-3xl font-medium text-ivory mb-2">{trip.title}</h2>
              <div className="flex items-center gap-1.5 text-sm text-ivory/80">
                <MapPin className="size-4" strokeWidth={1.5} />
                {trip.location}
              </div>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-border">
            <Stat icon={Calendar} label="التاريخ" value={trip.dates} />
            <Stat icon={Users} label="المشاركون" value={`${trip.participants} عضواً`} />
            <Stat icon={Tent} label="الإقامة" value="مخيم عائلي" />
          </div>
          <div className="p-8 space-y-6">
            <p className="text-sm text-ivory/80 leading-relaxed">{trip.description}</p>
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
        </article>

        <article className="card-surface p-8">
          <div className="flex items-center gap-3 mb-6">
            <Mountain className="size-4 text-gold-primary" strokeWidth={1.5} />
            <h3 className="eyebrow">برنامج الرحلة</h3>
          </div>
          <ol className="space-y-5">
            {trip.itinerary.map((item, idx) => (
              <li key={idx} className="flex gap-4 pb-5 border-b border-border last:border-0 last:pb-0">
                <div className="size-9 shrink-0 rounded-lg bg-gold-primary/10 ring-1 ring-gold-primary/20 grid place-items-center text-gold-primary text-sm font-semibold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="eyebrow mb-1">{item.day}</div>
                  <div className="text-sm font-medium text-ivory">{item.title}</div>
                  <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>

        <article className="card-surface p-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="size-4 text-gold-primary" strokeWidth={1.5} />
            <h3 className="eyebrow">ملاحظات مهمة</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• يرجى إحضار ملابس دافئة لأمسيات الصحراء.</li>
            <li>• الانطلاق من مجلس المضيافة الساعة 8:00 صباحاً.</li>
            <li>• تنسيق المشتريات يتم عبر صفحة المهام.</li>
          </ul>
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
