import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { toast } from "sonner";
import { Camera, Loader2, Lock, User as UserIcon, Mail, Calendar } from "lucide-react";
import { UserAvatar, invalidateAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الملف الشخصي — الصيف" },
      { name: "description", content: "إدارة بيانات حسابك الشخصية وكلمة المرور وصورة الملف." },
    ],
  }),
  component: ProfilePage,
});

const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "الاسم يجب أن يحتوي على حرفين على الأقل" })
  .max(80, { message: "الاسم طويل جداً" });

const passwordSchema = z
  .string()
  .min(8, { message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" })
  .max(72, { message: "كلمة المرور طويلة جداً" });

type ProfileRow = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<string>("");
  const [arabicName, setArabicName] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      setEmail(u.user.email ?? "");
      setCreatedAt(u.user.created_at);
      const { data: p } = await supabase
        .from("profiles")
        .select("id, arabic_name, full_name, avatar_url, created_at")
        .eq("id", u.user.id)
        .maybeSingle<ProfileRow>();
      if (p) {
        setArabicName(p.arabic_name ?? "");
        setFullName(p.full_name ?? "");
        setAvatarUrl(p.avatar_url);
        if (p.avatar_url) {
          const { data: signed } = await supabase.storage
            .from("avatars")
            .createSignedUrl(p.avatar_url, 60 * 60);
          setAvatarSrc(signed?.signedUrl ?? null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const displayName =
    (arabicName || fullName || email.split("@")[0] || "عضو").trim();
  const initial = (displayName[0] ?? "ص").toUpperCase();

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const parsed = nameSchema.safeParse(arabicName || fullName);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        arabic_name: arabicName.trim() || null,
        full_name: fullName.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("تعذر حفظ التغييرات");
      return;
    }
    toast.success("تم حفظ التغييرات بنجاح");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPwSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    setPasswordConfirm("");
    toast.success("تم تحديث كلمة المرور");
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("يجب اختيار صورة");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميغابايت");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error("فشل رفع الصورة");
      return;
    }
    // Remove old avatar
    if (avatarUrl && avatarUrl !== path) {
      await supabase.storage.from("avatars").remove([avatarUrl]);
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);
    if (updErr) {
      setUploading(false);
      toast.error("تعذر حفظ الصورة");
      return;
    }
    setAvatarUrl(path);
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60);
    setAvatarSrc(signed?.signedUrl ?? null);
    setUploading(false);
    toast.success("تم تحديث صورة الملف الشخصي");
  }

  if (loading) {
    return (
      <AppShell title="الملف الشخصي" user={{ name: "...", role: "عضو", initial: "ص" }}>
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="الملف الشخصي"
      user={{ name: displayName, role: "عضو", initial }}
    >
      <div className="max-w-3xl space-y-8">
        {/* Header card */}
        <section className="card-surface p-8 flex flex-col sm:flex-row items-center gap-6 animate-fade-up">
          <div className="relative">
            <div className="size-24 rounded-full ring-2 ring-gold-primary/30 bg-gold-primary/10 grid place-items-center overflow-hidden">
              {avatarSrc ? (
                <img src={avatarSrc} alt={displayName} className="size-full object-cover" />
              ) : (
                <span className="text-3xl text-gold-primary font-medium">{initial}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="تغيير صورة الملف"
              className="absolute -bottom-1 -left-1 size-9 rounded-full bg-gold-primary text-navy-base grid place-items-center ring-2 ring-card hover:opacity-90 disabled:opacity-50 transition"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="text-center sm:text-right">
            <h2 className="text-2xl font-medium text-ivory">{displayName}</h2>
            <p className="text-sm text-muted-foreground mt-1">{email}</p>
          </div>
        </section>

        {/* Account info */}
        <section className="card-surface p-6 space-y-4 animate-fade-up">
          <h3 className="eyebrow">معلومات الحساب</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <InfoItem icon={<Mail className="size-4" />} label="البريد الإلكتروني" value={email} />
            <InfoItem
              icon={<Calendar className="size-4" />}
              label="تاريخ إنشاء الحساب"
              value={new Date(createdAt).toLocaleDateString("ar-SA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            />
          </dl>
        </section>

        {/* Edit profile */}
        <form
          onSubmit={saveProfile}
          className="card-surface p-6 space-y-5 animate-fade-up"
        >
          <div className="flex items-center gap-2">
            <UserIcon className="size-4 text-gold-primary" />
            <h3 className="eyebrow">الاسم المعروض</h3>
          </div>
          <Field label="الاسم بالعربية" value={arabicName} onChange={setArabicName} placeholder="مثال: فيصل السيف" />
          <Field label="الاسم الكامل (لاتيني)" value={fullName} onChange={setFullName} placeholder="Faisal Alsaif" />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-gold-primary text-navy-base text-sm font-medium hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              حفظ التغييرات
            </button>
          </div>
        </form>

        {/* Password */}
        <form
          onSubmit={changePassword}
          className="card-surface p-6 space-y-5 animate-fade-up"
        >
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-gold-primary" />
            <h3 className="eyebrow">تغيير كلمة المرور</h3>
          </div>
          <Field
            label="كلمة المرور الجديدة"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="8 أحرف على الأقل"
          />
          <Field
            label="تأكيد كلمة المرور"
            type="password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            placeholder="أعد كتابة كلمة المرور"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwSaving || !password}
              className="px-5 py-2 rounded-lg bg-gold-primary text-navy-base text-sm font-medium hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-2"
            >
              {pwSaving && <Loader2 className="size-4 animate-spin" />}
              تحديث كلمة المرور
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-ivory placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold-primary/40 focus:border-gold-primary/40 transition"
      />
    </label>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border">
      <div className="text-gold-primary mt-0.5">{icon}</div>
      <div className="min-w-0">
        <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</dt>
        <dd className="text-sm text-ivory mt-0.5 truncate">{value}</dd>
      </div>
    </div>
  );
}
