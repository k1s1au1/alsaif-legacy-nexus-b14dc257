import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, CheckCircle2, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Post = { id: string; title: string; body: string | null; author_id: string; created_at: string };
type Comment = { id: string; post_id: string; author_id: string; body: string };
type PollData = { question: string; options: string[] };
type EnrichedPoll = { post: Post; poll: PollData; votes: Comment[]; myVoteIndex: number };

const SNOOZE_KEY = "polls-popup-snoozed-until";
const SESSION_SHOWN_KEY = "polls-popup-shown-session";
const SNOOZE_MS = 6 * 60 * 60 * 1000; // 6 hours

export function PollsPopup({ userId }: { userId: string | null }) {
  const [polls, setPolls] = useState<EnrichedPoll[]>([]);
  const [open, setOpen] = useState(false);
  const autoOpenedRef = useRef(false);

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

  const pending = useMemo(() => polls.filter(p => p.myVoteIndex === -1), [polls]);

  // Auto-open only once per session, and only if not snoozed
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (pending.length === 0) return;
    if (typeof window === "undefined") return;
    const until = parseInt(localStorage.getItem(SNOOZE_KEY) || "0");
    const shownThisSession = sessionStorage.getItem(SESSION_SHOWN_KEY) === "1";
    if (until > Date.now() || shownThisSession) return;
    autoOpenedRef.current = true;
    sessionStorage.setItem(SESSION_SHOWN_KEY, "1");
    setOpen(true);
  }, [pending.length]);

  const vote = async (post_id: string, idx: number) => {
    if (!userId) return;
    const { error } = await supabase.from("majlis_comments").insert({
      post_id, author_id: userId, body: `[VOTE]:${idx}`,
    });
    if (error) return toast.error("تعذر تسجيل الصوت");
    toast.success("تم تسجيل صوتك");
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

          {polls.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <Sparkles className="mx-auto text-primary/40" size={32} />
              <p className="text-sm font-bold text-muted-foreground">لا توجد اقتراحات حالياً</p>
            </div>
          ) : (
            <div className="grid gap-4 mt-2">
              <AnimatePresence mode="popLayout">
                {polls.map(({ post, poll, votes, myVoteIndex }) => {
                  const counts = new Array(poll.options.length).fill(0);
                  votes.forEach(v => {
                    const i = parseInt(v.body.split(":")[1]);
                    if (i >= 0 && i < counts.length) counts[i]++;
                  });
                  const total = counts.reduce((a, b) => a + b, 0);
                  const voted = myVoteIndex !== -1;
                  return (
                    <motion.div
                      key={post.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="rounded-2xl border-2 border-border/40 bg-card p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-primary line-clamp-1">{post.title}</h4>
                          <p className="text-sm font-bold text-primary/80 mt-1">{poll.question}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {total} صوت
                          </span>
                          {voted && (
                            <span className="text-[10px] font-black bg-emerald-500/15 text-emerald-600 px-2 py-1 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 size={10} /> صوّتت
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        {poll.options.map((opt, i) => {
                          const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
                          const isMine = myVoteIndex === i;
                          return (
                            <button
                              key={i}
                              onClick={() => vote(post.id, i)}
                              disabled={voted}
                              className={cn(
                                "relative p-3 rounded-xl text-right font-black overflow-hidden border-2 transition-all",
                                isMine ? "bg-primary text-white border-primary" : "bg-card border-border/40 text-primary hover:border-primary disabled:hover:border-border/40",
                              )}
                            >
                              <div
                                className={cn("absolute inset-y-0 right-0 transition-all duration-700", isMine ? "bg-white/10" : "bg-primary/5")}
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative z-10 flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  {isMine ? <CheckCircle2 size={16} /> : <div className="size-3.5 rounded-full border-2 border-current opacity-30" />}
                                  <span>{opt}</span>
                                </div>
                                <span className="opacity-60 text-xs">{pct}%</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <button onClick={() => handleClose(false)} className="text-xs font-bold text-muted-foreground hover:text-primary">
              إغلاق
            </button>
            <Link
              to="/meetings"
              onClick={() => handleClose(false)}
              className="text-xs font-black text-primary inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              عرض الكل في الاجتماعات <ArrowLeft size={14} />
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
