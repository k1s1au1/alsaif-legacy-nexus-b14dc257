import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Archive,
  Bell,
  BellOff,
  CheckCheck,
  Check,
  Crown,
  Download,
  File as FileIcon,
  Image as ImageIcon,
  Info,
  Lock,
  Mic,
  MoreVertical,
  Paperclip,
  Pause,
  Play,
  Reply,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smile,
  Square,
  Trash2,
  Users,
  UserPlus,
  X,
  Clock,
  Phone,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import {
  chatTimeLabel,
  conversationAvatarInitial,
  conversationTitle,
  dayKey,
  dayLabel,
  displayName,
  EMOJI_PICKER,
  EMOJI_QUICK,
  formatBytes,
  formatDuration,
  getSignedAttachmentUrl,
  initialOf,
  lastSeenLabel,
  type Conversation,
  type Delivery,
  type Message,
  type Participant,
  type Presence,
  type Profile,
  type Reaction,
  timeLabel,
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  ssr: false,
  component: ConversationRoute,
});

function ConversationRoute() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();

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

  const myParticipant = useMemo(
    () => participants.find((p) => p.user_id === meId),
    [participants, meId],
  );
  const isAdmin =
    myParticipant?.role === "owner" || myParticipant?.role === "admin";
  const canSend = useMemo(() => {
    if (!conv || !myParticipant) return false;
    if (conv.kind === "direct") return true;
    const perm = conv.send_permission ?? "all";
    if (perm === "all") return true;
    if (perm === "admins") return isAdmin;
    return isAdmin || myParticipant.can_send;
  }, [conv, myParticipant, isAdmin]);

  useEffect(() => {
    setNotFound(false);
    setConv(null);
    setMessages([]);
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setMeId(u.user.id);

      const { data: c } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();
      if (!c) {
        setNotFound(true);
        return;
      }
      setConv(c as unknown as Conversation);

      const [{ data: parts }, { data: profs }, { data: msgs }] = await Promise.all([
        supabase
          .from("conversation_participants")
          .select("*")
          .eq("conversation_id", conversationId),
        supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(300),
      ]);

      setParticipants((parts ?? []) as unknown as Participant[]);
      const pmap: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => (pmap[p.id] = p as Profile));
      setProfiles(pmap);
      const msgList = (msgs ?? []) as Message[];
      setMessages(msgList);

      if (msgList.length) {
        const ids = msgList.map((m) => m.id);
        const [{ data: rxs }, { data: delvs }] = await Promise.all([
          supabase.from("message_reactions").select("*").in("message_id", ids),
          supabase.from("message_deliveries").select("*").in("message_id", ids),
        ]);
        setReactions((rxs ?? []) as Reaction[]);
        setDeliveries((delvs ?? []) as Delivery[]);
      }

      const userIds = (parts ?? []).map((p) => p.user_id);
      if (userIds.length) {
        const { data: pres } = await supabase
          .from("user_presence")
          .select("*")
          .in("user_id", userIds);
        const pm: Record<string, Presence> = {};
        (pres ?? []).forEach((x) => (pm[x.user_id] = x as Presence));
        setPresence(pm);
      }
    })();
  }, [conversationId]);

  useEffect(() => {
    if (!meId) return;
    const ch = supabase
      .channel(`conv-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (document.visibilityState === "visible" && m.sender_id !== meId) {
            markConversationRead();
          } else {
            markDelivered(m.id);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) =>
          setMessages((prev) =>
            prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m)),
          ),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) =>
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as Message).id)),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setReactions((prev) => prev.filter((r) => r.id !== (payload.old as Reaction).id));
          } else {
            const r = payload.new as Reaction;
            setReactions((prev) =>
              prev.some((x) => x.id === r.id) ? prev : [...prev, r],
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_deliveries",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const d = payload.new as Delivery;
          setDeliveries((prev) => {
            const idx = prev.findIndex((x) => x.id === d.id);
            if (idx === -1) return [...prev, d];
            const next = [...prev];
            next[idx] = d;
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const p = payload.new as Presence;
          setPresence((prev) => ({ ...prev, [p.user_id]: p }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          const { data: parts } = await supabase
            .from("conversation_participants")
            .select("*")
            .eq("conversation_id", conversationId);
          setParticipants((parts ?? []) as unknown as Participant[]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, meId]);

  useEffect(() => {
    if (!meId) return;
    const ch = supabase.channel(`typing-${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const uid = payload?.user_id as string | undefined;
      if (!uid || uid === meId) return;
      setTypingUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
      window.setTimeout(() => {
        setTypingUsers((prev) => prev.filter((x) => x !== uid));
      }, 3000);
    });
    ch.subscribe();
    typingChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [conversationId, meId]);

  const markConversationRead = useCallback(async () => {
    if (!meId) return;
    const now = new Date().toISOString();
    setParticipants((prev) =>
      prev.map((p) =>
        p.conversation_id === conversationId && p.user_id === meId
          ? { ...p, last_read_at: now }
          : p,
      ),
    );
    await supabase.rpc("mark_conversation_read", { _conversation_id: conversationId });
  }, [conversationId, meId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    markConversationRead();
  }, [markConversationRead, messages.length]);

  async function markDelivered(messageId: string) {
    if (!meId) return;
    await supabase
      .from("message_deliveries")
      .update({ delivered_at: new Date().toISOString() })
      .eq("message_id", messageId)
      .eq("user_id", meId)
      .is("delivered_at", null);
  }

  function onDraftKey() {
    if (!meId || !typingChannelRef.current) return;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: meId },
    });
  }

  async function sendText(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !meId || !conv || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: meId,
      kind: "text",
      body,
      reply_to_id: replyTo?.id ?? null,
    });
    setSending(false);
    if (error) {
      toast.error("تعذّر إرسال الرسالة");
      return;
    }
    setDraft("");
    setReplyTo(null);
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  }

  async function uploadAndSend(file: File, kind: "image" | "video" | "audio" | "file") {
    if (!meId || !conv) return;
    const ext = file.name.split(".").pop() || "bin";
    const tempId = crypto.randomUUID();
    const path = `${conv.id}/${tempId}/${tempId}.${ext}`;
    setSending(true);
    const { error: upErr } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setSending(false);
      toast.error("تعذّر رفع الملف");
      return;
    }
    let duration_ms: number | null = null;
    if (kind === "audio" || kind === "video") {
      try {
        duration_ms = await readMediaDuration(file);
      } catch { /* ignore */ }
    }
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: meId,
      kind,
      body: null,
      attachment_url: path,
      attachment_name: file.name,
      attachment_size: file.size,
      attachment_mime: file.type,
      attachment_duration_ms: duration_ms,
      reply_to_id: replyTo?.id ?? null,
    });
    setSending(false);
    if (msgErr) {
      toast.error("تعذّر إرسال الملف");
      return;
    }
    setReplyTo(null);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>, mode: "any" | "image") {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file";
    uploadAndSend(file, kind);
    e.target.value = "";
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) mediaChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(mediaChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        await uploadAndSend(file, "audio");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      recordStartRef.current = Date.now();
      setRecordMs(0);
      recordTimerRef.current = setInterval(() => {
        setRecordMs(Date.now() - recordStartRef.current);
      }, 200);
    } catch {
      toast.error("لا يمكن الوصول للميكروفون");
    }
  }

  function stopRecording(cancel: boolean) {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (cancel) mr.ondataavailable = null as any;
    mr.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!meId) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === meId && r.emoji === emoji);
    if (existing) await supabase.from("message_reactions").delete().eq("id", existing.id);
    else await supabase.from("message_reactions").insert({ message_id: messageId, user_id: meId, emoji });
    setReactingTo(null);
  }

  async function deleteMessage(m: Message) {
    if (!meId) return;
    if (m.sender_id === meId) {
      await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", m.id);
    } else if (isAdmin) {
      await supabase.from("messages").delete().eq("id", m.id);
    }
  }

  async function toggleMute() {
    if (!myParticipant) return;
    await supabase.from("conversation_participants").update({ muted: !myParticipant.muted }).eq("id", myParticipant.id);
  }
  async function toggleArchive() {
    if (!myParticipant) return;
    await supabase.from("conversation_participants").update({ archived_at: myParticipant.archived_at ? null : new Date().toISOString() }).eq("id", myParticipant.id);
    toast.success(myParticipant.archived_at ? "تم إلغاء الأرشفة" : "تمت الأرشفة");
  }
  async function deleteConversation() {
    if (!conv) return;
    if (!confirm("هل تريد حذف هذه المحادثة بالكامل؟")) return;
    const { error } = await supabase.from("conversations").delete().eq("id", conv.id);
    if (error) { toast.error("تعذّر الحذف"); return; }
    navigate({ to: "/chat" });
  }
  async function leaveConversation() {
    if (!myParticipant) return;
    if (!confirm("هل تريد مغادرة هذه المحادثة؟")) return;
    await supabase.from("conversation_participants").delete().eq("id", myParticipant.id);
    navigate({ to: "/chat" });
  }

  const visibleMessages = useMemo(() => {
    if (!search.trim()) return messages;
    return messages.filter((m) => (m.body ?? "").toLowerCase().includes(search.toLowerCase()));
  }, [messages, search]);

  if (!conv) return null;

  const title = conversationTitle(conv, participants, profiles, meId);
  const otherInDirect = participants.find((p) => p.user_id !== meId);
  const presenceInfo = otherInDirect ? presence[otherInDirect.user_id] : undefined;
  const statusLabel = conv.kind === "direct"
    ? (presenceInfo?.status === "online" ? "متصل الآن" : lastSeenLabel(presenceInfo?.last_seen_at ?? null))
    : `${participants.length} عضو`;

  const typingLabel = (() => {
    const others = typingUsers.filter((u) => u !== meId);
    if (others.length === 0) return null;
    if (others.length === 1) return `${displayName(profiles[others[0]])} يكتب...`;
    return `${others.length} أعضاء يكتبون...`;
  })();

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
      <header className="h-20 shrink-0 border-b border-border bg-card/60 backdrop-blur-xl flex items-center justify-between px-6 z-30 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={() => navigate({ to: "/chat" })} className="lg:hidden p-2 -mr-2 text-muted-foreground hover:text-primary transition-all">
            <ArrowRight className="size-5" />
          </button>

          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setShowInfo(true)}>
             <div className="size-12 rounded-[20px] bg-primary/5 border border-primary/10 overflow-hidden relative shadow-inner">
                {conv.kind === "group" ? (
                  <div className="size-full flex items-center justify-center bg-primary text-white"><Users className="size-6" /></div>
                ) : (
                  <UserAvatar path={otherInDirect ? profiles[otherInDirect.user_id]?.avatar_url ?? null : null} name={title} className="size-full" userId={otherInDirect?.user_id ?? null} />
                )}
                {conv.kind === "direct" && presenceInfo?.status === "online" && (
                   <span className="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full border-2 border-card" />
                )}
             </div>
             <div className="min-w-0">
                <h2 className="text-[17px] font-black tracking-tight text-primary group-hover:text-gold-primary transition-colors truncate">{title}</h2>
                <p className="text-[11px] font-bold text-muted-foreground opacity-60">
                   {typingLabel ? <span className="text-emerald-500 animate-pulse">{typingLabel}</span> : statusLabel}
                </p>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
           <button onClick={() => setShowSearch(!showSearch)} className={cn("size-10 rounded-xl flex items-center justify-center transition-all", showSearch ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}><Search className="size-5" /></button>
           <button onClick={() => setShowInfo(true)} className="size-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"><MoreVertical className="size-5" /></button>
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="absolute inset-x-0 bottom-0 top-0 bg-card z-50 flex items-center px-6 gap-4 border-b border-border shadow-2xl">
               <Search className="size-5 text-primary" />
               <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في محادثة المجلس..." className="flex-1 bg-transparent border-none focus:outline-none font-bold text-lg" autoFocus />
               <button onClick={() => { setShowSearch(false); setSearch(""); }} className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-all"><X className="size-5" /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar px-4 md:px-8 py-10 space-y-6 relative"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%238E7745' fill-opacity='0.03' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E")` }}
      >
        <AnimatePresence initial={false}>
          {renderGroupedMessages({
            messages: visibleMessages,
            meId,
            profiles,
            participants,
            reactions,
            deliveries,
            onReply: setReplyTo,
            onReact: (id: string) => setReactingTo(id),
            onDelete: deleteMessage,
            isAdmin,
            reactingTo,
            onPickReaction: toggleReaction,
            closeReactingTo: () => setReactingTo(null),
          })}
        </AnimatePresence>
      </div>

      <div className="px-6 pb-6 shrink-0 relative z-20">
         <AnimatePresence>
           {replyTo && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="mb-2 bg-card/90 backdrop-blur-md border border-border rounded-2xl p-4 flex items-center gap-4 shadow-xl border-r-4 border-r-gold-primary">
                 <Reply className="size-4 text-gold-primary" />
                 <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase text-gold-primary">الرد على {displayName(profiles[replyTo.sender_id])}</p>
                    <p className="text-xs font-bold text-muted-foreground truncate">{replyTo.body || `[مرفق]`}</p>
                 </div>
                 <button onClick={() => setReplyTo(null)} className="size-8 rounded-full hover:bg-muted flex items-center justify-center transition-all"><X className="size-4 text-muted-foreground" /></button>
              </motion.div>
           )}
         </AnimatePresence>

         {recording ? (
            <div className="bg-primary h-[72px] rounded-[28px] flex items-center px-6 gap-6 shadow-2xl text-white">
               <button onClick={() => stopRecording(true)} className="size-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-500 transition-all"><Trash2 className="size-5" /></button>
               <div className="flex-1 flex items-center gap-4">
                  <div className="size-3 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-lg font-black tracking-tighter">{formatDuration(recordMs)}</span>
                  <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                     <motion.div className="h-full bg-white" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 60, ease: "linear" }} />
                  </div>
               </div>
               <button onClick={() => stopRecording(false)} className="size-12 rounded-[20px] bg-white text-primary flex items-center justify-center hover:scale-105 transition-all shadow-lg"><Send className="size-5" /></button>
            </div>
         ) : !canSend ? (
            <div className="bg-muted/30 h-14 rounded-[28px] border border-border flex items-center justify-center text-[13px] font-black text-muted-foreground">
               <Lock className="size-4 ml-2 opacity-40" />
               {conv.send_permission === "admins" ? "المشرفون فقط يمكنهم إرسال الرسائل هنا" : "ليس لديك صلاحية للإرسال"}
            </div>
         ) : (
            <form onSubmit={sendText} className="flex items-end gap-3">
               <div className="flex-1 bg-card/80 backdrop-blur-xl border border-border rounded-[32px] p-2 flex items-end shadow-2xl focus-within:ring-4 focus-within:ring-primary/5 transition-all">
                  <div className="flex items-center pb-1">
                     <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="size-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-gold-primary transition-all relative">
                        <Smile className="size-6" />
                        {showEmoji && (
                          <div className="absolute bottom-14 right-0 w-80 h-80 bg-card border border-border rounded-[32px] shadow-2xl p-4 grid grid-cols-6 gap-2 overflow-y-auto no-scrollbar z-50">
                             {EMOJI_PICKER.map(e => <button key={e} type="button" onClick={() => { setDraft(d => d + e); setShowEmoji(false); }} className="size-10 flex items-center justify-center text-xl hover:bg-muted rounded-xl transition-all">{e}</button>)}
                          </div>
                        )}
                     </button>
                     <button type="button" onClick={() => fileInputRef.current?.click()} className="size-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-gold-primary transition-all"><Paperclip className="size-6" /></button>
                  </div>
                  <textarea
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); onDraftKey(); }}
                    onKeyDown={onComposerKeyDown}
                    placeholder="اكتب رسالتك للمجلس..."
                    rows={1}
                    className="flex-1 bg-transparent border-none focus:outline-none px-2 py-3.5 font-bold text-[15px] resize-none max-h-40 no-scrollbar min-h-[52px]"
                  />
                  <input ref={fileInputRef} type="file" hidden onChange={(e) => onPickFile(e, "any")} />
                  <div className="pb-1 px-1">
                     <button type="button" onClick={() => imageInputRef.current?.click()} className="size-11 rounded-full bg-primary/5 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all"><ImageIcon className="size-6" /></button>
                     <input ref={imageInputRef} type="file" accept="image/*,video/*" hidden onChange={(e) => onPickFile(e, "image")} />
                  </div>
               </div>

               <div className="shrink-0">
                  {draft.trim() ? (
                     <button type="submit" className="size-[60px] rounded-[24px] bg-primary text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-primary/30">
                        <Send className="size-6" strokeWidth={2.5} />
                     </button>
                  ) : (
                     <button type="button" onClick={startRecording} className="size-[60px] rounded-[24px] bg-gold-primary text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-gold-primary/30">
                        <Mic className="size-6" strokeWidth={2.5} />
                     </button>
                  )}
               </div>
            </form>
         )}
      </div>

      <AnimatePresence>
        {showInfo && (
          <InfoDrawer
            conversation={conv}
            participants={participants}
            profiles={profiles}
            presence={presence}
            meId={meId}
            isAdmin={isAdmin}
            myParticipant={myParticipant}
            onClose={() => setShowInfo(false)}
            onToggleMute={toggleMute}
            onToggleArchive={toggleArchive}
            onDelete={deleteConversation}
            onLeave={leaveConversation}
          />
        )}
      </AnimatePresence>
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
        <div key={`day-${day}`} className="flex justify-center my-8 relative">
          <div className="h-px w-full bg-border absolute top-1/2 left-0 z-0" />
          <span className="relative z-10 text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground bg-background px-6 rounded-full border border-border">
            {dayLabel(m.created_at)}
          </span>
        </div>,
      );
      lastDay = day;
    }
    nodes.push(
      <MessageBubble
        key={m.id}
        m={m}
        index={idx}
        meId={meId}
        profiles={profiles}
        replyTo={m.reply_to_id ? byId[m.reply_to_id] : undefined}
        reactions={reactions.filter((r: any) => r.message_id === m.id)}
        deliveries={deliveries.filter((d: any) => d.message_id === m.id)}
        totalRecipients={totalRecipients}
        onReply={() => onReply(m)}
        onReact={() => onReact(m.id)}
        onDelete={() => onDelete(m)}
        isAdmin={isAdmin}
        reacting={reactingTo === m.id}
        onPickReaction={(e: string) => onPickReaction(m.id, e)}
        closeReacting={closeReactingTo}
      />,
    );
  });
  return nodes;
}

function MessageBubble({ m, meId, profiles, replyTo, reactions, deliveries, totalRecipients, onReply, onReact, onDelete, isAdmin, reacting, onPickReaction, closeReacting, index }: any) {
  const mine = m.sender_id === meId;
  const profile = profiles[m.sender_id];
  const name = displayName(profile);
  const initial = initialOf(name);
  const canDelete = mine || isAdmin;

  const rxGrouped = reactions.reduce((acc: any, r: any) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++;
    if (r.user_id === meId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  let status: "sent" | "delivered" | "read" = "sent";
  if (mine && deliveries.length > 0) {
    const delivered = deliveries.filter((d: any) => d.delivered_at).length;
    const read = deliveries.filter((d: any) => d.read_at).length;
    if (read >= totalRecipients) status = "read";
    else if (delivered > 0) status = "delivered";
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: mine ? 20 : -20, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn("group flex items-end gap-3", mine ? "flex-row-reverse" : "flex-row")}
    >
      {!mine && (
        <div className="size-9 rounded-[14px] border border-gold-primary/10 overflow-hidden shrink-0 shadow-sm">
          <UserAvatar path={profile?.avatar_url ?? null} name={name} initial={initial} className="size-full" userId={m.sender_id} />
        </div>
      )}

      <div className={cn("max-w-[85%] sm:max-w-[70%] flex flex-col relative", mine ? "items-end text-left" : "items-start text-right")}>
        {!mine && (
           <span className="text-[10px] font-black text-primary opacity-60 mb-1.5 mr-3 tracking-wide">{name}</span>
        )}

        <div className={cn(
          "relative px-4 py-3 rounded-[24px] shadow-sm transition-all duration-300",
          mine
            ? "bg-primary text-white rounded-br-none shadow-primary/10"
            : "bg-white dark:bg-card border border-border text-foreground rounded-bl-none shadow-black/5"
        )}>
           {replyTo && (
              <div className={cn(
                "mb-3 p-3 rounded-xl border-r-4 text-[12px] font-bold",
                mine ? "bg-black/10 border-white/30 text-white/90" : "bg-muted/50 border-gold-primary/40 text-muted-foreground"
              )}>
                 <p className="text-[10px] uppercase font-black mb-1 opacity-70">{displayName(profiles[replyTo.sender_id])}</p>
                 <p className="truncate italic">{replyTo.deleted_at ? "رسالة محذوفة" : (replyTo.body || "[مرفق]")}</p>
              </div>
           )}

           {m.deleted_at ? (
              <p className="text-xs italic opacity-40 py-1">🚫 تم حذف هذه الرسالة</p>
           ) : (
              <div className="text-[15px] font-bold leading-relaxed">
                 <AttachmentBody m={m} />
              </div>
           )}

           <div className={cn("flex items-center gap-2 mt-2 text-[10px] font-black uppercase tracking-widest", mine ? "text-white/50 justify-end" : "text-muted-foreground/50")}>
              <span>{timeLabel(m.created_at)}</span>
              {mine && !m.deleted_at && (
                <div className="flex">
                   {status === "sent" ? <Check className="size-3" /> : status === "delivered" ? <CheckCheck className="size-3" /> : <CheckCheck className="size-3 text-emerald-400" />}
                </div>
              )}
           </div>
        </div>

        {Object.keys(rxGrouped).length > 0 && (
           <div className={cn("flex flex-wrap gap-1 mt-2 animate-fade-in", mine ? "justify-end" : "")}>
              {Object.entries(rxGrouped).map(([emoji, info]: any) => (
                <button key={emoji} onClick={() => onPickReaction(emoji)} className={cn("px-2 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 transition-all active:scale-90", info.mine ? "bg-primary text-white border-primary" : "bg-card border-border text-primary hover:border-gold-primary")}>
                   <span>{emoji}</span>
                   <span className="opacity-60">{info.count}</span>
                </button>
              ))}
           </div>
        )}

        {reacting && (
           <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn("absolute -top-12 z-50 bg-card border border-border p-1 rounded-2xl flex gap-1 shadow-2xl", mine ? "right-0" : "left-0")}>
              {EMOJI_QUICK.map(e => <button key={e} onClick={() => onPickReaction(e)} className="size-10 flex items-center justify-center text-xl hover:bg-muted rounded-xl transition-all active:scale-125">{e}</button>)}
           </motion.div>
        )}
      </div>

      {!m.deleted_at && (
         <div className={cn("opacity-0 group-hover:opacity-100 transition-all flex items-center self-center", mine ? "flex-row-reverse" : "")}>
            <button onClick={onReact} className="p-2 text-muted-foreground hover:text-gold-primary transition-all"><Smile size={16} /></button>
            <button onClick={onReply} className="p-2 text-muted-foreground hover:text-gold-primary transition-all"><Reply size={16} /></button>
            {canDelete && <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-red-500 transition-all"><Trash2 size={16} /></button>}
         </div>
      )}
    </motion.div>
  );
}

function AttachmentBody({ m }: { m: Message }) {
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    if (!m.attachment_url) return;
    let cancelled = false;
    getSignedAttachmentUrl(m.attachment_url).then((u) => {
      if (!cancelled) setSigned(u);
    });
    return () => {
      cancelled = true;
    };
  }, [m.attachment_url]);

  if (m.kind === "text") return <span className="dir-rtl inline-block text-right w-full">{m.body}</span>;
  if (!m.attachment_url) return <em className="opacity-70">[مرفق غير متاح]</em>;

  if (m.kind === "image") {
    return signed ? (
      <a href={signed} target="_blank" rel="noopener noreferrer" className="block relative group/img overflow-hidden rounded-2xl shadow-lg border border-white/10">
        <img src={signed} alt={m.attachment_name ?? ""} loading="lazy" className="max-w-full max-h-[400px] object-cover transition-transform duration-700 group-hover/img:scale-110" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity"><Download className="text-white size-8" /></div>
      </a>
    ) : (
      <div className="size-48 rounded-2xl bg-muted animate-pulse flex items-center justify-center text-muted-foreground"><ImageIcon className="size-10 opacity-20" /></div>
    );
  }

  if (m.kind === "video") {
    return signed ? (
      <div className="rounded-2xl overflow-hidden shadow-xl border border-white/10 bg-black">
         <video src={signed} controls className="max-w-full max-h-[400px]" />
      </div>
    ) : (
      <div className="size-48 rounded-2xl bg-muted animate-pulse" />
    );
  }

  if (m.kind === "audio") {
    return (
      <div className="flex flex-col gap-3 min-w-[250px] p-2 bg-black/5 rounded-2xl">
        <div className="flex items-center gap-3">
           <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white"><Mic className="size-5" /></div>
           <div className="flex-1">
              <p className="text-[10px] font-black uppercase opacity-60 mb-1">رسالة صوتية</p>
              {signed ? <audio controls src={signed} className="h-6 w-full opacity-60" /> : <span className="text-xs opacity-50">تحميل...</span>}
           </div>
        </div>
        {m.attachment_duration_ms && (
          <span className="text-[10px] font-black opacity-40 self-end px-2">{formatDuration(m.attachment_duration_ms)}</span>
        )}
      </div>
    );
  }

  return (
    <a href={signed ?? "#"} target="_blank" rel="noopener noreferrer" download={m.attachment_name ?? undefined} className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-muted/30 hover:bg-muted transition-all border border-border min-w-[220px]">
      <div className="size-12 rounded-xl bg-gold-primary text-white flex items-center justify-center shadow-lg"><FileIcon className="size-6" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black truncate text-primary">{m.attachment_name ?? "ملف"}</p>
        <p className="text-[10px] font-bold opacity-40">{formatBytes(m.attachment_size)}</p>
      </div>
      <Download className="size-4 text-primary opacity-60" />
    </a>
  );
}

function InfoDrawer({ conversation, participants, profiles, presence, meId, isAdmin, myParticipant, onClose, onToggleMute, onToggleArchive, onDelete, onLeave }: any) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(conversation.title ?? "");
  const [showAdd, setShowAdd] = useState(false);

  async function saveTitle() {
    if (!title.trim()) return;
    await supabase.from("conversations").update({ title: title.trim() }).eq("id", conversation.id);
    setRenaming(false);
    toast.success("تم تحديث اسم المجلس");
  }

  const sorted = [...participants].sort((a, b) => {
    const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
    return displayName(profiles[a.user_id]).localeCompare(displayName(profiles[b.user_id]), "ar");
  });

  const otherUser = useMemo(() => participants.find((p: Participant) => p.user_id !== meId), [participants, meId]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex justify-end">
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30 }} className="w-full max-w-md bg-card h-full shadow-2xl flex flex-col border-r border-border">

        <header className="h-20 shrink-0 border-b border-border flex items-center justify-between px-8 bg-muted/10">
           <h3 className="text-xl font-black text-primary tracking-tight">معلومات المجلس</h3>
           <button onClick={onClose} className="size-10 rounded-full hover:bg-muted flex items-center justify-center transition-all"><X className="size-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
           <div className="flex flex-col items-center text-center space-y-6">
              <div className="size-32 rounded-[40px] bg-primary/5 border-2 border-gold-primary/20 flex items-center justify-center relative shadow-2xl overflow-hidden">
                 {conversation.kind === "group" ? (
                   <Users className="size-12 text-primary" />
                 ) : (
                   <UserAvatar
                     path={otherUser ? profiles[otherUser.user_id]?.avatar_url : null}
                     name={conversationTitle(conversation, participants, profiles, meId)}
                     className="size-full"
                     userId={otherUser?.user_id}
                   />
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>

              <div className="space-y-2">
                 {renaming ? (
                    <div className="flex gap-2">
                       <input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-muted border border-border rounded-xl px-4 py-2 font-bold text-center" />
                       <button onClick={saveTitle} className="btn-gold px-4 rounded-xl font-black">حفظ</button>
                    </div>
                 ) : (
                    <div className="flex items-center justify-center gap-3">
                       <h4 className="text-2xl font-black text-primary tracking-tight">{conversationTitle(conversation, participants, profiles, meId)}</h4>
                       {isAdmin && <button onClick={() => setRenaming(true)} className="text-muted-foreground hover:text-primary"><Settings2 size={16} /></button>}
                    </div>
                 )}
                 <p className="text-sm font-bold text-muted-foreground opacity-60 italic">{conversation.kind === "group" ? `مجلس يضم ${participants.length} عضو` : "محادثة خاصة ومؤمنة"}</p>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
              <button onClick={onToggleMute} className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-muted/40 hover:bg-muted transition-all border border-border/40 group">
                 <div className="size-10 rounded-2xl bg-card flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">{myParticipant?.muted ? <Bell className="size-5 text-gold-primary" /> : <BellOff className="size-5 text-muted-foreground" />}</div>
                 <span className="text-[11px] font-black uppercase tracking-widest">{myParticipant?.muted ? "إلغاء الكتم" : "كتم الإشعارات"}</span>
              </button>
              <button onClick={onToggleArchive} className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-muted/40 hover:bg-muted transition-all border border-border/40 group">
                 <div className="size-10 rounded-2xl bg-card flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><Archive className="size-5 text-muted-foreground" /></div>
                 <span className="text-[11px] font-black uppercase tracking-widest">{myParticipant?.archived_at ? "إلغاء الأرشفة" : "أرشفة المحادثة"}</span>
              </button>
           </div>

           <div className="space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <h5 className="font-black text-xs uppercase tracking-[0.2em] text-primary">أعضاء المجلس</h5>
                    <span className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-black rounded-full border border-primary/10">{participants.length}</span>
                 </div>
                 {isAdmin && <button onClick={() => setShowAdd(true)} className="text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline">+ إضافة عضو</button>}
              </div>

              <div className="space-y-2">
                 {sorted.map(p => {
                    const profile = profiles[p.user_id];
                    const name = displayName(profile);
                    const pres = presence[p.user_id];
                    return (
                       <div key={p.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/40 transition-all group/mem">
                          <div className="size-11 rounded-[14px] border border-border overflow-hidden shrink-0 shadow-sm relative">
                             <UserAvatar path={profile?.avatar_url ?? null} name={name} className="size-full" userId={p.user_id} />
                             {pres?.status === "online" && <div className="absolute -bottom-1 -right-1 size-3 bg-emerald-500 rounded-full border-2 border-card" />}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-sm font-black text-primary truncate">{name} {p.user_id === meId && <span className="opacity-40 font-bold">(أنت)</span>}</p>
                             <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                                {p.role === "owner" ? <Crown size={10} className="text-gold-primary" /> : p.role === "admin" ? <ShieldCheck size={10} className="text-primary" /> : <Users size={10} />}
                                <span className="text-[10px] font-black uppercase tracking-tighter">{p.role === "owner" ? "مالك المجلس" : p.role === "admin" ? "مشرف" : "عضو"}</span>
                             </div>
                          </div>
                       </div>
                    );
                 })}
              </div>
           </div>

           <div className="pt-10 space-y-3">
              {conversation.kind === "group" && <button onClick={onLeave} className="w-full py-4 rounded-2xl bg-red-500/5 text-red-600 font-black text-sm border border-red-500/10 hover:bg-red-500 hover:text-white transition-all">مغادرة المجلس</button>}
              {(isAdmin || conversation.created_by === meId) && <button onClick={onDelete} className="w-full py-4 rounded-2xl bg-red-500/5 text-red-600 font-black text-sm border border-red-500/10 hover:bg-red-500 hover:text-white transition-all">حذف المحادثة نهائياً</button>}
           </div>
        </div>
      </motion.div>

      {showAdd && (
        <AddParticipantsDialog
          conversationId={conversation.id}
          existing={new Set(participants.map((p: any) => p.user_id))}
          profiles={profiles}
          meId={meId}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function AddParticipantsDialog({ conversationId, existing, profiles, meId, onClose }: any) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const list = Object.values(profiles)
    .filter((p: any) => p.id !== meId && !existing.has(p.id))
    .filter((p: any) => !q.trim() || displayName(p).toLowerCase().includes(q.toLowerCase()));

  async function add(uid: string) {
    setBusy(uid);
    const { error } = await supabase.from("conversation_participants").insert({ conversation_id: conversationId, user_id: uid, role: "member" });
    setBusy(null);
    if (error) { toast.error("تعذّر إضافة العضو"); return; }
    toast.success("تمت الإضافة للمجلس");
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md grid place-items-center z-[110] p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="card-surface w-full max-w-md p-8 space-y-6 flex flex-col rounded-[40px]">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-primary tracking-tight">إضافة للمجلس</h3>
          <button onClick={onClose} className="size-10 rounded-full hover:bg-muted flex items-center justify-center transition-all"><X className="size-5" /></button>
        </div>
        <div className="relative">
          <Search className="size-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم..." className="w-full bg-muted/40 border border-border rounded-2xl pl-4 pr-11 py-3.5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 min-h-[300px] max-h-[400px]">
          {list.map((p: any) => (
            <button key={p.id} onClick={() => add(p.id)} disabled={busy === p.id} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-primary/5 transition-all border border-transparent hover:border-primary/10">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black uppercase text-xs">{(p.arabic_name || p.full_name || "?")[0]}</div>
              <span className="flex-1 text-sm font-bold text-right text-primary">{displayName(p)}</span>
              {busy === p.id ? <div className="size-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" /> : <UserPlus className="size-4 text-gold-primary" />}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

async function readMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    const el = document.createElement(isVideo ? "video" : "audio") as HTMLMediaElement;
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round((el.duration || 0) * 1000));
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("metadata"));
    };
  });
}
