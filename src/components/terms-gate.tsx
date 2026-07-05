import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TermsContent, TERMS_SHORT } from "./terms-content";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TermsGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [needsAccept, setNeedsAccept] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setChecked(true);
        return;
      }
      setUserId(u.user.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("terms_accepted_at")
        .eq("id", u.user.id)
        .maybeSingle();
      setNeedsAccept(!(p as any)?.terms_accepted_at);
      setChecked(true);
    })();
  }, []);

  async function onAccept() {
    if (!userId || !agree) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("تعذّر حفظ الموافقة، حاول مرة أخرى");
      return;
    }
    setNeedsAccept(false);
    toast.success("شكراً، تم تسجيل موافقتك");
  }

  if (!checked) return null;

  return (
    <>
      {children}
      {needsAccept && (
        <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm grid place-items-center p-4">
          <div className="card-surface max-w-2xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-ivory mb-2">إقرار وموافقة استخدام التطبيق</h2>
            <p className="text-xs text-muted-foreground mb-5">
              يرجى قراءة الإقرار التالي والموافقة عليه لمتابعة استخدام التطبيق.
            </p>
            <div className="rounded-lg border border-border/60 bg-background/40 p-4 mb-5">
              <TermsContent />
            </div>
            <label className="flex items-start gap-3 cursor-pointer select-none mb-5">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1 size-4 accent-gold-primary"
              />
              <span className="text-sm text-ivory/90 leading-relaxed">{TERMS_SHORT}</span>
            </label>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-ivory transition"
              >
                تسجيل الخروج
              </button>
              <button
                type="button"
                disabled={!agree || saving}
                onClick={onAccept}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                أوافق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
