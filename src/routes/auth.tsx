import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — الصيف" },
      { name: "description", content: "بوابة الدخول الخاصة بأعضاء عائلة الصيف." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
    toast.success("أهلاً بك في الصيف");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      {/* Ambient gold glow */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(191,161,93,0.18), transparent 50%), radial-gradient(circle at 80% 80%, rgba(191,161,93,0.10), transparent 50%)",
        }}
      />

      <div className="relative w-full max-w-md card-surface p-10 animate-fade-up">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="size-14 rounded-xl bg-gold-primary/10 ring-1 ring-gold-primary/30 grid place-items-center mb-5">
            <span className="text-gold-primary text-2xl font-semibold">ص</span>
          </div>
          <h1 className="text-2xl font-medium text-ivory tracking-tight">الصيف</h1>
          <p className="eyebrow mt-2">ALSAIF · PRIVATE ACCESS</p>
          <p className="text-sm text-muted-foreground mt-4 max-w-[28ch] leading-relaxed">
            هذه المنصة خاصة بأعضاء العائلة. الوصول بدعوة فقط — لا يوجد تسجيل عام.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="email">
              البريد الإلكتروني
            </label>
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
            <label className="text-xs text-muted-foreground" htmlFor="password">
              كلمة المرور
            </label>
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

        <p className="text-[11px] text-muted-foreground/70 text-center mt-8 leading-relaxed">
          لطلب حساب أو إعادة تعيين كلمة المرور، تواصل مع مسؤول النظام في العائلة.
        </p>
      </div>
    </div>
  );
}
