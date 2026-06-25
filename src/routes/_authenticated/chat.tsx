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
      supabase
        .from("conversation_participants")
        .select("*")
        .eq("user_id", u.user.id),
      supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
      supabase
        .from("profiles")
        .select("arabic_name, full_name, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle(),
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
    if (convIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const [{ data: convs }, { data: allParts }, { data: msgs }] = await Promise.all([
      supabase.from("conversations").select("*").in("id", convIds),
      supabase.from("conversation_participants").select("*").in("conversation_id", convIds),
      supabase
        .from("messages")
        .select("*")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const partsByConv: Record<string, Participant[]> = {};
    (allParts ?? []).forEach((p) => {
      (partsByConv[p.conversation_id] ??= []).push(p as Participant);
    });

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

    const built: ConversationListItem[] = (convs ?? [])
      .map((c) => ({
        conversation: c as Conversation,
        participants: partsByConv[c.id] ?? [],
        lastMessage: lastByConv[c.id],
        unread: unreadByConv[c.id] ?? 0,
        myParticipant: myPartByConv[c.id],
      }))
      .sort(
        (a, b) =>
          new Date(b.conversation.last_message_at).getTime() -
          new Date(a.conversation.last_message_at).getTime(),
      );

    setItems(built);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        () => load(),
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
  }, [load]);

  const filtered = useMemo(() => {
    return items
      .filter((it) => (showArchive ? it.myParticipant?.archived_at : !it.myParticipant?.archived_at))
      .filter((it) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const title = conversationTitle(
          it.conversation,
          it.participants,
          profiles,
          meId,
        ).toLowerCase();
        if (title.includes(q)) return true;
        const preview = messagePreview(it.lastMessage).toLowerCase();
        if (preview.includes(q)) return true;
        return it.participants.some((p) =>
          displayName(profiles[p.user_id]).toLowerCase().includes(q),
        );
      });
  }, [items, profiles, meId, search, showArchive]);

  const handleToggleArchive = async (item: ConversationListItem) => {
    if (!item.myParticipant) return;
    const isArchiving = !item.myParticipant.archived_at;
    const now = new Date().toISOString();

    setItems(prev => prev.map(it =>
      it.conversation.id === item.conversation.id
        ? { ...it, myParticipant: { ...it.myParticipant!, archived_at: isArchiving ? now : null } }
        : it
    ));

    const { error } = await supabase
      .from("conversation_participants")
      .update({ archived_at: isArchiving ? now : null })
      .eq("id", item.myParticipant.id);

    if (error) {
      toast.error("حدث خطأ أثناء تغيير حالة الأرشفة");
      load();
    } else {
      toast.success(isArchiving ? "تمت أرشفة المحادثة" : "تمت استعادة المحادثة");
    }
  };

  const handleDeleteOrLeave = async (item: ConversationListItem) => {
    if (!item.myParticipant) return;

    const isOwner = item.myParticipant.role === "owner";
    const isGroup = item.conversation.kind === "group";

    const msg = isOwner && isGroup
      ? "هل أنت متأكد من حذف هذه المجموعة نهائياً؟"
      : isGroup
        ? "هل تود مغادرة هذه المجموعة؟"
        : "هل تود حذف هذه المحادثة من قائمتك؟";

    if (!confirm(msg)) return;

    let error;
    if (isOwner && isGroup) {
      const { error: err } = await supabase.from("conversations").delete().eq("id", item.conversation.id);
      error = err;
    } else {
      const { error: err } = await supabase.from("conversation_participants").delete().eq("id", item.myParticipant.id);
      error = err;
    }

    if (error) {
      toast.error("فشل الإجراء: " + error.message);
    } else {
      toast.success("تم تنفيذ طلبك بنجاح");
      load();
    }
  };

  return (
    <AppShell title="المحادثات" user={shellUser}>
      <div className="flex h-[calc(100vh-10rem)] -m-6 lg:-m-10 -mt-6 lg:-mt-10 overflow-hidden bg-background">
        <aside
          className={cn(
            "flex flex-col w-full lg:w-[400px] shrink-0 border-l border-border bg-card/30 backdrop-blur-xl relative z-20 transition-all duration-500",
            isConvOpen ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="p-6 border-b border-border space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-foreground tracking-tight">الرسائل</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary opacity-60">تواصل مباشر</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNew("chat")}
                  className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                >
                  <Plus className="size-5" />
                </button>
                <button
                  onClick={() => setShowNew("group")}
                  className="size-10 rounded-xl bg-gold-primary/10 text-gold-primary border border-gold-primary/20 flex items-center justify-center hover:bg-gold-primary/20 transition-all"
                >
                  <Users className="size-5" />
                </button>
              </div>
            </div>

            <div className="relative group">
              <Search
                className="size-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none"
                strokeWidth={2.5}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في المحادثات..."
                className="w-full bg-background/50 border border-border rounded-2xl pl-4 pr-11 py-3.5 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-inner"
              />
            </div>

            <div className="flex p-1 bg-muted/40 rounded-2xl border border-border/40">
              <button
                onClick={() => setShowArchive(false)}
                className={cn(
                  "flex-1 py-2 text-xs font-black rounded-xl transition-all",
                  !showArchive ? "bg-card text-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                )}
              >
                نشطة
              </button>
              <button
                onClick={() => setShowArchive(true)}
                className={cn(
                  "flex-1 py-2 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all",
                  showArchive ? "bg-card text-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Archive className="size-3.5" />
                المؤرشفة
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar py-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3 opacity-30">
                 <div className="size-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                 <span className="text-[10px] font-black uppercase tracking-widest">جاري التحميل...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-10 text-center space-y-4 opacity-40">
                <div className="size-16 rounded-[32px] bg-muted flex items-center justify-center text-muted-foreground">
                   <Users className="size-8" />
                </div>
                <p className="text-sm font-bold leading-relaxed">
                  {showArchive ? "لا توجد محادثات مؤرشفة حالياً" : "ابدأ أول محادثة مع أفراد عائلتك الآن"}
                </p>
              </div>
            ) : (
              <div className="px-3 space-y-1">
                {filtered.map((it) => (
                  <ConversationRow
                    key={it.conversation.id}
                    item={it}
                    meId={meId}
                    profiles={profiles}
                    active={path === `/chat/${it.conversation.id}`}
                    onArchive={() => handleToggleArchive(it)}
                    onDelete={() => handleDeleteOrLeave(it)}
                    onOpen={() => {
                      setItems((prev) =>
                        prev.map((x) =>
                          x.conversation.id === it.conversation.id
                            ? { ...x, unread: 0 }
                            : x,
                        ),
                      );
                      if (meId) {
                        supabase.rpc("mark_conversation_read", {
                          _conversation_id: it.conversation.id,
                        });
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className={cn(
          "flex-1 min-w-0 bg-background relative z-10",
          isConvOpen ? "flex" : "hidden lg:flex"
        )}>
          {!isConvOpen && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-8 animate-fade-up">
               <div className="relative group">
                 <div className="absolute inset-0 bg-gold-primary/20 blur-[100px] rounded-full" />
                 <div
                   className="size-48 md:size-64 relative z-10 logo-alsaif opacity-40"
                   style={{ '--logo-url': `url(${dynamicLogo || alsaifMark?.url || ""})` } as any}
                 />
               </div>
               <div className="space-y-2 max-w-sm">
                 <h3 className="text-3xl font-black text-primary tracking-tight">مجلس المحادثات</h3>
                 <p className="text-muted-foreground font-bold text-lg opacity-60 leading-relaxed">اختر محادثة من القائمة للبدء في التواصل مع أعضاء عائلة السيف.</p>
               </div>
               <button
                onClick={() => setShowNew("chat")}
                className="btn-gold px-10 py-4 text-base shadow-2xl shadow-gold-primary/20"
               >
                 بدء محادثة جديدة
               </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <AnimatePresence>
        {showNew && meId && (
          <NewConversationDialog
            mode={showNew}
            meId={meId}
            profiles={profiles}
            dynamicLogo={dynamicLogo}
            onClose={() => setShowNew(null)}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function ConversationRow({
  item,
  meId,
  profiles,
  active,
  onOpen,
  onArchive,
  onDelete,
}: {
  item: ConversationListItem;
  meId: string | null;
  profiles: Record<string, Profile>;
  active: boolean;
  onOpen?: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const title = conversationTitle(item.conversation, item.participants, profiles, meId);
  const initial = conversationAvatarInitial(
    item.conversation,
    item.participants,
    profiles,
    meId,
  );
  const other = item.conversation.kind === "direct"
    ? item.participants.find((p) => p.user_id !== meId)
    : undefined;
  const otherAvatarPath = other ? profiles[other.user_id]?.avatar_url ?? null : null;
  const lastMine = item.lastMessage?.sender_id === meId;
  const lastDelivered = item.lastMessage;

  const isArchived = !!item.myParticipant?.archived_at;

  return (
    <div className="relative overflow-hidden rounded-[28px] group/row">
      <div className="absolute inset-0 flex items-center justify-between px-6 z-0">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchive(); }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
            isArchived ? "text-emerald-500" : "text-amber-500"
          )}
        >
          <div className={cn("size-10 rounded-full flex items-center justify-center bg-current/10 shadow-sm")}>
            <Archive className="size-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">{isArchived ? "استعادة" : "أرشفة"}</span>
        </button>

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          className="flex flex-col items-center justify-center gap-1 text-red-500 transition-all active:scale-95"
        >
          <div className="size-10 rounded-full flex items-center justify-center bg-red-500/10 shadow-sm">
            <Trash2 className="size-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">حذف</span>
        </button>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 120 }}
        dragSnapToOrigin
        onDragEnd={(e, info) => {
          if (info.offset.x > 80) onArchive();
          else if (info.offset.x < -80) onDelete();
        }}
        dragElastic={0.2}
        whileDrag={{ cursor: "grabbing" }}
        className="relative z-10"
      >
        <Link
          to="/chat/$conversationId"
          params={{ conversationId: item.conversation.id }}
          onClick={() => onOpen?.()}
          className={cn(
            "flex items-center gap-4 px-4 py-4 rounded-[28px] transition-all duration-300 relative overflow-hidden",
            active
              ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-[1.01]"
              : "bg-card hover:bg-muted text-foreground border border-border/40 shadow-sm"
          )}
        >
          <div className="relative shrink-0">
            <div
              className={cn(
                "size-14 rounded-[22px] grid place-items-center text-sm font-black overflow-hidden border-2 transition-all duration-500",
                active ? "border-white/20" : "border-gold-primary/10"
              )}
            >
              {item.conversation.kind === "group" ? (
                <div className={cn("size-full flex items-center justify-center", active ? "bg-white/10" : "bg-primary/5")}>
                  <Users className={cn("size-6", active ? "text-white" : "text-primary")} strokeWidth={2} />
                </div>
              ) : (
                <UserAvatar path={otherAvatarPath} name={title} initial={initial} className="size-full" userId={other?.user_id ?? null} />
              )}
            </div>
            {!active && item.unread > 0 && (
              <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-gold-primary text-navy-base text-[10px] font-black grid place-items-center border-2 border-card shadow-lg animate-fade-in">
                {item.unread > 99 ? "99+" : item.unread}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className={cn("text-sm font-black truncate tracking-tight", active ? "text-white" : "text-foreground group-hover/row:text-primary transition-colors")}>{title}</h3>
              <div className="flex items-center gap-1.5 opacity-60">
                 {!active && <Clock className="size-3 text-muted-foreground" />}
                 <span className={cn("text-[10px] font-bold", active ? "text-white/60" : "text-muted-foreground")}>
                   {item.lastMessage ? chatTimeLabel(item.lastMessage.created_at) : ""}
                 </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className={cn("text-xs font-bold truncate flex items-center gap-1.5", active ? "text-white/80" : "text-muted-foreground")}>
                {lastMine && lastDelivered && (
                  <CheckCheck className={cn("size-3.5", active ? "text-white/60" : "text-gold-primary/60")} strokeWidth={2.5} />
                )}
                {messagePreview(item.lastMessage)}
              </p>
              {item.myParticipant?.muted && !active && (
                <BellOff className="size-3 text-muted-foreground opacity-40" strokeWidth={2.5} />
              )}
            </div>
          </div>

          {active && (
            <motion.div
              layoutId="active-chat-pill"
              className="absolute left-0 inset-y-4 w-1 bg-white rounded-full opacity-40"
            />
          )}
        </Link>
      </motion.div>
    </div>
  );
}

function NewConversationDialog({
  mode,
  meId,
  profiles,
  dynamicLogo,
  onClose,
}: {
  mode: "chat" | "group";
  meId: string;
  profiles: Record<string, Profile>;
  dynamicLogo: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const list = Object.values(profiles)
    .filter((p) => p.id !== meId)
    .filter((p) => {
      if (!q.trim()) return true;
      return displayName(p).toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "ar"));

  function toggle(id: string) {
    if (mode === "chat") {
      setSelected(new Set([id]));
    } else {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelected(next);
    }
  }

  async function create() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      if (mode === "chat") {
        const otherId = Array.from(selected)[0];
        console.log("Starting chat with:", otherId);
        const { data, error } = await supabase.rpc("find_or_create_direct", { _other: otherId });
        if (error) throw error;
        if (!data) throw new Error("No conversation ID returned");

        onClose();
        navigate({ to: "/chat/$conversationId", params: { conversationId: String(data) } });
      } else {
        if (!title.trim()) {
          toast.error("اكتب اسماً للمجموعة");
          setBusy(false);
          return;
        }
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .insert({ kind: "group", title: title.trim(), created_by: meId })
          .select()
          .single();
        if (convErr || !conv) throw convErr || new Error("Failed to create group");

        const rows = [
          { conversation_id: conv.id, user_id: meId, role: "owner" as const },
          ...Array.from(selected).map((uid) => ({
            conversation_id: conv.id,
            user_id: uid,
            role: "member" as const,
          }))
        ];
        const { error: addErr } = await supabase.from("conversation_participants").insert(rows);
        if (addErr) throw addErr;

        onClose();
        navigate({ to: "/chat/$conversationId", params: { conversationId: conv.id } });
      }
    } catch (err: any) {
      console.error("Chat creation error:", err);
      toast.error("تعذّر إنشاء المحادثة: " + (err.message || "خطأ غير معروف"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-card border border-border rounded-[48px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        dir="rtl"
      >
        <div className="absolute top-0 left-0 opacity-10 -translate-x-1/4 -translate-y-1/4 pointer-events-none scale-150 transition-opacity duration-700">
           <div
             className="size-64 logo-alsaif"
             style={{ "--logo-url": `url(${dynamicLogo || alsaifMark.url})` } as any}
           />
        </div>

        <div className="p-6 sm:p-10 space-y-6 flex flex-col flex-1 min-h-0 relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
               <div className="flex items-center gap-3">
                  <div className="size-1 w-10 bg-gold-primary rounded-full" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">تواصل مباشر</span>
               </div>
              <h3 className="text-3xl font-black tracking-tight text-foreground">
                {mode === "chat" ? "محادثة جديدة" : "مجلس عائلي جديد"}
              </h3>
              <p className="text-muted-foreground font-bold text-sm">اختر الأفراد الذين تود التواصل معهم في هذا المجلس.</p>
            </div>
            <button onClick={onClose} className="size-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary transition-all">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            {mode === "group" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-foreground opacity-60 mr-2 block">عنوان المجلس</label>
                <div className="relative group">
                   <Users className="size-4 absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-gold-primary transition-colors" />
                   <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: مجلس الأحفاد / ترتيبات العيد"
                    maxLength={80}
                    className="w-full bg-muted/30 border border-border rounded-2xl pl-6 pr-12 py-5 font-bold text-sm text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-foreground opacity-60 mr-2 block">البحث عن أفراد العائلة</label>
               <div className="relative group">
                 <Search className="size-4 absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                 <input
                   value={q}
                   onChange={(e) => setQ(e.target.value)}
                   placeholder="ابحث بالاسم أو اللقب..."
                   className="w-full bg-muted/30 border border-border rounded-2xl pl-6 pr-12 py-5 font-bold text-sm text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                 />
               </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 -mr-2 space-y-3 py-4 border-y border-border/40 min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
            {list.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 opacity-40">
                 <Search size={40} className="text-muted-foreground" />
                 <p className="text-center text-sm font-bold italic">لا توجد نتائج مطابقة لبحثك حالياً.</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 pb-2">
              {list.map((p) => {
                const name = displayName(p);
                const isSel = selected.has(p.id);
                return (
                  <motion.button
                    key={p.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-4 rounded-[28px] transition-all duration-300 border-2 text-right group",
                      isSel
                        ? "bg-primary/5 border-primary/20 shadow-xl shadow-primary/5"
                        : "bg-white/50 border-transparent hover:bg-white hover:border-border"
                    )}
                  >
                    <div className={cn(
                      "size-12 rounded-[20px] grid place-items-center text-xs font-black overflow-hidden border-2 transition-all duration-500",
                      isSel ? "border-primary bg-primary text-white scale-110 shadow-lg" : "border-gold-primary/10 bg-muted group-hover:border-gold-primary/30"
                    )}>
                      <UserAvatar path={p.avatar_url} name={name} initial={initialOf(name)} className="size-full" userId={p.id} />
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className={cn("text-base font-black truncate transition-colors", isSel ? "text-primary" : "text-foreground group-hover:text-gold-primary")}>{name}</p>
                       <p className="text-[10px] font-bold text-muted-foreground opacity-60 uppercase tracking-widest">عضو العائلة</p>
                    </div>
                    {isSel && (
                      <div className="size-7 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg animate-fade-in">
                        <Check className="size-4" strokeWidth={4} />
                      </div>
                    )}
                    {!isSel && mode === "group" && (
                       <div className="size-7 rounded-full border-2 border-border flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="size-4" />
                       </div>
                    )}
                    {!isSel && mode === "chat" && (
                       <ArrowLeft className="size-5 text-gold-primary opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={create}
              disabled={selected.size === 0 || busy || (mode === "group" && !title.trim())}
              className="w-full btn-gold py-6 rounded-[32px] text-xl font-black shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-4 disabled:opacity-50 transition-all"
            >
              {busy ? (
                <div className="size-7 rounded-full border-4 border-white/20 border-t-white animate-spin" />
              ) : (
                <>
                  {mode === "chat" ? (
                    <>
                      <span>بدء المحادثة الآن</span>
                      <MessageSquarePlus className="size-6" />
                    </>
                  ) : (
                    <>
                      <span>تأسيس المجلس ({selected.size})</span>
                      <ArrowRight className="size-6 rotate-180" />
                    </>
                  )}
                </>
              )}
            </button>
            {mode === "group" && (
               <p className="text-center text-[10px] font-bold text-muted-foreground mt-4 opacity-60">سيتم إضافة جميع الأعضاء المختارين تلقائياً إلى هذا المجلس فور إنشائه.</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
