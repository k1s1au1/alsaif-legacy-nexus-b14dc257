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
  Lock,
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
        // search participant names
        return it.participants.some((p) =>
          displayName(profiles[p.user_id]).toLowerCase().includes(q),
        );
      });
  }, [items, profiles, meId, search, showArchive]);

  return (
    <AppShell title="المحادثات" user={shellUser}>
      <div className="flex h-[calc(100vh-9rem)] -m-6 lg:-m-10 -mt-6 lg:-mt-10">
        {/* Sidebar (conversation list) */}
        <aside
          className={`${
            isConvOpen ? "hidden lg:flex" : "flex"
          } flex-col w-full lg:w-96 shrink-0 border-l border-border bg-card/40 backdrop-blur-md`}
        >
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-ivory">المحادثات</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowNew("chat")}
                  title="محادثة جديدة"
                  className="p-2 rounded-lg text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
                >
                  <MessageSquarePlus className="size-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setShowNew("group")}
                  title="مجموعة جديدة"
                  className="p-2 rounded-lg text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
                >
                  <Users className="size-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search
                className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في المحادثات..."
                className="w-full bg-background/60 border border-border rounded-xl pl-3 pr-9 py-2.5 text-sm text-ivory placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
              />
            </div>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setShowArchive(false)}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  !showArchive
                    ? "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                    : "text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                نشطة
              </button>
              <button
                onClick={() => setShowArchive(true)}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  showArchive
                    ? "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                    : "text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                <Archive className="size-3" strokeWidth={1.5} />
                الأرشيف
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <p className="text-center text-xs text-muted-foreground py-8">جارٍ التحميل...</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-10 px-6">
                {showArchive ? "لا توجد محادثات مؤرشفة." : "ابدأ محادثة جديدة من الأعلى."}
              </p>
            )}
            {filtered.map((it) => (
              <ConversationRow
                key={it.conversation.id}
                item={it}
                meId={meId}
                profiles={profiles}
                active={path === `/chat/${it.conversation.id}`}
                onOpen={() => {
                  // Optimistically clear the unread badge the moment the
                  // recipient opens the conversation, then mark the whole
                  // conversation read on the backend so every session syncs.
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
        </aside>

        {/* Conversation panel */}
        <div className={`flex-1 min-w-0 ${isConvOpen ? "flex" : "hidden lg:flex"}`}>
          <Outlet />
        </div>
      </div>

      {showNew && meId && (
        <NewConversationDialog
          mode={showNew}
          meId={meId}
          profiles={profiles}
          onClose={() => setShowNew(null)}
        />
      )}
    </AppShell>
  );
}

function ConversationRow({
  item,
  meId,
  profiles,
  active,
  onOpen,
}: {
  item: ConversationListItem;
  meId: string | null;
  profiles: Record<string, Profile>;
  active: boolean;
  onOpen?: () => void;
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
  const lastDelivered = item.lastMessage; // simplified — full delivery state in detail view

  return (
    <Link
      to="/chat/$conversationId"
      params={{ conversationId: item.conversation.id }}
      onClick={() => onOpen?.()}
      className={`flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-secondary/30 transition ${
        active ? "bg-secondary/40" : ""
      }`}
    >
      <div
        className={`size-12 rounded-full grid place-items-center text-sm font-medium shrink-0 overflow-hidden ${
          item.conversation.kind === "group"
            ? "bg-secondary/60 text-ivory ring-1 ring-border"
            : "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
        }`}
      >
        {item.conversation.kind === "group" ? (
          <Users className="size-5" strokeWidth={1.5} />
        ) : (
          <UserAvatar path={otherAvatarPath} initial={initial} className="size-full" userId={other?.user_id ?? null} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ivory truncate">{title}</h3>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {item.lastMessage ? chatTimeLabel(item.lastMessage.created_at) : ""}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
            {lastMine && lastDelivered && (
              <CheckCheck className="size-3 text-gold-primary/60 shrink-0" strokeWidth={2} />
            )}
            {messagePreview(item.lastMessage)}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.myParticipant?.muted && (
              <BellOff className="size-3 text-muted-foreground" strokeWidth={1.5} />
            )}
            {item.unread > 0 && (
              <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-gold-primary text-navy-base text-[10px] font-bold grid place-items-center">
                {item.unread > 99 ? "99+" : item.unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function NewConversationDialog({
  mode,
  meId,
  profiles,
  onClose,
}: {
  mode: "chat" | "group";
  meId: string;
  profiles: Record<string, Profile>;
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
    if (mode === "chat") {
      const otherId = [...selected][0];
      const { data, error } = await supabase.rpc("find_or_create_direct", { _other: otherId });
      setBusy(false);
      if (error || !data) {
        toast.error("تعذّر إنشاء المحادثة");
        return;
      }
      onClose();
      navigate({ to: "/chat/$conversationId", params: { conversationId: data as string } });
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
      if (convErr || !conv) {
        toast.error("تعذّر إنشاء المجموعة");
        setBusy(false);
        return;
      }
      const rows = [...selected].map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
        role: "member" as const,
      }));
      const { error: addErr } = await supabase.from("conversation_participants").insert(rows);
      setBusy(false);
      if (addErr) {
        toast.error("تعذّر إضافة الأعضاء");
        return;
      }
      onClose();
      navigate({ to: "/chat/$conversationId", params: { conversationId: conv.id } });
    }
  }

  return (
    <div
      className="fixed inset-0 bg-navy-base/80 backdrop-blur-sm grid place-items-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-surface w-full max-w-md p-6 space-y-4 max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-ivory">
            {mode === "chat" ? "محادثة جديدة" : "مجموعة جديدة"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-ivory">
            <X className="size-4" />
          </button>
        </div>
        {mode === "group" && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="اسم المجموعة"
            maxLength={80}
            className="w-full bg-background/60 border border-border rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
          />
        )}
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
          {list.map((p) => {
            const name = displayName(p);
            const isSel = selected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-right ${
                  isSel ? "bg-gold-primary/10 ring-1 ring-gold-primary/20" : "hover:bg-secondary/40"
                }`}
              >
                <div className="size-9 rounded-full bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20 grid place-items-center text-xs font-medium shrink-0">
                  {initialOf(name)}
                </div>
                <span className="flex-1 text-sm text-ivory truncate">{name}</span>
                {isSel && <Check className="size-4 text-gold-primary" strokeWidth={2} />}
              </button>
            );
          })}
        </div>
        <button
          onClick={create}
          disabled={
            selected.size === 0 || busy || (mode === "group" && !title.trim())
          }
          className="w-full px-4 py-3 bg-gold-primary text-navy-base text-sm font-semibold rounded-xl hover:brightness-110 transition disabled:opacity-40"
        >
          {busy ? "..." : mode === "chat" ? "بدء المحادثة" : `إنشاء المجموعة (${selected.size})`}
        </button>
      </div>
    </div>
  );
}
