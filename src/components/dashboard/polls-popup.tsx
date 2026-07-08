import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, CheckCircle2, ArrowLeft, Sparkles, Crown, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { executeLeadershipTransition } from "@/lib/api/shura.functions";

type Post = { id: string; title: string; body: string | null; author_id: string; created_at: string };
type Comment = { id: string; post_id: string; author_id: string; body: string };
type PollData = {
  question: string;
  options: string[];
  type?: string;
  target_uid?: string;
  target_name?: string;
  threshold?: number;
  status?: string;
  expires_at?: string;
  target_committee_only?: boolean;
};
type EnrichedPoll = { post: Post; poll: PollData; votes: Comment[]; myVoteIndex: number };

const SNOOZE_KEY = "polls-popup-snoozed-until";
const SESSION_SHOWN_KEY = "polls-popup-shown-session";
const SNOOZE_MS = 6 * 60 * 60 * 1000; // 6 hours

export function PollsPopup({ userId }: { userId: string | null }) {
  const [polls, setPolls] = useState<EnrichedPoll[]>([]);
  const [open, setOpen] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const autoOpenedRef = useRef(false);
  const runTransition = useServerFn(executeLeadershipTransition);

  useEffect(() => {
    if (userId) {
      supabase.from("user_roles").select("role").eq("user_id", userId).then(({ data }) => {
        if (data) setUserRoles(data.map(r => r.role));
      });
    }
  }, [userId]);

  const load = async () => {
    const { data: posts } = await supabase
      .from("majlis_posts")
      .select("id,title,body,author_id,created_at")
      .like("body", "%---poll:%")
      .order("created_at", { ascending: false })
      .limit(10);
    const list = (posts ?? []) as Post[];
    if (list.length === 0) { setPolls([]); return; }
    const { data: cs } = await supabase
      .from("majlis_comments")
      .select("id,post_id,author_id,body")
      .in("post_id", list.map(p => p.id));
    const allComments = (cs ?? []) as Comment[];
    const enriched: EnrichedPoll[] = [];
    for (const post of list) {
      const match = (post.body || "").match(/---poll:({.*?})---/s);
      if (!match) continue;
      try {
        const poll = JSON.parse(match[1]) as PollData;
        const votes = allComments.filter(c => c.post_id === post.id && c.body.startsWith("[VOTE]:"));
        const mine = userId ? votes.find(v => v.author_id === userId) : undefined;
        const myVoteIndex = mine ? parseInt(mine.body.split(":")[1]) : -1;
        enriched.push({ post, poll, votes, myVoteIndex });
      } catch { /* skip */ }
    }
    setPolls(enriched);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("dash-polls-popup-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_comments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const pending = useMemo(() => {
    return polls.filter(p => {
      // 1. Basic Filters
      if (p.myVoteIndex !== -1) return false;
      if (p.poll.status === "finalized") return false;

      // 2. Committee Only Check
      if (p.poll.target_committee_only) {
        const isCommittee = userRoles.some(r => ["admin", "manager", "chairman"].includes(r));
        if (!isCommittee) return false;
      }

      // 3. Expiration Check
      if (p.poll.expires_at && new Date(p.poll.expires_at) < new Date()) return false;

      return true;
    });
  }, [polls, userRoles]);

  // Auto-open only once per session, and only if not snoozed
  useEffect(() => {
    if (!userId) return; // Don't auto-open if we don't know the user yet (prevents race condition)
    if (autoOpenedRef.current) return;
    if (pending.length === 0) return;
    if (typeof window === "undefined") return;
    const until = parseInt(localStorage.getItem(SNOOZE_KEY) || "0");
    const shownThisSession = sessionStorage.getItem(SESSION_SHOWN_KEY) === "1";
    if (until > Date.now() || shownThisSession) return;
    autoOpenedRef.current = true;
    sessionStorage.setItem(SESSION_SHOWN_KEY, "1");
    setOpen(true);
  }, [pending.length, userId]);

  // Listen for manual trigger from Dynamic Island
  useEffect(() => {
    const handleManualOpen = () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(SNOOZE_KEY);
      }
      setOpen(true);
    };
    window.addEventListener("polls:open", handleManualOpen);
    return () => window.removeEventListener("polls:open", handleManualOpen);
  }, []);

  const vote = async (post_id: string, idx: number) => {
    if (!userId) return;
    const { error } = await supabase.from("majlis_comments").insert({
      post_id, author_id: userId, body: `[VOTE]:${idx}`,
    });
    if (error) return toast.error("تعذر تسجيل الصوت");
    toast.success("تم تسجيل صوتك");
    await load(); // Refresh data to show results or hide
  };

  const handleClose = (o: boolean) => {
    setOpen(o);
    if (!o && typeof window !== "undefined") {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    }
  };

  const reopen = () => {
    if (typeof window !== "undefined") localStorage.removeItem(SNOOZE_KEY);
    setOpen(true);
  };

  const handleExecuteTransition = async (postId: string) => {
    setExecutingId(postId);
    try {
      const res = await runTransition({ data: { postId } });
      if (res.success) {
        toast.success(`تم بنجاح! ${(res as any).newChairman ?? ""} هو رئيس المجلس الجديد الآن.`);
        await load();
      }
    } catch (e: any) {
      toast.error(e.message || "فشل تنفيذ الانتقال");
    } finally {
      setExecutingId(null);
    }
  };

  // Only render the floating button if there are pending polls and dialog closed
  if (polls.length === 0 && !open) return null;

  return (
    <>
      {!open && pending.length > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={reopen}
          className="fixed bottom-24 left-4 z-[60] flex items-center gap-2 rounded-full bg-primary text-white px-4 py-3 shadow-2xl shadow-primary/40 hover:scale-105 transition-transform"
          dir="rtl"
          aria-label="عرض الاقتراحات"
        >
          <BarChart3 size={18} />
          <span className="text-xs font-black">{pending.length} اقتراح بانتظار تصويتك</span>
        </motion.button>
      )}

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-primary/20" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <BarChart3 size={22} />
              </div>
              <div className="text-right">
                <DialogTitle className="text-xl font-black text-primary">اقتراحات و تصويتات</DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground">
                  {pending.length > 0
                    ? `${pending.length} ${pending.length === 1 ? "اقتراح" : "اقتراحات"} بانتظار رأيك`
                    : "شكراً لمشاركتك — هذه نتائج جميع الاقتراحات الحالية"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {pending.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-500/40" size={32} />
              <p className="text-sm font-bold text-muted-foreground">لقد شاركت في جميع التصويتات الحالية. شكراً لك!</p>
            </div>
          ) : (
              <AnimatePresence mode="popLayout">
                {polls.map(({ post, poll, votes, myVoteIndex }) => {
                  const counts = new Array(poll.options.length).fill(0);
                  votes.forEach(v => {
                    const i = parseInt(v.body.split(":")[1]);
                    if (i >= 0 && i < counts.length) counts[i]++;
                  });
                  const total = counts.reduce((a, b) => a + b, 0);
                  const voted = myVoteIndex !== -1;
                  const isLeadership = poll.type === "leadership_shura";
                  const yesPct = total > 0 ? Math.round((counts[0] / total) * 100) : 0;
                  const canExecute = isLeadership && yesPct >= (poll.threshold || 70) && poll.status !== "executed";
                  const alreadyExecuted = poll.status === "executed";
                  const finalized = poll.status === "finalized";
                  const expired = poll.expires_at && new Date(poll.expires_at) < new Date();

                  if ((alreadyExecuted || finalized || expired) && !open) return null; // Don't show finished in bubble button

                  return (
                    <motion.div
                      key={post.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        "rounded-2xl border-2 p-5 space-y-4 relative overflow-hidden",
                        isLeadership ? "border-gold-primary/30 bg-gold-primary/5 shadow-[0_0_20px_rgba(212,175,55,0.05)]" : "border-border/40 bg-card",
                        expired && "opacity-60 grayscale-[0.5]"
                      )}
                    >
                      {isLeadership && (
                        <div className="absolute -top-6 -left-6 size-20 bg-gold-primary/10 rounded-full blur-xl" />
                      )}

                      <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                             {isLeadership && <Crown className="size-4 text-gold-primary" />}
                             <h4 className="font-black text-primary line-clamp-1">{post.title}</h4>
                             {expired && <span className="text-[9px] font-black bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">انتهى الوقت</span>}
                          </div>
                          <p className="text-sm font-bold text-primary/80">{poll.question}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={cn(
                            "text-[10px] font-black px-2 py-1 rounded-full",
                            isLeadership ? "bg-gold-primary text-emerald-950" : "bg-primary/10 text-primary"
                          )}>
                            {total} صوت
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-2 relative z-10">
                        {poll.options.map((opt, i) => {
                          const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
                          const isMyVote = myVoteIndex === i;
                          return (
                            <button
                              key={i}
                              onClick={() => vote(post.id, i)}
                              disabled={voted || alreadyExecuted || finalized || expired}
                              className={cn(
                                "relative p-3 rounded-xl text-right font-black overflow-hidden border-2 transition-all active:scale-[0.98]",
                                isMyVote ? "border-primary bg-primary/5" : "border-border/40 bg-card hover:border-primary/40",
                                (alreadyExecuted || finalized || expired) && "opacity-80 cursor-default"
                              )}
                            >
                              <div
                                className={cn("absolute inset-y-0 right-0 transition-all duration-700", isLeadership && i === 0 ? "bg-gold-primary/10" : "bg-primary/5")}
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative z-10 flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  {isMyVote ? <CheckCircle2 className="size-3.5 text-primary" /> : <div className="size-3.5 rounded-full border-2 border-current opacity-30" />}
                                  <span className={cn(isMyVote && "text-primary")}>{opt}</span>
                                </div>
                                <span className="opacity-60 text-xs tabular-nums">{pct}%</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {isLeadership && !alreadyExecuted && (
                        <div className="pt-2">
                           <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black uppercase text-gold-primary tracking-widest">مستوى التأييد الحالي</span>
                              <span className="text-xs font-black text-primary tabular-nums">{yesPct}% / {poll.threshold || 70}%</span>
                           </div>
                           <div className="h-1.5 bg-gold-primary/10 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (yesPct / (poll.threshold || 70)) * 100)}%` }}
                                className={cn("h-full transition-colors", yesPct >= (poll.threshold || 70) ? "bg-emerald-500" : "bg-gold-primary")}
                              />
                           </div>

                           {canExecute && (
                              <motion.button
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                onClick={() => handleExecuteTransition(post.id)}
                                disabled={executingId === post.id}
                                className="w-full mt-4 btn-gold py-3 rounded-xl flex items-center justify-center gap-2 shadow-2xl shadow-gold-primary/30"
                              >
                                {executingId === post.id ? <Loader2 className="animate-spin size-4" /> : <ShieldCheck size={18} />}
                                <span className="text-sm font-black text-emerald-950">تنفيذ قرار الشورى (تغيير الرئيس)</span>
                              </motion.button>
                           )}
                        </div>
                      )}

                      {alreadyExecuted && (
                        <div className="flex items-center gap-2 justify-center py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                           <ShieldCheck className="size-4 text-emerald-600" />
                           <span className="text-xs font-black text-emerald-600">تم تنفيذ القرار وتحديث رئاسة المجلس</span>
                        </div>
                      )}

                      {finalized && (
                        <div className="flex items-center gap-2 justify-center py-2 bg-muted rounded-xl border border-border">
                           <CheckCircle2 className="size-4 text-muted-foreground" />
                           <span className="text-xs font-black text-muted-foreground">تم إغلاق التصويت وأرشفة المحضر في الخزنة</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
          )}

          <div className="flex items-center justify-center pt-2 border-t border-border/30">
            <button onClick={() => handleClose(false)} className="text-xs font-black text-muted-foreground hover:text-primary transition-colors">
              إغلاق النافذة
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
