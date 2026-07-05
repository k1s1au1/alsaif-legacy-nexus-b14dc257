import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  ArrowRight,
  Archive,
  BellOff,
  Check,
  CheckCheck,
  MessageSquarePlus,
  Search,
  Users,
  X,
  Plus,
  Clock,
  UserPlus,
  ArrowLeft,
  Trash2,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import {
  chatTimeLabel,
  Conversation,
  conversationAvatarInitial,
  conversationTitle,
  displayName,
  initialOf,
  Message,
  messagePreview,
  Participant,
  Profile,
} from "@/lib/chat";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "المحادثات — السيف" },
      { name: "description", content: "محادثات فردية وجماعية مباشرة." },
    ],
  }),
  component: ChatLayout,
});

type ConversationListItem = {
  conversation: Conversation;
  participants: Participant[];
  lastMessage?: Message;
  unread: number;
  myParticipant?: Participant;
};

function ChatLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isConvOpen = /^\/chat\/[^/]+/.test(path);
  const dynamicLogo = useSiteLogo();

  const [meId, setMeId] = useState<string | null>(null);
  const [shellUser, setShellUser] = useState<{ name: string; role: string; initial: string; avatarPath: string | null }>({ name: "عضو", role: "عضو", initial: "ص", avatarPath: null });
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [search, setSearch] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [showNew, setShowNew] = useState<"chat" | "group" | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setMeId(u.user.id);

    const [{ data: myParts }, { data: profs }, { data: myProf }] = await Promise.all([
      supabase.from("conversation_participants").select("*").eq("user_id", u.user.id),
      supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
      supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.user.id).maybeSingle(),
    ]);

    const pmap: Record<string, Profile> = {};
    (profs ?? []).forEach((p) => (pmap[p.id] = p as Profile));
    setProfiles(pmap);

    const meName = displayName({
      id: u.user.id,
      arabic_name: myProf?.arabic_name ?? null,
      full_name: myProf?.full_name ?? null,
      avatar_url: null,
    });
    setShellUser({ name: meName, role: "عضو العائلة", initial: initialOf(meName), avatarPath: myProf?.avatar_url ?? null });

    const convIds = (myParts ?? []).map((p) => p.conversation_id);
    if (convIds.length === 0) { setItems([]); setLoading(false); return; }

    const [{ data: convs }, { data: allParts }, { data: msgs }] = await Promise.all([
      supabase.from("conversations").select("*").in("id", convIds),
      supabase.from("conversation_participants").select("*").in("conversation_id", convIds),
      supabase.from("messages").select("*").in("conversation_id", convIds).order("created_at", { ascending: false }).limit(500),
    ]);

    const partsByConv: Record<string, Participant[]> = {};
    (allParts ?? []).forEach((p) => { (partsByConv[p.conversation_id] ??= []).push(p as Participant); });

    const lastByConv: Record<string, Message> = {};
    const unreadByConv: Record<string, number> = {};
    const myPartByConv: Record<string, Participant> = {};
    (myParts ?? []).forEach((p) => (myPartByConv[p.conversation_id] = p as Participant));

    (msgs ?? []).forEach((m) => {
      const mm = m as Message;
      if (!lastByConv[mm.conversation_id]) lastByConv[mm.conversation_id] = mm;
      const myP = myPartByConv[mm.conversation_id];
      if (myP && mm.sender_id !== u.user!.id && new Date(mm.created_at) > new Date(myP.last_read_at)) {
        unreadByConv[mm.conversation_id] = (unreadByConv[mm.conversation_id] ?? 0) + 1;
      }
    });

    const built: ConversationListItem[] = (convs ?? []).map((c) => ({
      conversation: c as Conversation,
      participants: partsByConv[c.id] ?? [],
      lastMessage: lastByConv[c.id],
      unread: unreadByConv[c.id] ?? 0,
      myParticipant: myPartByConv[c.id],
    })).sort((a, b) => new Date(b.conversation.last_message_at).getTime() - new Date(a.conversation.last_message_at).getTime());

    setItems(built);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    return items
      .filter((it) => (showArchive ? it.myParticipant?.archived_at : !it.myParticipant?.archived_at))
      .filter((it) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const title = conversationTitle(it.conversation, it.participants, profiles, meId).toLowerCase();
        return title.includes(q) || messagePreview(it.lastMessage).toLowerCase().includes(q);
      });
  }, [items, profiles, meId, search, showArchive]);

  return (
    <AppShell title="المحادثات" user={shellUser}>
      <div className="flex h-[calc(100vh-6rem)] lg:h-[calc(100vh-8rem)] -m-6 lg:-m-10 -mt-6 lg:-mt-10 overflow-hidden bg-[#051410]">

        {/* RADICAL PRESTIGE SIDEBAR */}
        <aside className={cn(
            "flex flex-col w-full lg:w-[320px] xl:w-[380px] shrink-0 border-l border-white/5 bg-gradient-to-b from-[#064E3B]/20 to-[#051410] relative z-20 transition-all duration-500",
            isConvOpen ? "hidden lg:flex" : "flex"
          )}>

          {/* Header Area */}
          <div className="p-6 lg:p-8 space-y-6 lg:space-y-8 relative overflow-hidden shrink-0">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l15 30H15zM30 60L15 30h30zM0 30l30-15v30zM60 30L30 45V15z' fill='%23D4AF37' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")` }} />

            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-gold-primary">
                  <Sparkles className="size-3 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">مركز التواصل</span>
                </div>
                <h2 className="text-3xl font-black text-white tracking-tighter drop-shadow-lg">مجلس السيف</h2>
              </div>
              <button onClick={() => setShowNew("chat")} className="size-12 rounded-2xl bg-gold-primary text-emerald-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(212,175,55,0.3)]">
                <Plus className="size-6" strokeWidth={3} />
              </button>
            </div>

            <div className="relative group">
              <Search className="size-4 absolute right-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-gold-primary transition-colors" strokeWidth={3} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في أروقة المجلس..." className="w-full bg-white/5 border border-white/10 rounded-2xl pl-6 pr-12 py-4 text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary/40 transition-all shadow-inner" />
            </div>

            <div className="flex p-1 bg-black/40 rounded-[20px] border border-white/5 backdrop-blur-xl">
              <button onClick={() => setShowArchive(false)} className={cn("flex-1 py-2.5 text-[11px] font-black rounded-2xl transition-all tracking-widest", !showArchive ? "bg-gold-primary text-emerald-950 shadow-xl" : "text-white/40 hover:text-white")}>المجالس النشطة</button>
              <button onClick={() => setShowArchive(true)} className={cn("flex-1 py-2.5 text-[11px] font-black rounded-2xl transition-all tracking-widest flex items-center justify-center gap-2", showArchive ? "bg-gold-primary text-emerald-950 shadow-xl" : "text-white/40 hover:text-white")}>
                <Archive size={14} /> المؤرشفة
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-10 space-y-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                 <div className="size-10 rounded-2xl border-2 border-gold-primary/20 border-t-gold-primary animate-spin" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-gold-primary/40 animate-pulse">جاري التحميل...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 px-10 text-center space-y-6 opacity-30">
                <Users className="size-16 mx-auto text-gold-primary" />
                <p className="text-sm font-black text-white leading-relaxed tracking-wide">{showArchive ? "لا توجد مراسلات مخبأة حالياً" : "ابدأ أول حوار عائلي في هذا المجلس الملكي"}</p>
              </div>
            ) : filtered.map((it) => (
              <ConversationRow key={it.conversation.id} item={it} meId={meId} profiles={profiles} active={path === `/chat/${it.conversation.id}`} />
            ))}
          </div>
        </aside>

        {/* MAIN VIEWPORT */}
        <main className={cn("flex-1 min-w-0 bg-[#04100d] relative z-10", isConvOpen ? "flex" : "hidden lg:flex")}>
          {!isConvOpen && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-10 animate-fade-up relative overflow-hidden">
               {/* Heritage Background for Empty State */}
               <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0l30 60H30zM60 120L30 60h60zM0 60l60-30v60zM120 60L60 90V30z' fill='%23D4AF37' fill-opacity='1'/%3E%3C/svg%3E")`, backgroundSize: '120px 120px' }} />

               <div className="relative group">
                 <div className="absolute inset-0 bg-gold-primary/10 blur-[120px] rounded-full scale-150 animate-pulse" />
                 <div className="size-56 md:size-80 relative z-10 logo-alsaif opacity-10 group-hover:opacity-20 transition-opacity duration-1000 group-hover:scale-110 transition-transform"
                      style={{ '--logo-url': `url(${dynamicLogo || alsaifMark?.url || ""})` } as any} />
               </div>
               <div className="space-y-4 max-w-md relative z-10">
                 <h3 className="text-4xl font-black text-white tracking-tighter">مجلس المحادثات الملكي</h3>
                 <p className="text-white/40 font-bold text-xl leading-relaxed">بوابة السيف الرقمية للتواصل الفوري والمؤمن، اختر إحدى الجلسات للبدء.</p>
               </div>
               <button onClick={() => setShowNew("chat")} className="btn-gold px-12 py-6 text-xl rounded-[32px] shadow-[0_20px_60px_-10px_rgba(212,175,55,0.4)] hover:scale-105 active:scale-95 transition-all">بدء مجلس جديد</button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <AnimatePresence>
        {showNew && meId && (
          <NewConversationDialog mode={showNew} meId={meId} profiles={profiles} dynamicLogo={dynamicLogo} onClose={() => setShowNew(null)} />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function ConversationRow({ item, meId, profiles, active }: { item: ConversationListItem; meId: string | null; profiles: Record<string, Profile>; active: boolean }) {
  const title = conversationTitle(item.conversation, item.participants, profiles, meId);
  const initial = conversationAvatarInitial(item.conversation, item.participants, profiles, meId);
  const other = item.conversation.kind === "direct" ? item.participants.find((p) => p.user_id !== meId) : undefined;
  const otherAvatarPath = other ? profiles[other.user_id]?.avatar_url ?? null : null;
  const lastMine = item.lastMessage?.sender_id === meId;

  return (
    <Link to="/chat/$conversationId" params={{ conversationId: item.conversation.id }}
      className={cn(
        "flex items-center gap-4 px-5 py-5 rounded-[32px] transition-all duration-500 relative overflow-hidden group/row",
        active
          ? "bg-gradient-to-br from-gold-primary via-gold-primary to-[#8E7745] text-emerald-950 shadow-2xl scale-[1.02] z-10"
          : "hover:bg-white/5 text-white/70 hover:text-white"
      )}>

      <div className="relative shrink-0">
        <div className={cn("size-16 rounded-[24px] overflow-hidden border-2 transition-all duration-500", active ? "border-emerald-950/20" : "border-gold-primary/10 group-hover/row:border-gold-primary/30")}>
           {item.conversation.kind === "group" ? (
             <div className="size-full flex items-center justify-center bg-white/5 backdrop-blur-xl"><Users className={cn("size-7", active ? "text-emerald-950" : "text-gold-primary")} /></div>
           ) : (
             <UserAvatar path={otherAvatarPath} name={title} initial={initial} className="size-full" userId={other?.user_id ?? null} presenceDotClassName="absolute -bottom-1 -left-1 size-4 ring-4 ring-[#051410] shadow-2xl" />
           )}
        </div>
        {!active && item.unread > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[22px] h-6 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black grid place-items-center border-2 border-[#051410] shadow-lg animate-bounce">
            {item.unread > 99 ? "99+" : item.unread}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className={cn("text-base font-black truncate tracking-tight", active ? "text-emerald-950" : "text-white")}>{title}</h3>
          <span className={cn("text-[10px] font-black tracking-widest uppercase opacity-40 whitespace-nowrap", active ? "text-emerald-950/60" : "text-white/40")}>
            {item.lastMessage ? chatTimeLabel(item.lastMessage.created_at) : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
          <p className={cn("text-xs font-bold truncate flex-1", active ? "text-emerald-950/70" : "text-white/30")}>
            {lastMine && item.lastMessage && (
              <CheckCheck className={cn("size-3.5 inline ml-1.5", active ? "text-emerald-950/40" : "text-gold-primary/40")} />
            )}
            {messagePreview(item.lastMessage)}
          </p>
          {item.myParticipant?.muted && !active && <BellOff className="size-3 text-white/20 shrink-0" />}
        </div>
      </div>

      {active && (
        <motion.div layoutId="active-nav-glow" className="absolute inset-0 bg-white/10 mix-blend-overlay pointer-events-none" />
      )}
    </Link>
  );
}

function NewConversationDialog({ mode, meId, profiles, dynamicLogo, onClose }: { mode: "chat" | "group"; meId: string; profiles: Record<string, Profile>; dynamicLogo: string | null; onClose: () => void; }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const list = Object.values(profiles).filter((p) => p.id !== meId).filter((p) => !q.trim() || displayName(p).toLowerCase().includes(q.toLowerCase())).sort((a, b) => displayName(a).localeCompare(displayName(b), "ar"));

  function toggle(id: string) {
    if (mode === "chat") setSelected(new Set([id]));
    else { const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); setSelected(next); }
  }

  async function create() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      if (mode === "chat") {
        const { data, error } = await supabase.rpc("find_or_create_direct", { _other: Array.from(selected)[0] });
        if (error) throw error;
        onClose();
        navigate({ to: "/chat/$conversationId", params: { conversationId: String(data) } });
      } else {
        if (!title.trim()) { toast.error("اكتب اسماً للمجموعة"); setBusy(false); return; }
        const { data: conv, error: convErr } = await supabase.from("conversations").insert({ kind: "group", title: title.trim(), created_by: meId }).select().single();
        if (convErr || !conv) throw convErr || new Error("Failed to create group");
        const rows = [{ conversation_id: conv.id, user_id: meId, role: "owner" as const }, ...Array.from(selected).map((uid) => ({ conversation_id: conv.id, user_id: uid, role: "member" as const }))];
        const { error: addErr } = await supabase.from("conversation_participants").insert(rows);
        if (addErr) throw addErr;
        onClose();
        navigate({ to: "/chat/$conversationId", params: { conversationId: conv.id } });
      }
    } catch (err: any) { toast.error("تعذّر إنشاء المحادثة"); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="relative bg-[#051410] border border-white/10 rounded-[50px] w-full max-w-lg overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col max-h-[85vh]" dir="rtl">
        <div className="p-8 sm:p-12 space-y-8 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
               <div className="flex items-center gap-3"><div className="size-1 w-10 bg-gold-primary rounded-full" /><span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">تأسيس مجلس</span></div>
              <h3 className="text-4xl font-black text-white tracking-tighter">{mode === "chat" ? "محادثة خاصة" : "مجلس عائلي"}</h3>
            </div>
            <button onClick={onClose} className="size-12 rounded-full bg-white/5 hover:bg-red-500 text-white transition-all flex items-center justify-center"><X size={28} /></button>
          </div>
          <div className="space-y-6">
            {mode === "group" && <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المجلس الجديد..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 font-black text-white focus:border-gold-primary transition-all shadow-inner" />}
            <div className="relative group">
              <Search className="size-5 absolute right-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-primary transition-colors" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="البحث في أفراد العائلة..." className="w-full bg-white/5 border border-white/10 rounded-2xl pl-6 pr-14 py-5 font-bold text-white focus:border-gold-primary transition-all shadow-inner" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 py-4 overscroll-contain">
            {list.map((p) => (
              <motion.button key={p.id} whileTap={{ scale: 0.98 }} onClick={() => toggle(p.id)}
                className={cn("w-full flex items-center gap-5 px-6 py-5 rounded-[30px] transition-all border-2 text-right", selected.has(p.id) ? "bg-gold-primary/10 border-gold-primary shadow-2xl shadow-gold-primary/10" : "bg-white/5 border-transparent hover:bg-white/10")}>
                <div className={cn("size-14 rounded-2xl overflow-hidden border-2 transition-all", selected.has(p.id) ? "border-gold-primary" : "border-white/10")}>
                  <UserAvatar path={p.avatar_url} name={displayName(p)} initial={initialOf(displayName(p))} className="size-full" userId={p.id} />
                </div>
                <div className="flex-1 min-w-0"><p className={cn("text-lg font-black truncate", selected.has(p.id) ? "text-gold-primary" : "text-white")}>{displayName(p)}</p></div>
                {selected.has(p.id) && <div className="size-8 rounded-full bg-gold-primary flex items-center justify-center text-emerald-950"><Check className="size-5" strokeWidth={4} /></div>}
              </motion.button>
            ))}
          </div>
          <button onClick={create} disabled={selected.size === 0 || busy || (mode === "group" && !title.trim())} className="w-full btn-gold py-7 rounded-[35px] text-2xl font-black shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-4 transition-all">
            {busy ? <div className="size-8 rounded-full border-4 border-emerald-950/20 border-t-emerald-950 animate-spin" /> : <span>تأكيد الاختيار ({selected.size})</span>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
