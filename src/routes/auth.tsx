import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, ArrowRight, Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import logoAsset from "@/assets/alsaif-logo.png.asset.json";
import { TermsContent, TERMS_SHORT } from "@/components/terms-content";
import { useAppBackground } from "@/hooks/use-app-background";
import { paletteToCssVars } from "@/lib/bg-palette";


export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — السيف" },
      { name: "description", content: "بوابة الدخول الخاصة بأعضاء عائلة السيف." },
    ],
  }),
  component: AuthPage,
});

const DEFAULT_PRIMARY = "#165A3A";
const DEFAULT_SECONDARY = "#2E7D32";
const DEFAULT_BORDER = "#E5E7EB";
const DEFAULT_DARK = "#1F2937";
const DEFAULT_MUTED = "#6B7280";
const ERROR = "#C62828";
// Aliases used by helper components below the main page component.
const PRIMARY = DEFAULT_PRIMARY;
const BORDER = DEFAULT_BORDER;
const DARK = DEFAULT_DARK;
const MUTED = DEFAULT_MUTED;

const nameSchema = z.string().trim().min(2, "حرفان على الأقل").max(40, "طويل جداً");
const phoneSchema = z
  .string()
  .trim()
  .min(8, "رقم قصير")
  .max(20, "رقم طويل")
  .regex(/^[\d\s+\-()]+$/, "أرقام فقط");

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "request" | "forgot">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  // request form
  const [first, setFirst] = useState("");
  const [father, setFather] = useState("");
  const [grand, setGrand] = useState("");
  const [phone, setPhone] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [reqPassword2, setReqPassword2] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("تعذّر الدخول", { description: "تأكد من البريد وكلمة المرور المعتمدين من الإدارة." });
      return;
    }
    toast.success("أهلاً بك في السيف");
    navigate({ to: "/dashboard", replace: true });
  }

  async function onSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    for (const [v, label] of [
      [first, "الاسم الأول"],
      [father, "اسم الأب"],
      [grand, "اسم الجد"],
    ] as const) {
      const r = nameSchema.safeParse(v);
      if (!r.success) {
        toast.error(`${label}: ${r.error.issues[0].message}`);
        return;
      }
    }
    const ph = phoneSchema.safeParse(phone);
    if (!ph.success) {
      toast.error(`رقم الجوال: ${ph.error.issues[0].message}`);
      return;
    }
    if (!z.string().email().safeParse(reqEmail.trim()).success) {
      toast.error("البريد الإلكتروني غير صالح");
      return;
    }
    if (reqPassword.length < 8) {
      toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }
    if (reqPassword !== reqPassword2) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    if (!agreeTerms) {
      toast.error("يجب الموافقة على الإقرار والشروط للمتابعة");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("account_requests").insert({
      first_name: first.trim(),
      father_name: father.trim(),
      grandfather_name: grand.trim(),
      phone: phone.trim(),
      email: reqEmail.trim(),
      desired_password: reqPassword,
      note: note.trim() || null,
      terms_accepted: true,
    });
    setSubmitting(false);
    if (error) {
      toast.error("تعذّر إرسال الطلب، حاول لاحقاً");
      return;
    }
    setSubmitted(true);
    toast.success("تم إرسال طلبك، سيتواصل معك المشرفون قريباً");
  }

  async function onSubmitForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!z.string().email().safeParse(forgotEmail.trim()).success) {
      toast.error("البريد الإلكتروني غير صالح");
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error("تعذّر إرسال البريد", { description: error.message });
      return;
    }
    setForgotSent(true);
    toast.success("تم إرسال رابط إعادة التعيين");
  }

  // CSS filter to tint the black logo to dark green (#165A3A)
  const greenLogoFilter =
    "brightness(0) saturate(100%) invert(24%) sepia(45%) saturate(900%) hue-rotate(105deg) brightness(92%) contrast(92%)";

  const { url: customBg, palette } = useAppBackground("auth_bg");

  // Adaptive colors derived from the uploaded background (fallback to defaults).
  const PRIMARY = palette?.accent ?? DEFAULT_PRIMARY;
  const SECONDARY = palette?.accent ?? DEFAULT_SECONDARY;
  const DARK = palette?.fg ?? DEFAULT_DARK;
  const MUTED = palette?.muted ?? DEFAULT_MUTED;
  const BORDER = palette?.border ?? DEFAULT_BORDER;
  const CARD_BG = palette?.card ?? "rgba(255,255,255,0.55)";
  const paletteVars = palette ? paletteToCssVars(palette) : {};

  // Glass tint derived from background accent
  const glassTint = palette ? `${palette.accent}22` : "rgba(255,255,255,0.35)";
  const glassBorder = palette?.border ?? "rgba(255,255,255,0.45)";
  const glassShadow = palette?.isDark
    ? "0 20px 60px -25px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)"
    : "0 20px 60px -25px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.45)";

  return (
    <div
      dir="rtl"
      className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10"
      style={{
        ...paletteVars,
        background: customBg ? `url(${customBg}) center/cover no-repeat` : "#FFFFFF",
        color: DARK,
        fontFamily: "'Noto Kufi Arabic','Tajawal',system-ui,sans-serif",
      }}
    >
      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-7">
          <img
            src={logoAsset.url}
            alt="شعار عائلة السيف"
            width={140}
            height={140}
            className="w-28 h-28 sm:w-32 sm:h-32 object-contain mb-4"
            style={{ filter: greenLogoFilter }}
          />
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: PRIMARY }}>
            السيف
          </h1>
          <p
            className="mt-2 text-[11px] font-semibold"
            style={{ color: SECONDARY, letterSpacing: "0.28em" }}
          >
            ALSAIF · PRIVATE ACCESS
          </p>
          <p className="mt-4 text-sm leading-relaxed max-w-[32ch]" style={{ color: MUTED }}>
            هذه المنصة خاصة بأعضاء العائلة.
            <br />
            الوصول بدعوة أو بموافقة المشرفين.
          </p>
        </div>

        {/* Glass card — tints with background palette */}
        <div
          className="p-7 sm:p-8 animate-fade-up"
          style={{
            background: `linear-gradient(135deg, ${glassTint}, rgba(255,255,255,0.18))`,
            border: `1px solid ${glassBorder}`,
            borderRadius: 24,
            backdropFilter: "blur(22px) saturate(160%)",
            boxShadow: glassShadow,
          }}
        >
          {mode === "login" ? (
            <>
              <form onSubmit={onSubmit} className="space-y-5">
                <Field
                  label="البريد الإلكتروني"
                  icon={<Mail className="size-4" style={{ color: PRIMARY }} strokeWidth={1.8} />}
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    placeholder="name@alsaif.family"
                    className="w-full bg-transparent outline-none text-sm text-right py-1"
                    style={{ color: DARK }}
                  />
                </Field>

                <Field
                  label="كلمة المرور"
                  icon={<Lock className="size-4" style={{ color: PRIMARY }} strokeWidth={1.8} />}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="p-1 rounded hover:bg-gray-100 transition"
                      aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" style={{ color: MUTED }} strokeWidth={1.8} />
                      ) : (
                        <Eye className="size-4" style={{ color: MUTED }} strokeWidth={1.8} />
                      )}
                    </button>
                  }
                >
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent outline-none text-sm py-1"
                    style={{ color: DARK }}
                  />
                </Field>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: MUTED }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="size-4 rounded"
                      style={{ accentColor: PRIMARY }}
                    />
                    تذكرني
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="font-medium hover:underline transition"
                    style={{ color: ERROR }}
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 text-white text-sm font-semibold rounded-2xl transition-all duration-300 disabled:opacity-60 inline-flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-[1px]"
                  style={{
                    background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`,
                    boxShadow: "0 10px 24px -10px rgba(22,90,58,0.55)",
                  }}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  {loading ? "جاري الدخول…" : "دخول إلى المجلس"}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3" style={{ color: MUTED }}>
                <div className="flex-1 h-px" style={{ background: BORDER }} />
                <span className="text-[11px]">أو</span>
                <div className="flex-1 h-px" style={{ background: BORDER }} />
              </div>

              <div className="text-center space-y-3">
                <p className="text-xs" style={{ color: MUTED }}>
                  ليس لديك حساب بعد؟
                </p>
                <button
                  type="button"
                  onClick={() => setMode("request")}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 hover:bg-[color:var(--primary-soft)] hover:-translate-y-[1px]"
                  style={{
                    background: "rgba(255,255,255,0.45)",
                    backdropFilter: "blur(8px)",
                    border: `1.5px solid ${PRIMARY}`,
                    color: PRIMARY,
                    ['--primary-soft' as never]: "#F0F7F2",
                  }}
                >
                  <UserPlus className="size-4" strokeWidth={1.8} />
                  طلب إنشاء حساب
                </button>
              </div>
            </>
          ) : mode === "forgot" ? (
            forgotSent ? (
              <div className="text-center space-y-4 py-4">
                <h2 className="text-lg font-semibold" style={{ color: DARK }}>
                  تم إرسال البريد
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  إذا كان البريد مسجلاً لدينا، فستصلك رسالة فيها رابط لإعادة تعيين كلمة المرور خلال دقائق.
                </p>
                <button
                  onClick={() => { setMode("login"); setForgotSent(false); setForgotEmail(""); }}
                  className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                  style={{ color: PRIMARY }}
                >
                  <ArrowRight className="size-4" />
                  العودة إلى تسجيل الدخول
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-center max-w-[30ch] mx-auto leading-relaxed mb-6" style={{ color: MUTED }}>
                  أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
                </p>
                <form onSubmit={onSubmitForgot} className="space-y-4">
                  <Field
                    label="البريد الإلكتروني"
                    icon={<Mail className="size-4" style={{ color: PRIMARY }} strokeWidth={1.8} />}
                  >
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@alsaif.family"
                      className="w-full bg-transparent outline-none text-sm text-right py-1"
                      style={{ color: DARK }}
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3.5 text-white text-sm font-semibold rounded-2xl transition-all duration-300 disabled:opacity-60 inline-flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-[1px]"
                    style={{
                      background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`,
                      boxShadow: "0 10px 24px -10px rgba(22,90,58,0.55)",
                    }}
                  >
                    {forgotLoading && <Loader2 className="size-4 animate-spin" />}
                    إرسال رابط الإعادة
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full text-xs hover:text-[color:var(--primary)] transition pt-1"
                    style={{ color: MUTED, ['--primary' as never]: PRIMARY }}
                  >
                    العودة إلى تسجيل الدخول
                  </button>
                </form>
              </>
            )
          ) : submitted ? (
            <div className="text-center space-y-4 py-4">
              <div
                className="size-12 mx-auto rounded-full grid place-items-center"
                style={{ background: "#F0F7F2", border: `1px solid ${PRIMARY}33` }}
              >
                <UserPlus className="size-5" style={{ color: PRIMARY }} strokeWidth={1.6} />
              </div>
              <h2 className="text-lg font-semibold" style={{ color: DARK }}>
                تم استلام طلبك
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                سيقوم المشرفون بمراجعة طلبك والتواصل معك على رقم الجوال المسجّل.
              </p>
              <button
                onClick={() => {
                  setMode("login");
                  setSubmitted(false);
                  setFirst(""); setFather(""); setGrand(""); setPhone(""); setReqEmail(""); setReqPassword(""); setReqPassword2(""); setNote("");
                }}
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                style={{ color: PRIMARY }}
              >
                <ArrowRight className="size-4" />
                العودة إلى تسجيل الدخول
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-center max-w-[30ch] mx-auto leading-relaxed mb-6" style={{ color: MUTED }}>
                أدخل اسمك الثلاثي ورقم جوالك. سيقوم المشرفون بمراجعة الطلب.
              </p>
              <form onSubmit={onSubmitRequest} className="space-y-3">
                <ReqField label="الاسم الأول" value={first} onChange={setFirst} placeholder="فيصل" />
                <ReqField label="اسم الأب" value={father} onChange={setFather} placeholder="عبدالله" />
                <ReqField label="اسم الجد" value={grand} onChange={setGrand} placeholder="السيف" />
                <ReqField label="رقم الجوال" value={phone} onChange={setPhone} placeholder="055 123 4567" />
                <ReqField label="البريد الإلكتروني" value={reqEmail} onChange={setReqEmail} placeholder="name@example.com" type="email" />
                <ReqField label="كلمة المرور" value={reqPassword} onChange={setReqPassword} placeholder="٨ أحرف على الأقل" type="password" />
                <ReqField label="تأكيد كلمة المرور" value={reqPassword2} onChange={setReqPassword2} placeholder="أعد إدخال كلمة المرور" type="password" />
                <label className="block space-y-1.5">
                  <span className="text-xs" style={{ color: MUTED }}>ملاحظات (اختياري)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={400}
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                    style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(8px)", border: `1px solid ${BORDER}`, color: DARK }}
                    placeholder="صلة القرابة أو أي تفاصيل تساعد المشرفين"
                  />
                </label>
                <div className="rounded-xl p-3 space-y-2" style={{ border: `1px solid ${BORDER}`, background: "#F9FAFB" }}>
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-1 size-4 flex-shrink-0"
                      style={{ accentColor: PRIMARY }}
                    />
                    <span className="text-xs leading-relaxed" style={{ color: DARK }}>{TERMS_SHORT}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    className="text-[11px] hover:underline"
                    style={{ color: PRIMARY }}
                  >
                    عرض الإقرار الكامل
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 text-white text-sm font-semibold rounded-2xl transition-all duration-300 disabled:opacity-60 inline-flex items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-[1px]"
                  style={{
                    background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`,
                    boxShadow: "0 10px 24px -10px rgba(22,90,58,0.55)",
                  }}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  إرسال الطلب
                </button>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full text-xs transition pt-1 hover:underline"
                  style={{ color: MUTED }}
                >
                  العودة إلى تسجيل الدخول
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {showTerms && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm grid place-items-center p-4">
          <div
            className="max-w-2xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto"
            style={{ background: "#FFFFFF", borderRadius: 24, border: `1px solid ${BORDER}` }}
          >
            <div className="rounded-xl p-4 mb-5" style={{ border: `1px solid ${BORDER}`, background: "#F9FAFB" }}>
              <TermsContent />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="px-5 py-2.5 text-white text-sm font-semibold rounded-2xl transition hover:shadow-lg"
                style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)` }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  icon,
  trailing,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium" style={{ color: DARK }}>
        {label}
      </span>
      <div
        className="flex items-center gap-3 px-4 py-2.5 transition-all focus-within:border-[color:var(--p)] focus-within:ring-2 focus-within:ring-[color:var(--pr)]"
        style={{
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          ['--p' as never]: PRIMARY,
          ['--pr' as never]: "rgba(22,90,58,0.15)",
        }}
      >
        {icon}
        <div className="flex-1 min-w-0">{children}</div>
        {trailing}
      </div>
    </label>
  );
}

function ReqField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium" style={{ color: DARK }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          color: DARK,
        }}
      />
    </label>
  );
}
