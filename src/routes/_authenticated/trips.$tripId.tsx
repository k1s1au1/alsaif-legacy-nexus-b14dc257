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
  Navigation
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
        .select("user_id, status, companions_count")
        .eq("trip_id", tid);

      if (error) {
        const { data: fallbackRows } = await supabase
          .from("trip_attendees")
          .select("user_id")
          .eq("trip_id", tid);
        processAttendees(fallbackRows || []);
      } else {
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

      const profileIds = Array.from(new Set((items || []).flatMap((i: any) => [i.created_by, i.assigned_to]).filter(Boolean)));
      const { data: profs } = profileIds.length ? await supabase.from("profiles").select("id, arabic_name, full_name, avatar_url").in("id", profileIds) : { data: [] };
      const profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

      setChecklist((items || []).map((item: any) => ({
        ...item,
        creator: profileMap.get(item.created_by) ?? null,
        assignee: item.assigned_to ? profileMap.get(item.assigned_to) ?? null : null,
      })));
    } catch (err: any) {
      console.error("Load checklist error:", err);
    }
  }

  async function addItem() {
    if (!newItemName.trim() || !userId) return;
    setAddingItem(true);
    try {
      const { error } = await supabase.from("trip_items").insert({ trip_id: tripId, name: newItemName.trim(), created_by: userId });
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
      const { error } = await supabase.from("trip_items").update({ assigned_to: newAssignedTo }).eq("id", item.id);
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
        const { data: p } = await supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", userId).maybeSingle();
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
        setProfile({ name, role: roleLabel(primaryRole), initial: (name[0] ?? "س").toUpperCase(), avatarPath: p?.avatar_url ?? null });

        const { data: mine } = await supabase.from("trip_attendees").select("status, companions_count").eq("trip_id", tripId).eq("user_id", userId).maybeSingle();
        if (mine) {
          setAttendanceStatus((mine as any).status || 'going');
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

    const channel = supabase.channel(`trip-${tripId}-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_attendees", filter: `trip_id=eq.${tripId}` }, () => loadAttendees(tripId))
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_items", filter: `trip_id=eq.${tripId}` }, () => loadChecklist(tripId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tripId, userId, primaryRole]);

  async function updateAttendance(status: 'going' | 'not_going', companions: number = 0, isExplicitClick: boolean = false) {
    if (!userId || saving) return;
    const prevStatus = attendanceStatus;
    const prevCompanions = companionsCount;
    const isRemoving = isExplicitClick && attendanceStatus === status && companionsCount === companions;

    if (!isExplicitClick && attendanceStatus === status && companionsCount === companions) return;

    setAttendanceStatus(isRemoving ? null : status);
    if (!isRemoving) setCompanionsCount(companions);
    setSaving(true);

    try {
      if (isRemoving || status === 'not_going') {
        await supabase.from("trip_attendees").delete().eq("trip_id", tripId).eq("user_id", userId);
        if (status === 'not_going') toast.info("تم تسجيل اعتذارك");
        else toast.success("تم إلغاء اختيارك");
      } else {
        const payload: any = { trip_id: tripId, user_id: userId, status: 'going', companions_count: companions };
        const { error } = await supabase.from("trip_attendees").upsert(payload, { onConflict: "trip_id,user_id" });
        if (error) {
           await supabase.from("trip_attendees").upsert({ trip_id: tripId, user_id: userId }, { onConflict: "trip_id,user_id" });
        }
        if (status === 'going') {
          if (prevStatus === 'going') { if (prevCompanions !== companions) toast.success("تم تحديث عدد المرافقين ✨"); }
          else toast.success("تم تأكيد حضورك ✨");
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

  if (loading) return <AppShell title="الرحلات" user={profile}><div className="p-20 text-center opacity-40">جاري التحميل...</div></AppShell>;
  if (!trip) return <AppShell title="الرحلات" user={profile}><div className="card-surface p-10 text-center"><p className="text-muted-foreground">لم يتم العثور على الرحلة.</p><Link to="/trips" className="mt-4 inline-flex items-center gap-2 text-gold-primary text-sm"><ArrowRight className="size-4" />العودة للقائمة</Link></div></AppShell>;

  return (
    <AppShell title={trip.title} user={profile}>
      <div className="max-w-6xl mx-auto space-y-8 pb-32 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        <div className="flex items-center justify-between px-2">
          <Link to="/trips" className="group flex items-center gap-3 text-muted-foreground hover:text-gold-primary transition-all font-black text-xs uppercase tracking-widest">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-gold-primary group-hover:text-black transition-all"><ArrowRight className="size-4" /></div>
            العودة للترفيه
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => trip && addToCalendar({ title: trip.title, description: trip.description || "", location: trip.location || "", startTime: trip.start_date || new Date().toISOString() })} className="px-4 py-2 rounded-full bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary border border-gold-primary/20 transition-all font-black text-[10px] flex items-center gap-2"><Calendar size={14} /> إضافة للتقويم</button>
            <button className="size-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-gold-primary/20 transition-all text-gold-primary"><Share2 size={18} /></button>
          </div>
        </div>

        <article className="space-y-8">
          {/* Hero Header */}
          <div className="relative h-[400px] md:h-[500px] w-full overflow-hidden rounded-[48px] shadow-2xl border-4 border-white/5 group">
            <TripImage path={trip.image_url} alt={trip.title} className="absolute inset-0 size-full object-cover transition-transform duration-1000 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10" />
            <div className="absolute bottom-0 right-0 left-0 p-8 md:p-16 z-20 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-1 w-12 bg-gold-primary rounded-full" />
                {trip.badge && <span className="px-4 py-1.5 bg-gold-primary text-black text-[10px] font-black rounded-full uppercase tracking-[0.2em] shadow-xl">{trip.badge}</span>}
                <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-md shadow-xl", trip.status === "upcoming" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-white/10 text-white border-white/10")}>{statusLabel(trip.status)}</span>
              </div>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl">{trip.title}</h2>
              <div className="flex flex-wrap items-center gap-6 text-white/80 font-bold">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm"><MapPin className="size-5 text-gold-primary" /><span>{trip.location || "وجهة عائلية"}</span></div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm"><Calendar className="size-5 text-gold-primary" /><span>{formatRange(trip.start_date, trip.end_date)}</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="card-surface p-8 md:p-12 rounded-[40px] space-y-6 border-none shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Info size={120} /></div>
                <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-xs"><Compass size={18} /> وصف الرحلة</div>
                <p className="text-lg md:text-xl font-bold text-foreground/80 leading-relaxed whitespace-pre-line relative z-10">{trip.description?.trim() || "لا يوجد وصف لهذه الرحلة."}</p>
              </div>

              <div className="card-surface p-8 md:p-12 rounded-[40px] space-y-8 border-none shadow-xl">
                 <div className="flex items-center justify-between"><div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-xs"><ListChecks size={18} /> أغراض الرحلة (من سيحضر ماذا؟)</div></div>
                 {isPrivileged && (
                   <div className="flex gap-3">
                      <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="أضف غرضاً مطلوباً..." className="flex-1 bg-muted/30 border border-border rounded-2xl px-6 py-4 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
                      <button onClick={addItem} disabled={addingItem} className="btn-gold size-14 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-lg">{addingItem ? <Loader2 className="size-5 animate-spin" /> : <Plus size={24} strokeWidth={3} />}</button>
                   </div>
                 )}
                 <div className="grid grid-cols-1 gap-3">
                   {checklist.length === 0 ? <p className="py-10 text-center opacity-30 font-bold">لا يوجد تجهيزات مطلوبة حالياً.</p> : checklist.map((item) => {
                     const isMine = item.assigned_to === userId;
                     const isTaken = !!item.assigned_to;
                     return (
                       <div key={item.id} className={cn("group flex items-center justify-between p-4 md:p-6 rounded-3xl border transition-all duration-300", isTaken ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/20 border-border/40")}>
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                             <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", isTaken ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>{isTaken ? <UserCheck size={20} /> : <Tent size={20} />}</div>
                             <div className="min-w-0"><p className={cn("text-base md:text-lg font-black truncate", isTaken && "text-emerald-600")}>{item.name}</p>{isTaken && (<p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">سيحضره: {item.assignee?.arabic_name || "عضو"} {isMine && "(أنت)"}</p>)}</div>
                          </div>
                          <div className="flex items-center gap-2">{isPrivileged && (<button onClick={() => deleteItem(item.id)} className="size-10 rounded-xl hover:bg-rose-500/10 text-rose-500 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>)}<button onClick={() => toggleClaim(item)} className={cn("px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95", isMine ? "bg-rose-500 text-white hover:bg-rose-600" : isTaken ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50" : "bg-emerald-500 text-white hover:bg-emerald-600")} disabled={isTaken && !isMine}>{isMine ? "إلغاء" : isTaken ? "تم الحجز" : "سأحضره أنا"}</button></div>
                       </div>
                     );
                   })}
                 </div>
              </div>

              <div className="card-surface p-8 md:p-12 rounded-[40px] space-y-8 border-none shadow-xl">
                <div className="flex items-center justify-between"><div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-xs"><Users size={18} /> المشاركون المؤكدون</div><span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 text-xs font-black">{attendees.reduce((acc, curr) => acc + 1 + curr.companions_count, 0)} حاضرين</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {attendees.length === 0 ? <p className="py-10 text-center col-span-2 opacity-30 font-bold">لا يوجد حضور مؤكد بعد.</p> : attendees.map((a) => (
                    <div key={a.user_id} className="group flex items-center gap-4 p-4 rounded-[28px] bg-muted/30 hover:bg-gold-primary/5 border border-border/40 transition-all duration-300">
                      <div className="size-12 rounded-2xl overflow-hidden shadow-lg border-2 border-white/5 transition-transform group-hover:scale-110 shrink-0"><UserAvatar path={a.avatarPath} name={a.name} initial={a.initial} className="size-full" userId={a.user_id} /></div>
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2"><span className="text-base font-black text-foreground truncate">{a.name}</span>{a.companions_count > 0 && (<span className="text-[9px] font-black bg-gold-primary/10 text-gold-primary px-2 py-0.5 rounded-full border border-gold-primary/20 shrink-0">+{a.companions_count} مرافقين</span>)}</div>
                         <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 block">عضو مؤكد</span>
                      </div>
                      <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500"><CheckCircle2 size={16} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Attendance Card */}
              <div className="relative overflow-hidden rounded-[40px] bg-emerald-950 p-8 text-white shadow-2xl ring-1 ring-white/10">
                <div className="absolute top-6 left-6"><div className="flex size-12 items-center justify-center rounded-full bg-emerald-800/70 ring-1 ring-white/20 backdrop-blur-sm"><Clock className="size-6 text-white" strokeWidth={2.5} /></div></div>
                <div className="relative z-10 mb-8 space-y-3"><h3 className="text-3xl font-black leading-tight tracking-tight">هل ستنضم إلينا؟</h3><p className="text-sm font-bold leading-relaxed text-emerald-100/80">أكد حضورك الآن لتساعدنا في تنظيم الرحلة بشكل أفضل.</p></div>
                <div className="relative z-10 flex flex-col gap-4">
                  {attendanceStatus === 'going' && (
                    <div className="flex flex-col gap-3 mb-2 animate-fade-up bg-white/5 p-5 rounded-3xl border border-white/10">
                       <div className="flex items-center justify-between px-1"><p className="text-[10px] font-black text-gold-primary uppercase tracking-widest">عدد المرافقين معك؟</p><span className="text-[14px] font-black text-white bg-white/10 px-3 py-1 rounded-lg">إجمالي: {1 + companionsCount}</span></div>
                       <input type="tel" value={companionsCount === 0 ? "" : companionsCount} onFocus={(e) => e.target.select()} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setCompanionsCount(val === '' ? 0 : parseInt(val)); }} onBlur={() => updateAttendance('going', companionsCount)} className="w-full h-20 bg-black/20 border-2 border-white/10 rounded-[24px] px-6 font-black text-center text-4xl focus:outline-none focus:border-gold-primary transition-all text-white shadow-inner" placeholder="٠" />
                    </div>
                  )}
                  <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-[28px] grid grid-cols-2 gap-1.5 shadow-2xl overflow-hidden h-[70px]">
                    <div className={cn("absolute inset-y-1.5 w-[calc(50%-6px)] rounded-[22px] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-lg", attendanceStatus === 'going' ? "right-1.5 bg-emerald-500 shadow-emerald-500/40" : attendanceStatus === 'not_going' ? "right-[calc(50%+1.5px)] bg-rose-500 shadow-rose-500/40" : "opacity-0")} />
                    <button onClick={() => updateAttendance('going', companionsCount, true)} disabled={saving || !userId || !attendanceLoaded} className={cn("relative z-10 flex items-center justify-center gap-3 font-black text-sm md:text-base transition-colors duration-500", attendanceStatus === 'going' ? "text-white" : "text-white/40 hover:text-white/60")}>{saving && attendanceStatus === 'going' ? <Loader2 size={20} className="animate-spin" /> : <UserCheck size={22} />}<span>سأحضر</span></button>
                    <button onClick={() => updateAttendance('not_going', 0, true)} disabled={saving || !userId || !attendanceLoaded} className={cn("relative z-10 flex items-center justify-center gap-3 font-black text-sm md:text-base transition-colors duration-500", attendanceStatus === 'not_going' ? "text-white" : "text-white/40 hover:text-white/60")}>{saving && attendanceStatus === 'not_going' ? <Loader2 size={20} className="animate-spin" /> : <UserX size={22} />}<span>أعتذر</span></button>
                  </div>
                </div>
                <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none"><Tent size={160} /></div>
              </div>

              <div className="card-surface p-8 rounded-[40px] space-y-8 border-none shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gold-primary/20" />
                <div className="flex items-center gap-3 text-primary font-black uppercase tracking-[0.3em] text-xs"><Info size={18} /> تفاصيل إضافية</div>
                <div className="space-y-6">
                  <SidebarStat icon={Tent} label="نوع الإقامة" value="مخيم عائلي فاخر" />
                  <SidebarStat icon={Clock} label="آخر موعد للتسجيل" value={formatDate(trip.start_date)} />
                  {trip.location_url && (<div className="pt-4 border-t border-border/40"><a href={trip.location_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 hover:bg-gold-primary/10 hover:text-gold-primary transition-all border border-transparent hover:border-gold-primary/20 group"><div className="flex items-center gap-3"><MapPin size={20} /><span className="text-sm font-black">موقع الوجهة</span></div><ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /></a></div>)}
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
  return (<div className="flex items-start gap-4"><div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 border border-primary/10"><Icon size={20} /></div><div className="space-y-0.5"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">{label}</p><p className="text-base font-black text-foreground tracking-tight">{value}</p></div></div>);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" }); } catch { return "—"; }
}
