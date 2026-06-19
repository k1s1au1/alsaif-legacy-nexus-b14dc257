import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, ArrowRight, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import logoAsset from "@/assets/alsaif-logo.png.asset.json";
import { SaduPattern } from "@/components/sadu-pattern";
import { TermsContent, TERMS_SHORT } from "@/components/terms-content";

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

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10 bg-[#F5F5F0]">
      <div className="relative w-full max-w-[440px] bg-[#FAF9F6]/90 backdrop-blur-sm rounded-[40px] p-8 border border-[#E5E4E0] shadow-2xl animate-fade-up">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="size-28 mb-4">
            <img src={logoAsset.url} alt="Logo" className="size-full object-contain" />
          </div>
          <h1 className="text-4xl font-serif text-[#1B4332] mb-1">السيف</h1>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-[#8E7745] uppercase">
            <span>◆</span>
            <span>ALSAIF · PRIVATE ACCESS</span>
            <span>◆</span>
          </div>
          <p className="mt-6 text-sm text-[#4A4A4A] leading-relaxed max-w-[32ch]">
            هذه المنصة خاصة بأعضاء العائلة. الوصول بدعوة أو بموافقة المشرفين.
          </p>
        </div>

        <div className="relative bg-[#FAF9F6] rounded-[32px] p-6 border border-[#E5E4E0] shadow-inner mt-4 overflow-hidden">
          {/* Decorative leaf icon top center */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#FAF9F6] px-2 text-[#8E7745]">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z"/></svg>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8 pt-2">
            <div className="h-px w-8 bg-[#D4AF37]/40" />
            <h2 className="text-lg font-bold text-[#1B4332]">تسجيل الدخول</h2>
            <div className="h-px w-8 bg-[#D4AF37]/40" />
          </div>

          {mode === "login" ? (
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-1.5 text-right">
                <label className="text-[11px] text-[#666666] font-medium block mr-1">البريد الإلكتروني</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <Mail className="size-4 text-[#8E7745]/60" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className="w-full bg-white border border-[#E0E0E0] rounded-xl pr-11 pl-4 py-3.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] transition-all text-right"
                    placeholder="name@alsaif.family"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-right">
                <label className="text-[11px] text-[#666666] font-medium block mr-1">كلمة المرور</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <Lock className="size-4 text-[#8E7745]/60" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-[#E0E0E0] rounded-xl pr-11 pl-11 py-3.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] transition-all"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-4 flex items-center text-[#8E7745]/60 hover:text-[#8E7745]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] px-1">
                <label className="flex items-center gap-2 cursor-pointer text-[#4A4A4A]">
                  <input type="checkbox" className="size-3.5 accent-[#8E7745] rounded" />
                  تذكرني
                </label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-[#D4AF37] hover:underline font-medium"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-l from-[#996515] to-[#D4AF37] text-white text-base font-bold rounded-2xl shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
              >
                {loading && <Loader2 className="size-5 animate-spin" />}
                <span>دخول إلى المجلس</span>
                <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow h-px bg-[#E5E4E0]" />
                <span className="flex-shrink mx-4 text-[11px] text-[#A0A0A0]">أو</span>
                <div className="flex-grow h-px bg-[#E5E4E0]" />
              </div>

              <div className="text-center">
                <p className="text-xs text-[#666666] mb-4">ليس لديك حساب بعد؟</p>
                <button
                  type="button"
                  onClick={() => setMode("request")}
                  className="w-full py-3.5 border-2 border-[#E5E4E0] text-[#4A4A4A] text-sm font-bold rounded-2xl hover:bg-black/5 transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus className="size-4" />
                  طلب إنشاء حساب
                </button>
              </div>
            </form>
          ) : (
            <div className="min-h-[300px] flex items-center justify-center">
               <button onClick={() => setMode("login")} className="text-sm text-[#8E7745] underline">العودة للرئيسية</button>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-[#A0A0A0] mt-8 tracking-widest uppercase font-bold">
          ALSAIF FAMILY HUB
        </p>
      </div>
    </div>
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
    <label className="block space-y-1.5 text-right">
      <span className="text-xs text-[#666666] mr-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-[#E0E0E0] rounded-xl px-4 py-3 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] transition-all"
      />
    </label>
  );
}
