import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "إعادة تعيين كلمة المرور — السيف" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        setReady(true);
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : "";
        const hashParams = new URLSearchParams(hash);
        const errDesc = url.searchParams.get("error_description") || hashParams.get("error_description");
        if (errDesc) {
          if (!cancelled) setError(decodeURIComponent(errDesc));
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!cancelled) {
            if (error) setError(error.message);
            else setReady(true);
          }
          return;
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!cancelled) {
            if (error) setError(error.message);
            else setReady(true);
          }
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!cancelled && data.session) setReady(true);
        else if (!cancelled) {
          // Fallback after a short wait so the form still shows
          setTimeout(() => {
            if (!cancelled) setReady(true);
          }, 1500);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }
    if (password !== password2) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("تعذّر تحديث كلمة المرور", { description: error.message });
      return;
    }
    toast.success("تم تحديث كلمة المرور");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div
        className="relative w-full max-w-md p-10 rounded-2xl backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(160deg, rgba(38,26,14,0.78) 0%, rgba(24,16,8,0.88) 100%)",
          border: "1px solid rgba(212,175,90,0.35)",
          boxShadow:
            "0 30px 80px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(245,222,179,0.18)",
        }}
      >
        <h1 className="text-xl font-medium text-ivory text-center mb-2">
          إعادة تعيين كلمة المرور
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          أدخل كلمة مرور جديدة للحساب
        </p>

        {error ? (
          <div className="text-center text-sm text-red-300 py-4 space-y-3">
            <p>تعذّر التحقق من رابط إعادة التعيين</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate({ to: "/auth", replace: true })}
              className="text-xs text-gold-primary underline"
            >
              العودة لتسجيل الدخول
            </button>
          </div>
        ) : !ready ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            <Loader2 className="size-5 animate-spin mx-auto mb-3" />
            جاري التحقق من رابط إعادة التعيين...
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">كلمة المرور الجديدة</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="٨ أحرف على الأقل"
                className="w-full px-3 py-2.5 rounded-lg bg-input/60 border border-border text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">تأكيد كلمة المرور</span>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="أعد الإدخال"
                className="w-full px-3 py-2.5 rounded-lg bg-input/60 border border-border text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              حفظ كلمة المرور
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
