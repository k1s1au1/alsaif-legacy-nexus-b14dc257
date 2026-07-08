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
  X,
  ListChecks,
  Plus,
  Trash2,
  UserCheck,
  UserX
} from "lucide-react";
import { TripImage } from "@/components/trip-image";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { cn } from "@/lib/utils";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { toast } from "sonner";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { addToCalendar } from "@/lib/calendar";

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
  const [companionsCount, setCompanionsCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [attendees, setAttendees] = useState<
    { user_id: string; name: string; initial: string; avatarPath: string | null; companions_count: number }[]
  >([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [addingItem, setAddingItem] = useState(false);
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
        .select("user_id, created_at, status, companions_count")
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
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));

    // Map with companions count
    const rowsMap = new Map(rows.map(r => [r.user_id, r.companions_count || 0]));

    setAttendees(
      ids.map((id) => {
        const p = map.get(id) as any;
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
        return {
          user_id: id,
          name,
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
          companions_count: rowsMap.get(id) || 0
        };
      }),
    );
  }

  async function loadChecklist(tid: string) {
    try {
      const { data: items, error } = await supabase
        .from("trip_items")
        .select("id,name,assigned_to,created_by,created_at")
        .eq("trip_id", tid)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const parsedItems = ((items ?? []) as any[]).map((item) => ({
        id: item.id,
        name: item.name,
        assigned_to: item.assigned_to,
        created_by: item.created_by,
        created_at: item.created_at,
      }));

      const profileIds = Array.from(
        new Set(parsedItems.flatMap((item) => [item.created_by, item.assigned_to]).filter(Boolean))
      );
      const { data: profs } = profileIds.length
        ? await supabase
            .from("profiles")
            .select("id, arabic_name, full_name, avatar_url")
            .in("id", profileIds)
        : { data: [] as any[] };
      const profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

      const enriched = parsedItems.map((item) => ({
        ...item,
        creator: profileMap.get(item.created_by) ?? null,
        assignee: item.assigned_to ? profileMap.get(item.assigned_to) ?? null : null,
      }));

      setChecklist(enriched);
    } catch (err: any) {
      console.error("Load checklist error:", err);
    }
  }


  async function addItem() {
    if (!newItemName.trim() || !userId) return;
    setAddingItem(true);

    try {
      const { error } = await supabase
        .from("trip_items")
        .insert({
          trip_id: tripId,
          name: newItemName.trim(),
          created_by: userId,
          assigned_to: null,
        });

      if (error) throw error;

      setNewItemName("");
      toast.success("تمت إضافة الغرض للقائمة");
      await loadChecklist(tripId);
    } catch (err: any) {
      console.error("Add item error:", err);
      toast.error("تعذر إضافة الغرض");
    } finally {
      setAddingItem(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("حذف الغرض؟")) return;
    try {
      const { error } = await supabase
        .from("trip_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setChecklist(prev => prev.filter(item => item.id !== id));
      toast.success("تم الحذف");
    } catch (err: any) {
      toast.error("فشل الحذف");
    }
  }

  async function toggleClaim(item: any) {
    if (!userId) return;

    const isMine = item.assigned_to === userId;
    const newAssignedTo = isMine ? null : userId;

    try {
      const { error } = await supabase
        .from("trip_items")
        .update({ assigned_to: newAssignedTo })
        .eq("id", item.id);

      if (error) throw error;

      await loadChecklist(tripId);
      toast.success(isMine ? "تم إلغاء التطوع" : "شكراً لتطوعك");
    } catch (err: any) {
      toast.error("فشل تحديث الحالة");
    }
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
          .select("status, companions_count")
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
          setCompanionsCount(0);
        } else if (mine) {
          setAttendanceStatus((mine as any).status || 'going');
          setCompanionsCount((mine as any).companions_count || 0);
        } else {
          setAttendanceStatus(null);
          setCompanionsCount(0);
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
      await loadChecklist(tripId);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`trip-${tripId}-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_attendees", filter: `trip_id=eq.${tripId}` }, () => loadAttendees(tripId))
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_items", filter: `trip_id=eq.${tripId}` }, () => loadChecklist(tripId))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, userId, primaryRole]);

  async function updateAttendance(status: 'going' | 'not_going', companions: number = 0, isExplicitClick: boolean = false) {
    if (!userId || saving) return;

    const prevStatus = attendanceStatus;
    const prevCompanions = companionsCount;

    // Logic for toggling off if clicking the same button
    const isRemoving = isExplicitClick && attendanceStatus === status && companionsCount === companions;

    if (!isExplicitClick && attendanceStatus === status && companionsCount === companions) {
      // Don't do anything if it's just an auto-save (onBlur) and nothing changed
      return;
    }

    // Optimistic UI
    setAttendanceStatus(isRemoving ? null : status);
    if (!isRemoving) setCompanionsCount(companions);
    setSaving(true);

    try {
      if (isRemoving || status === 'not_going') {
        const { error } = await supabase
          .from("trip_attendees")
          .delete()
          .eq("trip_id", tripId)
          .eq("user_id", userId);

        if (error) {
           // If delete fails, maybe try upserting status if column exists
           const { error: upsertError } = await supabase
             .from("trip_attendees")
             .upsert({ trip_id: tripId, user_id: userId, status: 'not_going' }, { onConflict: "trip_id,user_id" });
           if (upsertError) throw upsertError;
        }

        if (status === 'not_going') toast.info("تم تسجيل اعتذارك");
        else toast.success("تم إلغاء اختيارك");
      } else {
        // Attempt upsert with all fields
        const payload: any = { trip_id: tripId, user_id: userId, status, companions_count: companions };

        const { error } = await supabase
          .from("trip_attendees")
          .upsert(payload, { onConflict: "trip_id,user_id" });

        if (error) {
          // Graceful fallback: try without companions_count or status if they are missing from DB
          console.warn("Retrying trip attendance without extended fields...");
          const { error: retryError } = await supabase
            .from("trip_attendees")
            .upsert({ trip_id: tripId, user_id: userId }, { onConflict: "trip_id,user_id" });
          if (retryError) throw retryError;
        }

        if (status === 'going') {
          if (prevStatus === 'going') {
             if (prevCompanions !== companions) toast.success("تم تحديث عدد المرافقين بنجاح ✨");
          } else {
             toast.success("تم تأكيد حضورك ✨");
          }
        }
      }

      await loadAttendees(tripId);
    } catch (err: any) {
      console.error("Attendance update error:", err);
      toast.error("حدث خطأ أثناء تحديث حالة الحضور");
      setAttendanceStatus(prevStatus);
      setCompanionsCount(prevCompanions);
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
            العودة إلى الترفيه
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => trip && addToCalendar({
                title: trip.title,
                description: trip.description || "",
                location: trip.location || "",
                startTime: trip.start_date || new Date().toISOString(),
              })}
              className="px-4 py-2 rounded-full bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary border border-gold-primary/20 transition-all font-black text-[10px] flex items-center gap-2"
            >
               <Calendar size={14} /> إضافة للتقويم
            </button>
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
            <div className="absolute top-10 left-10 opacity-30 pointer-events-none z-20 hidden md:block">
              <div
                className="size-32 logo-alsaif-banner"
                style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
              />
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
                  trip.status === "upcoming" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-white/10 text-white border-white/10"
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

          {/* Premium Attendance Card — Meeting Style */}
          <div className="animate-fade-up">
            <div className={cn(
              "relative min-h-[300px] overflow-hidden rounded-[48px] p-8 md:p-12 text-white shadow-2xl transition-all duration-700 flex flex-col justify-between gap-8",
              attendanceStatus === 'going' ? "bg-emerald-950" :
              attendanceStatus === 'not_going' ? "bg-rose-950" :
              "bg-emerald-900/90"
            )}>
              {/* Background Gradient & Watermark */}
              <div className={cn(
                "absolute inset-0 transition-opacity duration-700 z-0",
                attendanceStatus === 'going' ? "bg-gradient-to-br from-emerald-900 via-emerald-950 to-black" :
                attendanceStatus === 'not_going' ? "bg-gradient-to-br from-rose-900 via-rose-950 to-black" :
                "bg-gradient-to-br from-[#064E3B] via-[#051410] to-black"
              )} />

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none scale-[2] logo-alsaif-banner z-1"
                   style={{ '--logo-url': dynamicLogo ? `url(${dynamicLogo})` : 'none' } as any} />

              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                 <div className="space-y-4 text-center md:text-right">
                    <div className="flex items-center justify-center md:justify-start gap-3">
                       <div className="size-12 rounded-2xl bg-gold-primary/20 backdrop-blur-xl flex items-center justify-center text-gold-primary border border-gold-primary/20">
                          <Users size={24} />
                       </div>
                       <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">مركز تأكيد الحضور</span>
                    </div>
                    <h3 className="text-3xl md:text-5xl font-black tracking-tighter">
                       {attendanceStatus === 'going' ? "سعداء بانضمامك!" :
                        attendanceStatus === 'not_going' ? "سنفتقدك هذه المرة" :
                        "هل ستنضم إلينا؟"}
                    </h3>
                    <div className="flex items-center justify-center md:justify-start gap-4">
                       <p className="text-base font-bold text-white/60">
                          {attendanceStatus === 'going' ? "تم تأكيد حضورك، ننتظرك بكل حب." :
                           attendanceStatus === 'not_going' ? "تم تسجيل اعتذارك، نراك في مناسبات قادمة." :
                           "أكد حضورك الآن لنرتب لك مكاناً يليق بك في رحلتنا العائلية."}
                       </p>
                    </div>
                 </div>

                 {/* Real-time Counter Stats */}
                 <div className="flex items-center gap-4">
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[32px] p-6 text-center min-w-[140px] shadow-2xl">
                       <span className="block text-4xl md:text-5xl font-black text-gold-primary tabular-nums leading-none">
                          {attendees.reduce((acc, curr) => acc + 1 + curr.companions_count, 0)}
                       </span>
                       <span className="block text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">إجمالي الحضور</span>
                    </div>
                 </div>
              </div>

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-end">
                 {/* Companions Section (only if going) */}
                 <div className="w-full">
                    <AnimatePresence>
                       {attendanceStatus === 'going' && (
                         <motion.div
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: 10 }}
                           className="flex flex-col gap-2 bg-white/5 p-5 rounded-[32px] border border-white/10"
                         >
                            <div className="flex items-center justify-between px-2">
                               <p className="text-[10px] font-black text-gold-primary uppercase tracking-widest">عدد المرافقين معك؟</p>
                               <div className="bg-gold-primary/20 px-4 py-1 rounded-full">
                                  <span className="text-sm font-black text-gold-primary">{1 + companionsCount} حاضرين (أنت + الضيوف)</span>
                               </div>
                            </div>
                            <input
                              type="tel"
                              value={companionsCount === 0 ? "" : companionsCount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setCompanionsCount(val === '' ? 0 : parseInt(val));
                              }}
                              onBlur={() => updateAttendance('going', companionsCount)}
                              className="w-full h-20 bg-black/20 border-2 border-white/10 rounded-[24px] px-6 font-black text-center text-4xl focus:outline-none focus:border-gold-primary transition-all text-white shadow-inner"
                              placeholder="٠"
                            />
                         </motion.div>
                       )}
                    </AnimatePresence>
                 </div>

                 {/* RSVP Switcher */}
                 <div className="relative bg-white/5 backdrop-blur-3xl border border-white/10 p-1.5 rounded-[32px] grid grid-cols-2 gap-1.5 shadow-2xl h-[76px] w-full overflow-hidden">
                    <div
                      className={cn(
                        "absolute inset-y-1.5 w-[calc(50%-7.5px)] rounded-[26px] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-[0_10px_30px_rgba(0,0,0,0.5)]",
                        attendanceStatus === 'going' ? "right-1.5 bg-emerald-500" :
                        attendanceStatus === 'not_going' ? "right-[calc(50%+1.5px)] bg-rose-500" :
                        "opacity-0"
                      )}
                    />

                    <button
                      onClick={() => updateAttendance('going', companionsCount, true)}
                      disabled={saving || !userId || !attendanceLoaded || rolesLoading}
                      className={cn(
                        "relative z-10 flex items-center justify-center gap-3 font-black text-sm md:text-lg transition-all duration-500",
                        attendanceStatus === 'going' ? "text-white" : "text-white/40 hover:text-white/60 active:scale-95"
                      )}
                    >
                      {saving && attendanceStatus === 'going' ? <Loader2 size={24} className="animate-spin" /> : <UserCheck size={24} strokeWidth={2.5} />}
                      <span>سأحضر</span>
                    </button>

                    <button
                      onClick={() => updateAttendance('not_going', 0, true)}
                      disabled={saving || !userId || !attendanceLoaded || rolesLoading}
                      className={cn(
                        "relative z-10 flex items-center justify-center gap-3 font-black text-sm md:text-lg transition-all duration-500",
                        attendanceStatus === 'not_going' ? "text-white" : "text-white/40 hover:text-white/60 active:scale-95"
                      )}
                    >
                      {saving && attendanceStatus === 'not_going' ? <Loader2 size={24} className="animate-spin" /> : <UserX size={24} strokeWidth={2.5} />}
                      <span>أعتذر</span>
                    </button>
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

              {/* Shared Checklist Section */}
              <div className="card-surface p-8 md:p-12 rounded-[40px] space-y-8 border-none shadow-xl">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-xs">
                       <ListChecks size={18} /> أغراض الرحلة (من سيحضر ماذا؟)
                    </div>
                 </div>

                 {isPrivileged && (
                   <div className="flex gap-3">
                      <input
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="أضف غرضاً مطلوباً (مثلاً: القهوة، ذبيحة...)"
                        className="flex-1 bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                      />
                      <button
                        onClick={addItem}
                        disabled={addingItem}
                        className="btn-gold size-14 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all"
                      >
                         {addingItem ? <Loader2 className="size-5 animate-spin" /> : <Plus size={24} strokeWidth={3} />}
                      </button>
                   </div>
                 )}

                 {checklist.length === 0 ? (
                   <div className="py-12 flex flex-col items-center justify-center text-center gap-4 opacity-30 border-2 border-dashed border-border rounded-3xl">
                      <ListChecks size={48} strokeWidth={1} />
                      <p className="font-bold text-lg text-muted-foreground">لا توجد أغراض مطلوبة حالياً.</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 gap-3">
                       {checklist.map((item) => {
                         const isMine = item.assigned_to === userId;
                         const isTaken = !!item.assigned_to;
                          const assigneeName = item.assignee?.arabic_name || item.assignee?.full_name || "عضو";

                         return (
                           <div key={item.id} className={cn(
                             "group flex items-center justify-between p-4 md:p-6 rounded-3xl border transition-all duration-300",
                             isTaken ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/20 border-border/40"
                           )}>
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                 <div className={cn(
                                   "size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                   isTaken ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                                 )}>
                                    {isTaken ? <UserCheck size={20} /> : <Tent size={20} />}
                                 </div>
                                 <div className="min-w-0">
                                    <p className={cn("text-base md:text-lg font-black truncate", isTaken && "text-emerald-600")}>{item.name}</p>
                                    {isTaken && (
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">سيحضره: {assigneeName} {isMine && "(أنت)"}</p>
                                    )}
                                 </div>
                              </div>

                             <div className="flex items-center gap-2">
                                {isPrivileged && (
                                  <button onClick={() => deleteItem(item.id)} className="size-10 rounded-xl hover:bg-rose-500/10 text-rose-500 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                                )}
                                <button
                                  onClick={() => toggleClaim(item)}
                                  className={cn(
                                    "px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95",
                                    isMine ? "bg-rose-500 text-white hover:bg-rose-600" :
                                    isTaken ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50" :
                                    "bg-emerald-500 text-white hover:bg-emerald-600"
                                  )}
                                  disabled={isTaken && !isMine}
                                >
                                   {isMine ? "إلغاء التطوع" : isTaken ? "تم الحجز" : "سأحضره أنا"}
                                </button>
                             </div>
                          </div>
                        );
                      })}
                   </div>
                 )}
              </div>

              {/* Attendees Section */}
              <div className="card-surface p-8 md:p-12 rounded-[40px] space-y-8 border-none shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-xs">
                    <Users size={18} /> المشاركون المؤكدون
                  </div>
                  <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 text-xs font-black">
                    {attendees.reduce((acc, curr) => acc + 1 + curr.companions_count, 0)} حاضرين
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
                          <div className="flex items-center gap-2">
                             <span className="text-base font-black text-foreground truncate">{a.name}</span>
                             {a.companions_count > 0 && (
                               <span className="text-[9px] font-black bg-gold-primary/10 text-gold-primary px-2 py-0.5 rounded-full border border-gold-primary/20 shrink-0">
                                  +{a.companions_count} مرافقين
                               </span>
                             )}
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 block">عضو مؤكد</span>
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
              {/* Trip Info Sidebar Card */}
              <div className="card-surface p-8 rounded-[40px] space-y-8 border-none shadow-xl relative overflow-hidden">
                {/* Decorative Pattern */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gold-primary/20" />

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
