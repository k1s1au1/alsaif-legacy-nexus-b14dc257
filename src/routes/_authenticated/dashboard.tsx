import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Megaphone, Clock, MapPin, ChevronLeft } from "lucide-react";
import tripImage from "@/assets/trip-alula.jpg";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة التحكم — السيف" },
      { name: "description", content: "ملخص نشاط العائلة: الإعلانات، الاجتماعات، الرحلات والمهام." },
    ],
  }),
  component: Dashboard,
});

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

function Dashboard() {
  const [profile, setProfile] = useState<{ name: string; role: string; initial: string }>({
    name: "عضو العائلة",
    role: "عضو",
    initial: "ص",
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id).order("role").limit(1).maybeSingle(),
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
      });
    })();
  }, []);

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="space-y-8">
        {/* Hero greeting */}
        <section className="relative py-12 px-8 lg:px-12 rounded-2xl overflow-hidden animate-fade-up">
          <div className="absolute inset-0 bg-gradient-to-l from-gold-primary/20 to-transparent" />
          <div className="absolute inset-0 bg-card ring-1 ring-gold-primary/20 rounded-2xl" />
          <div className="relative z-10 space-y-3">
            <p className="eyebrow">أهلاً بعودتك</p>
            <h2 className="text-3xl lg:text-5xl font-medium text-ivory leading-tight tracking-tight">
              {profile.name}
            </h2>
            <p className="text-base lg:text-lg text-gold-primary/80 max-w-[48ch] leading-relaxed">
              نصل العائلة، نحفظ الإرث، نبني المجتمع.
            </p>
          </div>
        </section>

        {/* Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Pinned Announcement */}
          <article className="lg:col-span-8 card-surface p-6 space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-gold-primary" strokeWidth={1.5} />
                <h3 className="eyebrow">إعلان مثبت</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">منذ ساعتين</span>
            </div>
            <h4 className="text-xl font-medium text-ivory">موعد الغبقة الرمضانية السنوية</h4>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch]">
              يسر مجلس العائلة دعوتكم لحضور الغبقة الرمضانية في منزل الوالد، وذلك في تمام الساعة
              العاشرة مساءً. الحضور مرغوب للجميع.
            </p>
          </article>

          {/* Fund */}
          <article className="lg:col-span-4 bg-card ring-1 ring-gold-primary/20 rounded-2xl p-6 flex flex-col justify-between animate-fade-up">
            <h3 className="eyebrow">صندوق العائلة</h3>
            <div className="mt-4">
              <span className="text-[11px] text-muted-foreground">الرصيد المتاح</span>
              <div className="text-3xl font-medium text-ivory mt-1">
                284,500 <span className="text-sm text-gold-primary">ر.س</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">آخر مساهمة</span>
                <span className="text-gold-primary">+2,500 ر.س</span>
              </div>
            </div>
          </article>

          {/* Next meeting */}
          <article className="lg:col-span-6 card-surface p-6 space-y-6 animate-fade-up">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="eyebrow">الاجتماع القادم</h3>
                <h4 className="text-lg font-medium text-ivory">مناقشة وقف العائلة</h4>
              </div>
              <div className="text-left">
                <div className="text-xl font-medium text-ivory">24</div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                  أبريل 2024
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground">08:30 مساءً</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground">مجلس الضيافة</span>
              </div>
            </div>

            <div className="flex -space-x-2 space-x-reverse">
              <div className="size-7 rounded-full bg-gold-primary ring-2 ring-card" />
              <div className="size-7 rounded-full bg-ivory/10 ring-2 ring-card" />
              <div className="size-7 rounded-full bg-gold-soft ring-2 ring-card" />
              <div className="size-7 rounded-full bg-navy-base ring-2 ring-card grid place-items-center text-[10px] text-muted-foreground">
                +8
              </div>
            </div>
          </article>

          {/* Recent messages */}
          <article className="lg:col-span-6 card-surface p-6 space-y-6 animate-fade-up">
            <h3 className="eyebrow">أحدث الرسائل</h3>
            <ul className="space-y-4">
              {[
                { i: "ف", name: "فيصل بن أحمد", t: "الآن", msg: "تم تحديث ملفات الأرشفة الخاصة بصور السيف..." },
                { i: "ن", name: "نورة السيف", t: "١٠:١٥ ص", msg: "هل تم اعتماد ميزانية الرحلة القادمة؟" },
                { i: "م", name: "مجلس العائلة (قروب)", t: "أمس", msg: "أحمد: السلام عليكم، بخصوص الاجتماع..." },
              ].map((m, idx, arr) => (
                <li key={m.name} className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-gold-primary/10 grid place-items-center text-xs font-medium text-gold-primary">
                    {m.i}
                  </div>
                  <div className={`flex-1 ${idx < arr.length - 1 ? "border-b border-border pb-4" : ""}`}>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-ivory">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground">{m.t}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{m.msg}</p>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          {/* Trip */}
          <article className="lg:col-span-12 card-surface overflow-hidden flex flex-col lg:flex-row animate-fade-up">
            <div className="lg:w-1/3 h-56 lg:h-auto relative">
              <img
                src={tripImage}
                alt="مخيم العلا في المملكة العربية السعودية عند الغروب"
                width={1280}
                height={800}
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-card via-card/30 to-transparent" />
            </div>
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-gold-primary/10 text-gold-primary text-[10px] rounded uppercase tracking-wider ring-1 ring-gold-primary/20">
                    الرحلة الكبرى
                  </span>
                  <span className="text-muted-foreground text-xs">
                    مخيم العلا، المملكة العربية السعودية
                  </span>
                </div>
                <h4 className="text-2xl font-medium text-ivory">رحلة الشتاء السنوية</h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[52ch]">
                  اجتماع شمل العائلة في قلب الطبيعة التاريخية للعلا، نجمع بين التراث والاسترخاء.
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="eyebrow mb-1">التاريخ</div>
                    <div className="text-sm text-ivory">12 - 15 فبراير</div>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <div className="eyebrow mb-1">المشاركين</div>
                    <div className="text-sm text-ivory">24 عضواً</div>
                  </div>
                </div>
                <Link
                  to="/trips"
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
                >
                  عرض التفاصيل
                  <ChevronLeft className="size-4" />
                </Link>
              </div>
            </div>
          </article>

          {/* Tasks */}
          <article className="lg:col-span-12 card-surface p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-8">
              <h3 className="eyebrow">المهام والمسؤوليات</h3>
              <button className="text-xs text-gold-primary border-b border-gold-primary/20 pb-0.5">
                عرض الكل
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: "تجديد وثائق الوقف", pct: 80 },
                { label: "تنظيم صور الأرشيف (1980)", pct: 45 },
                { label: "تجهيز قائمة مشتريات الرحلة", pct: 100 },
              ].map((t) => (
                <div key={t.label} className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-ivory/80">{t.label}</span>
                    <span className="text-gold-primary">{t.pct}%</span>
                  </div>
                  <div className="h-1 bg-ivory/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold-primary rounded-full"
                      style={{
                        width: `${t.pct}%`,
                        boxShadow: t.pct > 60 ? "0 0 8px rgba(191,161,93,0.4)" : undefined,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* Placeholder modules notice */}
        <p className="text-center text-xs text-muted-foreground pt-4 leading-relaxed">
          المرحلة الأولى: الأساس، المصادقة، ولوحة التحكم. الوحدات الأخرى (الرسائل، الاجتماعات،
          الرحلات، المالية، المهام، المناسبات، المجلس، الأرشيف، الإدارة) قادمة في المراحل القادمة.
        </p>
      </div>
    </AppShell>
  );
}
