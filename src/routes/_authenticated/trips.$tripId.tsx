import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  Tent,
  Compass,
  Clock,
  Info,
  Share2,
  Shield,
  ChevronLeft,
  Loader2,
  X
} from "lucide-react";
import { TripImage } from "@/components/trip-image";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { cn } from "@/lib/utils";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { toast } from "sonner";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "تفاصيل الرحلة — السيف" }],
  }),
  component: TripDetail,
});

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
  const { userId, isLoading: rolesLoading, canManage, primaryRole } = useUserRole();
  const dynamicLogo = useSiteLogo();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<'going' | 'not_going' | null>(null);
  const [saving, setSaving] = useState(false);
  const [attendees, setAttendees] = useState<
    { user_id: string; name: string; initial: string; avatarPath: string | null }[]
  >([]);
  const isPrivileged = canManage("trips");
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });

  async function loadAttendees(tid: string) {
    try {
      const { data: rows, error } = await supabase
        .from("trip_attendees")
        .select("user_id, created_at, status")
        .eq("trip_id", tid);

      if (error) {
        // Fallback for legacy structure
        const { data: fallbackRows } = await supabase
          .from("trip_attendees")
          .select("user_id, created_at")
          .eq("trip_id", tid);

        processAttendees(fallbackRows || []);
      } else {
        // Show everyone who is 'going' or has no status (default attending)
        const goingRows = ((rows || []) as any[]).filter((r: any) => !r.status || r.status === 'going');
        processAttendees(goingRows);
      }
    } catch (err) {
      console.error("Load attendees error:", err);
    }
  }

  async function processAttendees(rows: any[]) {
    const ids = rows.map((r) => r.user_id);
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
      if (userId) {
        const { data: p } = await supabase
          .from("profiles")
          .select("arabic_name, full_name, avatar_url")
          .eq("id", userId)
          .maybeSingle();
        const name =
          p?.arabic_name?.trim() ||
          p?.full_name?.trim() ||
          "عضو العائلة";

        setProfile({
          name,
          role: roleLabel(primaryRole),
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });

        const { data: mine, error: mineErr } = await supabase
          .from("trip_attendees")
          .select("status")
          .eq("trip_id", tripId)
          .eq("user_id", userId)
          .maybeSingle();

        if (mineErr) {
          // Fallback if status column is missing
          const { data: fallbackMine } = await supabase
            .from("trip_attendees")
            .select("user_id")
            .eq("trip_id", tripId)
            .eq("user_id", userId)
            .maybeSingle();
          setAttendanceStatus(fallbackMine ? 'going' : null);
        } else if (mine) {
          setAttendanceStatus((mine as any).status || 'going');
        } else {
          setAttendanceStatus(null);
        }
        setAttendanceLoaded(true);
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

    const channel = supabase
      .channel(`trip-${tripId}-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_attendees", filter: `trip_id=eq.${tripId}` }, () => loadAttendees(tripId))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, userId, primaryRole]);

  async function updateAttendance(status: 'going' | 'not_going') {
    if (!userId || saving) return;
    setSaving(true);

    try {
      const isRemoving = attendanceStatus === status;

      // Always clear existing attendance for this trip
      await supabase.from("trip_attendees").delete().eq("trip_id", tripId).eq("user_id", userId);

      if (isRemoving) {
        setAttendanceStatus(null);
        toast.success("تم إلغاء اختيارك");
      } else {
        setAttendanceStatus(status);
        const { error } = await supabase
          .from("trip_attendees")
          .insert({ trip_id: tripId, user_id: userId, status: status } as any);

        if (error) {
          // Fallback if status column is missing
          await supabase.from("trip_attendees").insert({ trip_id: tripId, user_id: userId });
        }

        if (status === 'going') toast.success("تم تأكيد حضورك");
        else toast.info("تم تسجيل اعتذارك");
      }

      await loadAttendees(tripId);
    } catch (err: any) {
      console.error("Attendance update error:", err);
      toast.error("حدث خطأ أثناء تحديث حالة الحضور");
    } finally {
      setSaving(false);
    }
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
      <div className="max-w-6xl mx-auto space-y-8 pb-20" dir="rtl">
        <QuickActionsBanner />

        {/* Navigation Header */}
        <div className="flex items-center justify-between px-4 md:px-0">
          <Link
            to="/trips"
            className="group flex items-center gap-3 text-muted-foreground hover:text-gold-primary transition-all font-black text-xs uppercase tracking-widest"
          >
            <div className="size-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-gold-primary group-hover:text-black transition-all">
              <ArrowRight className="size-4" />
            </div>
            العودة إلى الرحلات
          </Link>
          <div className="flex items-center gap-2">
            <button className="size-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-gold-primary/20 transition-all text-gold-primary">
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <article className="space-y-8">
          {/* Immersive Hero Header */}
          <div className="relative h-[400px] md:h-[500px] w-full overflow-hidden rounded-[48px] shadow-2xl border-4 border-white/5 group">
            <TripImage
              path={trip.image_url}
              alt={trip.title}
              className="absolute inset-0 size-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            {/* Multi-layered overlays for better readability and style */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10" />

            {/* Decorative Family Mark */}
            <div className="absolute top-10 left-10 opacity-20 pointer-events-none z-20 hidden md:block">
              <img src={dynamicLogo || alsaifMark?.url || ""} className="size-32 object-contain brightness-0 invert" alt="" />
            </div>

            <div className="absolute bottom-0 right-0 left-0 p-8 md:p-16 z-20 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-1 w-12 bg-gold-primary rounded-full" />
                {trip.badge && (
                  <span className="px-4 py-1.5 bg-gold-primary text-black text-[10px] font-black rounded-full uppercase tracking-[0.2em] shadow-xl">
                    {trip.badge}
                  </span>
                )}
                <span className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-md shadow-xl",
                  trip.status === "upcoming" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" : "bg-white/10 text-white border-white/10"
                )}>
                  {statusLabel(trip.status)}
                </span>
              </div>

              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl">
                {trip.title}
              </h2>

              <div className="flex flex-wrap items-center gap-6 text-white/80 font-bold">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <MapPin className="size-5 text-gold-primary" />
                  <span>{trip.location || "وجهة عائلية"}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <Calendar className="size-5 text-gold-primary" />
                  <span>{formatRange(trip.start_date, trip.end_date)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Content Column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Description Card */}
              <div className="card-surface p-8 md:p-12 rounded-[40px] space-y-6 border-none shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                  <Info size={120} />
                </div>
                <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-xs">
                  <Compass size={18} /> وصف الرحلة
                </div>
                <p className="text-lg md:text-xl font-bold text-foreground/80 leading-relaxed whitespace-pre-line relative z-10">
                  {trip.description?.trim() || "لا يوجد وصف لهذه الرحلة."}
                </p>
              </div>

              {/* Attendees Section */}
              <div className="card-surface p-8 md:p-12 rounded-[40px] space-y-8 border-none shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-xs">
                    <Users size={18} /> المشاركون المؤكدون
                  </div>
                  <span className="px-4 py-1.5 bg-primary/5 rounded-full border border-primary/10 text-xs font-black">
                    {attendees.length} عضو
                  </span>
                </div>

                {attendees.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-4 opacity-30 border-2 border-dashed border-border rounded-3xl">
                    <Users size={48} strokeWidth={1} />
                    <p className="font-bold text-lg text-muted-foreground">لم يقم أحد بتأكيد الحضور بعد.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {attendees.map((a) => (
                      <div
                        key={a.user_id}
                        className="group flex items-center gap-4 p-4 rounded-[28px] bg-muted/30 hover:bg-gold-primary/5 border border-border/40 transition-all duration-300"
                      >
                        <div className="size-12 rounded-2xl overflow-hidden shadow-lg border-2 border-white/5 transition-transform group-hover:scale-110">
                          <UserAvatar
                            path={a.avatarPath}
                            name={a.name}
                            initial={a.initial}
                            className="size-full"
                            userId={a.user_id}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-base font-black text-foreground truncate block">{a.name}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">عضو مؤكد</span>
                        </div>
                        <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <CheckCircle2 size={16} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isPrivileged && (
                  <p className="text-[10px] text-center text-muted-foreground opacity-50 font-bold">
                    ملاحظة: التفاصيل الكاملة للحضور متاحة للمشرفين فقط في لوحة الإدارة.
                  </p>
                )}
              </div>
            </div>

            {/* Right Sidebar Column */}
            <div className="space-y-8">
            {/* Action Card */}
            <div className={cn(
              "card-surface p-8 rounded-[40px] border-none shadow-2xl transition-all duration-500 space-y-8 relative overflow-hidden group/action",
              attendanceStatus === 'going'
                ? "bg-emerald-600 text-white ring-4 ring-emerald-500/30 shadow-emerald-900/40"
                : attendanceStatus === 'not_going'
                ? "bg-rose-600 text-white ring-4 ring-rose-500/30 shadow-rose-900/40"
                : "bg-primary text-primary-foreground"
            )}>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/action:opacity-100 transition-opacity" />

              <div className="relative z-10 space-y-4">
                {attendanceStatus === 'going' ? (
                  <>
                    <div className="size-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4 shadow-inner">
                      <CheckCircle2 className="size-8 text-white" strokeWidth={4} />
                    </div>
                    <h3 className="text-4xl font-black tracking-tight">ننتظر تشريفك!</h3>
                    <p className="text-base font-bold text-white/90 leading-relaxed">تم تأكيد حضورك للرحلة. يسعدنا جداً انضمامك إلينا، ونتطلع لقضاء وقت ممتع سوياً.</p>
                  </>
                ) : attendanceStatus === 'not_going' ? (
                  <>
                    <div className="size-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4 shadow-inner">
                      <X className="size-8 text-white" strokeWidth={4} />
                    </div>
                    <h3 className="text-4xl font-black tracking-tight">نعتذر لعدم حضورك</h3>
                    <p className="text-base font-bold text-white/90 leading-relaxed">يؤسفنا جداً عدم تمكنك من التواجد معنا في هذه الرحلة. مكانك سيظل خالياً، ونتطلع لرؤيتك في مناسبات قادمة بإذن الله.</p>
                  </>
                ) : (
                  <>
                    <Clock className="size-8 opacity-40 animate-pulse" />
                    <h3 className="text-3xl font-black tracking-tight">هل ستنضم إلينا؟</h3>
                    <p className="text-sm font-bold opacity-70 leading-relaxed">أكد حضورك الآن لتساعدنا في تنظيم الرحلة بشكل أفضل.</p>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => updateAttendance('going')}
                  disabled={saving || !userId || !attendanceLoaded || rolesLoading}
                  className={cn(
                    "relative w-full py-5 rounded-[24px] font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95",
                    attendanceStatus === 'going'
                      ? "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                      : "bg-gold-primary text-black hover:scale-[1.02] hover:shadow-gold-primary/20"
                  )}
                >
                  {saving ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : attendanceStatus === 'going' ? (
                    <>
                      <CheckCircle2 size={20} strokeWidth={3} />
                      تم تأكيد حضورك
                    </>
                  ) : (
                    <>
                      سأحضر
                      <ChevronLeft size={20} strokeWidth={3} />
                    </>
                  )}
                </button>

                {attendanceStatus !== 'not_going' && (
                  <button
                    onClick={() => updateAttendance('not_going')}
                    disabled={saving || !userId || !attendanceLoaded || rolesLoading}
                    className={cn(
                      "relative w-full py-4 rounded-[24px] font-black text-sm transition-all flex items-center justify-center gap-3 active:scale-95 border",
                      "bg-transparent text-white/60 border-white/10 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    لن أحضر
                  </button>
                )}
              </div>
            </div>

              {/* Trip Info Sidebar Card */}
              <div className="card-surface p-8 rounded-[40px] space-y-8 border-none shadow-xl">
                <div className="flex items-center gap-3 text-primary font-black uppercase tracking-[0.3em] text-xs">
                  <Info size={18} /> تفاصيل إضافية
                </div>

                <div className="space-y-6">
                  <SidebarStat icon={Tent} label="نوع الإقامة" value="مخيم عائلي فاخر" />
                  <SidebarStat icon={Clock} label="آخر موعد للتسجيل" value={formatDate(trip.start_date)} />
                  {trip.location_url && (
                    <div className="pt-4 border-t border-border/40">
                      <a
                        href={trip.location_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 hover:bg-gold-primary/10 hover:text-gold-primary transition-all border border-transparent hover:border-gold-primary/20 group"
                      >
                        <div className="flex items-center gap-3">
                          <MapPin size={20} />
                          <span className="text-sm font-black">موقع الوجهة</span>
                        </div>
                        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </AppShell>
  );
}

function SidebarStat({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-start gap-4">
      <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 border border-primary/10">
        <Icon size={20} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">{label}</p>
        <p className="text-base font-black text-foreground tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return "—";
  }
}
