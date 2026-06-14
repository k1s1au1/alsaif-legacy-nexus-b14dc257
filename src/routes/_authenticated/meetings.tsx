import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  Plus,
  X,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/meetings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الاجتماعات — السيف" },
      { name: "description", content: "جدول اجتماعات العائلة، تأكيد الحضور، وتفاصيل اللقاء." },
    ],
  }),
  component: MeetingsPage,
});

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

type Rsvp = "going" | "not_going" | "maybe";

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: "scheduled" | "cancelled" | "completed";
  created_by: string;
};

type Attendee = { meeting_id: string; user_id: string; rsvp: Rsvp };
type ProfileLite = { id: string; arabic_name: string | null; full_name: string | null };

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

function statusChip(status: Meeting["status"], scheduledAt: string) {
  if (status === "cancelled")
    return { label: "ملغي", className: "bg-destructive/15 text-destructive ring-destructive/30" };
  if (status === "completed" || new Date(scheduledAt) < new Date())
    return { label: "منتهي", className: "bg-secondary/50 text-muted-foreground ring-border" };
  return { label: "قادم", className: "bg-gold-primary/15 text-gold-primary ring-gold-primary/30" };
}

function MeetingsPage() {
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const canManage = userRole === "admin" || userRole === "manager";

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form fields
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fLocationUrl, setFLocationUrl] = useState("");
  const [fWhen, setFWhen] = useState("");
  const [fDuration, setFDuration] = useState("");

  function resetForm() {
    setFTitle("");
    setFDesc("");
    setFLocation("");
    setFLocationUrl("");
    setFWhen("");
    setFDuration("");
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(m: Meeting) {
    setEditing(m);
    setFTitle(m.title);
    setFDesc(m.description ?? "");
    setFLocation(m.location ?? "");
    setFLocationUrl(m.location_url ?? "");
    // datetime-local needs YYYY-MM-DDTHH:mm
    const d = new Date(m.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    setFWhen(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
    setFDuration(m.duration_minutes ? String(m.duration_minutes) : "");
    setShowForm(true);
  }

  async function loadAll() {
    const [{ data: m, error: me }, { data: a }, { data: pr }] = await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id,title,description,location,location_url,scheduled_at,duration_minutes,status,created_by",
        )
        .order("scheduled_at", { ascending: true }),
      supabase.from("meeting_attendees").select("meeting_id,user_id,rsvp"),
      supabase.from("profiles").select("id, arabic_name, full_name"),
    ]);
    if (me) toast.error("تعذر تحميل الاجتماعات");
    setMeetings((m ?? []) as Meeting[]);
    setAttendees((a ?? []) as Attendee[]);
    const map: Record<string, ProfileLite> = {};
    (pr ?? []).forEach((p: any) => { map[p.id] = p; });
    setProfiles(map);
    setLoading(false);
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
        setUserRole(r?.role ?? null);
      }
      await loadAll();
    })();

    const channel = supabase
      .channel("meetings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => loadAll())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_attendees" },
        () => loadAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!fTitle.trim() || !fWhen) {
      toast.error("العنوان والموعد مطلوبان");
      return;
    }
    setSubmitting(true);
    const payload = {
      title: fTitle.trim(),
      description: fDesc.trim() || null,
      location: fLocation.trim() || null,
      location_url: fLocationUrl.trim() || null,
      scheduled_at: new Date(fWhen).toISOString(),
      duration_minutes: fDuration ? Number(fDuration) : null,
    };
    if (editing) {
      const { error } = await supabase.from("meetings").update(payload).eq("id", editing.id);
      if (error) toast.error("تعذر التحديث: " + error.message);
      else {
        toast.success("تم تحديث الاجتماع");
        setShowForm(false);
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from("meetings")
        .insert({ ...payload, created_by: userId });
      if (error) toast.error("تعذر الإنشاء: " + error.message);
      else {
        toast.success("تم إنشاء الاجتماع");
        setShowForm(false);
        resetForm();
      }
    }
    setSubmitting(false);
  }

  async function deleteMeeting(id: string) {
    if (!confirm("هل تريد حذف هذا الاجتماع؟")) return;
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) toast.error("تعذر الحذف");
    else toast.success("تم الحذف");
  }

  async function setRsvp(meetingId: string, rsvp: Rsvp) {
    if (!userId) return;
    const existing = attendees.find((a) => a.meeting_id === meetingId && a.user_id === userId);
    if (existing && existing.rsvp === rsvp) {
      // toggle off
      const { error } = await supabase
        .from("meeting_attendees")
        .delete()
        .eq("meeting_id", meetingId)
        .eq("user_id", userId);
      if (error) toast.error("تعذر التحديث");
      return;
    }
    const { error } = await supabase
      .from("meeting_attendees")
      .upsert(
        { meeting_id: meetingId, user_id: userId, rsvp },
        { onConflict: "meeting_id,user_id" },
      );
    if (error) toast.error("تعذر التحديث");
  }

  function countsFor(meetingId: string) {
    const list = attendees.filter((a) => a.meeting_id === meetingId);
    return {
      going: list.filter((a) => a.rsvp === "going").length,
      not_going: list.filter((a) => a.rsvp === "not_going").length,
      maybe: list.filter((a) => a.rsvp === "maybe").length,
    };
  }

  function myRsvp(meetingId: string): Rsvp | null {
    if (!userId) return null;
    return attendees.find((a) => a.meeting_id === meetingId && a.user_id === userId)?.rsvp ?? null;
  }

  const upcoming = meetings.filter(
    (m) => m.status !== "cancelled" && new Date(m.scheduled_at) >= new Date(),
  );
  const past = meetings.filter(
    (m) => m.status === "cancelled" || new Date(m.scheduled_at) < new Date(),
  );

  return (
    <AppShell title="الاجتماعات" user={profile}>
      <div className="space-y-8" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">اجتماعات العائلة</h2>
            <p className="text-sm text-muted-foreground mt-1">
              جدول اللقاءات القادمة وتأكيد الحضور.
            </p>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary text-navy-base text-sm font-medium hover:opacity-90 transition"
            >
              <Plus className="size-4" strokeWidth={2} />
              اجتماع جديد
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-16">جاري التحميل...</div>
        ) : (
          <>
            {/* Upcoming */}
            <section>
              <h3 className="eyebrow mb-4">القادمة</h3>
              {upcoming.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card/40 p-10 text-center text-muted-foreground">
                  لا توجد اجتماعات قادمة.
                </div>
              ) : (
                <div className="grid gap-4">
                  {upcoming.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      counts={countsFor(m.id)}
                      attendeesList={attendees.filter((a) => a.meeting_id === m.id)}
                      profiles={profiles}
                      myRsvp={myRsvp(m.id)}
                      onRsvp={setRsvp}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={deleteMeeting}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Past */}
            {past.length > 0 && (
              <section>
                <h3 className="eyebrow mb-4">السابقة</h3>
                <div className="grid gap-4 opacity-80">
                  {past.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      counts={countsFor(m.id)}
                      attendeesList={attendees.filter((a) => a.meeting_id === m.id)}
                      profiles={profiles}
                      myRsvp={myRsvp(m.id)}
                      onRsvp={setRsvp}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={deleteMeeting}
                      isPast
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editing ? "تعديل الاجتماع" : "اجتماع جديد"}
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
                  <label className="text-xs text-muted-foreground">الموعد *</label>
                  <input
                    type="datetime-local"
                    value={fWhen}
                    onChange={(e) => setFWhen(e.target.value)}
                    required
                    className="w-full mt-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">المدة (دقائق)</label>
                  <input
                    type="number"
                    min="0"
                    value={fDuration}
                    onChange={(e) => setFDuration(e.target.value)}
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

function MeetingCard({
  meeting,
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
  meeting: Meeting;
  counts: { going: number; not_going: number; maybe: number };
  attendeesList: Attendee[];
  profiles: Record<string, ProfileLite>;
  myRsvp: Rsvp | null;
  onRsvp: (id: string, r: Rsvp) => void;
  canManage: boolean;
  onEdit: (m: Meeting) => void;
  onDelete: (id: string) => void;
  isPast?: boolean;
}) {
  const chip = statusChip(meeting.status, meeting.scheduled_at);
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
      {/* Header strip */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border/60 bg-secondary/20">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <h4 className="text-lg font-semibold truncate">{meeting.title}</h4>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 ${chip.className}`}>
            {chip.label}
          </span>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(meeting)}
              className="p-2 text-muted-foreground hover:text-gold-primary rounded-lg hover:bg-secondary/40"
              aria-label="تعديل"
            >
              <Pencil className="size-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onDelete(meeting.id)}
              className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary/40"
              aria-label="حذف"
            >
              <Trash2 className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {meeting.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{meeting.description}</p>
        )}

        {/* Stacked info rows */}
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <InfoRow icon={<CalendarDays className="size-4" strokeWidth={1.5} />} label="الموعد">
            {formatDate(meeting.scheduled_at)}
          </InfoRow>
          {meeting.duration_minutes && (
            <InfoRow icon={<Clock className="size-4" strokeWidth={1.5} />} label="المدة">
              {meeting.duration_minutes} دقيقة
            </InfoRow>
          )}
          {meeting.location && (
            <InfoRow icon={<MapPin className="size-4" strokeWidth={1.5} />} label="المكان">
              {meeting.location_url ? (
                <a
                  href={meeting.location_url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-gold-primary"
                >
                  {meeting.location}
                </a>
              ) : (
                meeting.location
              )}
            </InfoRow>
          )}
          <InfoRow icon={<Users className="size-4" strokeWidth={1.5} />} label="الحضور">
            {counts.going} حاضر · {counts.maybe} ربما · {counts.not_going} معتذر
          </InfoRow>
        </dl>

        {/* Attendees by status */}
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
            onClick={() => onRsvp(meeting.id, "going")}
            icon={<CheckCircle2 className="size-4" strokeWidth={1.5} />}
            label="سأحضر"
            activeClass="bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
          />
          <RsvpButton
            active={myRsvp === "maybe"}
            onClick={() => onRsvp(meeting.id, "maybe")}
            icon={<HelpCircle className="size-4" strokeWidth={1.5} />}
            label="ربما"
            activeClass="bg-amber-500/15 text-amber-400 ring-amber-500/30"
          />
          <RsvpButton
            active={myRsvp === "not_going"}
            onClick={() => onRsvp(meeting.id, "not_going")}
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
            <li
              key={i}
              className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ${chipClass}`}
            >
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
