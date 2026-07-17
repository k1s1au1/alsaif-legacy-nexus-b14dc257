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
  UserX,
  Navigation,
} from "lucide-react";
import { TripImage } from "@/components/trip-image";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { cn } from "@/lib/utils";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { toast } from "sonner";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { addToCalendar } from "@/lib/calendar";
import { FamilySharing } from "@/lib/native-bridge";

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
  const [attendanceStatus, setAttendanceStatus] = useState<"going" | "not_going" | null>(null);
  const [companionsCount, setCompanionsCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [attendees, setAttendees] = useState<
    {
      user_id: string;
      name: string;
      initial: string;
      avatarPath: string | null;
      companions_count: number;
    }[]
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
        .select("user_id, status, companions_count")
        .eq("trip_id", tid);

      if (error) {
        const { data: fallbackRows } = await supabase
          .from("trip_attendees")
          .select("user_id")
          .eq("trip_id", tid);
        processAttendees(fallbackRows || []);
      } else {
        const goingRows = ((rows || []) as any[]).filter(
          (r: any) => !r.status || r.status === "going",
        );
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
    const rowsMap = new Map(rows.map((r) => [r.user_id, r.companions_count || 0]));

    setAttendees(
      ids.map((id) => {
        const p = map.get(id) as any;
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
        return {
          user_id: id,
          name,
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
          companions_count: rowsMap.get(id) || 0,
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

      const profileIds = Array.from(
        new Set((items || []).flatMap((i: any) => [i.created_by, i.assigned_to]).filter(Boolean)),
      );
      const { data: profs } = profileIds.length
        ? await supabase
            .from("profiles")
            .select("id, arabic_name, full_name, avatar_url")
            .in("id", profileIds)
        : { data: [] };
      const profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

      setChecklist(
        (items || []).map((item: any) => ({
          ...item,
          creator: profileMap.get(item.created_by) ?? null,
          assignee: item.assigned_to ? (profileMap.get(item.assigned_to) ?? null) : null,
        })),
      );
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
        .insert({ trip_id: tripId, name: newItemName.trim(), created_by: userId });
      if (error) throw error;
      setNewItemName("");
      toast.success("تمت إضافة الغرض للقائمة");
      await loadChecklist(tripId);
    } catch (err: any) {
      toast.error("تعذر إضافة الغرض");
    } finally {
      setAddingItem(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("حذف الغرض؟")) return;
    try {
      const { error } = await supabase.from("trip_items").delete().eq("id", id);
      if (error) throw error;
      setChecklist((prev) => prev.filter((item) => item.id !== id));
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
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
        setProfile({
          name,
          role: roleLabel(primaryRole),
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });

        const { data: mine } = await supabase
          .from("trip_attendees")
          .select("status, companions_count")
          .eq("trip_id", tripId)
          .eq("user_id", userId)
          .maybeSingle();
        if (mine) {
          setAttendanceStatus((mine as any).status || "going");
          setCompanionsCount((mine as any).companions_count || 0);
        } else {
          setAttendanceStatus(null);
          setCompanionsCount(0);
        }
        setAttendanceLoaded(true);
      }
      const { data: t } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
      setTrip((t as Trip | null) ?? null);
      await loadAttendees(tripId);
      await loadChecklist(tripId);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`trip-${tripId}-realtime`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_attendees", filter: `trip_id=eq.${tripId}` },
        () => loadAttendees(tripId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_items", filter: `trip_id=eq.${tripId}` },
        () => loadChecklist(tripId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, userId, primaryRole]);

  async function updateAttendance(
    status: "going" | "not_going",
    companions: number = 0,
    isExplicitClick: boolean = false,
  ) {
    if (!userId || saving) return;
    const prevStatus = attendanceStatus;
    const prevCompanions = companionsCount;
    const isRemoving =
      isExplicitClick && attendanceStatus === status && companionsCount === companions;

    if (!isExplicitClick && attendanceStatus === status && companionsCount === companions) return;

    setAttendanceStatus(isRemoving ? null : status);
    if (!isRemoving) setCompanionsCount(companions);
    setSaving(true);

    try {
      if (isRemoving || status === "not_going") {
        await supabase.from("trip_attendees").delete().eq("trip_id", tripId).eq("user_id", userId);
        if (status === "not_going") toast.info("تم تسجيل اعتذارك");
        else toast.success("تم إلغاء اختيارك");
      } else {
        const payload: any = {
          trip_id: tripId,
          user_id: userId,
          status: "going",
          companions_count: companions,
        };
        const { error } = await supabase
          .from("trip_attendees")
          .upsert(payload, { onConflict: "trip_id,user_id" });
        if (error) {
          await supabase
            .from("trip_attendees")
            .upsert({ trip_id: tripId, user_id: userId }, { onConflict: "trip_id,user_id" });
        }
        if (status === "going") {
          if (prevStatus === "going") {
            if (prevCompanions !== companions) toast.success("تم تحديث عدد المرافقين ✨");
          } else toast.success("تم تأكيد حضورك ✨");
        }
      }
      await loadAttendees(tripId);
    } catch (err: any) {
      toast.error("حدث خطأ في تحديث الحضور");
      setAttendanceStatus(prevStatus);
      setCompanionsCount(prevCompanions);
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <AppShell title="الرحلات" user={profile}>
        <div className="p-20 text-center opacity-40">جاري التحميل...</div>
      </AppShell>
    );
  if (!trip)
    return (
      <AppShell title="الرحلات" user={profile}>
        <div className="card-surface p-10 text-center">
          <p className="text-muted-foreground">لم يتم العثور على الرحلة.</p>
          <Link
            to="/trips"
            className="mt-4 inline-flex items-center gap-2 text-gold-primary text-sm"
          >
            <ArrowRight className="size-4" />
            العودة للقائمة
          </Link>
        </div>
      </AppShell>
    );

  return (
    <AppShell title={trip.title} user={profile}>
      <div className="max-w-6xl mx-auto space-y-8 pb-32 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        <div className="flex items-center justify-between px-2">
          <Link
            to="/trips"
            className="group flex items-center gap-3 text-muted-foreground hover:text-gold-primary transition-all font-black text-xs uppercase tracking-widest"
          >
            <div className="size-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-gold-primary group-hover:text-black transition-all">
              <ArrowRight className="size-4" />
            </div>
            العودة للترفيه
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                trip &&
                addToCalendar({
                  title: trip.title,
                  description: trip.description || "",
                  location: trip.location || "",
                  startTime: trip.start_date || new Date().toISOString(),
                })
              }
              className="px-4 py-2 rounded-full bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary border border-gold-primary/20 transition-all font-black text-[10px] flex items-center gap-2"
            >
              <Calendar size={14} /> إضافة للتقويم
            </button>
            <button
              onClick={() => trip && FamilySharing.shareInvitation({
                title: trip.title,
                date: formatRange(trip.start_date, trip.end_date),
                location: trip.location || "وجهة عائلية"
              })}
              className="size-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-gold-primary/20 transition-all text-gold-primary"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <article className="space-y-8">
          {/* Hero Header - Square on Mobile */}
          <div className="relative aspect-square md:aspect-auto md:h-[500px] w-full overflow-hidden rounded-[32px] md:rounded-[48px] shadow-2xl border-4 border-white/5 group">
            <TripImage
              path={trip.image_url}
              alt={trip.title}
              className="absolute inset-0 size-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10" />
            <div className="absolute bottom-0 right-0 left-0 p-8 md:p-16 z-20 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-1 w-12 bg-gold-primary rounded-full" />
                {trip.badge && (
                  <span className="px-4 py-1.5 bg-gold-primary text-black text-[10px] font-black rounded-full uppercase tracking-[0.2em] shadow-xl">
                    {trip.badge}
                  </span>
                )}
                <span
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-md shadow-xl",
                    trip.status === "upcoming"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-white/10 text-white border-white/10",
                  )}
                >
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
            <div className="lg:col-span-3 space-y-6 md:space-y-8">
              {/* MERGED PREMIUM TRIP HUB BANNER - Separated on Mobile */}
              <div className={cn(
                "relative overflow-hidden rounded-[32px] md:rounded-[48px] shadow-2xl border border-white/10 group md:min-h-[500px] flex flex-col-reverse md:flex-row transition-all duration-700",
                attendanceStatus === "going" ? "bg-emerald-950" : attendanceStatus === "not_going" ? "bg-rose-950" : "bg-[#0a1a16]"
              )}>
                {/* Journey identity layer: trip image, family mark, and a quiet route motif */}
                {trip.image_url && (
                  <TripImage
                    path={trip.image_url}
                    alt=""
                    className="absolute inset-0 size-full object-cover opacity-[0.07] mix-blend-screen pointer-events-none"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/35 pointer-events-none" />
                {dynamicLogo && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none">
                    <img
                      src={dynamicLogo}
                      alt=""
                      className="size-[18rem] md:size-[28rem] object-contain grayscale mix-blend-screen rotate-[-8deg]"
                    />
                  </div>
                )}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 text-gold-primary/40 pointer-events-none">
                  <div className="w-16 md:w-24 border-t border-dashed border-gold-primary/30" />
                  <Navigation className="size-4 md:size-5" />
                  <span className="text-[9px] md:text-[10px] font-black tracking-[0.3em] whitespace-nowrap">رحلة تجمعنا</span>
                  <div className="w-16 md:w-24 border-t border-dashed border-gold-primary/30" />
                </div>

                {/* Background Decoration - Desktop Only */}
                <div className="absolute top-0 right-0 p-12 opacity-[0.08] pointer-events-none hidden md:block">
                  <Tent size={240} className="text-white" />
                </div>
                <div className="absolute bottom-0 left-0 p-12 opacity-[0.08] pointer-events-none -rotate-12 hidden md:block">
                  <Compass size={180} className="text-white" />
                </div>

                {/* Left Side (or Top on Mobile): Attendance & Participants */}
                <div className={cn(
                  "md:w-1/3 p-6 md:p-12 flex flex-col justify-between space-y-6 md:space-y-10 relative z-10",
                  "bg-white/5 backdrop-blur-sm md:border-l border-white/10 rounded-[28px] md:rounded-none m-2 md:m-0 shadow-xl md:shadow-none"
                )}>
                  <div className="space-y-4 md:space-y-6">
                    <div className="space-y-2 md:space-y-3">
                      <h3 className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tight">هل ستنضم إلينا؟</h3>
                      <p className="text-xs md:text-sm font-bold leading-relaxed text-emerald-100/60">أكد حضورك الآن لتساعدنا في تنظيم الرحلة بشكل أفضل.</p>
                    </div>

                    <div className="flex flex-col gap-3 md:gap-4">
                      {attendanceStatus === "going" && (
                        <div className="flex flex-col gap-2 md:gap-3 animate-fade-up bg-white/10 p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-white/10 shadow-inner">
                          <div className="flex items-center justify-between px-1">
                            <p className="text-[9px] md:text-[10px] font-black text-gold-primary uppercase tracking-widest">عدد المرافقين معك؟</p>
                            <div className="text-center bg-gold-primary/20 px-2 py-0.5 md:px-3 md:py-1 rounded-lg border border-gold-primary/20">
                              <span className="text-[12px] md:text-[14px] font-black leading-none text-gold-primary">{1 + companionsCount} حاضرين</span>
                            </div>
                          </div>
                          <input
                            type="tel"
                            value={companionsCount === 0 ? "" : companionsCount}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              setCompanionsCount(val === "" ? 0 : parseInt(val));
                            }}
                            onBlur={() => updateAttendance("going", companionsCount)}
                            className="w-full h-12 md:h-16 bg-black/20 border-2 border-white/10 rounded-[18px] md:rounded-[24px] px-6 font-black text-center text-2xl md:text-3xl focus:outline-none focus:border-gold-primary transition-all text-white shadow-inner"
                            placeholder="٠"
                          />
                        </div>
                      )}

                      <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-[22px] md:rounded-[28px] grid grid-cols-2 gap-1 shadow-2xl overflow-hidden h-[60px] md:h-[70px]">
                        <div
                          className={cn(
                            "absolute inset-y-1 w-[calc(50%-4px)] rounded-[18px] md:rounded-[22px] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-lg",
                            attendanceStatus === "going" ? "right-1 bg-emerald-500 shadow-emerald-500/40" :
                            attendanceStatus === "not_going" ? "right-[calc(50%+1px)] bg-rose-500 shadow-rose-500/40" : "opacity-0"
                          )}
                        />
                        <button
                          onClick={() => updateAttendance("going", companionsCount, true)}
                          disabled={saving || !userId || !attendanceLoaded}
                          className={cn(
                            "relative z-10 flex items-center justify-center gap-2 md:gap-3 font-black text-xs md:text-sm transition-colors duration-500",
                            attendanceStatus === "going" ? "text-white" : "text-white/40 hover:text-white/60"
                          )}
                        >
                          {saving && attendanceStatus === "going" ? <Loader2 className="size-4 md:size-[18px] animate-spin" /> : <UserCheck className="size-[18px] md:size-5" />}
                          <span>سأحضر</span>
                        </button>
                        <button
                          onClick={() => updateAttendance("not_going", 0, true)}
                          disabled={saving || !userId || !attendanceLoaded}
                          className={cn(
                            "relative z-10 flex items-center justify-center gap-2 md:gap-3 font-black text-xs md:text-sm transition-colors duration-500",
                            attendanceStatus === "not_going" ? "text-white" : "text-white/40 hover:text-white/60"
                          )}
                        >
                          {saving && attendanceStatus === "not_going" ? <Loader2 className="size-4 md:size-[18px] animate-spin" /> : <UserX className="size-[18px] md:size-5" />}
                          <span>أعتذر</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 md:space-y-4 pt-4 md:pt-0">
                    <div className="flex items-center justify-between border-t border-white/10 pt-4 md:pt-6">
                      <div className="flex items-center gap-2 text-gold-primary font-black uppercase tracking-[0.2em] text-[9px] md:text-[10px]">
                        <Users className="size-3.5 md:size-4" /> المشاركون
                      </div>
                      <span className="text-[9px] md:text-[10px] font-black bg-white/10 text-white px-2 py-0.5 md:px-3 md:py-1 rounded-full">
                        {(() => {
                           const meInList = attendees.some(a => a.user_id === userId);
                           const othersSum = attendees
                             .filter(a => a.user_id !== userId)
                             .reduce((acc, curr) => acc + 1 + (curr.companions_count || 0), 0);

                           if (attendanceStatus === "going") {
                             return othersSum + 1 + companionsCount;
                           }

                           // If not going but was in list (unlikely with delete logic but safe)
                           return othersSum + (meInList ? 1 + (attendees.find(a => a.user_id === userId)?.companions_count || 0) : 0);
                        })()} حاضرين
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                       {attendees.slice(0, 5).map(a => (
                         <div key={a.user_id} className="relative group/avatar">
                            <div className="size-8 md:size-10 rounded-lg md:rounded-xl overflow-hidden ring-2 ring-white/10 shadow-lg transition-transform hover:scale-110">
                               <UserAvatar path={a.avatarPath} name={a.name} initial={a.initial} className="size-full" userId={a.user_id} />
                            </div>
                            {(a.user_id === userId ? companionsCount : a.companions_count) > 0 && (
                              <div className="absolute -top-1 -right-1 size-4 md:size-5 bg-gold-primary text-black text-[7px] md:text-[9px] font-black rounded-full flex items-center justify-center border border-emerald-950 z-10 shadow-lg">
                                +{a.user_id === userId ? companionsCount : a.companions_count}
                              </div>
                            )}
                         </div>
                       ))}
                       {attendees.length > 5 && (
                         <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[9px] md:text-[10px] font-black text-white">+{attendees.length - 5}</div>
                       )}
                       {attendees.length === 0 && <p className="text-[9px] md:text-[10px] font-bold text-white/30 italic">لا يوجد حضور مؤكد بعد</p>}
                    </div>
                  </div>
                </div>

                {/* Right Side (or Bottom on Mobile): Info & Description */}
                <div className={cn(
                  "flex-1 p-6 md:p-14 space-y-8 md:space-y-12 relative z-10",
                  "rounded-[28px] md:rounded-none m-2 md:m-0 bg-white/[0.02] md:bg-transparent border border-white/5 md:border-none shadow-xl md:shadow-none"
                )}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                    <div className="space-y-4 md:space-y-6">
                       <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-[10px] md:text-xs">
                          <Compass className="size-4 md:size-[18px]" /> وصف الرحلة
                       </div>
                       <p className="text-sm md:text-xl font-medium text-emerald-50/90 leading-relaxed whitespace-pre-line drop-shadow-sm">
                          {trip.description?.trim() || "لا يوجد وصف لهذه الرحلة."}
                       </p>
                    </div>

                    <div className="space-y-6 md:space-y-8">
                       <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-[10px] md:text-xs">
                          <Info className="size-4 md:size-[18px]" /> تفاصيل إضافية
                       </div>
                       <div className="grid grid-cols-1 gap-3 md:gap-6">
                          <div className="flex items-center gap-3 md:gap-4 bg-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/10">
                             <div className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-xl shrink-0"><Tent className="size-[18px] md:size-[22px]" /></div>
                             <div>
                                <p className="text-[8px] md:text-[10px] font-black text-white/40 uppercase tracking-widest">نوع الإقامة</p>
                                <p className="text-xs md:text-sm font-black text-white">مخيم عائلي فاخر</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3 md:gap-4 bg-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/10">
                             <div className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-xl shrink-0"><Clock className="size-[18px] md:size-[22px]" /></div>
                             <div>
                                <p className="text-[8px] md:text-[10px] font-black text-white/40 uppercase tracking-widest">آخر موعد للتسجيل</p>
                                <p className="text-xs md:text-sm font-black text-white">{formatDate(trip.start_date)}</p>
                             </div>
                          </div>
                          {trip.location_url && (
                            <a href={trip.location_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3.5 md:p-5 rounded-2xl md:rounded-[28px] bg-gold-primary text-emerald-950 font-black shadow-xl hover:scale-[1.02] transition-all">
                               <div className="flex items-center gap-3">
                                  <MapPin className="size-[18px] md:size-[22px]" strokeWidth={2.5} />
                                  <span className="text-xs md:text-base">موقع الوجهة على الخريطة</span>
                               </div>
                               <ChevronLeft className="size-4 md:size-5" strokeWidth={3} />
                            </a>
                          )}
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Checklist Section Remains Separate for Clarity */}
              <div className="card-surface p-8 md:p-12 rounded-[40px] space-y-8 border-none shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <ListChecks size={140} />
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-xs">
                    <ListChecks size={18} /> أغراض الرحلة (من سيحضر ماذا؟)
                  </div>
                </div>
                {isPrivileged && (
                  <div className="flex gap-3 relative z-10">
                    <input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="أضف غرضاً مطلوباً..."
                      className="flex-1 bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                    <button
                      onClick={addItem}
                      disabled={addingItem}
                      className="btn-gold size-14 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-lg"
                    >
                      {addingItem ? <Loader2 className="size-5 animate-spin" /> : <Plus size={24} strokeWidth={3} />}
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 relative z-10">
                  {checklist.length === 0 ? (
                    <p className="py-10 text-center opacity-30 font-bold">لا يوجد تجهيزات مطلوبة حالياً.</p>
                  ) : (
                    checklist.map((item) => {
                      const isMine = item.assigned_to === userId;
                      const isTaken = !!item.assigned_to;
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "group flex items-center justify-between p-4 md:p-6 rounded-3xl border transition-all duration-300",
                            isTaken ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/20 border-border/40"
                          )}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", isTaken ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                              {isTaken ? <UserCheck size={20} /> : <Tent size={20} />}
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-base md:text-lg font-black truncate", isTaken && "text-emerald-600")}>{item.name}</p>
                              {isTaken && (
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">سيحضره: {item.assignee?.arabic_name || "عضو"} {isMine && "(أنت)"}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isPrivileged && (
                              <button onClick={() => deleteItem(item.id)} className="size-10 rounded-xl hover:bg-rose-500/10 text-rose-500 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Trash2 size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => toggleClaim(item)}
                              className={cn(
                                "px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95",
                                isMine ? "bg-rose-500 text-white hover:bg-rose-600" : isTaken ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50" : "bg-emerald-500 text-white hover:bg-emerald-600"
                              )}
                              disabled={isTaken && !isMine}
                            >
                              {isMine ? "إلغاء" : isTaken ? "تم الحجز" : "سأحضره أنا"}
                            </button>
                          </div>
                        </div>
                      );
                    })
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
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
          {label}
        </p>
        <p className="text-base font-black text-foreground tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
  } catch {
    return "—";
  }
}
