import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, ArrowRight, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import logoAsset from "@/assets/alsaif-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "مجلس آل سيف — تسجيل الدخول" },
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

  // request form state
  const [first, setFirst] = useState("");
  const [phone, setPhone] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    setSubmitting(true);
    // Logic for request...
    setSubmitting(false);
    setSubmitted(true);
  }

  async function onSubmitForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    // Logic for forgot password...
    setForgotLoading(false);
    setForgotSent(true);
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-[#F5F5F0]">
      <div className="relative w-full max-w-[440px] bg-[#FAF9F6] rounded-[40px] p-8 border border-[#E5E4E0] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] animate-fade-up">

        {/* Top Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="size-28 mb-4 flex items-center justify-center">
            <img src={logoAsset.url} alt="Logo" className="size-full object-contain" />
          </div>
          <h1 className="text-4xl font-serif text-[#1B4332] mb-1 font-bold">السيف</h1>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-[#8E7745] uppercase mt-2">
            <span>◆</span>
            <span>ALSAIF · PRIVATE ACCESS</span>
            <span>◆</span>
          </div>
          <p className="mt-8 text-[14px] text-[#4A4A4A] leading-relaxed max-w-[32ch]">
            هذه المنصة خاصة بأعضاء العائلة. الوصول بدعوة أو بموافقة المشرفين.
          </p>
        </div>

        {/* Inner Card Section */}
        <div className="relative bg-[#FAF9F6] rounded-[32px] p-6 border border-[#EBEAE6] shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] mt-2">

          {/* Decorative Leaf Icon */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#FAF9F6] px-3 text-[#8E7745]">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
               <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z"/>
             </svg>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8 pt-3">
            <div className="h-[1px] w-8 bg-[#D4AF37]/30" />
            <h2 className="text-lg font-bold text-[#1B4332]">تسجيل الدخول</h2>
            <div className="h-[1px] w-8 bg-[#D4AF37]/30" />
          </div>

          {mode === "login" ? (
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2 text-right">
                <label className="text-[11px] text-[#666666] font-bold mr-1">البريد الإلكتروني</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <Mail className="size-4 text-[#8E7745]/50" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className="w-full bg-white border border-[#E0E0E0] rounded-xl pr-11 pl-4 py-4 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/10 focus:border-[#D4AF37] transition-all text-right shadow-sm"
                    placeholder="name@alsaif.family"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2 text-right">
                <label className="text-[11px] text-[#666666] font-bold mr-1">كلمة المرور</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <Lock className="size-4 text-[#8E7745]/50" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-[#E0E0E0] rounded-xl pr-11 pl-11 py-4 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/10 focus:border-[#D4AF37] transition-all shadow-sm"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-4 flex items-center text-[#8E7745]/40 hover:text-[#8E7745] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-[11px] px-1 font-medium">
                <label className="flex items-center gap-2 cursor-pointer text-[#4A4A4A]">
                  <input type="checkbox" className="size-4 accent-[#8E7745] rounded-md border-[#E0E0E0]" />
                  تذكرني
                </label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-[#D4AF37] hover:text-[#996515] transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-l from-[#996515] to-[#D4AF37] text-white text-base font-bold rounded-2xl shadow-xl shadow-[#D4AF37]/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
              >
                {loading && <Loader2 className="size-5 animate-spin" />}
                <span>دخول إلى المجلس</span>
                <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
              </button>

              {/* Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow h-[1px] bg-[#E5E4E0]" />
                <span className="flex-shrink mx-4 text-[10px] font-bold text-[#A0A0A0] uppercase">أو</span>
                <div className="flex-grow h-[1px] bg-[#E5E4E0]" />
              </div>

              {/* Register Section */}
              <div className="text-center">
                <p className="text-[11px] text-[#666666] mb-4">ليس لديك حساب بعد؟</p>
                <button
                  type="button"
                  onClick={() => setMode("request")}
                  className="w-full py-4 border-2 border-[#E5E4E0] text-[#4A4A4A] text-sm font-bold rounded-2xl hover:bg-black/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus className="size-4" />
                  طلب إنشاء حساب
                </button>
              </div>
            </form>
          ) : (
            <div className="min-h-[200px] flex flex-col items-center justify-center gap-4 text-center">
               <p className="text-sm text-[#4A4A4A]">سيتم نقلك لصفحة الطلب/الاستعادة...</p>
               <button onClick={() => setMode("login")} className="text-sm text-[#8E7745] font-bold underline">العودة للرئيسية</button>
            </div>
          )}
        </div>

        {/* Footer Branding */}
        <p className="text-center text-[10px] text-[#A0A0A0] mt-10 tracking-[0.2em] uppercase font-bold">
          ALSAIF FAMILY HUB
        </p>
      </div>
    </div>
  );
}
