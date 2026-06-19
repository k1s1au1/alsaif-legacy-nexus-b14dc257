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
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-background transition-colors duration-700 overflow-hidden">

      {/* Background Watermarks - Kept subtle */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-5%] size-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] size-[600px] rounded-full bg-gold-primary/5 blur-[120px]" />
      </div>

      <div
        className="relative w-full max-w-[460px] bg-card rounded-[44px] shadow-2xl animate-fade-up overflow-hidden border border-border"
        style={paletteVars}
      >
        {/* BACKGROUND IMAGE - Strictly confined to this card */}
        {authBg && (
          <div
            className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat opacity-[0.45] transition-opacity duration-1000"
            style={{ backgroundImage: `url(${authBg})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-card/95 via-card/40 to-card/95" />
          </div>
        )}

        <div className="relative z-10 p-8 sm:p-10">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="size-24 mb-6 flex items-center justify-center p-3 bg-card rounded-[32px] shadow-sm ring-1 ring-border">
              <img src={logoAsset.url} alt="Logo" className="size-full object-contain" />
            </div>
            <h1 className="text-4xl font-serif text-primary mb-1 font-bold tracking-tight">مجلس السيف</h1>
            <div className="flex items-center gap-3 text-[10px] font-bold tracking-[0.3em] text-gold-primary uppercase mt-2">
              <span>◆</span>
              <span>ALSAIF · PRIVATE ACCESS</span>
              <span>◆</span>
            </div>
            <p className="mt-8 text-[15px] text-muted-foreground font-medium leading-relaxed max-w-[30ch]">
              هذه المنصة خاصة بأعضاء العائلة. الوصول بدعوة أو بموافقة المشرفين.
            </p>
          </div>

          {/* Inner Login Form Container */}
          <div className="relative bg-muted/30 rounded-[36px] p-6 sm:p-8 border border-border shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">

            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-5 py-1.5 rounded-full shadow-md text-gold-primary border border-border">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z"/>
               </svg>
            </div>

            <div className="flex items-center justify-center gap-4 mb-8 pt-3">
              <div className="h-[1.5px] w-10 bg-gold-primary/30" />
              <h2 className="text-[18px] font-bold text-primary tracking-tight">تسجيل الدخول</h2>
              <div className="h-[1.5px] w-10 bg-gold-primary/30" />
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2 text-right">
                <label className="text-[12px] text-muted-foreground font-bold mr-2 block uppercase tracking-wider">البريد الإلكتروني</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                    <Mail className="size-5 text-gold-primary/60" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className="w-full bg-card border border-border rounded-2xl pr-14 pl-5 py-4 text-[16px] font-medium text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-right shadow-sm"
                    placeholder="name@alsaif.family"
                  />
                </div>
              </div>

              <div className="space-y-2 text-right">
                <label className="text-[12px] text-muted-foreground font-bold mr-2 block uppercase tracking-wider">كلمة المرور</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                    <Lock className="size-5 text-gold-primary/60" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-card border border-border rounded-2xl pr-14 pl-14 py-4 text-[16px] font-medium text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-5 flex items-center text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[14px] px-1 font-bold">
                <label className="flex items-center gap-2.5 cursor-pointer text-muted-foreground">
                  <input type="checkbox" className="size-4.5 accent-primary rounded-lg border-border" />
                  تذكرني
                </label>
                <button
                  type="button"
                  className="text-gold-primary hover:text-primary transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4.5 bg-primary text-primary-foreground text-[17px] font-bold rounded-2xl shadow-xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
              >
                {loading && <Loader2 className="size-5 animate-spin" />}
                <span>دخول إلى المجلس</span>
                <ArrowLeft className="size-5 group-hover:-translate-x-1 transition-transform" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  className="text-[14px] text-primary hover:underline font-bold opacity-90"
                >
                  طلب إنشاء حساب جديد
                </button>
              </div>
            </form>
          </div>

          <p className="text-center text-[10px] text-muted-foreground mt-12 tracking-[0.4em] uppercase font-black opacity-60">
            ALSAIF FAMILY HUB
          </p>
        </div>
      </div>
    </div>
  );
}
