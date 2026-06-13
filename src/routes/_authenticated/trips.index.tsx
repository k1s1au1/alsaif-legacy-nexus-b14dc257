import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { MapPin, Calendar, Users, ChevronLeft, Plane, Plus, X, Upload, ImageIcon, Trash2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import tripImage from "@/assets/trip-alula.jpg";
import { TripImage } from "@/components/trip-image";

export const Route = createFileRoute("/_authenticated/trips/")({
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
    new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} - ${fmt(end)}`;
}

function statusChip(status: string) {
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const canManage = userRole === "admin" || userRole === "manager";

  async function loadTrips() {
    const { data, error } = await supabase
      .from("trips")
      .select("id,title,badge,location,location_url,start_date,end_date,description,image_url,status")
      .order("start_date", { ascending: true, nullsFirst: false });
    if (error) {
      toast.error("تعذر تحميل الرحلات");
    } else {
      setTrips((data ?? []) as Trip[]);
    }
    setLoading(false);
  }

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
        setUserRole(r?.role ?? null);
      }
      await loadTrips();
    })();

    const channel = supabase
      .channel("trips-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => loadTrips())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
          {canManage && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              إضافة رحلة
            </button>
          )}
        </div>

        {loading ? (
          <div className="card-surface p-10 text-center text-muted-foreground text-sm">
            جاري تحميل الرحلات...
          </div>
        ) : trips.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <Plane className="size-10 text-gold-primary mx-auto mb-4" strokeWidth={1.2} />
            <h3 className="text-lg font-medium text-ivory mb-2">لا توجد رحلات بعد</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {canManage ? "ابدأ بإضافة أول رحلة عائلية لتظهر هنا." : "لم يقم المشرفون بإضافة رحلات بعد."}
            </p>
            {canManage && (
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
              >
                <Plus className="size-4" strokeWidth={2.5} />
                إضافة رحلة
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {trips.map((trip) => {
              const chip = statusChip(trip.status);
              return (
                <article
                  key={trip.id}
                  className="card-surface overflow-hidden flex flex-col animate-fade-up"
                >
                  <div className="relative h-56">
                    <TripImage
                      path={trip.image_url}
                      alt={trip.title}
                      className="absolute inset-0 size-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                    <span
                      className={`absolute top-4 right-4 px-2.5 py-1 text-[10px] rounded uppercase tracking-wider ring-1 ${chip.className}`}
                    >
                      {chip.label}
                    </span>
                    {canManage && (
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <button
                          onClick={() => setEditingTrip(trip)}
                          className="size-9 grid place-items-center rounded-full bg-black/60 text-ivory hover:bg-gold-primary/80 hover:text-navy-base transition ring-1 ring-white/10"
                          aria-label="تعديل الرحلة"
                        >
                          <Pencil className="size-4" strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`هل تريد حذف رحلة "${trip.title}"؟`)) return;
                            if (trip.image_url) {
                              await supabase.storage.from("trip-images").remove([trip.image_url]);
                            }
                            const { error } = await supabase.from("trips").delete().eq("id", trip.id);
                            if (error) {
                              toast.error("تعذر حذف الرحلة");
                            } else {
                              toast.success("تم حذف الرحلة");
                              loadTrips();
                            }
                          }}
                          className="size-9 grid place-items-center rounded-full bg-black/60 text-ivory hover:bg-red-500/80 transition ring-1 ring-white/10"
                          aria-label="حذف الرحلة"
                        >
                          <Trash2 className="size-4" strokeWidth={1.8} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    {trip.badge && (
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="px-2 py-0.5 bg-gold-primary/10 text-gold-primary text-[10px] rounded uppercase tracking-wider ring-1 ring-gold-primary/20">
                          {trip.badge}
                        </span>
                      </div>
                    )}
                    <h3 className="text-xl font-medium text-ivory mb-2">{trip.title}</h3>
                    {trip.location && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                        <MapPin className="size-3.5" strokeWidth={1.5} />
                        {trip.location}
                      </div>
                    )}
                    {trip.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">
                        {trip.description}
                      </p>
                    )}
                    <div className="mt-6 pt-5 border-t border-border flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2 text-xs text-ivory/80">
                          <Calendar className="size-3.5 text-gold-primary" strokeWidth={1.5} />
                          {formatRange(trip.start_date, trip.end_date)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-ivory/80">
                          <Users className="size-3.5 text-gold-primary" strokeWidth={1.5} />
                          عائلي
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
        )}
      </div>

      {showAdd && <TripDialog onClose={() => setShowAdd(false)} onSaved={loadTrips} />}
      {editingTrip && (
        <TripDialog
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onSaved={loadTrips}
        />
      )}
    </AppShell>
  );
}

function TripDialog({
  trip,
  onClose,
  onSaved,
}: {
  trip?: Trip;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!trip;
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [form, setForm] = useState({
    title: trip?.title ?? "",
    badge: trip?.badge ?? "",
    location: trip?.location ?? "",
    location_url: trip?.location_url ?? "",
    start_date: trip?.start_date ?? "",
    end_date: trip?.end_date ?? "",
    description: trip?.description ?? "",
    status: trip?.status ?? "upcoming",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("الرجاء اختيار ملف صورة");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (isEdit && trip?.image_url) setRemoveExistingImage(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("الرجاء إدخال عنوان الرحلة");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("يجب تسجيل الدخول");
      setSaving(false);
      return;
    }

    let imagePath: string | null | undefined = undefined;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("trip-images")
        .upload(path, imageFile, { contentType: imageFile.type, upsert: false });
      if (upErr) {
        toast.error("تعذر رفع الصورة");
        setSaving(false);
        return;
      }
      imagePath = path;
      if (isEdit && trip?.image_url) {
        await supabase.storage.from("trip-images").remove([trip.image_url]);
      }
    } else if (isEdit && removeExistingImage) {
      if (trip?.image_url) {
        await supabase.storage.from("trip-images").remove([trip.image_url]);
      }
      imagePath = null;
    }

    const payload = {
      title: form.title.trim(),
      badge: form.badge.trim() || null,
      location: form.location.trim() || null,
      location_url: form.location_url.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      description: form.description.trim() || null,
      status: form.status,
    };

    let error;
    if (isEdit && trip) {
      const updateData = imagePath !== undefined ? { ...payload, image_url: imagePath } : payload;
      ({ error } = await supabase.from("trips").update(updateData).eq("id", trip.id));
    } else {
      ({ error } = await supabase.from("trips").insert({
        ...payload,
        image_url: imagePath ?? null,
        created_by: u.user.id,
      }));
    }
    setSaving(false);
    if (error) {
      toast.error(isEdit ? "تعذر حفظ التعديلات" : "تعذر إضافة الرحلة");
      return;
    }
    toast.success(isEdit ? "تم حفظ التعديلات" : "تمت إضافة الرحلة");
    onSaved();
    onClose();
  }


  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="card-surface w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-medium text-ivory">{isEdit ? "تعديل الرحلة" : "إضافة رحلة جديدة"}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-ivory transition"
            aria-label="إغلاق"
          >
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <Field label="عنوان الرحلة *">
            <input
              required
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="input-base"
              placeholder="رحلة الشتاء السنوية"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="الوسم">
              <input
                value={form.badge}
                onChange={(e) => update("badge", e.target.value)}
                className="input-base"
                placeholder="الرحلة الكبرى"
              />
            </Field>
            <Field label="الحالة">
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className="input-base"
              >
                <option value="upcoming">قادمة</option>
                <option value="planning">قيد التخطيط</option>
                <option value="past">سابقة</option>
              </select>
            </Field>
          </div>
          <Field label="الموقع">
            <input
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              className="input-base"
              placeholder="مخيم العلا، المملكة العربية السعودية"
            />
          </Field>
          <Field label="رابط الموقع (خرائط جوجل أو أي رابط)">
            <input
              type="url"
              value={form.location_url}
              onChange={(e) => update("location_url", e.target.value)}
              className="input-base"
              placeholder="https://maps.google.com/..."
              dir="ltr"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="تاريخ البدء">
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => update("start_date", e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label="تاريخ الانتهاء">
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => update("end_date", e.target.value)}
                className="input-base"
              />
            </Field>
          </div>
          <Field label="الوصف">
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="input-base min-h-24 resize-y"
              placeholder="اجتماع شمل العائلة..."
            />
          </Field>
          <Field label="صورة الرحلة (اختياري)">
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img src={imagePreview} alt="معاينة" className="w-full h-48 object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 left-2 size-8 grid place-items-center rounded-full bg-black/60 text-ivory hover:bg-black/80 transition"
                  aria-label="إزالة الصورة"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : isEdit && trip?.image_url && !removeExistingImage ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <TripImage path={trip.image_url} alt="الصورة الحالية" className="w-full h-48 object-cover" />
                <button
                  type="button"
                  onClick={() => setRemoveExistingImage(true)}
                  className="absolute top-2 left-2 size-8 grid place-items-center rounded-full bg-black/60 text-ivory hover:bg-black/80 transition"
                  aria-label="إزالة الصورة"
                >
                  <X className="size-4" />
                </button>
                <label className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-black/60 text-ivory text-xs cursor-pointer hover:bg-black/80 transition">
                  <Upload className="size-3.5" />
                  استبدال
                  <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 px-4 py-8 border border-dashed border-border rounded-lg cursor-pointer hover:border-gold-primary/40 hover:bg-secondary/20 transition">
                <div className="size-10 rounded-full bg-gold-primary/10 grid place-items-center">
                  <Upload className="size-5 text-gold-primary" strokeWidth={1.5} />
                </div>
                <div className="text-sm text-ivory">انقر لرفع صورة</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="size-3" />
                  JPG, PNG, WebP — حتى 5 ميجابايت
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickImage}
                />
              </label>
            )}
          </Field>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-ivory transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition disabled:opacity-60"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              {saving ? "جاري الحفظ..." : "إضافة الرحلة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-2">{label}</span>
      {children}
    </label>
  );
}
