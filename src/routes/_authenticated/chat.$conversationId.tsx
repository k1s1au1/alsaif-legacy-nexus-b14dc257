import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, Archive, Bell, BellOff, CheckCheck, Check, Crown, Download, File as FileIcon,
  Image as ImageIcon, Info, Lock, Mic, MoreVertical, Paperclip, Pause, Play, Reply, Search,
  Send, Settings2, ShieldCheck, Smile, Square, Trash2, Users, UserPlus, X, Clock, Phone, Video,
  ChevronLeft, MoreHorizontal, Maximize2, DownloadCloud, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { PresenceDot, usePresenceFor } from "@/lib/presence";
import {
  chatTimeLabel, conversationAvatarInitial, conversationTitle, dayKey, dayLabel, displayName,
  EMOJI_PICKER, EMOJI_QUICK, formatBytes, formatDuration, getSignedAttachmentUrl, initialOf,
  lastSeenLabel, type Conversation, type Delivery, type Message, type Participant, type Presence,
  type Profile, type Reaction, timeLabel
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteLogo } from "@/hooks/use-site-logo";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  ssr: false,
  component: ConversationRoute,
});

function ConversationRoute() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const dynamicLogo = useSiteLogo();

  const [meId, setMeId] = useState<string | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myParticipant = useMemo(() => participants.find((p) => p.user_id === meId), [participants, meId]);
  const isAdmin = myParticipant?.role === "owner" || myParticipant?.role === "admin";
  const canSend = useMemo(() => {
    if (!conv || !myParticipant) return false;
    if (conv.kind === "direct") return true;
    const perm = conv.send_permission ?? "all";
    if (perm === "all") return true;
    if (perm === "admins") return isAdmin;
    return isAdmin || myParticipant.can_send;
  }, [conv, myParticipant, isAdmin]);

  useEffect(() => {
    let active = true;
    setNotFound(false);
    setConv(null);
    setMessages([]);
    setLoading(true);

    const loadData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!active || !authData?.user) return;
        setMeId(authData.user.id);

        const { data: c, error: cErr } = await supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle();
        if (!active) return;
        if (cErr || !c) { setNotFound(true); setLoading(false); return; }
        setConv(c as unknown as Conversation);

        const [{ data: parts }, { data: profs }, { data: msgs }] = await Promise.all([
          supabase.from("conversation_participants").select("*").eq("conversation_id", conversationId),
          supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
          supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(300),
        ]);

        if (!active) return;
        const partList = (parts ?? []) as unknown as Participant[];
        setParticipants(partList);
        const pmap: Record<string, Profile> = {};
        (profs ?? []).forEach((p) => { if (p.id) pmap[p.id] = p as Profile; });
        setProfiles(pmap);
        const msgList = (msgs ?? []) as Message[];
        setMessages(msgList);

        if (msgList.length) {
          const ids = msgList.map((m) => m.id);
          const [{ data: rxs }, { data: delvs }] = await Promise.all([
            supabase.from("message_reactions").select("*").in("message_id", ids),
            supabase.from("message_deliveries").select("*").in("message_id", ids),
          ]);
          if (active) { setReactions((rxs ?? []) as Reaction[]); setDeliveries((delvs ?? []) as Delivery[]); }
        }

        const userIds = partList.map((p) => p.user_id).filter(Boolean);
        if (active && userIds.length) {
          const { data: pres } = await supabase.from("user_presence").select("*").in("user_id", userIds);
          if (active) {
            const pm: Record<string, Presence> = {};
            (pres ?? []).forEach((x) => { if (x.user_id) pm[x.user_id] = x as Presence; });
            setPresence(pm);
          }
        }
      } catch (err) { console.error("Chat loading error:", err); } finally { if (active) setLoading(false); }
    };
    loadData();
    return () => { active = false; };
  }, [conversationId]);

  useEffect(() => {
    if (!meId) return;
    const ch = supabase.channel(`conv-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (document.visibilityState === "visible" && m.sender_id !== meId) markConversationRead();
        else markDelivered(m.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
        setMessages((prev) => prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m))))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) =>
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as Message).id)))
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        if (payload.eventType === "DELETE") setReactions((prev) => prev.filter((r) => r.id !== (payload.old as Reaction).id));
        else { const r = payload.new as Reaction; setReactions((prev) => prev.some((x) => x.id === r.id) ? prev : [...prev, r]); }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_deliveries", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const d = payload.new as Delivery;
        setDeliveries((prev) => { const idx = prev.findIndex((x) => x.id === d.id); if (idx === -1) return [...prev, d]; const next = [...prev]; next[idx] = d; return next; });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const p = payload.new as Presence;
        setPresence((prev) => ({ ...prev, [p.user_id]: p }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, meId]);

  const markConversationRead = useCallback(async () => {
    if (!meId) return;
    await supabase.rpc("mark_conversation_read", { _conversation_id: conversationId });
  }, [conversationId, meId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages.length]);
  useEffect(() => { markConversationRead(); }, [markConversationRead, messages.length]);

  async function markDelivered(messageId: string) {
    if (!meId) return;
    await supabase.from("message_deliveries").update({ delivered_at: new Date().toISOString() }).eq("message_id", messageId).eq("user_id", meId).is("delivered_at", null);
  }

  async function sendText(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !meId || !conv || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({ conversation_id: conv.id, sender_id: meId, kind: "text", body, reply_to_id: replyTo?.id ?? null });
    setSending(false);
    if (!error) { setDraft(""); setReplyTo(null); }
  }

  const title = conversationTitle(conv || ({} as any), participants, profiles, meId);
  const otherInDirect = participants.find((p) => p.user_id !== meId);
  const otherPresenceState = usePresenceFor(otherInDirect?.user_id);
  const statusLabel = conv?.kind === "direct" ? (otherPresenceState === "online" ? "متصل الآن" : "غير متصل") : `${participants.length} عضو`;

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#051410] gap-4">
       <div className="size-20 rounded-[40px] bg-gold-primary/5 flex items-center justify-center border border-gold-primary/20 shadow-2xl relative">
          <Sparkles className="size-10 text-gold-primary animate-pulse" />
       </div>
       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary/40 animate-pulse">تأمين مجلس المحادثة...</p>
    </div>
  );

  if (notFound) return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-6 bg-[#051410]">
       <div className="size-20 rounded-[32px] bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 shadow-xl"><Archive size={40} /></div>
       <h3 className="text-2xl font-black text-white">المجلس غير متاح</h3>
       <button onClick={() => navigate({ to: "/chat" })} className="btn-gold px-8 py-4 rounded-full font-black">العودة للرئيسية</button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#051410] relative overflow-hidden">

      {/* RADICAL PRESTIGE HEADER */}
      <header className="h-24 shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between px-8 z-30 shadow-2xl">
        <div className="flex items-center gap-6 min-w-0">
          <button onClick={() => navigate({ to: "/chat" })} className="lg:hidden p-3 -mr-3 text-white/40 hover:text-gold-primary transition-all">
            <ChevronLeft className="size-8 rotate-180" strokeWidth={3} />
          </button>

          <div className="flex items-center gap-5 cursor-pointer group" onClick={() => setShowInfo(true)}>
             <div className="relative">
                <div className="size-14 rounded-[22px] bg-gradient-to-br from-gold-primary via-gold-primary to-[#8E7745] p-0.5 shadow-xl transition-transform group-hover:scale-105">
                   <div className="size-full rounded-[20px] bg-[#051410] overflow-hidden">
                      {conv?.kind === "group" ? (
                        <div className="size-full flex items-center justify-center bg-white/5"><Users className="size-7 text-gold-primary" /></div>
                      ) : (
                        <UserAvatar path={otherInDirect ? profiles[otherInDirect.user_id]?.avatar_url ?? null : null} name={title} className="size-full object-cover" />
                      )}
                   </div>
                </div>
                {conv?.kind === "direct" && otherInDirect && (
                  <PresenceDot state={otherPresenceState} className="absolute -bottom-1 -left-1 size-4 ring-4 ring-[#051410] shadow-2xl z-20" />
                )}
             </div>
             <div className="min-w-0 space-y-0.5">
                <h2 className="text-xl font-black tracking-tighter text-white group-hover:text-gold-primary transition-colors truncate">{title}</h2>
                <div className="flex items-center gap-2">
                   <div className={cn("size-1.5 rounded-full animate-pulse", otherPresenceState === 'online' ? "bg-emerald-500" : "bg-white/20")} />
                   <p className="text-[11px] font-black uppercase tracking-widest text-white/40">{statusLabel}</p>
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button onClick={() => setShowSearch(!showSearch)} className={cn("size-12 rounded-2xl flex items-center justify-center transition-all shadow-lg", showSearch ? "bg-gold-primary text-emerald-950" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white")}><Search className="size-5" strokeWidth={2.5} /></button>
           <button onClick={() => setShowInfo(true)} className="size-12 rounded-2xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all shadow-lg"><MoreHorizontal className="size-6" strokeWidth={2.5} /></button>
        </div>
      </header>

      {/* MESSAGES AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-6 md:px-12 py-10 space-y-8 relative">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 0l15 35H35zM50 100L35 65h30zM0 50l35-15v30zM100 50L65 65V35z' fill='%23D4AF37'/%3E%3C/svg%3E")`, backgroundSize: '100px 100px' }} />

        <AnimatePresence initial={false}>
          {renderGroupedMessages({
            messages, meId, profiles, participants, reactions, deliveries,
            onReply: setReplyTo,
            onReact: (id: string) => setReactingTo(id),
            onDelete: (m: Message) => { if (m.sender_id === meId || isAdmin) supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", m.id); },
            isAdmin, reactingTo, onPickReaction: (mid: string, e: string) => { supabase.from("message_reactions").insert({ message_id: mid, user_id: meId!, emoji: e }); setReactingTo(null); },
            closeReactingTo: () => setReactingTo(null),
          })}
        </AnimatePresence>
      </div>

      {/* INPUT AREA - FLOATING BAR */}
      <div className="px-6 pb-8 md:pb-10 shrink-0 relative z-20">
         <AnimatePresence>
           {replyTo && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="mb-4 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[30px] p-5 flex items-center gap-5 shadow-2xl border-r-[6px] border-r-gold-primary">
                 <div className="size-10 rounded-full bg-gold-primary/10 flex items-center justify-center text-gold-primary"><Reply className="size-5" /></div>
                 <div className="flex-1 min-w-0"><p className="text-[10px] font-black uppercase text-gold-primary tracking-[0.2em] mb-1">الرد على {displayName(profiles[replyTo.sender_id])}</p><p className="text-sm font-bold text-white/60 truncate">{replyTo.body || `[مرفق]`}</p></div>
                 <button onClick={() => setReplyTo(null)} className="size-10 rounded-full bg-white/5 hover:bg-white/10 text-white/40 flex items-center justify-center transition-all"><X size={20} /></button>
              </motion.div>
           )}
         </AnimatePresence>

         <form onSubmit={sendText} className="flex items-end gap-4 max-w-6xl mx-auto">
            <div className="flex-1 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[35px] p-3 flex items-end shadow-[0_30px_70px_rgba(0,0,0,0.5)] focus-within:border-gold-primary/40 transition-all ring-1 ring-white/5">
               <button type="button" onClick={() => fileInputRef.current?.click()} className="size-12 md:size-14 rounded-full flex items-center justify-center text-white/30 hover:text-gold-primary hover:bg-white/5 transition-all"><Paperclip className="size-6" strokeWidth={2.5} /></button>
               <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="ارتقِ بحديثك في أروقة السيف..." rows={1} className="flex-1 bg-transparent border-none focus:outline-none px-4 py-4 font-bold text-lg text-white placeholder:text-white/20 resize-none max-h-48 no-scrollbar min-h-[56px]" />
               <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="size-12 md:size-14 rounded-full text-white/30 hover:text-gold-primary hover:bg-white/5 transition-all"><Smile className="size-7" strokeWidth={2.5} /></button>
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="size-12 md:size-14 rounded-full bg-white/5 text-gold-primary flex items-center justify-center hover:bg-gold-primary hover:text-emerald-950 transition-all shadow-inner"><ImageIcon className="size-7" strokeWidth={2.5} /></button>
               </div>
            </div>
            <button type="submit" disabled={!draft.trim() || sending} className="size-[64px] md:size-[80px] rounded-[30px] bg-gradient-to-br from-gold-primary to-[#8E7745] text-emerald-950 flex items-center justify-center shadow-[0_20px_40px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all">
               {sending ? <div className="size-8 rounded-full border-4 border-emerald-950/20 border-t-emerald-950 animate-spin" /> : <Send className="size-8 md:size-10" strokeWidth={3} />}
            </button>
            <input ref={fileInputRef} type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (f) toast.info("جاري المعالجة..."); }} />
            <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) toast.info("جاري المعالجة..."); }} />
         </form>
      </div>

      <AnimatePresence>{showInfo && <InfoDrawer conversation={conv} participants={participants} profiles={profiles} presence={presence} meId={meId} isAdmin={isAdmin} myParticipant={myParticipant} onClose={() => setShowInfo(false)} />}</AnimatePresence>
    </div>
  );
}

function renderGroupedMessages(opts: any) {
  const { messages, meId, profiles, participants, reactions, deliveries, onReply, onReact, onDelete, isAdmin, reactingTo, onPickReaction, closeReactingTo } = opts;
  const nodes: React.ReactNode[] = [];
  let lastDay = "";
  const byId: Record<string, Message> = {};
  messages.forEach((m: Message) => (byId[m.id] = m));
  const totalRecipients = Math.max(1, participants.length - 1);

  messages.forEach((m: Message, idx: number) => {
    const day = dayKey(m.created_at);
    if (day !== lastDay) {
      nodes.push(
        <div key={`day-${day}`} className="flex justify-center my-12 relative px-10 text-center">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent absolute top-1/2 left-0" />
          <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.5em] text-gold-primary bg-[#051410] px-8 py-2 rounded-full border border-gold-primary/20 shadow-2xl">
            {dayLabel(m.created_at)}
          </span>
        </div>
      );
      lastDay = day;
    }
    nodes.push(
      <MessageBubble key={m.id} m={m} meId={meId} profiles={profiles} replyTo={m.reply_to_id ? byId[m.reply_to_id] : undefined}
        reactions={reactions.filter((r: any) => r.message_id === m.id)}
        onReply={() => onReply(m)} onReact={() => onReact(m.id)} onDelete={() => onDelete(m)}
        isAdmin={isAdmin} reacting={reactingTo === m.id} onPickReaction={(mid: string, e: string) => onPickReaction(mid, e)} closeReacting={closeReactingTo} />
    );
  });
  return nodes;
}

function MessageBubble({ m, meId, profiles, replyTo, reactions, onReply, onReact, onDelete, isAdmin, reacting, onPickReaction, closeReacting }: any) {
  const mine = m.sender_id === meId;
  const profile = profiles[m.sender_id];
  const name = displayName(profile);
  const canDelete = mine || isAdmin;
  const [showActions, setShowActions] = useState(false);

  const rxGrouped = reactions.reduce((acc: any, r: any) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++;
    if (r.user_id === meId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  return (
    <motion.div initial={{ opacity: 0, x: mine ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className={cn("flex group/msg w-full gap-4", mine ? "flex-row-reverse" : "flex-row")}>
      {!mine && (
        <div className="shrink-0 pt-2">
          <div className="size-12 rounded-[18px] border-2 border-gold-primary/10 overflow-hidden shadow-lg transition-transform hover:scale-110">
            <UserAvatar path={profile?.avatar_url ?? null} name={name} className="size-full" userId={m.sender_id} presenceDotClassName="absolute -bottom-1 -right-1 size-3.5 ring-4 ring-[#051410] z-20" />
          </div>
        </div>
      )}

      <div className={cn("flex flex-col gap-2 relative max-w-[85%] md:max-w-[70%]", mine ? "items-end" : "items-start")}>
        {!mine && <span className="text-[11px] font-black text-gold-primary/80 mr-2 tracking-widest uppercase">{name}</span>}

        <div
          onClick={() => setShowActions(!showActions)}
          className={cn("relative p-5 rounded-[32px] shadow-2xl transition-all duration-500 ring-1 ring-white/5 cursor-pointer active:scale-[0.98]",
          mine ? "bg-gradient-to-br from-[#064E3B] to-[#04281d] text-white rounded-tr-none" : "bg-card border border-white/5 text-white/90 rounded-tl-none")}>

           {replyTo && (
              <div className={cn("mb-4 p-4 rounded-2xl border-r-4 text-[13px] font-bold backdrop-blur-md", mine ? "bg-black/30 border-gold-primary/40 text-white/70" : "bg-white/5 border-gold-primary text-white/50")}>
                 <p className="text-[10px] uppercase font-black mb-1.5 opacity-60 tracking-widest">{displayName(profiles[replyTo.sender_id])}</p>
                 <p className="truncate italic">"{replyTo.deleted_at ? "رسالة محذوفة" : (replyTo.body || "[مرفق]")}"</p>
              </div>
           )}

           <div className="text-[16px] md:text-[18px] font-bold leading-relaxed whitespace-pre-wrap dir-rtl text-right">
              {m.deleted_at ? <em className="opacity-30 font-medium">🚫 تم حذف هذه الرسالة</em> : m.body}
           </div>

           <div className={cn("flex items-center gap-3 mt-3 text-[10px] font-black uppercase tracking-widest", mine ? "text-white/30 justify-end" : "text-white/20")}>
              <span className="tabular-nums">{timeLabel(m.created_at)}</span>
              {mine && !m.deleted_at && <CheckCheck className="size-3.5 text-gold-primary/40" />}
           </div>
        </div>

        {Object.keys(rxGrouped).length > 0 && (
           <div className={cn("flex flex-wrap gap-1.5 mt-1", mine ? "justify-end" : "")}>
              {Object.entries(rxGrouped).map(([emoji, info]: any) => (
                <button key={emoji} className={cn("px-3 py-1.5 rounded-full text-sm font-black border backdrop-blur-3xl flex items-center gap-2 transition-all active:scale-90", info.mine ? "bg-gold-primary/20 border-gold-primary/40 text-gold-primary shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "bg-white/5 border-white/10 text-white/40")}>
                   <span>{emoji}</span><span>{info.count}</span>
                </button>
              ))}
           </div>
        )}

        {/* ACTIONS ROW - Visible on click/tap or hover */}
        <AnimatePresence>
          {!m.deleted_at && (showActions || reacting) && (
             <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className={cn("flex items-center gap-1 mt-1", mine ? "flex-row-reverse" : "flex-row")}>
                <button onClick={(e) => { e.stopPropagation(); onReact(); }} className="p-3 rounded-full bg-white/5 text-gold-primary transition-all active:scale-125 shadow-lg border border-white/5"><Smile size={18} /></button>
                <button onClick={(e) => { e.stopPropagation(); onReply(); }} className="p-3 rounded-full bg-white/5 text-gold-primary transition-all active:scale-125 shadow-lg border border-white/5"><Reply size={18} /></button>
                {canDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(m); }} className="p-3 rounded-full bg-red-500/10 text-red-500 transition-all active:scale-125 shadow-lg border border-red-500/10"><Trash2 size={18} /></button>}
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QUICK REACTION PICKER POPUP */}
      <AnimatePresence>
        {reacting && (
           <motion.div initial={{ y: 20, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.9 }} className={cn("absolute z-[60] -top-16 bg-[#051410]/95 backdrop-blur-3xl border border-white/10 p-2 rounded-[28px] flex gap-2 shadow-[0_30px_80px_rgba(0,0,0,0.8)]", mine ? "right-0 md:right-20" : "left-0 md:left-20")}>
              {EMOJI_QUICK.map(e => <button key={e} onClick={() => onPickReaction(m.id, e)} className="size-12 flex items-center justify-center text-3xl hover:bg-white/5 rounded-2xl transition-all active:scale-150">{e}</button>)}
              <div className="w-px bg-white/10 mx-1" />
              <button onClick={closeReacting} className="size-12 flex items-center justify-center text-white/40 hover:text-white transition-all"><X size={20} /></button>
           </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoDrawer({ conversation, participants, profiles, presence, meId, isAdmin, myParticipant, onClose }: any) {
  const otherUser = participants.find((p: Participant) => p.user_id !== meId);
  const otherProfile = otherUser ? profiles[otherUser.user_id] : null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 200 }} className="relative w-[90vw] max-w-md bg-[#051410] h-full shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col border-r border-white/5">
        <header className="h-24 shrink-0 border-b border-white/5 flex items-center justify-between px-10">
           <h3 className="text-2xl font-black text-white tracking-tighter">تفاصيل المجلس</h3>
           <button onClick={onClose} className="size-12 rounded-full hover:bg-white/5 flex items-center justify-center transition-all active:scale-90 text-white/60"><X size={32} /></button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-10 space-y-12">
           <div className="flex flex-col items-center text-center space-y-8">
              <div className="relative">
                 <div className="size-40 rounded-[50px] bg-gold-primary/10 border-2 border-gold-primary/30 flex items-center justify-center relative shadow-3xl overflow-hidden group">
                    {conversation.kind === "group" ? (
                      <Users className="size-16 text-gold-primary" />
                    ) : (
                      <UserAvatar path={otherProfile?.avatar_url} name={displayName(otherProfile)} className="size-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                    )}
                 </div>
                 <div className="absolute -bottom-2 -right-2 size-8 rounded-2xl bg-[#051410] border-2 border-gold-primary/20 flex items-center justify-center"><ShieldCheck className="size-4 text-gold-primary" /></div>
              </div>

              <div className="space-y-3">
                 <h4 className="text-3xl font-black text-white tracking-tighter">{conversationTitle(conversation, participants, profiles, meId)}</h4>
                 <div className="flex items-center justify-center gap-3">
                    <span className="px-5 py-1.5 rounded-full bg-gold-primary/10 text-gold-primary text-[10px] font-black uppercase tracking-[0.3em] border border-gold-primary/20">
                       {conversation.kind === "group" ? "مجلس عائلي" : "محادثة ملكية"}
                    </span>
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <div className="flex items-center gap-4">
                 <h5 className="font-black text-xs uppercase tracking-[0.3em] text-white/30">أعضاء الجلسة</h5>
                 <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="space-y-3">
                 {participants.map((p: any) => {
                    const prof = profiles[p.user_id];
                    const name = displayName(prof);
                    return (
                       <div key={p.id} className="flex items-center gap-5 p-5 rounded-[28px] bg-white/5 border border-white/5 transition-all hover:bg-white/10 group/item">
                          <div className="size-14 rounded-2xl overflow-hidden border-2 border-white/10 group-hover/item:border-gold-primary/30 transition-colors">
                             <UserAvatar path={prof?.avatar_url} name={name} className="size-full" userId={p.user_id} />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-[17px] font-black text-white truncate">{name}</p>
                             <p className="text-[10px] font-bold text-gold-primary opacity-60 uppercase tracking-widest mt-1">{p.role === 'owner' ? "مؤسس المجلس" : "عضو المجلس"}</p>
                          </div>
                       </div>
                    );
                 })}
              </div>
           </div>

           <div className="pt-10 flex flex-col gap-4">
              <button className="w-full py-6 rounded-[30px] bg-white/5 text-white/60 font-black text-sm border border-white/10 hover:bg-white/10 transition-all">كتم تنبيهات المجلس</button>
              <button className="w-full py-6 rounded-[30px] bg-red-500/5 text-red-500 font-black text-sm border border-red-500/10 hover:bg-red-500 hover:text-white transition-all">مغادرة المجلس الملكي</button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}

async function readMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio") as HTMLMediaElement;
    el.preload = "metadata"; el.src = url;
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round((el.duration || 0) * 1000)); };
    el.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
  });
}
