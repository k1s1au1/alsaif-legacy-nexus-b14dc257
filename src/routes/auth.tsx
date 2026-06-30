import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, UserPlus, Send, X, Phone, User } from "lucide-react";
import logoAsset from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useAppBackground } from "@/hooks/use-app-background";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "مجلس السيف — تسجيل الدخول" },
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

  // Request form fields
  const [reqFirstName, setReqFirstName] = useState("");
  const [reqFatherName, setReqFatherName] = useState("");
  const [reqGrandName, setReqGrandFatherName] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [reqNote, setReqNote] = useState("");

  const { url: authBg } = useAppBackground("auth_bg");

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
      toast.error("تعذّر الدخول", { description: "تأكد من البيانات المعتمدة من الإدارة." });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function onRequestAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("account_requests").insert({
      first_name: reqFirstName,
      father_name: reqFatherName,
      grandfather_name: reqGrandName,
      phone: reqPhone,
      email: reqEmail,
      desired_password: reqPassword,
      note: reqNote,
      terms_accepted: true
    });
    setLoading(false);
    if (error) {
      toast.error("تعذر إرسال الطلب", { description: error.message });
      return;
    }
    toast.success("تم إرسال طلبك بنجاح", { description: "سيتم مراجعة الطلب من قبل الإدارة وإشعارك قريباً." });
    setAuthMode("login");
  }

  async function onForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("حدث خطأ", { description: error.message });
      return;
    }
    toast.success("تم إرسال رابط الاستعادة", { description: "يرجى التحقق من بريدك الإلكتروني." });
    setAuthMode("login");
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-[#051410] overflow-hidden" dir="rtl">
      {/* Background Image Layer */}
      {authBg && (
        <div
          className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat opacity-[0.45] transition-opacity duration-1000"
          style={{ backgroundImage: `url(${authBg})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#051410]/95 via-transparent to-[#051410]/95" />
        </div>
      )}

      {/* Alsaif Background Decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-5%] size-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] size-[600px] rounded-full bg-gold-primary/5 blur-[120px]" />
      </div>

      <div
        className="relative w-full max-w-[480px] md:max-w-[540px] bg-[#064E3B] rounded-[44px] shadow-2xl animate-fade-up overflow-hidden border border-white/10 transition-all duration-500"
      >
        <div className="relative z-10 p-8 sm:p-10 flex flex-col h-full text-white">
          <div className="flex flex-col items-center text-center mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="size-24 mb-6 flex items-center justify-center p-4 bg-white/10 backdrop-blur-md rounded-[32px] shadow-lg ring-1 ring-white/20 relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gold-primary/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div
                className="size-full relative z-10 logo-alsaif"
                style={{ '--logo-url': `url(${dynamicLogo || logoAsset.url})` } as any}
              />
            </motion.div>
            <h1 className="text-3xl font-black text-white mb-1 tracking-tight">مجلس السيف</h1>
            <p className="text-[10px] font-black tracking-[0.4em] text-gold-primary uppercase mt-1 opacity-80">ALSAIF HUB</p>
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.div key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="h-px w-8 bg-white/20" />
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">تسجيل الدخول</h2>
                  <div className="h-px w-8 bg-white/20" />
                </div>
                <form onSubmit={onLogin} className="space-y-5">
                  <div className="space-y-1.5" dir="rtl">
                    <label className="text-[10px] font-black text-white/60 mr-4 uppercase tracking-widest">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40" />
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pr-14 pl-5 font-bold text-sm focus:border-gold-primary transition-all text-white outline-none" placeholder="saud@alsaif.family" />
                    </div>
                  </div>
                  <div className="space-y-1.5" dir="rtl">
                    <label className="text-[10px] font-black text-white/60 mr-4 uppercase tracking-widest">كلمة المرور</label>
                    <div className="relative">
                      <Lock className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40" />
                      <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pr-14 pl-14 font-bold text-sm focus:border-gold-primary transition-all text-white outline-none" placeholder="••••••••••••" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white/40 select-none"><input type="checkbox" className="size-4 rounded-md border-white/10 bg-white/5 text-gold-primary focus:ring-gold-primary" />تذكرني</label>
                    <button type="button" onClick={() => setAuthMode("forgot")} className="text-xs font-black text-gold-primary hover:text-white transition-colors">نسيت كلمة المرور؟</button>
                  </div>
                  <button type="submit" disabled={loading} className="btn-gold w-full h-14 rounded-2xl shadow-xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
                    {loading ? <Loader2 className="size-5 animate-spin" /> : <><span>دخول إلى المجلس</span><ArrowLeft className="size-5" /></>}
                  </button>
                  <div className="text-center pt-4"><button type="button" onClick={() => setAuthMode("request")} className="text-sm font-black text-white/60 hover:text-gold-primary hover:underline flex items-center justify-center gap-2 mx-auto"><UserPlus size={16} />طلب إنشاء حساب جديد</button></div>
                </form>
              </motion.div>
            ) : mode === "request" ? (
              <motion.div key="request" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="flex items-center justify-between mb-2" dir="rtl"><h2 className="text-sm font-black text-white uppercase tracking-widest">طلب انضمام</h2><button onClick={() => setAuthMode("login")} className="size-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 transition-all"><X size={16} /></button></div>
                <form onSubmit={onRequestAccount} className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar px-1" dir="rtl">
                   <div className="grid grid-cols-1 gap-4">
                      <ReqField label="الاسم الأول" value={reqFirstName} onChange={setReqFirstName} />
                      <div className="grid grid-cols-2 gap-3"><ReqField label="الأب" value={reqFatherName} onChange={setReqFatherName} /><ReqField label="الجد" value={reqGrandName} onChange={setReqGrandFatherName} /></div>
                      <ReqField label="الجوال" value={reqPhone} onChange={setReqPhone} type="tel" />
                      <ReqField label="البريد" value={reqEmail} onChange={setReqEmail} type="email" />
                      <ReqField label="كلمة المرور" value={reqPassword} onChange={setReqPassword} type="password" />
                   </div>
                   <button type="submit" disabled={loading} className="btn-gold w-full h-14 rounded-2xl font-black flex items-center justify-center gap-3">
                    {loading ? <Loader2 className="size-5 animate-spin" /> : <><span>إرسال الطلب</span><Send className="size-4" /></>}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div key="forgot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="flex items-center justify-between mb-2" dir="rtl"><h2 className="text-sm font-black text-white uppercase tracking-widest">استعادة الوصول</h2><button onClick={() => setAuthMode("login")} className="size-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 transition-all"><X size={16} /></button></div>
                <form onSubmit={onForgotPassword} className="space-y-6" dir="rtl">
                  <p className="text-xs font-bold text-white/40">أدخل بريدك وسنرسل لك رابط الاستعادة.</p>
                  <ReqField label="البريد الإلكتروني" value={email} onChange={setEmail} type="email" />
                  <button type="submit" disabled={loading || !email} className="btn-gold w-full h-14 rounded-2xl font-black flex items-center justify-center gap-3">
                    {loading ? <Loader2 className="size-5 animate-spin" /> : <><span>إرسال الرابط</span><Send className="size-4" /></>}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-center text-[10px] text-white/20 mt-12 tracking-[0.4em] uppercase font-black">ALSAIF FAMILY HUB</p>
        </div>
      </div>
    </div>
  );
}

function ReqField({ label, value, onChange, type = "text" }: any) {
  return (
    <div className="space-y-1.5 text-right">
       <label className="text-[10px] font-black text-white/40 mr-2 uppercase tracking-widest">{label}</label>
       <input type={type} required value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 font-bold text-sm focus:border-gold-primary text-white outline-none" />
    </div>
  );
}
