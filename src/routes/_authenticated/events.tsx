import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Sparkles,
  CalendarDays,
  MapPin,
  Users,
  Plus,
  X,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Cake,
  Heart,
  GraduationCap,
  Moon,
  PartyPopper,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { useSiteLogo } from "@/hooks/use-site-logo";

export const Route = createFileRoute("/_authenticated/events")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "المهام — السيف" },
      { name: "description", content: "مهام وأنشطة العائلة القادمة." },
    ],
  }),
  component: EventsPage,
});

type EventType = "wedding" | "birthday" | "graduation" | "religious" | "social" | "other";
type Rsvp = "going" | "not_going" | "maybe";

type FamilyEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  location: string | null;
  location_url: string | null;
  starts_at: string;
  ends_at: string | null;
  status: "scheduled" | "cancelled" | "completed";
  created_by: string;
};

type Attendee = { event_id: string; user_id: string; rsvp: Rsvp };
type ProfileLite = { id: string; arabic_name: string | null; full_name: string | null };

const TYPE_META: Record<EventType, { label: string; icon: typeof Sparkles; color: string }> = {
  wedding: { label: "زواج", icon: Heart, color: "text-rose-300 bg-rose-500/10 ring-rose-500/30" },
  birthday: { label: "ميلاد", icon: Cake, color: "text-pink-300 bg-pink-500/10 ring-pink-500/30" },
  graduation: { label: "تخرّج", icon: GraduationCap, color: "text-sky-300 bg-sky-500/10 ring-sky-500/30" },
  religious: { label: "ديني", icon: Moon, color: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30" },
  social: { label: "اجتماعي", icon: PartyPopper, color: "text-gold-primary bg-gold-primary/10 ring-gold-primary/30" },
  other: { label: "أخرى", icon: Star, color: "text-muted-foreground bg-secondary/40 ring-border" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ar-SA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusChip(status: FamilyEvent["status"], startsAt: string) {
  if (status === "cancelled")
    return { label: "ملغية", className: "bg-destructive/15 text-destructive ring-destructive/30" };
  if (status === "completed" || new Date(startsAt) < new Date())
    return { label: "انتهت", className: "bg-secondary/50 text-muted-foreground ring-border" };
  return { label: "قادمة", className: "bg-gold-primary/15 text-gold-primary ring-gold-primary/30" };
}

function EventsPage() {
  const { userId, primaryRole, canManage: canManageSection } = useUserRole();
  const canManage = canManageSection("tasks");

  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });

  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FamilyEvent | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fType, setFType] = useState<EventType>("social");
  const [fLocation, setFLocation] = useState("");
  const [fLocationUrl, setFLocationUrl] = useState("");
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");

  function resetForm() {
    setFTitle("");
    setFDesc("");
    setFType("social");
    setFLocation("");
    setFLocationUrl("");
    setFStart("");
    setFEnd("");
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function toLocalInput(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openEdit(ev: FamilyEvent) {
    setEditing(ev);
    setFTitle(ev.title);
    setFDesc(ev.description ?? "");
    setFType(ev.event_type);
    setFLocation(ev.location ?? "");
    setFLocationUrl(ev.location_url ?? "");
    setFStart(toLocalInput(ev.starts_at));
    setFEnd(ev.ends_at ? toLocalInput(ev.ends_at) : "");
    setShowForm(true);
  }

  const loadAll = useCallback(async () => {
    const [{ data: evs, error: ee }, { data: ats }, { data: pr }] = await Promise.all([
      supabase
        .from("events")
        .select(
          "id,title,description,event_type,location,location_url,starts_at,ends_at,status,created_by",
        )
        .order("starts_at", { ascending: true }),
      supabase.from("event_attendees").select("event_id,user_id,rsvp"),
      supabase.from("profiles").select("id, arabic_name, full_name"),
    ]);
    if (ee) toast.error("تعذر تحميل المهام");
    setEvents((evs ?? []) as FamilyEvent[]);
    setAttendees((ats ?? []) as Attendee[]);
    const map: Record<string, ProfileLite> = {};
    (pr ?? []).forEach((p: any) => {
      map[p.id] = p;
    });
    setProfiles(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      if (userId) {
        const [{ data: p }] = await Promise.all([
          supabase
            .from("profiles")
            .select("arabic_name, full_name, avatar_url")
            .eq("id", userId)
            .maybeSingle(),
        ]);
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
      }
      await loadAll();
    })();

    const channel = supabase
      .channel("events-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_attendees" }, () =>
        loadAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, primaryRole, loadAll]);

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!fTitle.trim() || !fStart) {
      toast.error("العنوان والموعد مطلوبان");
      return;
    }
    setSubmitting(true);
    const payload = {
      title: fTitle.trim(),
      description: fDesc.trim() || null,
      event_type: fType,
      location: fLocation.trim() || null,
      location_url: fLocationUrl.trim() || null,
      starts_at: new Date(fStart).toISOString(),
      ends_at: fEnd ? new Date(fEnd).toISOString() : null,
    };
    if (editing) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (error) toast.error("تعذر التحديث: " + error.message);
      else {
        toast.success("تم تحديث المناسبة");
        setShowForm(false);
        resetForm();
      }
    } else {
      const { error } = await supabase.from("events").insert({ ...payload, created_by: userId });
      if (error) toast.error("تعذر الإنشاء: " + error.message);
      else {
        toast.success("تم إنشاء المناسبة");
        setShowForm(false);
        resetForm();
      }
    }
    setSubmitting(false);
  }

  async function deleteEvent(id: string) {
    if (!confirm("هل تريد حذف هذه المناسبة؟")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) toast.error("تعذر الحذف");
    else toast.success("تم الحذف");
  }

  async function setRsvp(eventId: string, rsvp: Rsvp) {
    if (!userId) return;
    const existing = attendees.find((a) => a.event_id === eventId && a.user_id === userId);
    if (existing && existing.rsvp === rsvp) {
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", userId);
      if (error) toast.error("تعذر التحديث");
      return;
    }
    const { error } = await supabase
      .from("event_attendees")
      .upsert({ event_id: eventId, user_id: userId, rsvp }, { onConflict: "event_id,user_id" });
    if (error) toast.error("تعذر التحديث");
  }

  function countsFor(eventId: string) {
    const list = attendees.filter((a) => a.event_id === eventId);
    return {
      going: list.filter((a) => a.rsvp === "going").length,
      not_going: list.filter((a) => a.rsvp === "not_going").length,
      maybe: list.filter((a) => a.rsvp === "maybe").length,
    };
  }

  function myRsvp(eventId: string): Rsvp | null {
    if (!userId) return null;
    return attendees.find((a) => a.event_id === eventId && a.user_id === userId)?.rsvp ?? null;
  }

  const upcoming = events.filter(
    (e) => e.status !== "cancelled" && new Date(e.starts_at) >= new Date(),
  );
  const past = events.filter(
    (e) => e.status === "cancelled" || new Date(e.starts_at) < new Date(),
  );

  return (
    <AppShell title="المهام" user={profile}>
      <div className="space-y-8" dir="rtl">
        <QuickActionsBanner />
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">مهام العائلة</h2>
            <p className="text-sm text-muted-foreground mt-1">
              متابعة المهام وكل ما يجمع العائلة.
            </p>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary text-navy-base text-sm font-medium hover:opacity-90 transition"
            >
              <Plus className="size-4" strokeWidth={2} />
              مهمة جديدة
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-16">جاري التحميل...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border">
            <Sparkles className="size-10 text-gold-primary mx-auto mb-3" strokeWidth={1.2} />
            <p className="text-sm text-muted-foreground">
              لا توجد مناسبات بعد{canManage ? " — ابدأ بإضافة مناسبة جديدة." : "."}
            </p>
          </div>
        ) : (
          <>
            <section>
              <h3 className="eyebrow mb-4">القادمة</h3>
              {upcoming.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card/40 p-10 text-center text-muted-foreground">
                  لا توجد مناسبات قادمة.
                </div>
              ) : (
                <div className="grid gap-4">
                  {upcoming.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      counts={countsFor(ev.id)}
                      attendeesList={attendees.filter((a) => a.event_id === ev.id)}
                      profiles={profiles}
                      myRsvp={myRsvp(ev.id)}
                      onRsvp={setRsvp}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={deleteEvent}
                    />
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h3 className="eyebrow mb-4">السابقة</h3>
                <div className="grid gap-4 opacity-80">
                  {past.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      counts={countsFor(ev.id)}
                      attendeesList={attendees.filter((a) => a.event_id === ev.id)}
                      profiles={profiles}
                      myRsvp={myRsvp(ev.id)}
                      onRsvp={setRsvp}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={deleteEvent}
                      isPast
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editing ? "تعديل المناسبة" : "مناسبة جديدة"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={submitForm} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">العنوان *</label>
                <input
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  required
                  className="w-full mt-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">نوع المناسبة</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(Object.keys(TYPE_META) as EventType[]).map((t) => {
                    const Meta = TYPE_META[t];
                    const Icon = Meta.icon;
                    const active = fType === t;
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setFType(t)}
                        className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs ring-1 transition ${
                          active
                            ? Meta.color
                            : "bg-secondary/30 text-muted-foreground ring-border hover:text-foreground"
                        }`}
                      >
                        <Icon className="size-3.5" strokeWidth={1.6} />
                        {Meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">الوصف</label>
                <textarea
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  rows={3}
                  className="w-full mt-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">البداية *</label>
                  <input
                    type="datetime-local"
                    value={fStart}
                    onChange={(e) => setFStart(e.target.value)}
                    required
                    className="w-full mt-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">النهاية</label>
                  <input
                    type="datetime-local"
                    value={fEnd}
                    onChange={(e) => setFEnd(e.target.value)}
                    className="w-full mt-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">المكان</label>
                <input
                  value={fLocation}
                  onChange={(e) => setFLocation(e.target.value)}
                  className="w-full mt-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">رابط الموقع (اختياري)</label>
                <input
                  type="url"
                  value={fLocationUrl}
                  onChange={(e) => setFLocationUrl(e.target.value)}
                  placeholder="https://maps..."
                  className="w-full mt-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-primary"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-lg bg-gold-primary text-navy-base text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {submitting ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "إنشاء"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary/40"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function EventCard({
  event,
  counts,
  attendeesList,
  profiles,
  myRsvp,
  onRsvp,
  canManage,
  onEdit,
  onDelete,
  isPast = false,
}: {
  event: FamilyEvent;
  counts: { going: number; not_going: number; maybe: number };
  attendeesList: Attendee[];
  profiles: Record<string, ProfileLite>;
  myRsvp: Rsvp | null;
  onRsvp: (id: string, r: Rsvp) => void;
  canManage: boolean;
  onEdit: (m: FamilyEvent) => void;
  onDelete: (id: string) => void;
  isPast?: boolean;
}) {
  const chip = statusChip(event.status, event.starts_at);
  const typeMeta = TYPE_META[event.event_type];
  const TypeIcon = typeMeta.icon;
  const nameOf = (uid: string) => {
    const p = profiles[uid];
    return p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو";
  };
  const going = attendeesList.filter((a) => a.rsvp === "going").map((a) => nameOf(a.user_id));
  const maybe = attendeesList.filter((a) => a.rsvp === "maybe").map((a) => nameOf(a.user_id));
  const notGoing = attendeesList
    .filter((a) => a.rsvp === "not_going")
    .map((a) => nameOf(a.user_id));

  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden hover:bg-card/80 transition">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border/60 bg-secondary/20">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ring-1 ${typeMeta.color}`}
          >
            <TypeIcon className="size-3" strokeWidth={1.8} />
            {typeMeta.label}
          </span>
          <h4 className="text-lg font-semibold truncate">{event.title}</h4>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ${chip.className}`}>
            {chip.label}
          </span>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(event)}
              className="p-2 text-muted-foreground hover:text-gold-primary rounded-lg hover:bg-secondary/40"
              aria-label="تعديل"
            >
              <Pencil className="size-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary/40"
              aria-label="حذف"
            >
              <Trash2 className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {event.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
        )}

        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <InfoRow icon={<CalendarDays className="size-4" strokeWidth={1.5} />} label="البداية">
            {formatDate(event.starts_at)}
          </InfoRow>
          {event.ends_at && (
            <InfoRow icon={<CalendarDays className="size-4" strokeWidth={1.5} />} label="النهاية">
              {formatDate(event.ends_at)}
            </InfoRow>
          )}
          {event.location && (
            <InfoRow icon={<MapPin className="size-4" strokeWidth={1.5} />} label="المكان">
              {event.location_url ? (
                <a
                  href={event.location_url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-gold-primary"
                >
                  {event.location}
                </a>
              ) : (
                event.location
              )}
            </InfoRow>
          )}
          <InfoRow icon={<Users className="size-4" strokeWidth={1.5} />} label="الحضور">
            {counts.going} حاضر · {counts.maybe} ربما · {counts.not_going} معتذر
          </InfoRow>
        </dl>

        {(going.length > 0 || maybe.length > 0 || notGoing.length > 0) && (
          <div className="grid sm:grid-cols-3 gap-3 pt-3 border-t border-border/60">
            <AttendeeList
              title="حاضرون"
              count={going.length}
              names={going}
              dotClass="bg-emerald-400"
              chipClass="bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
            />
            <AttendeeList
              title="ربما"
              count={maybe.length}
              names={maybe}
              dotClass="bg-amber-400"
              chipClass="bg-amber-500/10 text-amber-300 ring-amber-500/20"
            />
            <AttendeeList
              title="معتذرون"
              count={notGoing.length}
              names={notGoing}
              dotClass="bg-rose-400"
              chipClass="bg-rose-500/10 text-rose-300 ring-rose-500/20"
            />
          </div>
        )}
      </div>

      {!isPast && (
        <div className="flex gap-2 px-5 pb-5">
          <RsvpButton
            active={myRsvp === "going"}
            onClick={() => onRsvp(event.id, "going")}
            icon={<CheckCircle2 className="size-4" strokeWidth={1.5} />}
            label="سأحضر"
            activeClass="bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
          />
          <RsvpButton
            active={myRsvp === "maybe"}
            onClick={() => onRsvp(event.id, "maybe")}
            icon={<HelpCircle className="size-4" strokeWidth={1.5} />}
            label="ربما"
            activeClass="bg-amber-500/15 text-amber-400 ring-amber-500/30"
          />
          <RsvpButton
            active={myRsvp === "not_going"}
            onClick={() => onRsvp(event.id, "not_going")}
            icon={<XCircle className="size-4" strokeWidth={1.5} />}
            label="معتذر"
            activeClass="bg-rose-500/15 text-rose-400 ring-rose-500/30"
          />
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-secondary/20 px-3 py-2.5 ring-1 ring-border/60">
      <span className="mt-0.5 text-gold-primary shrink-0">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className="text-sm text-foreground mt-0.5 break-words">{children}</dd>
      </div>
    </div>
  );
}

function AttendeeList({
  title,
  count,
  names,
  dotClass,
  chipClass,
}: {
  title: string;
  count: number;
  names: string[];
  dotClass: string;
  chipClass: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${dotClass}`} />
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="text-[10px] text-muted-foreground">({count})</span>
      </div>
      {names.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/70">—</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {names.map((n, i) => (
            <li key={i} className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ${chipClass}`}>
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RsvpButton({
  active,
  onClick,
  icon,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ring-1 transition ${
        active
          ? activeClass
          : "bg-secondary/30 text-muted-foreground ring-border hover:text-foreground hover:bg-secondary/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
