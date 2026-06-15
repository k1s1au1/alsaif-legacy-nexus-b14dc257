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

  // --- Initial load -------------------------------------------------------
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

      // Load reactions + deliveries for these messages
      if (msgList.length) {
        const ids = msgList.map((m) => m.id);
        const [{ data: rxs }, { data: delvs }] = await Promise.all([
          supabase.from("message_reactions").select("*").in("message_id", ids),
          supabase.from("message_deliveries").select("*").in("message_id", ids),
        ]);
        setReactions((rxs ?? []) as Reaction[]);
        setDeliveries((delvs ?? []) as Delivery[]);
      }

      // Load presence for all participants
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

  // --- Realtime: messages, reactions, deliveries, presence ----------------
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
          // Browser notification
          if (m.sender_id !== meId && document.visibilityState !== "visible") {
            maybeNotify(m, profiles);
          }
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => setConv(payload.new as unknown as Conversation),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const p = payload.new as Profile;
          setProfiles((prev) => ({ ...prev, [p.id]: { ...prev[p.id], ...p } }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, meId]);

  // --- Typing broadcast channel ------------------------------------------
  useEffect(() => {
    if (!meId) return;
    const ch = supabase.channel(`typing-${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const uid = payload?.user_id as string | undefined;
      if (!uid || uid === meId) return;
      setTypingUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
      // auto-clear after 3s
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

  // --- Presence: heartbeat ourselves online ------------------------------
  useEffect(() => {
    if (!meId) return;
    const setOnline = () =>
      supabase
        .from("user_presence")
        .upsert({ user_id: meId, status: "online", last_seen_at: new Date().toISOString() });
    const setOffline = () =>
      supabase
        .from("user_presence")
        .upsert({ user_id: meId, status: "offline", last_seen_at: new Date().toISOString() });

    setOnline();
    const interval = window.setInterval(setOnline, 30_000);
    const onUnload = () => setOffline();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", onUnload);
      setOffline();
    };
  }, [meId]);

  // --- Notification permission ------------------------------------------
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  function maybeNotify(m: Message, profs: Record<string, Profile>) {
    if (myParticipant?.muted) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification(displayName(profs[m.sender_id]), {
        body:
          m.kind === "text"
            ? (m.body ?? "")
            : m.kind === "audio"
            ? "🎙 رسالة صوتية"
            : m.kind === "image"
            ? "📷 صورة"
            : m.kind === "video"
            ? "🎬 فيديو"
            : `📎 ${m.attachment_name ?? "ملف"}`,
        silent: false,
      });
    } catch {
      /* ignore */
    }
  }

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
    setDeliveries((prev) =>
      prev.map((d) =>
        d.conversation_id === conversationId && d.user_id === meId && !d.read_at
          ? { ...d, delivered_at: d.delivered_at ?? now, read_at: now }
          : d,
      ),
    );
    await supabase.rpc("mark_conversation_read", { _conversation_id: conversationId });
  }, [conversationId, meId]);

  // --- Auto-scroll + mark read on view ----------------------------------
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
  // --- Typing emit on keystroke -----------------------------------------
  function onDraftKey() {
    if (!meId || !typingChannelRef.current) return;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: meId },
    });
  }

  // --- Send text --------------------------------------------------------
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

  // --- Upload attachment ------------------------------------------------
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
      } catch {
        /* ignore */
      }
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
    e.target.value = "";
    if (!file) return;
    const kind =
      mode === "image" && file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
        ? "audio"
        : "file";
    uploadAndSend(file, kind);
  }

  // --- Voice recording --------------------------------------------------
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
    if (cancel) mr.ondataavailable = null as never;
    mr.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (cancel) mediaChunksRef.current = [];
  }

  // --- Reactions --------------------------------------------------------
  async function toggleReaction(messageId: string, emoji: string) {
    if (!meId) return;
    const existing = reactions.find(
      (r) => r.message_id === messageId && r.user_id === meId && r.emoji === emoji,
    );
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: meId,
        emoji,
      });
    }
    setReactingTo(null);
  }

  // --- Delete message ---------------------------------------------------
  async function deleteMessage(m: Message) {
    if (!meId) return;
    if (m.sender_id === meId) {
      await supabase
        .from("messages")
        .update({ deleted_at: new Date().toISOString(), body: null, attachment_url: null })
        .eq("id", m.id);
    } else if (isAdmin) {
      await supabase.from("messages").delete().eq("id", m.id);
    }
  }

  // --- Conversation actions: archive/mute --------------------------------
  async function toggleMute() {
    if (!myParticipant) return;
    await supabase
      .from("conversation_participants")
      .update({ muted: !myParticipant.muted })
      .eq("id", myParticipant.id);
  }
  async function toggleArchive() {
    if (!myParticipant) return;
    await supabase
      .from("conversation_participants")
      .update({ archived_at: myParticipant.archived_at ? null : new Date().toISOString() })
      .eq("id", myParticipant.id);
    toast.success(myParticipant.archived_at ? "تم إلغاء الأرشفة" : "تمت الأرشفة");
  }
  async function deleteConversation() {
    if (!conv) return;
    if (!confirm("هل تريد حذف هذه المحادثة بالكامل؟")) return;
    const { error } = await supabase.from("conversations").delete().eq("id", conv.id);
    if (error) {
      toast.error("تعذّر الحذف — تحتاج صلاحيات مسؤول الغرفة");
      return;
    }
    navigate({ to: "/chat" });
  }
  async function leaveConversation() {
    if (!myParticipant) return;
    if (!confirm("هل تريد مغادرة هذه المحادثة؟")) return;
    await supabase.from("conversation_participants").delete().eq("id", myParticipant.id);
    navigate({ to: "/chat" });
  }

  // --- Filtered messages with search ------------------------------------
  const visibleMessages = useMemo(() => {
    if (!search.trim()) return messages;
    const q = search.toLowerCase();
    return messages.filter((m) => (m.body ?? "").toLowerCase().includes(q));
  }, [messages, search]);

  if (notFound) {
    return (
      <div className="flex-1 grid place-items-center text-center px-6">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            المحادثة غير موجودة أو ليست لديك صلاحية الوصول.
          </p>
          <button
            onClick={() => navigate({ to: "/chat" })}
            className="text-sm text-gold-primary hover:underline"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }
  if (!conv) {
    return (
      <div className="flex-1 grid place-items-center text-center text-sm text-muted-foreground">
        جارٍ التحميل...
      </div>
    );
  }

  const title = conversationTitle(conv, participants, profiles, meId);
  const initial = conversationAvatarInitial(conv, participants, profiles, meId);
  const otherInDirect = participants.find((p) => p.user_id !== meId);
  const headerStatus =
    conv.kind === "direct"
      ? (() => {
          const p = otherInDirect ? presence[otherInDirect.user_id] : undefined;
          if (p?.status === "online") return "متصل الآن";
          return lastSeenLabel(p?.last_seen_at ?? null);
        })()
      : `${participants.length} عضو`;

  const typingLabel = (() => {
    const others = typingUsers.filter((u) => u !== meId);
    if (others.length === 0) return null;
    if (others.length === 1) return `${displayName(profiles[others[0]])} يكتب...`;
    return `${others.length} أعضاء يكتبون...`;
  })();

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border px-4 lg:px-6 flex items-center gap-3 bg-card/40 backdrop-blur-md">
        <button
          onClick={() => navigate({ to: "/chat" })}
          className="lg:hidden p-2 -mr-2 rounded-lg text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
          aria-label="رجوع"
        >
          <ArrowRight className="size-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition text-right"
        >
          <div
            className={`size-10 rounded-full grid place-items-center text-sm font-medium shrink-0 overflow-hidden ${
              conv.kind === "group"
                ? "bg-secondary/60 text-ivory ring-1 ring-border"
                : "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
            }`}
          >
            {conv.kind === "group" ? (
              <Users className="size-5" strokeWidth={1.5} />
            ) : (
              <UserAvatar
                path={otherInDirect ? profiles[otherInDirect.user_id]?.avatar_url ?? null : null}
                initial={initial}
                className="size-full"
                userId={otherInDirect?.user_id ?? null}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-ivory truncate">{title}</h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {typingLabel ?? headerStatus}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="p-2 rounded-lg text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
            aria-label="بحث"
          >
            <Search className="size-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
            aria-label="معلومات"
          >
            <Info className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {showSearch && (
        <div className="border-b border-border px-4 py-2 bg-card/40">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الرسائل..."
            autoFocus
            className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm text-ivory placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
          />
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-8 py-4 space-y-1">
        {visibleMessages.length === 0 && (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">
            {search ? "لا توجد نتائج." : "ابدأ المحادثة بإرسال رسالة."}
          </div>
        )}
        {renderGroupedMessages({
          messages: visibleMessages,
          meId,
          profiles,
          participants,
          reactions,
          deliveries,
          onReply: setReplyTo,
          onReact: (id) => setReactingTo(id),
          onDelete: deleteMessage,
          isAdmin,
          reactingTo,
          onPickReaction: toggleReaction,
          closeReactingTo: () => setReactingTo(null),
        })}
      </div>

      {/* Reply context */}
      {replyTo && (
        <div className="border-t border-border bg-card/60 px-4 py-2 flex items-center gap-3">
          <div className="flex-1 min-w-0 border-r-2 border-gold-primary pr-3">
            <p className="text-[11px] text-gold-primary">رد على {displayName(profiles[replyTo.sender_id])}</p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.body ?? `[${replyTo.kind}]`}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-muted-foreground hover:text-ivory"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Composer */}
      {recording ? (
        <div className="border-t border-border px-4 lg:px-6 py-3 bg-card/60 flex items-center gap-3">
          <button
            onClick={() => stopRecording(true)}
            className="p-2 rounded-full text-red-400 hover:bg-red-400/10"
            aria-label="إلغاء"
          >
            <Trash2 className="size-4" />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-sm text-ivory">{formatDuration(recordMs)}</span>
            <span className="text-xs text-muted-foreground">جاري التسجيل...</span>
          </div>
          <button
            onClick={() => stopRecording(false)}
            className="p-3 rounded-full bg-gold-primary text-navy-base hover:brightness-110"
            aria-label="إرسال"
          >
            <Send className="size-4" />
          </button>
        </div>
      ) : !canSend ? (
        <div className="border-t border-border px-4 py-4 bg-card/60 text-center text-xs text-muted-foreground">
          {conv?.send_permission === "admins"
            ? "🔒 المشرفون فقط يمكنهم إرسال الرسائل في هذه المجموعة"
            : "🔒 ليس لديك صلاحية إرسال الرسائل في هذه المجموعة"}
        </div>
      ) : (
        <form
          onSubmit={sendText}
          className="border-t border-border px-3 lg:px-4 py-3 bg-card/60 flex items-end gap-2"
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="p-2.5 rounded-full text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
              aria-label="إيموجي"
            >
              <Smile className="size-5" strokeWidth={1.5} />
            </button>
            {showEmoji && (
              <div className="absolute bottom-12 right-0 w-72 max-h-64 overflow-y-auto card-surface p-2 grid grid-cols-8 gap-1 z-50">
                {EMOJI_PICKER.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setDraft((d) => d + e);
                      setShowEmoji(false);
                    }}
                    className="size-7 grid place-items-center hover:bg-secondary/40 rounded text-base"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-full text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
            aria-label="مرفق"
          >
            <Paperclip className="size-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="p-2.5 rounded-full text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
            aria-label="صورة"
          >
            <ImageIcon className="size-5" strokeWidth={1.5} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => onPickFile(e, "any")}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            hidden
            onChange={(e) => onPickFile(e, "image")}
          />
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onDraftKey();
            }}
            onKeyDown={onComposerKeyDown}
            placeholder="اكتب رسالتك..."
            rows={1}
            disabled={sending}
            className="flex-1 resize-none max-h-32 bg-background/60 border border-border rounded-2xl px-4 py-2.5 text-sm text-ivory placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
          />
          {draft.trim() ? (
            <button
              type="submit"
              disabled={sending}
              className="p-3 rounded-full bg-gold-primary text-navy-base hover:brightness-110 transition disabled:opacity-40"
              aria-label="إرسال"
            >
              <Send className="size-4" strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="p-3 rounded-full bg-gold-primary text-navy-base hover:brightness-110 transition"
              aria-label="تسجيل صوتي"
            >
              <Mic className="size-4" strokeWidth={2} />
            </button>
          )}
        </form>
      )}

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
    </div>
  );
}

// ============================================================
// Message rendering
// ============================================================

function renderGroupedMessages(opts: {
  messages: Message[];
  meId: string | null;
  profiles: Record<string, Profile>;
  participants: Participant[];
  reactions: Reaction[];
  deliveries: Delivery[];
  onReply: (m: Message) => void;
  onReact: (id: string) => void;
  onDelete: (m: Message) => void;
  isAdmin: boolean;
  reactingTo: string | null;
  onPickReaction: (id: string, emoji: string) => void;
  closeReactingTo: () => void;
}) {
  const {
    messages,
    meId,
    profiles,
    participants,
    reactions,
    deliveries,
    onReply,
    onReact,
    onDelete,
    isAdmin,
    reactingTo,
    onPickReaction,
    closeReactingTo,
  } = opts;
  const nodes: React.ReactNode[] = [];
  let lastDay = "";
  const byId: Record<string, Message> = {};
  messages.forEach((m) => (byId[m.id] = m));
  const totalRecipients = Math.max(1, participants.length - 1);

  messages.forEach((m) => {
    const day = dayKey(m.created_at);
    if (day !== lastDay) {
      nodes.push(
        <div key={`day-${day}`} className="flex justify-center my-3">
          <span className="text-[10px] text-muted-foreground bg-card/60 px-3 py-1 rounded-full ring-1 ring-border">
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
        meId={meId}
        profiles={profiles}
        replyTo={m.reply_to_id ? byId[m.reply_to_id] : undefined}
        reactions={reactions.filter((r) => r.message_id === m.id)}
        deliveries={deliveries.filter((d) => d.message_id === m.id)}
        totalRecipients={totalRecipients}
        onReply={() => onReply(m)}
        onReact={() => onReact(m.id)}
        onDelete={() => onDelete(m)}
        isAdmin={isAdmin}
        reacting={reactingTo === m.id}
        onPickReaction={(e) => onPickReaction(m.id, e)}
        closeReacting={closeReactingTo}
      />,
    );
  });
  return nodes;
}

function MessageBubble({
  m,
  meId,
  profiles,
  replyTo,
  reactions,
  deliveries,
  totalRecipients,
  onReply,
  onReact,
  onDelete,
  isAdmin,
  reacting,
  onPickReaction,
  closeReacting,
}: {
  m: Message;
  meId: string | null;
  profiles: Record<string, Profile>;
  replyTo: Message | undefined;
  reactions: Reaction[];
  deliveries: Delivery[];
  totalRecipients: number;
  onReply: () => void;
  onReact: () => void;
  onDelete: () => void;
  isAdmin: boolean;
  reacting: boolean;
  onPickReaction: (e: string) => void;
  closeReacting: () => void;
}) {
  const mine = m.sender_id === meId;
  const name = displayName(profiles[m.sender_id]);
  const initial = initialOf(name);
  const canDelete = mine || isAdmin;

  // reaction summary grouped by emoji
  const rxGrouped = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++;
    if (r.user_id === meId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  // status indicator (for own messages)
  let status: "sent" | "delivered" | "read" = "sent";
  if (mine && deliveries.length > 0) {
    const delivered = deliveries.filter((d) => d.delivered_at).length;
    const read = deliveries.filter((d) => d.read_at).length;
    if (read >= totalRecipients) status = "read";
    else if (delivered > 0) status = "delivered";
  }

  return (
    <div className={`group flex items-end gap-2 my-1 ${mine ? "flex-row-reverse" : ""}`}>
      {!mine && (
        <div className="size-7 rounded-full bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20 grid place-items-center text-[10px] font-medium shrink-0 overflow-hidden">
          <UserAvatar
            path={profiles[m.sender_id]?.avatar_url ?? null}
            initial={initial}
            className="size-full"
            userId={m.sender_id}
          />
        </div>
      )}
      <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col relative`}>
        {!mine && (
          <span className="text-[10px] text-muted-foreground mb-0.5 px-2">{name}</span>
        )}
        <div
          className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            mine
              ? "bg-gold-primary text-navy-base rounded-br-sm"
              : "bg-secondary/70 text-ivory ring-1 ring-border rounded-bl-sm"
          }`}
        >
          {replyTo && (
            <div
              className={`mb-1.5 px-2 py-1 rounded-md text-[11px] border-r-2 ${
                mine
                  ? "bg-navy-base/15 border-navy-base/40"
                  : "bg-background/50 border-gold-primary/50"
              }`}
            >
              <p className={`font-medium ${mine ? "text-navy-base/80" : "text-gold-primary"}`}>
                {displayName(profiles[replyTo.sender_id])}
              </p>
              <p className={`truncate ${mine ? "text-navy-base/70" : "text-muted-foreground"}`}>
                {replyTo.deleted_at ? "🚫 محذوفة" : replyTo.body ?? `[${replyTo.kind}]`}
              </p>
            </div>
          )}

          {m.deleted_at ? (
            <em className="opacity-70">🚫 تم حذف هذه الرسالة</em>
          ) : (
            <AttachmentBody m={m} />
          )}

          <div
            className={`flex items-center gap-1 mt-1 text-[10px] ${
              mine ? "text-navy-base/70" : "text-muted-foreground"
            } ${mine ? "justify-end" : "justify-start"}`}
          >
            <span>{timeLabel(m.created_at)}</span>
            {mine && !m.deleted_at && (
              <>
                {status === "sent" && <Check className="size-3" strokeWidth={2.2} />}
                {status === "delivered" && <CheckCheck className="size-3" strokeWidth={2.2} />}
                {status === "read" && (
                  <CheckCheck className="size-3 text-blue-500" strokeWidth={2.2} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Reactions chips */}
        {Object.keys(rxGrouped).length > 0 && (
          <div className={`flex gap-1 mt-1 ${mine ? "self-end" : "self-start"}`}>
            {Object.entries(rxGrouped).map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => onPickReaction(emoji)}
                className={`text-xs px-1.5 py-0.5 rounded-full bg-card/80 ring-1 transition ${
                  info.mine ? "ring-gold-primary/50" : "ring-border"
                }`}
              >
                {emoji} {info.count}
              </button>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        {reacting && (
          <div
            className={`absolute top-0 ${
              mine ? "left-0" : "right-0"
            } -translate-y-full mb-1 card-surface p-1 flex gap-0.5 z-20`}
            onMouseLeave={closeReacting}
          >
            {EMOJI_QUICK.map((e) => (
              <button
                key={e}
                onClick={() => onPickReaction(e)}
                className="size-8 grid place-items-center hover:bg-secondary/40 rounded text-base"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover toolbar */}
      {!m.deleted_at && (
        <div
          className={`opacity-0 group-hover:opacity-100 transition flex gap-0.5 ${
            mine ? "flex-row-reverse" : ""
          }`}
        >
          <button
            onClick={onReact}
            className="p-1.5 rounded-md text-muted-foreground hover:text-gold-primary hover:bg-secondary/40"
            aria-label="تفاعل"
          >
            <Smile className="size-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={onReply}
            className="p-1.5 rounded-md text-muted-foreground hover:text-gold-primary hover:bg-secondary/40"
            aria-label="رد"
          >
            <Reply className="size-3.5" strokeWidth={1.5} />
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-secondary/40"
              aria-label="حذف"
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Attachment body
// ============================================================

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

  if (m.kind === "text") {
    return <>{m.body}</>;
  }
  if (!m.attachment_url) {
    return <em className="opacity-70">[مرفق غير متاح]</em>;
  }
  if (m.kind === "image") {
    return signed ? (
      <a href={signed} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={signed}
          alt={m.attachment_name ?? ""}
          loading="lazy"
          className="max-w-[260px] max-h-[260px] rounded-lg object-cover"
        />
      </a>
    ) : (
      <div className="size-40 rounded-lg bg-background/40 animate-pulse" />
    );
  }
  if (m.kind === "video") {
    return signed ? (
      <video src={signed} controls className="max-w-[280px] max-h-[280px] rounded-lg" />
    ) : (
      <div className="size-40 rounded-lg bg-background/40 animate-pulse" />
    );
  }
  if (m.kind === "audio") {
    return (
      <div className="flex items-center gap-3 min-w-[220px]">
        {signed ? (
          <audio controls src={signed} className="h-8 w-full" />
        ) : (
          <span className="text-xs opacity-70">جارٍ التحميل...</span>
        )}
        {m.attachment_duration_ms && (
          <span className="text-[10px] opacity-70">{formatDuration(m.attachment_duration_ms)}</span>
        )}
      </div>
    );
  }
  // file
  return (
    <a
      href={signed ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      download={m.attachment_name ?? undefined}
      className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-background/30 hover:bg-background/50 transition min-w-[200px]"
    >
      <div className="size-10 rounded-lg bg-gold-primary/20 grid place-items-center shrink-0">
        <FileIcon className="size-5" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{m.attachment_name ?? "ملف"}</p>
        <p className="text-[10px] opacity-70">{formatBytes(m.attachment_size)}</p>
      </div>
      <Download className="size-3.5 opacity-70" strokeWidth={1.5} />
    </a>
  );
}

// ============================================================
// Info drawer (members + admin controls)
// ============================================================

function InfoDrawer({
  conversation,
  participants,
  profiles,
  presence,
  meId,
  isAdmin,
  myParticipant,
  onClose,
  onToggleMute,
  onToggleArchive,
  onDelete,
  onLeave,
}: {
  conversation: Conversation;
  participants: Participant[];
  profiles: Record<string, Profile>;
  presence: Record<string, Presence>;
  meId: string | null;
  isAdmin: boolean;
  myParticipant?: Participant;
  onClose: () => void;
  onToggleMute: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  onLeave: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(conversation.title ?? "");
  const [showAdd, setShowAdd] = useState(false);

  async function saveTitle() {
    if (!title.trim()) return;
    await supabase
      .from("conversations")
      .update({ title: title.trim() })
      .eq("id", conversation.id);
    setRenaming(false);
    toast.success("تم تحديث الاسم");
  }
  async function setRole(p: Participant, role: "admin" | "member") {
    await supabase.from("conversation_participants").update({ role }).eq("id", p.id);
  }
  async function setPermission(perm: "all" | "admins" | "selected") {
    const { error } = await supabase
      .from("conversations")
      .update({ send_permission: perm } as never)
      .eq("id", conversation.id);
    if (error) {
      toast.error("تعذّر تحديث الصلاحيات");
      return;
    }
    toast.success("تم تحديث صلاحيات الإرسال");
  }
  async function toggleCanSend(p: Participant, value: boolean) {
    const { error } = await supabase
      .from("conversation_participants")
      .update({ can_send: value } as never)
      .eq("id", p.id);
    if (error) toast.error("تعذّر التحديث");
  }
  async function removeMember(p: Participant) {
    if (p.user_id === conversation.created_by) {
      toast.error("لا يمكن إزالة مالك المجموعة");
      return;
    }
    await supabase.from("conversation_participants").delete().eq("id", p.id);
  }

  const sorted = [...participants].sort((a, b) => {
    const order = { owner: 0, admin: 1, member: 2 };
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
    return displayName(profiles[a.user_id]).localeCompare(displayName(profiles[b.user_id]), "ar");
  });

  return (
    <div
      className="fixed inset-0 bg-navy-base/80 backdrop-blur-sm z-[100]"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-y-0 left-0 w-full max-w-md bg-card border-l border-border flex flex-col overflow-hidden"
      >
        <header className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-medium text-ivory">معلومات المحادثة</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-ivory">
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Header card */}
          <div className="text-center space-y-2">
            <div
              className={`size-20 rounded-full grid place-items-center text-xl font-medium mx-auto ${
                conversation.kind === "group"
                  ? "bg-secondary/60 text-ivory ring-1 ring-border"
                  : "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
              }`}
            >
              {conversation.kind === "group" ? (
                <Users className="size-8" strokeWidth={1.5} />
              ) : (
                conversationAvatarInitial(conversation, participants, profiles, meId)
              )}
            </div>
            {conversation.kind === "group" && renaming ? (
              <div className="flex gap-2 max-w-xs mx-auto">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-ivory text-center"
                />
                <button
                  onClick={saveTitle}
                  className="px-3 py-2 bg-gold-primary text-navy-base rounded-lg text-xs font-semibold"
                >
                  حفظ
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h4 className="text-lg font-medium text-ivory">
                  {conversationTitle(conversation, participants, profiles, meId)}
                </h4>
                {conversation.kind === "group" && isAdmin && (
                  <button
                    onClick={() => setRenaming(true)}
                    className="text-muted-foreground hover:text-gold-primary"
                  >
                    <Settings2 className="size-3.5" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {conversation.kind === "group" ? `${participants.length} عضو` : "محادثة فردية"}
            </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onToggleMute}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 text-sm text-ivory transition"
            >
              {myParticipant?.muted ? (
                <>
                  <Bell className="size-4" strokeWidth={1.5} />
                  إلغاء الكتم
                </>
              ) : (
                <>
                  <BellOff className="size-4" strokeWidth={1.5} />
                  كتم
                </>
              )}
            </button>
            <button
              onClick={onToggleArchive}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 text-sm text-ivory transition"
            >
              <Archive className="size-4" strokeWidth={1.5} />
              {myParticipant?.archived_at ? "إلغاء الأرشفة" : "أرشفة"}
            </button>
          </div>

          {/* Send permissions (group + admin only) */}
          {conversation.kind === "group" && isAdmin && (
            <div>
              <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                صلاحيات الإرسال
              </h5>
              <div className="space-y-1.5">
                {(
                  [
                    { v: "all", label: "كل الأعضاء", desc: "يستطيع جميع الأعضاء إرسال الرسائل" },
                    { v: "admins", label: "المشرفون فقط", desc: "المالك والمشرفون فقط يمكنهم الإرسال" },
                    { v: "selected", label: "أعضاء محددون والمشرفون", desc: "اختر يدويًا من يستطيع الإرسال" },
                  ] as const
                ).map((opt) => {
                  const active = (conversation.send_permission ?? "all") === opt.v;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => setPermission(opt.v)}
                      className={`w-full text-right px-3 py-2.5 rounded-xl border transition ${
                        active
                          ? "border-gold-primary/60 bg-gold-primary/10"
                          : "border-border bg-secondary/30 hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm text-ivory">{opt.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                        </div>
                        <span
                          className={`size-4 rounded-full border ${
                            active ? "border-gold-primary bg-gold-primary" : "border-border"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs uppercase tracking-wider text-muted-foreground">الأعضاء</h5>
              {conversation.kind === "group" && isAdmin && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="text-xs text-gold-primary inline-flex items-center gap-1 hover:underline"
                >
                  <UserPlus className="size-3.5" strokeWidth={1.5} />
                  إضافة
                </button>
              )}
            </div>
            <div className="space-y-1">
              {sorted.map((p) => {
                const name = displayName(profiles[p.user_id]);
                const isMe = p.user_id === meId;
                const isOwner = p.role === "owner";
                const isMemAdmin = p.role === "admin";
                const pres = presence[p.user_id];
                return (
                  <div
                    key={p.id}
                    className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/30 transition"
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`size-9 rounded-full grid place-items-center text-xs font-medium overflow-hidden ${
                          isOwner || isMemAdmin
                            ? "bg-gold-primary text-navy-base"
                            : "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                        }`}
                      >
                        <UserAvatar
                          path={profiles[p.user_id]?.avatar_url ?? null}
                          name={name}
                          className="size-full"
                        />
                      </div>
                      {pres?.status === "online" && (
                        <span className="absolute bottom-0 left-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ivory truncate flex items-center gap-1.5">
                        {name}
                        {isMe && <span className="text-[10px] text-muted-foreground">(أنت)</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        {isOwner && <Crown className="size-3" strokeWidth={1.5} />}
                        {isMemAdmin && <ShieldCheck className="size-3" strokeWidth={1.5} />}
                        {isOwner
                          ? "المالك"
                          : isMemAdmin
                          ? "مشرف"
                          : pres?.status === "online"
                          ? "متصل الآن"
                          : lastSeenLabel(pres?.last_seen_at ?? null)}
                      </div>
                    </div>
                    {conversation.kind === "group" &&
                      isAdmin &&
                      conversation.send_permission === "selected" &&
                      !isOwner &&
                      !isMemAdmin && (
                        <label
                          className="text-[11px] text-muted-foreground flex items-center gap-1.5 cursor-pointer select-none"
                          title="السماح بالإرسال"
                        >
                          <input
                            type="checkbox"
                            checked={p.can_send}
                            onChange={(e) => toggleCanSend(p, e.target.checked)}
                            className="accent-gold-primary"
                          />
                          إرسال
                        </label>
                      )}
                    {conversation.kind === "group" && isAdmin && !isMe && !isOwner && (
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                        {isMemAdmin ? (
                          <button
                            onClick={() => setRole(p, "member")}
                            title="إلغاء صلاحية الإشراف"
                            className="text-xs text-muted-foreground hover:text-ivory px-2 py-1 rounded"
                          >
                            عضو
                          </button>
                        ) : (
                          <button
                            onClick={() => setRole(p, "admin")}
                            title="ترقية إلى مشرف"
                            className="text-xs text-gold-primary hover:underline px-2 py-1 rounded"
                          >
                            مشرف
                          </button>
                        )}
                        <button
                          onClick={() => removeMember(p)}
                          className="text-muted-foreground hover:text-red-400 p-1"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Danger zone */}
          <div className="border-t border-border pt-4 space-y-2">
            {conversation.kind === "group" && (
              <button
                onClick={onLeave}
                className="w-full py-2.5 text-sm text-red-400 hover:bg-red-400/10 rounded-xl transition"
              >
                مغادرة المجموعة
              </button>
            )}
            {(isAdmin || conversation.created_by === meId) && (
              <button
                onClick={onDelete}
                className="w-full py-2.5 text-sm text-red-400 hover:bg-red-400/10 rounded-xl transition"
              >
                حذف المحادثة
              </button>
            )}
          </div>
        </div>
      </aside>

      {showAdd && (
        <AddParticipantsDialog
          conversationId={conversation.id}
          existing={new Set(participants.map((p) => p.user_id))}
          profiles={profiles}
          meId={meId}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function AddParticipantsDialog({
  conversationId,
  existing,
  profiles,
  meId,
  onClose,
}: {
  conversationId: string;
  existing: Set<string>;
  profiles: Record<string, Profile>;
  meId: string | null;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const list = Object.values(profiles)
    .filter((p) => p.id !== meId && !existing.has(p.id))
    .filter((p) => !q.trim() || displayName(p).toLowerCase().includes(q.toLowerCase()));

  async function add(uid: string) {
    setBusy(uid);
    const { error } = await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conversationId, user_id: uid, role: "member" });
    setBusy(null);
    if (error) {
      toast.error("تعذّر إضافة العضو");
      return;
    }
    toast.success("تمت الإضافة");
  }

  return (
    <div
      className="fixed inset-0 bg-navy-base/80 backdrop-blur-sm grid place-items-center z-[110] p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-surface w-full max-w-md p-6 space-y-4 max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-ivory">إضافة أعضاء</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-ivory">
            <X className="size-4" />
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم..."
          className="w-full bg-background/60 border border-border rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
        />
        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
          {list.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">لا توجد نتائج.</p>
          )}
          {list.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              disabled={busy === p.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/40 transition text-right disabled:opacity-40"
            >
              <div className="size-8 rounded-full bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20 grid place-items-center text-xs font-medium shrink-0">
                {initialOf(displayName(p))}
              </div>
              <span className="flex-1 text-sm text-ivory truncate">{displayName(p)}</span>
              <UserPlus className="size-4 text-gold-primary" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

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
