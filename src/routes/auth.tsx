import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import logoAsset from "@/assets/alsaif-logo.png.asset.json";
import { useAppBackground } from "@/hooks/use-app-background";
import { paletteToCssVars } from "@/lib/bg-palette";

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

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { url: authBg, palette: authPalette } = useAppBackground("auth_bg");
  const paletteVars = authPalette ? paletteToCssVars(authPalette) : undefined;

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
      toast.error("تعذّر الدخول", { description: "تأكد من البيانات المعتمدة من الإدارة." });
      return;
    }
    toast.success("أهلاً بك في مجلس آل سيف");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-[#F4F4F1] transition-colors duration-700 overflow-hidden">

      {/* Background Watermarks - Kept subtle */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-5%] size-[600px] rounded-full bg-[#15402E]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] size-[600px] rounded-full bg-[#D4AF37]/5 blur-[120px]" />
      </div>

      <div
        className="relative w-full max-w-[460px] bg-white rounded-[44px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.18)] animate-fade-up overflow-hidden border border-black/5"
        style={paletteVars}
      >
        {/* BACKGROUND IMAGE - Strictly confined to this card */}
        {authBg && (
          <div
            className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat opacity-[0.45] transition-opacity duration-1000"
            style={{ backgroundImage: `url(${authBg})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/40 to-white/95" />
          </div>
        )}

        <div className="relative z-10 p-8 sm:p-10">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="size-24 mb-6 flex items-center justify-center p-3 bg-white rounded-[32px] shadow-sm ring-1 ring-black/5">
              <img src={logoAsset.url} alt="Logo" className="size-full object-contain" />
            </div>
            <h1 className="text-4xl font-serif text-[#15402E] mb-1 font-bold tracking-tight">مجلس السيف</h1>
            <div className="flex items-center gap-3 text-[10px] font-bold tracking-[0.3em] text-[#8E7745] uppercase mt-2">
              <span>◆</span>
              <span>ALSAIF · PRIVATE ACCESS</span>
              <span>◆</span>
            </div>
            <p className="mt-8 text-[15px] text-[#4B5563] font-medium leading-relaxed max-w-[30ch]">
              هذه المنصة خاصة بأعضاء العائلة. الوصول بدعوة أو بموافقة المشرفين.
            </p>
          </div>

          {/* Inner Login Form Container */}
          <div className="relative bg-[#F9F9F7] rounded-[36px] p-6 sm:p-8 border border-[#E5E4E0] shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">

            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-5 py-1.5 rounded-full shadow-md text-[#D4AF37] border border-[#F2F2F7]">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z"/>
               </svg>
            </div>

            <div className="flex items-center justify-center gap-4 mb-8 pt-3">
              <div className="h-[1.5px] w-10 bg-[#D4AF37]/30" />
              <h2 className="text-[18px] font-bold text-[#15402E] tracking-tight">تسجيل الدخول</h2>
              <div className="h-[1.5px] w-10 bg-[#D4AF37]/30" />
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2 text-right">
                <label className="text-[12px] text-[#4B5563] font-bold mr-2 block uppercase tracking-wider">البريد الإلكتروني</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                    <Mail className="size-5 text-[#8E7745]/60" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className="w-full bg-white border border-[#D1D1D6] rounded-2xl pr-14 pl-5 py-4 text-[16px] font-medium text-[#1A1A1A] focus:outline-none focus:ring-4 focus:ring-[#15402E]/5 focus:border-[#15402E] transition-all text-right shadow-sm"
                    placeholder="name@alsaif.family"
                  />
                </div>
              </div>

              <div className="space-y-2 text-right">
                <label className="text-[12px] text-[#4B5563] font-bold mr-2 block uppercase tracking-wider">كلمة المرور</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                    <Lock className="size-5 text-[#8E7745]/60" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-[#D1D1D6] rounded-2xl pr-14 pl-14 py-4 text-[16px] font-medium text-[#1A1A1A] focus:outline-none focus:ring-4 focus:ring-[#15402E]/5 focus:border-[#15402E] transition-all shadow-sm"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-5 flex items-center text-[#8E8E93] hover:text-[#15402E] transition-colors"
                  >
                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[14px] px-1 font-bold">
                <label className="flex items-center gap-2.5 cursor-pointer text-[#4B5563]">
                  <input type="checkbox" className="size-4.5 accent-[#15402E] rounded-lg border-[#D1D1D6]" />
                  تذكرني
                </label>
                <button
                  type="button"
                  className="text-[#B8972E] hover:text-[#8B6B23] transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4.5 bg-gradient-to-l from-[#8B6B23] to-[#B8972E] text-white text-[17px] font-bold rounded-2xl shadow-xl shadow-[#B8972E]/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
              >
                {loading && <Loader2 className="size-5 animate-spin" />}
                <span>دخول إلى المجلس</span>
                <ArrowLeft className="size-5 group-hover:-translate-x-1 transition-transform" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  className="text-[14px] text-[#15402E] hover:underline font-bold opacity-90"
                >
                  طلب إنشاء حساب جديد
                </button>
              </div>
            </form>
          </div>

          <p className="text-center text-[10px] text-[#8E8E93] mt-12 tracking-[0.4em] uppercase font-black opacity-60">
            ALSAIF FAMILY HUB
          </p>
        </div>
      </div>
    </div>
  );
}
