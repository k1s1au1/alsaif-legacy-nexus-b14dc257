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
    <div
      className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-background transition-all duration-1000 overflow-hidden"
      style={paletteVars}
    >
      {/* Dynamic Image Background */}
      {authBg && (
        <div
          className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat transition-opacity duration-1000"
          style={{ backgroundImage: `url(${authBg})` }}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
        </div>
      )}

      {/* Decorative Heritage Elements (Only show if no custom background) */}
      {!authBg && (
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-[-10%] right-[-5%] size-[600px] rounded-full bg-gold-primary/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] size-[600px] rounded-full bg-luxury-gold/10 blur-[120px]" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-[440px] bg-card/90 backdrop-blur-md rounded-[40px] p-8 border border-border shadow-2xl animate-fade-up">

        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="size-28 mb-4 flex items-center justify-center">
            <img src={logoAsset.url} alt="Logo" className="size-full object-contain" />
          </div>
          <h1 className="text-4xl font-serif text-primary mb-1 font-bold">مجلس السيف</h1>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-gold-primary/70 uppercase mt-2">
            <span>◆</span>
            <span>ALSAIF · PRIVATE ACCESS</span>
            <span>◆</span>
          </div>
          <p className="mt-8 text-sm text-muted-foreground leading-relaxed max-w-[32ch]">
            هذه المنصة خاصة بأعضاء العائلة. الوصول بدعوة أو بموافقة المشرفين.
          </p>
        </div>

        {/* Inner Login Form */}
        <div className="relative bg-background/50 rounded-[32px] p-6 border border-border/50 shadow-inner mt-2">

          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-luxury-gold">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
               <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z"/>
             </svg>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8 pt-3">
            <div className="h-[1px] w-8 bg-luxury-gold/30" />
            <h2 className="text-lg font-bold text-primary">تسجيل الدخول</h2>
            <div className="h-[1px] w-8 bg-luxury-gold/30" />
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2 text-right">
              <label className="text-[11px] text-muted-foreground font-bold mr-1">البريد الإلكتروني</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <Mail className="size-4 text-luxury-gold/50" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  className="input-base text-right"
                  placeholder="name@alsaif.family"
                />
              </div>
            </div>

            <div className="space-y-2 text-right">
              <label className="text-[11px] text-muted-foreground font-bold mr-1">كلمة المرور</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <Lock className="size-4 text-luxury-gold/50" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-4 flex items-center text-muted-foreground hover:text-luxury-gold transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 btn-gold flex items-center justify-center gap-3 group"
            >
              {loading && <Loader2 className="size-5 animate-spin" />}
              <span>دخول إلى المجلس</span>
              <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
            </button>

            <div className="text-center pt-4">
              <button
                type="button"
                className="text-[11px] text-luxury-gold hover:underline font-bold"
              >
                طلب إنشاء حساب جديد
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-10 tracking-[0.2em] uppercase font-bold">
          ALSAIF FAMILY HUB
        </p>
      </div>
    </div>
  );
}
