import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, UserPlus, Send, X, Phone, User } from "lucide-react";
import logoAsset from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "مجلس السيف — بوابة الدخول" },
      { name: "description", content: "بوابة الدخول الخاصة بأعضاء عائلة السيف." },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "login" | "request" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const dynamicLogo = useSiteLogo();

  // Signature Messages
  const [msgIndex, setMsgIndex] = useState(0);
  const welcomeMessages = [
    "أهلاً بك في مجلس السيف الموقر",
    "نصل العائلة.. ونبض المجتمع",
    "حيث يُحفظ الإرث وتُبنى الروابط",
    "منصة التواصل الرسمية والخاصة"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % welcomeMessages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("تعذّر الدخول", { description: "يرجى التحقق من بيانات الاعتماد." });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-[#05070a] transition-colors duration-1000 overflow-hidden">

      {/* 1. Signature Backdrop: Deep Emerald Gradient */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#064e3b] via-[#042f26] to-[#010a08]" />

      {/* 2. God Rays / Ambient Lighting */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none z-1">
         <div className="absolute -top-1/4 -right-1/4 w-full h-full bg-gold-primary/10 blur-[160px] rounded-full" />
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.05)_0%,transparent_50%)]" />
      </div>

      {/* 3. Floating Gold Particles (Luxury Dust) */}
      <div className="absolute inset-0 pointer-events-none z-1">
        {[...Array(60)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: Math.random() * 100 + "%", y: Math.random() * 100 + "%" }}
            animate={{ y: [null, "-100%"], opacity: [0, 0.5, 0] }}
            transition={{ duration: 15 + Math.random() * 25, repeat: Infinity, ease: "linear", delay: Math.random() * -30 }}
            className="absolute size-[2px] bg-gold-primary rounded-full blur-[1px] shadow-[0_0_8px_#d4af37]"
          />
        ))}
      </div>

      {/* 4. Heritage Watermark: Large Palm/Sword Silhouette */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-1 scale-150 rotate-12">
          <div className="size-[800px] logo-alsaif grayscale brightness-200" style={{ '--logo-url': `url(${dynamicLogo || logoAsset.url})` } as any} />
      </div>

      {/* 5. Main Card: Frosted Metallic Glass */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[480px] md:max-w-[580px] bg-white/5 backdrop-blur-[40px] rounded-[48px] shadow-[0_48px_120px_-24px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden"
      >
        {/* Subtle Inner Glow/Border */}
        <div className="absolute inset-0 border-[0.5px] border-gold-primary/20 rounded-[48px] pointer-events-none" />

        <div className="relative z-10 p-8 sm:p-12 lg:p-16 flex flex-col h-full">

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-10">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="size-28 mb-8 flex items-center justify-center p-5 bg-white/5 backdrop-blur-2xl rounded-[36px] shadow-2xl border border-white/10 relative group"
            >
              <div className="absolute inset-0 bg-gold-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <AnimatePresence mode="wait">
                {dynamicLogo ? (
                  <motion.div key={dynamicLogo} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="size-full relative z-10 logo-alsaif" style={{ '--logo-url': `url(${dynamicLogo})` } as any} />
                ) : (
                  <Loader2 className="size-8 animate-spin text-gold-primary/20" />
                )}
              </AnimatePresence>
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tighter drop-shadow-lg">مجلس السيف</h1>
            <p className="text-[10px] md:text-xs font-black tracking-[0.6em] text-gold-primary uppercase opacity-60">عائلة السيف · بوابة خاصة</p>

            {/* Ahlan - Signature Greeting (Amiri Font) */}
            <div className="h-12 mt-8 flex items-center justify-center">
               <AnimatePresence mode="wait">
                  <motion.p
                    key={msgIndex}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="text-xl md:text-2xl text-gold-primary/90 font-royal-mode italic"
                    style={{ fontFamily: "'Amiri', serif" }}
                  >
                    {welcomeMessages[msgIndex]}
                  </motion.p>
               </AnimatePresence>
            </div>
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            {mode === "login" && (
              <motion.form key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={onLogin} className="space-y-6">
                <div className="space-y-2" dir="rtl">
                  <label className="text-xs font-black text-white/40 mr-4 uppercase tracking-widest">البريد الإلكتروني</label>
                  <div className="relative group">
                    <Mail className="absolute right-6 top-1/2 -translate-y-1/2 size-5 text-gold-primary/60 group-focus-within:text-gold-primary transition-colors" />
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-16 bg-white/[0.03] border border-white/10 rounded-2xl pr-16 pl-6 font-bold text-white placeholder:text-white/10 focus:outline-none focus:bg-white/[0.07] focus:border-gold-primary/40 transition-all shadow-inner"
                      placeholder="البريد الإلكتروني..."
                    />
                  </div>
                </div>

                <div className="space-y-2" dir="rtl">
                  <label className="text-xs font-black text-white/40 mr-4 uppercase tracking-widest">كلمة المرور</label>
                  <div className="relative group">
                    <Lock className="absolute right-6 top-1/2 -translate-y-1/2 size-5 text-gold-primary/60 group-focus-within:text-gold-primary transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-16 bg-white/[0.03] border border-white/10 rounded-2xl pr-16 pl-16 font-bold text-white placeholder:text-white/10 focus:outline-none focus:bg-white/[0.07] focus:border-gold-primary/40 transition-all shadow-inner"
                      placeholder="••••••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors">
                      {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full h-16 bg-gradient-to-r from-[#064e3b] to-[#042f26] text-white font-black text-lg rounded-2xl shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-4 border border-white/10"
                >
                  {loading ? <Loader2 className="size-6 animate-spin" /> : <><span>دخول إلى المجلس</span><ArrowLeft className="size-6" /></>}
                </button>

                <div className="flex flex-col items-center gap-4 pt-4">
                   <button type="button" onClick={() => setAuthMode("request")} className="text-sm font-black text-gold-primary/80 hover:text-gold-primary hover:underline transition-all">طلب إنشاء حساب جديد</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer Logo/Mark */}
          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col items-center gap-2 opacity-20">
             <div className="size-8 logo-alsaif grayscale" style={{ '--logo-url': `url(${dynamicLogo || logoAsset.url})` } as any} />
             <p className="text-[10px] font-black tracking-[0.5em] text-white uppercase">Alsaif Legacy Hub</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ReqField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2">
       <label className="text-xs font-black text-white/40 mr-2 uppercase tracking-widest">{label}</label>
       <div className="relative group">
          {icon && <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors">{icon}</div>}
          <input
            type={type} required value={value} onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full h-14 bg-white/5 border border-white/10 rounded-2xl font-bold text-base text-white focus:outline-none focus:border-gold-primary/40 transition-all",
              icon ? "pr-14 pl-5" : "px-5"
            )}
            placeholder={placeholder}
          />
       </div>
    </div>
  );
}
