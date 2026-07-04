import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, Send, X, Phone, User } from "lucide-react";
import logoAsset from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
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

  const [reqForm, setReqForm] = useState({
    firstName: "",
    fatherName: "",
    grandFatherName: "",
    phone: "",
    email: "",
    password: ""
  });

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
      toast.error("تعذّر الدخول", { description: "يرجى التحقق من صحة البيانات." });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { toast.error("أدخل بريدك أولاً"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) { toast.error("خطأ", { description: error.message }); return; }
    toast.success("تم إرسال الرابط لبريدك");
    setAuthMode("login");
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("account_requests").insert({
      first_name: reqForm.firstName,
      father_name: reqForm.fatherName,
      grandfather_name: reqForm.grandFatherName,
      phone: reqForm.phone,
      email: reqForm.email,
      desired_password: reqForm.password,
      status: "pending"
    });
    setLoading(false);
    if (error) { toast.error("فشل الطلب", { description: error.message }); return; }
    toast.success("تم إرسال الطلب بنجاح");
    setAuthMode("login");
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-6 bg-[#064e3b] overflow-hidden" dir="rtl">

      {/* Deep Rich Emerald Backdrop */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#064e3b] via-[#053a2b] to-[#04281d]" />

      {/* Subtle Glowing Orbs for Depth */}
      <div className="absolute top-1/4 -right-20 size-[400px] bg-gold-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 size-[400px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Minimalist Glass Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 120 }}
        className="relative z-10 w-full max-w-[400px] bg-white/10 backdrop-blur-3xl rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.4)] border border-white/20 overflow-hidden"
      >
        <div className="p-8 sm:p-12 flex flex-col relative">
          {/* Glass Inner Tint */}
          <div className="absolute inset-0 bg-[#fdfcf7]/10 pointer-events-none" />

          <div className="relative z-10">
            {/* Simple Header */}
            <div className="flex flex-col items-center text-center mb-10">
               <div className="size-20 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-4 mb-6">
                  <div className="size-full logo-alsaif brightness-0 invert" style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : `url(${logoAsset.url})` } as any} />
               </div>
               <h1 className="text-3xl font-black text-white tracking-tight" style={{ fontFamily: "'Reem Kufi', sans-serif" }}>مجلس السيف</h1>
               <div className="h-px w-12 bg-gold-primary/40 mt-2" />
               <p className="text-[10px] font-black text-gold-primary uppercase tracking-[0.4em] mt-3">بوابة الدخول الذكية</p>
            </div>

            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.form key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={onLogin} className="space-y-5">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-white/40 mr-1 uppercase tracking-widest">البريد الإلكتروني</label>
                     <input
                       type="email" required value={email} onChange={e => setEmail(e.target.value)}
                       className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 font-bold text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-4 focus:ring-gold-primary/10 focus:border-gold-primary/30 transition-all"
                       placeholder="name@alsaif.com"
                     />
                  </div>

                  <div className="space-y-1.5">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">كلمة المرور</label>
                        <button type="button" onClick={() => setAuthMode("forgot")} className="text-[10px] font-black text-gold-primary hover:text-white transition-colors">هل نسيت؟</button>
                     </div>
                     <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                          className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 font-bold text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-4 focus:ring-gold-primary/10 focus:border-gold-primary/30 transition-all"
                          placeholder="••••••••"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-gold-primary p-1 transition-colors">
                           {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                     </div>
                  </div>

                  <button
                    type="submit" disabled={loading}
                    className="w-full h-14 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-2xl shadow-gold-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
                  >
                    {loading ? <Loader2 className="size-6 animate-spin" /> : <><span>دخول للمجلس</span><ArrowLeft size={5" /></>}
                  </button>

                  <div className="pt-8 text-center border-t border-white/5 mt-6">
                     <button
                       type="button"
                       onClick={() => setAuthMode("request")}
                       className="text-[11px] font-black text-white/40 uppercase tracking-widest hover:text-gold-primary transition-colors"
                     >
                       لا تملك حساباً؟ اطلب الانضمام
                     </button>
                  </div>
                </motion.form>
              ) : mode === "forgot" ? (
                <motion.form key="forgot" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onSubmit={onForgot} className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                     <h3 className="text-xl font-black text-white">استعادة الحساب</h3>
                     <button type="button" onClick={() => setAuthMode("login")} className="size-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-rose-500/20 hover:text-rose-400 transition-all"><X size={18} /></button>
                  </div>
                  <p className="text-xs font-bold text-white/40 leading-relaxed">أدخل بريدك وسنرسل لك رابط التحديث.</p>
                  <AuthField label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} placeholder="mail@example.com" />
                  <button
                    type="submit" disabled={loading}
                    className="w-full h-14 bg-white/10 text-white font-black rounded-2xl border border-white/10 hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="size-5 animate-spin" /> : <span>إرسال الرابط</span>}
                  </button>
                </motion.form>
              ) : (
                <motion.form key="request" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={onRequest} className="space-y-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar-thin">
                  <div className="flex justify-between items-center mb-4 sticky top-0 bg-[#064e3b]/80 backdrop-blur-md z-10 py-1">
                     <h3 className="text-xl font-black text-white">طلب عضوية</h3>
                     <button type="button" onClick={() => setAuthMode("login")} className="size-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-rose-500/20 hover:text-rose-400 transition-all"><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <AuthField label="الاسم الأول" value={reqForm.firstName} onChange={(v: string) => setReqForm({...reqForm, firstName: v})} placeholder="الاسم" />
                    <div className="grid grid-cols-2 gap-3">
                      <AuthField label="الأب" value={reqForm.fatherName} onChange={(v: string) => setReqForm({...reqForm, fatherName: v})} placeholder="اسم الأب" />
                      <AuthField label="الجد" value={reqForm.grandFatherName} onChange={(v: string) => setReqForm({...reqForm, grandFatherName: v})} placeholder="اسم الجد" />
                    </div>
                    <AuthField label="الجوال" value={reqForm.phone} onChange={(v: string) => setReqForm({...reqForm, phone: v})} placeholder="05xxxxxxxx" />
                    <AuthField label="البريد" type="email" value={reqForm.email} onChange={(v: string) => setReqForm({...reqForm, email: v})} placeholder="mail@example.com" />
                    <AuthField label="كلمة المرور" type="password" value={reqForm.password} onChange={(v: string) => setReqForm({...reqForm, password: v})} placeholder="••••••••" />
                  </div>
                  <button
                    type="submit" disabled={loading}
                    className="w-full h-14 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-xl mt-2 flex items-center justify-center"
                  >
                    {loading ? <Loader2 className="size-5 animate-spin" /> : <span>تقديم الطلب</span>}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-10 pt-6 border-t border-white/5 text-center opacity-20">
             <p className="text-[8px] font-black tracking-[0.6em] text-white uppercase">ALSAIF NEXUS</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AuthField({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-1">
       <label className="text-[10px] font-black text-primary/40 mr-1 uppercase">{label}</label>
       <input
         type={type} required value={value} onChange={(e) => onChange(e.target.value)}
         className="w-full h-11 bg-muted/20 border border-border rounded-xl px-4 font-bold text-sm text-primary focus:outline-none focus:border-primary focus:bg-white transition-all"
         placeholder={placeholder}
       />
    </div>
  );
}
