import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Post = {
  id: string;
  title: string;
  body: string | null;
  author_id: string;
  created_at: string;
};

type Comment = { id: string; post_id: string; author_id: string; body: string };

type PollData = { question: string; options: string[] };

type EnrichedPoll = {
  post: Post;
  poll: PollData;
  votes: Comment[];
  myVoteIndex: number;
};

export function ActivePolls({ userId }: { userId: string | null }) {
  const [polls, setPolls] = useState<EnrichedPoll[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: posts } = await supabase
      .from("majlis_posts")
      .select("id,title,body,author_id,created_at")
      .like("body", "%---poll:%")
      .order("created_at", { ascending: false })
      .limit(10);
    const list = (posts ?? []) as Post[];
    if (list.length === 0) {
      setPolls([]);
      setLoading(false);
      return;
    }
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
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("dash-polls-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_comments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const pending = useMemo(() => polls.filter(p => p.myVoteIndex === -1), [polls]);

  const vote = async (post_id: string, idx: number) => {
    if (!userId) return;
    const { error } = await supabase.from("majlis_comments").insert({
      post_id, author_id: userId, body: `[VOTE]:${idx}`,
    });
    if (error) return toast.error("تعذر تسجيل الصوت");
    toast.success("تم تسجيل صوتك");
  };

  if (loading || pending.length === 0) return null;

  return (
    <section className="px-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <BarChart3 size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-primary">اقتراحات بانتظار تصويتك</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {pending.length} {pending.length === 1 ? "اقتراح" : "اقتراحات"}
            </p>
          </div>
        </div>
        <Link to="/majlis" className="text-xs font-black text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
          المجلس <ArrowLeft size={14} />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {pending.slice(0, 4).map(({ post, poll, votes, myVoteIndex }) => {
            const counts = new Array(poll.options.length).fill(0);
            votes.forEach(v => {
              const i = parseInt(v.body.split(":")[1]);
              if (i >= 0 && i < counts.length) counts[i]++;
            });
            const total = counts.reduce((a, b) => a + b, 0);
            return (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-surface p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-primary line-clamp-1">{post.title}</h4>
                    <p className="text-sm font-bold text-primary/80 mt-2">{poll.question}</p>
                  </div>
                  <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-1 rounded-full shrink-0">
                    {total} صوت
                  </span>
                </div>
                <div className="grid gap-2">
                  {poll.options.map((opt, i) => {
                    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
                    const isMine = myVoteIndex === i;
                    return (
                      <button
                        key={i}
                        onClick={() => vote(post.id, i)}
                        disabled={myVoteIndex !== -1}
                        className={cn(
                          "relative p-3 rounded-xl text-right font-black overflow-hidden border-2 transition-all",
                          isMine
                            ? "bg-primary text-white border-primary"
                            : "bg-white border-border/40 text-primary hover:border-primary",
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
    </section>
  );
}
