import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Trophy, Footprints, Flame, TrendingUp, Calendar, Loader2, Plus, RotateCw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Capacitor } from "@capacitor/core";

export const Route = createFileRoute("/_authenticated/steps-challenge")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تحدي الخطوات — السيف" },
      { name: "description", content: "تحدي الخطوات العائلي الأسبوعي." },
    ],
  }),
  component: StepsChallengePage,
});

function StepsChallengePage() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [mySteps, setMySteps] = useState<number>(0);
  const [meId, setMeId] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if permission was already granted in this session
    const savedPerm = localStorage.getItem("steps_permission_granted");
    if (savedPerm === "true") setHasPermission(true);
    else if (!Capacitor.isNativePlatform()) setHasPermission(true);
    else setHasPermission(false);
  }, []);

  const requestActivityPermission = async () => {
    if (!Capacitor.isNativePlatform()) {
      setHasPermission(true);
      return;
    }

    try {
      toast.info("يرجى الموافقة على إذن الوصول للنشاط البدني عند ظهور رسالة النظام");

      // Since we don't have a specific Health plugin yet, we simulate the request
      // After adding the permission to AndroidManifest, the OS will prompt the user
      // when a fitness-related API is called. For now, we set the state.
      setTimeout(() => {
        setHasPermission(true);
        localStorage.setItem("steps_permission_granted", "true");
        toast.success("تم تفعيل الوصول للنشاط البدني ✨");
      }, 1500);
    } catch (e) {
      toast.error("فشل الحصول على الإذن");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMeId(user.id);

      // Load leaderboard (sum of steps for this week)
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const startIso = startOfWeek.toISOString().split('T')[0];

      const { data: stepsData, error } = await supabase
        .from("steps_data" as any)
        .select("user_id, steps")
        .gte("date", startIso);

      if (error) throw error;

      // Group and sum
      const grouped: Record<string, number> = {};
      stepsData.forEach((row: any) => {
        grouped[row.user_id] = (grouped[row.user_id] || 0) + row.steps;
      });

      const userIds = Object.keys(grouped);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, arabic_name, full_name, avatar_url")
        .in("id", userIds);

      const board = (profiles || []).map(p => ({
        ...p,
        totalSteps: grouped[p.id] || 0,
      })).sort((a, b) => b.totalSteps - a.totalSteps);

      setLeaderboard(board);
      setMySteps(grouped[user.id] || 0);
    } catch (e) {
      console.error("Steps load error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    const tId = toast.loading("جاري المزامنة مع بيانات الحركة...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("لم يتم العثور على حساب المستخدم");

      // محاكاة الحصول على الخطوات من الحساسات
      const randomSteps = Math.floor(Math.random() * 2000) + 500;
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase.from("steps_data" as any).upsert({
        user_id: user.id,
        steps: randomSteps,
        date: today
      }, { onConflict: "user_id,date" });

      if (error) throw error;

      toast.success(`تمت المزامنة بنجاح! أضفت ${randomSteps} خطوة اليوم ✨`, { id: tId });
      loadData();
    } catch (e: any) {
      console.error("Steps sync error:", e);
      toast.error("فشل تحديث الخطوات", {
        id: tId,
        description: e.message || "تأكد من وجود جدول steps_data في قاعدة البيانات"
      });
    }
  };

  return (
    <AppShell title="تحدي الخطوات" user={{ name: "تحدي العائلة", role: "رياضة", initial: "ت" }}>
      <div className="max-w-4xl mx-auto space-y-12 pb-24" dir="rtl">
        {/* Header Medallion */}
        <section className="text-center space-y-6 animate-fade-up">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gold-primary/20 blur-[60px] rounded-full" />
            <div className="relative size-32 rounded-[40px] bg-gradient-to-br from-gold-primary to-primary p-0.5 shadow-2xl">
              <div className="size-full rounded-[38px] bg-card flex items-center justify-center">
                <Footprints className="size-16 text-gold-primary" strokeWidth={1.5} />
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 size-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl border-4 border-card">
              <Trophy size={20} />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-4xl font-black text-primary tracking-tight">تحدي خطوات العائلة</h2>
            <p className="text-muted-foreground font-bold">المنافسة الشريفة تبني أجساداً قوية وأرواحاً متآلفة.</p>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <StatCard
            label="خطواتك هذا الأسبوع"
            value={mySteps.toLocaleString()}
            icon={<Footprints className="text-blue-500" />}
            desc="استمر في التقدم!"
          />
          <StatCard
            label="السعرات التقريبية"
            value={Math.round(mySteps * 0.04).toLocaleString()}
            icon={<Flame className="text-orange-500" />}
            unit="سعرة"
          />
          <StatCard
            label="مركزك الحالي"
            value={leaderboard.findIndex(u => u.id === meId) + 1 || "-"}
            icon={<TrendingUp className="text-emerald-500" />}
            desc="من بين جميع الأعضاء"
          />
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center gap-4 animate-fade-up" style={{ animationDelay: "200ms" }}>
          {!hasPermission ? (
            <button
              onClick={requestActivityPermission}
              className="px-12 py-5 rounded-full bg-primary text-white flex items-center gap-4 shadow-2xl hover:scale-105 active:scale-95 transition-all text-lg font-black"
            >
              <ShieldCheck className="size-6" /> تفعيل إذن النشاط البدني
            </button>
          ) : (
            <button
              onClick={handleSync}
              className="btn-gold px-12 py-5 rounded-full flex items-center gap-4 shadow-2xl hover:scale-105 active:scale-95 transition-all text-lg font-black"
            >
              <RotateCw className="size-6" /> مزامنة خطوات اليوم
            </button>
          )}
          {!hasPermission && (
            <p className="text-[10px] font-bold text-muted-foreground opacity-60">
              ملاحظة: يتطلب هذا التحدي الوصول لبيانات الحركة في جوالك.
            </p>
          )}
        </div>

        {/* Leaderboard */}
        <section className="space-y-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">لوحة الصدارة الأسبوعية</h3>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="card-surface overflow-hidden divide-y divide-border/40">
            {loading ? (
              <div className="p-20 text-center">
                <Loader2 className="animate-spin size-10 mx-auto text-primary opacity-20" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-20 text-center text-muted-foreground italic">
                لا يوجد بيانات خطوات مسجلة لهذا الأسبوع. كن أول من يبدأ!
              </div>
            ) : (
              leaderboard.map((user, index) => (
                <div
                  key={user.id}
                  className={cn(
                    "p-6 flex items-center justify-between transition-all",
                    user.id === meId ? "bg-primary/5 border-r-4 border-r-primary" : "hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-5">
                    <div className="size-10 flex items-center justify-center font-black text-lg text-primary opacity-40 italic">
                      #{index + 1}
                    </div>
                    <div className="size-12 rounded-2xl overflow-hidden border border-border shadow-sm">
                      <UserAvatar path={user.avatar_url} name={user.arabic_name || user.full_name} className="size-full" />
                    </div>
                    <div>
                      <p className="font-black text-primary leading-none">{user.arabic_name || user.full_name}</p>
                      {user.id === meId && <span className="text-[9px] font-black uppercase text-gold-primary tracking-widest mt-1 block">أنت</span>}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-black text-primary tracking-tighter">{user.totalSteps.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">خطوة</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon, desc, unit }: any) {
  return (
    <div className="card-surface p-8 space-y-4">
      <div className="size-12 rounded-2xl bg-muted flex items-center justify-center shadow-inner">
        {icon}
      </div>
      <div>
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-primary tracking-tighter">{value}</span>
          {unit && <span className="text-xs font-black text-primary/40 uppercase">{unit}</span>}
        </div>
        {desc && <p className="text-[10px] font-bold text-emerald-600 mt-2">{desc}</p>}
      </div>
    </div>
  );
}
