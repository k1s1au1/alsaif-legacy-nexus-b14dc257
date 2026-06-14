import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, ArrowRight } from "lucide-react";

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
  const [mode, setMode] = useState<"login" | "request">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    if (reqEmail.trim() && !z.string().email().safeParse(reqEmail.trim()).success) {
      toast.error("البريد غير صالح");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("account_requests").insert({
      first_name: first.trim(),
      father_name: father.trim(),
      grandfather_name: grand.trim(),
      phone: phone.trim(),
      email: reqEmail.trim() || null,
      note: note.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("تعذّر إرسال الطلب، حاول لاحقاً");
      return;
    }
    setSubmitted(true);
    toast.success("تم إرسال طلبك، سيتواصل معك المشرفون قريباً");
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(191,161,93,0.18), transparent 50%), radial-gradient(circle at 80% 80%, rgba(191,161,93,0.10), transparent 50%)",
        }}
      />

      <div className="relative w-full max-w-md card-surface p-10 animate-fade-up">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-14 rounded-xl bg-gold-primary/10 ring-1 ring-gold-primary/30 grid place-items-center mb-5">
            <span className="text-gold-primary text-2xl font-semibold">ص</span>
          </div>
          <h1 className="text-2xl font-medium text-ivory tracking-tight">السيف</h1>
          <p className="eyebrow mt-2">ALSAIF · PRIVATE ACCESS</p>
        </div>

        {mode === "login" ? (
          <>
            <p className="text-sm text-muted-foreground text-center max-w-[28ch] mx-auto leading-relaxed mb-6">
              هذه المنصة خاصة بأعضاء العائلة. الوصول بدعوة أو بموافقة المشرفين.
            </p>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground" htmlFor="email">البريد الإلكتروني</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  className="w-full bg-input/60 border border-border rounded-lg px-4 py-3 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-ring text-right"
                  placeholder="name@alsaif.family"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground" htmlFor="password">كلمة المرور</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-input/60 border border-border rounded-lg px-4 py-3 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition disabled:opacity-50"
              >
                {loading ? "...جاري الدخول" : "دخول إلى المجلس"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-border/60 text-center">
              <p className="text-xs text-muted-foreground mb-3">ليس لديك حساب بعد؟</p>
              <button
                type="button"
                onClick={() => setMode("request")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gold-primary/40 text-gold-primary text-sm hover:bg-gold-primary/10 transition"
              >
                <UserPlus className="size-4" strokeWidth={1.7} />
                طلب إنشاء حساب
              </button>
            </div>
          </>
        ) : submitted ? (
          <div className="text-center space-y-4 py-4">
            <div className="size-12 mx-auto rounded-full bg-gold-primary/10 ring-1 ring-gold-primary/30 grid place-items-center">
              <UserPlus className="size-5 text-gold-primary" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg text-ivory">تم استلام طلبك</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              سيقوم المشرفون بمراجعة طلبك والتواصل معك على رقم الجوال المسجّل.
            </p>
            <button
              onClick={() => {
                setMode("login");
                setSubmitted(false);
                setFirst(""); setFather(""); setGrand(""); setPhone(""); setReqEmail(""); setNote("");
              }}
              className="inline-flex items-center gap-2 text-sm text-gold-primary hover:underline"
            >
              <ArrowRight className="size-4" />
              العودة إلى تسجيل الدخول
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center max-w-[30ch] mx-auto leading-relaxed mb-6">
              أدخل اسمك الثلاثي ورقم جوالك. سيقوم المشرفون بمراجعة الطلب.
            </p>
            <form onSubmit={onSubmitRequest} className="space-y-3">
              <ReqField label="الاسم الأول" value={first} onChange={setFirst} placeholder="فيصل" />
              <ReqField label="اسم الأب" value={father} onChange={setFather} placeholder="عبدالله" />
              <ReqField label="اسم الجد" value={grand} onChange={setGrand} placeholder="السيف" />
              <ReqField label="رقم الجوال" value={phone} onChange={setPhone} placeholder="055 123 4567" />
              <ReqField label="البريد (اختياري)" value={reqEmail} onChange={setReqEmail} placeholder="name@example.com" type="email" />
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">ملاحظات (اختياري)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={400}
                  className="w-full px-3 py-2.5 rounded-lg bg-input/60 border border-border text-sm text-ivory placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
                  placeholder="صلة القرابة أو أي تفاصيل تساعد المشرفين"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                إرسال الطلب
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-xs text-muted-foreground hover:text-ivory transition pt-1"
              >
                العودة إلى تسجيل الدخول
              </button>
            </form>
          </>
        )}

        {mode === "login" && (
          <p className="text-[11px] text-muted-foreground/70 text-center mt-8 leading-relaxed">
            لإعادة تعيين كلمة المرور، تواصل مع مسؤول النظام في العائلة.
          </p>
        )}
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
    <label className="block space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-input/60 border border-border text-sm text-ivory placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
      />
    </label>
  );
}
