import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { toast } from "sonner";
import {
  MessageSquare, Pin, Plus, Send, Trash2, Loader2, X, Newspaper, ChevronLeft, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useUserRole } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/majlis")({
  ssr: false,
  component: MajlisPage,
});

function MajlisPage() {
  const { userId: meId, isAdmin, isChairman, canManage: canManageSection } = useUserRole();
  const canManage = canManageSection("news");
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const dynamicLogo = useSiteLogo();

  const loadData = useCallback(async () => {
    if (!meId) return;
    setLoading(true);
    try {
      const [{ data: p }, { data: rawPosts }, { data: coms }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", meId).maybeSingle(),
        supabase.from("majlis_posts").select("*").order("created_at", { ascending: false }),
        supabase.from("majlis_comments").select("*").order("created_at", { ascending: true })
      ]);
      setProfile(p);

      if (rawPosts) {
         const authorIds = Array.from(new Set(rawPosts.map((p: any) => p.author_id)));
         const { data: authors } = await supabase.from("profiles").select("id, arabic_name, avatar_url").in("id", authorIds);
         const authorMap = new Map(authors?.map(a => [a.id, a]));

         const processed = await Promise.all(rawPosts.map(async (p: any) => {
            const imgMatch = p.body.match(/---image:(.*)\n/);
            let url = null;
            if (imgMatch) {
               const { data } = await supabase.storage.from("trip-images").createSignedUrl(imgMatch[1].trim(), 86400);
               url = data?.signedUrl;
            }
            return {
               ...p,
               author: authorMap.get(p.author_id),
               imageUrl: url,
               cleanBody: p.body.replace(/---image:.*\n/, "").replace(/---kind:.*\n/, "").replace(/---poll:.*?---/s, "").trim()
            };
         }));
         setPosts(processed);
      }
      setComments(coms || []);
    } finally { setLoading(false); }
  }, [meId]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <AppShell title="الأخبار" user={{ name: profile?.arabic_name || "عضو", role: "عضو المجلس", initial: "ع" } as any}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24 px-4 md:px-0" dir="rtl">

        {/* REPLICATING THE BANNER FROM SCREENSHOT */}
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-primary via-[#0d2620] to-black p-8 md:p-16 text-white shadow-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-10">
            <div className="absolute left-10 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
              <div className="size-64 logo-alsaif-banner" style={{ "--logo-url": `url(${dynamicLogo})` } as any} />
            </div>

            <div className="relative z-10 space-y-5 text-center md:text-right">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <div className="h-0.5 w-12 bg-gold-primary" />
                <span className="text-xs font-black uppercase tracking-[0.4em] text-gold-primary">أخبار السيف</span>
              </div>
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter">الأخبار العائلية</h2>
              <p className="text-white/60 font-bold text-sm md:text-xl max-w-2xl">منشورات وأخبار العائلة. للنقاشات والتصويت، توجّه إلى صفحة الاجتماعات.</p>
            </div>

            <div className="size-20 md:size-32 rounded-[30px] bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl shrink-0 self-center md:self-auto">
              <Newspaper className="size-10 md:size-16 text-gold-primary" strokeWidth={1.5} />
            </div>
          </div>
        </section>

        {canManage && (
          <div className="flex justify-end">
            <button onClick={() => setShowAdd(true)} className="btn-gold px-10 py-4 rounded-2xl flex items-center gap-3 shadow-xl text-sm font-black transition-all active:scale-95">
              <Plus size={20} strokeWidth={3} /> <span>إضافة منشور</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {posts.map(p => (
            <motion.article key={p.id} layout className="card-surface p-8 md:p-12 space-y-8">
               <div className="flex items-center gap-4">
                  <UserAvatar path={p.author?.avatar_url} name={p.author?.arabic_name} className="size-14 rounded-2xl shadow-lg" userId={p.author_id} />
                  <div>
                     <h4 className="text-xl font-black text-primary">{p.author?.arabic_name}</h4>
                     <p className="text-xs font-bold text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar-SA")}</p>
                  </div>
               </div>
               <div className="space-y-4">
                  <h3 className="text-3xl font-black text-primary">{p.title}</h3>
                  <p className="text-lg font-bold text-foreground/80 leading-relaxed whitespace-pre-wrap">{p.cleanBody}</p>
                  {p.imageUrl && <img src={p.imageUrl} className="w-full rounded-[32px] border border-border shadow-xl" alt="" />}
               </div>
            </motion.article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
