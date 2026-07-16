import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Inbox, Send, ShieldCheck, Clock, Trash2, Loader2, CheckCircle2, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/suggestions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "صندوق المقترحات — السيف" },
      { name: "description", content: "أرسل مقترحك أو ملاحظتك بسرية تامة." },
    ],
  }),
  component: SuggestionsPage,
});

function SuggestionsPage() {
  const { isAdmin, isChairman } = useUserRole();
  const isManagement = isAdmin || isChairman;

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSuggestions = async () => {
    if (!isManagement) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("anonymous_suggestions" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setSuggestions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSuggestions();
  }, [isManagement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    const { error } = await supabase
      .from("anonymous_suggestions" as any)
      .insert({ content: content.trim() });

    if (error) {
      toast.error("فشل إرسال المقترح");
    } else {
      toast.success("تم إرسال مقترحك بسرية تامة. شكراً لك! ✨");
      setContent("");
    }
    setSubmitting(false);
  };

  const deleteSuggestion = async (id: string) => {
    if (!confirm("هل تريد حذف هذا المقترح؟")) return;
    const { error } = await supabase
      .from("anonymous_suggestions" as any)
      .delete()
      .eq("id", id);

    if (!error) {
      setSuggestions(prev => prev.filter(s => s.id !== id));
      toast.success("تم الحذف");
    }
  };

  return (
    <AppShell title="صندوق المقترحات" user={{ name: "صندوق الأفكار", role: "خصوصية", initial: "ص" }}>
      <div className="max-w-4xl mx-auto space-y-12 pb-24" dir="rtl">
        {/* Header Section */}
        <section className="text-center space-y-6 animate-fade-up">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full" />
            <div className="relative size-32 rounded-[40px] bg-gradient-to-br from-indigo-500 to-primary p-0.5 shadow-2xl">
              <div className="size-full rounded-[38px] bg-card flex items-center justify-center">
                <Inbox className="size-16 text-indigo-500" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-4xl font-black text-primary tracking-tight">صندوق المقترحات المجهول</h2>
            <p className="text-muted-foreground font-bold max-w-xl mx-auto leading-relaxed">
              رأيك يهمنا لتطوير المجلس. أرسل ملاحظاتك أو أفكارك بكل حرية، هويتك لن تظهر لأي أحد، حتى للمسؤولين.
            </p>
          </div>
        </section>

        {/* Submission Form */}
        <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <form onSubmit={handleSubmit} className="card-surface p-8 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <label className="text-xs font-black text-primary uppercase tracking-widest mr-2 block">
                اكتب مقترحك أو ملاحظتك هنا
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={5}
                placeholder="مثال: اقترح إضافة ركن للأطفال في الاجتماع القادم..."
                className="w-full bg-muted/30 border border-border rounded-[32px] px-8 py-6 font-bold text-lg focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-inner resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="w-full btn-gold py-5 rounded-full flex items-center justify-center gap-4 shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all text-lg font-black"
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Send className="size-6" />}
              إرسال المقترح بسرية
            </button>
          </form>
        </section>

        {/* Management View */}
        {isManagement && (
          <section className="space-y-8 animate-fade-up border-t border-border pt-12" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                  <ShieldCheck className="size-5" />
                </div>
                <h3 className="text-2xl font-black text-primary">المقترحات الواردة (للمسؤولين)</h3>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-primary font-black text-xs">
                {suggestions.length} مقترح
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center opacity-40">
                <Loader2 className="animate-spin size-10 mx-auto mb-4" />
                <p className="font-black">جاري جلب المقترحات...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="card-surface p-20 text-center text-muted-foreground border-dashed italic">
                لا توجد مقترحات واردة حتى الآن.
              </div>
            ) : (
              <div className="grid gap-6">
                {suggestions.map((s) => (
                  <motion.div
                    key={s.id}
                    layout
                    className="card-surface p-8 space-y-6 relative group overflow-hidden"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3 text-indigo-500">
                        <MessageSquareText size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">مقترح مجهول</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                        <Clock size={12} />
                        {new Date(s.created_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                    </div>

                    <p className="text-xl font-bold text-foreground leading-relaxed pr-2 border-r-4 border-indigo-500/20 mr-2">
                      {s.content}
                    </p>

                    <div className="flex justify-end pt-4 border-t border-border/40">
                      <button
                        onClick={() => deleteSuggestion(s.id)}
                        className="p-3 rounded-xl bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                        title="حذف المقترح"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
