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

      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      {/* Very Compact Royal Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[390px] bg-[#fdfcf7] rounded-[32px] shadow-[0_30px_80px_rgba(0,0,0,0.4)] border border-gold-primary/10 overflow-hidden"
      >
        <div className="p-8 sm:p-10 flex flex-col">

          {/* Simple Header */}
          <div className="flex flex-col items-center text-center mb-8">
             <div className="size-16 bg-white rounded-2xl shadow-lg border border-gold-primary/5 p-3 mb-4">
                <div className="size-full logo-alsaif" style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : `url(${logoAsset.url})` } as any} />
             </div>
             <h1 className="text-2xl font-black text-primary tracking-tight" style={{ fontFamily: "'Reem Kufi', sans-serif" }}>مجلس السيف</h1>
             <p className="text-[10px] font-black text-gold-primary/60 uppercase tracking-[0.3em] mt-1">بوابة الدخول</p>
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={onLogin} className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-primary/40 mr-1 uppercase">البريد الإلكتروني</label>
                   <input
                     type="email" required value={email} onChange={e => setEmail(e.target.value)}
                     className="w-full h-12 bg-muted/30 border border-border rounded-xl px-4 font-bold text-sm text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                     placeholder="example@mail.com"
                   />
                </div>

                <div className="space-y-1">
                   <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-primary/40 uppercase">كلمة المرور</label>
                      <button type="button" onClick={() => setAuthMode("forgot")} className="text-[10px] font-bold text-gold-primary hover:underline">نسيت؟</button>
                   </div>
                   <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full h-12 bg-muted/30 border border-border rounded-xl px-4 font-bold text-sm text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary p-1">
                         {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                   </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full h-12 bg-primary text-white font-black rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? <Loader2 className="size-5 animate-spin" /> : <><span>دخول للمجلس</span><ArrowLeft size={18} /></>}
                </button>

                <div className="pt-6 text-center border-t border-border/40 mt-4">
                   <button
                     type="button"
                     onClick={() => setAuthMode("request")}
                     className="text-[11px] font-black text-gold-primary uppercase tracking-widest hover:underline"
                   >
                     طلب انضمام جديد للمجلس
                   </button>
                </div>
              </motion.form>
            ) : mode === "forgot" ? (
              <motion.form key="forgot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={onForgot} className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-lg font-black text-primary">استعادة الحساب</h3>
                   <button type="button" onClick={() => setAuthMode("login")} className="size-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-rose-500 hover:text-white transition-all"><X size={16} /></button>
                </div>
                <AuthField label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} placeholder="mail@example.com" />
                <button
                  type="submit" disabled={loading}
                  className="w-full h-12 bg-primary text-white font-black rounded-xl shadow-lg mt-2 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <><span>إرسال الرابط</span></>}
                </button>
              </motion.form>
            ) : (
              <motion.form key="request" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={onRequest} className="space-y-4 max-h-[350px] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-[#fdfcf7] z-10 py-1">
                   <h3 className="text-lg font-black text-primary">طلب عضوية</h3>
                   <button type="button" onClick={() => setAuthMode("login")} className="size-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-rose-500 hover:text-white transition-all"><X size={16} /></button>
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
                  className="w-full h-12 bg-primary text-white font-black rounded-xl shadow-lg mt-2 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <span>تقديم الطلب</span>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-4 border-t border-border/20 text-center opacity-20">
             <p className="text-[8px] font-black tracking-[0.4em] text-primary uppercase">Alsaif Nexus 2026</p>
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
