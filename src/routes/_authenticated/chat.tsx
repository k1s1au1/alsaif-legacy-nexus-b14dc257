import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Archive,
  BellOff,
  CheckCheck,
  Search,
  Users,
  X,
  Plus,
  Clock,
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
      <div className="flex h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-14rem)] md:rounded-[32px] overflow-hidden md:border border-border md:shadow-2xl bg-card animate-fade-up -mx-4 md:mx-0">

        {/* INTEGRATED SIDEBAR */}
        <aside className={cn(
            "flex flex-col w-full lg:w-[320px] xl:w-[380px] shrink-0 border-l border-border bg-muted/30 relative z-20 transition-all duration-500",
            isConvOpen ? "hidden lg:flex" : "flex"
          )}>

          <div className="p-6 space-y-6 shrink-0 border-b border-border bg-card/50 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-gold-primary">
                  <Sparkles className="size-3 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em]">الرسائل</span>
                </div>
                <h2 className="text-2xl font-black text-primary tracking-tighter">مجلس السيف</h2>
              </div>
              <button onClick={() => setShowNew("chat")} className="size-10 rounded-xl bg-gold-primary text-emerald-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg">
                <Plus className="size-5" strokeWidth={3} />
              </button>
            </div>

            <div className="relative group">
              <Search className="size-3.5 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" strokeWidth={3} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في المحادثات..." className="w-full bg-background border border-border rounded-xl pl-4 pr-10 py-2.5 text-xs font-bold focus:ring-2 focus:ring-primary/10 transition-all shadow-inner" />
            </div>

            <div className="flex p-1 bg-muted rounded-xl border border-border/40">
              <button onClick={() => setShowArchive(false)} className={cn("flex-1 py-2 text-[10px] font-black rounded-lg transition-all", !showArchive ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>النشطة</button>
              <button onClick={() => setShowArchive(true)} className={cn("flex-1 py-2 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-2", showArchive ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
                <Archive size={12} /> المؤرشفة
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-muted/10 min-h-0 custom-scrollbar">
            {loading ? (
              <div className="py-20 text-center opacity-30"><Clock className="size-8 mx-auto animate-spin mb-2" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-20 px-8 text-center opacity-40 text-xs font-bold leading-relaxed">{showArchive ? "لا توجد محادثات مؤرشفة" : "ابدأ تواصلك الأول مع أفراد العائلة"}</div>
            ) : filtered.map((it) => (
              <ConversationRow key={it.conversation.id} item={it} meId={meId} profiles={profiles} active={path === `/chat/${it.conversation.id}`} />
            ))}
          </div>
        </aside>

        {/* MAIN VIEWPORT */}
        <main className={cn("flex-1 min-w-0 bg-background relative z-10", isConvOpen ? "flex" : "hidden lg:flex")}>
          {!isConvOpen && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-8 animate-fade-up">
               <div className="relative">
                 <div className="absolute inset-0 bg-gold-primary/10 blur-[80px] rounded-full scale-150" />
                 <div className="size-48 md:size-64 relative z-10 logo-alsaif opacity-10"
                      style={{ '--logo-url': `url(${dynamicLogo || ""})` } as any} />
               </div>
               <div className="space-y-2 max-w-sm">
                 <h3 className="text-2xl font-black text-primary tracking-tight">مجلس المحادثات</h3>
                 <p className="text-muted-foreground font-bold text-base opacity-60 leading-relaxed">اختر إحدى الجلسات لبدء حوار عائلي ممتع وآمن.</p>
               </div>
               <button onClick={() => setShowNew("chat")} className="btn-gold px-10 py-4 text-base rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">بدء مجلس جديد</button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <AnimatePresence>
        {showNew && meId && (
          <NewConversationDialog mode={showNew} meId={meId} profiles={profiles} onClose={() => setShowNew(null)} />
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
        "flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 relative overflow-hidden group/row border border-transparent",
        active
          ? "bg-primary text-white shadow-xl shadow-primary/10 border-primary"
          : "bg-card/50 hover:bg-card hover:border-border text-foreground shadow-sm"
      )}>

      <div className="relative shrink-0">
        <div className={cn("size-12 rounded-xl border transition-all relative", active ? "border-white/20 shadow-inner" : "border-gold-primary/10 shadow-sm")}>
           {item.conversation.kind === "group" ? (
             <div className="size-full flex items-center justify-center bg-muted rounded-xl overflow-hidden"><Users className={cn("size-5", active ? "text-white" : "text-primary")} /></div>
           ) : (
             <UserAvatar path={otherAvatarPath} name={title} initial={initial} className="size-full rounded-xl overflow-hidden" userId={other?.user_id ?? null} presenceDotClassName="absolute -bottom-1 -left-1 size-3.5 ring-2 ring-card shadow-lg z-20" />
           )}
        </div>
        {!active && item.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1.5 rounded-full bg-red-500 text-white text-[9px] font-black grid place-items-center border-2 border-card shadow-lg z-30">
            {item.unread}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className={cn("text-sm font-black truncate", active ? "text-white" : "text-primary")}>{title}</h3>
          <span className={cn("text-[9px] font-bold opacity-40", active ? "text-white" : "text-muted-foreground")}>
            {item.lastMessage ? chatTimeLabel(item.lastMessage.created_at) : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden">
          <p className={cn("text-[11px] font-bold truncate flex-1", active ? "text-white/70" : "text-muted-foreground")}>
            {lastMine && item.lastMessage && <CheckCheck className={cn("size-3 inline ml-1 opacity-50")} />}
            {messagePreview(item.lastMessage)}
          </p>
          {item.myParticipant?.muted && !active && <BellOff className="size-2.5 text-muted-foreground/30 shrink-0" />}
        </div>
      </div>
    </Link>
  );
}

function NewConversationDialog({ mode, meId, profiles, onClose }: { mode: "chat" | "group"; meId: string; profiles: Record<string, Profile>; onClose: () => void; }) {
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-card border border-border rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh]" dir="rtl">
        <div className="p-8 space-y-6 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-primary">{mode === "chat" ? "محادثة جديدة" : "مجلس عائلي جديد"}</h3>
            <button onClick={onClose} className="size-10 rounded-full hover:bg-muted text-muted-foreground transition-all flex items-center justify-center"><X size={20} /></button>
          </div>
          <div className="space-y-4">
            {mode === "group" && <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم المجلس..." className="w-full bg-muted border border-border rounded-xl px-5 py-3.5 font-bold text-sm" />}
            <div className="relative">
              <Search className="size-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن عضو..." className="w-full bg-muted border border-border rounded-xl pl-4 pr-11 py-3.5 font-bold text-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-4">
            {list.map((p) => (
              <button key={p.id} onClick={() => toggle(p.id)}
                className={cn("w-full flex items-center gap-4 px-4 py-3 rounded-2xl border-2 transition-all", selected.has(p.id) ? "border-primary bg-primary/5 shadow-sm" : "border-transparent hover:bg-muted")}>
                <div className="size-10 rounded-lg overflow-hidden border border-border"><UserAvatar path={p.avatar_url} name={displayName(p)} className="size-full" /></div>
                <span className={cn("text-sm font-black", selected.has(p.id) ? "text-primary" : "text-foreground")}>{displayName(p)}</span>
                {selected.has(p.id) && <div className="ms-auto size-5 rounded-full bg-primary flex items-center justify-center text-white"><Check size={12} strokeWidth={4} /></div>}
              </button>
            ))}
          </div>
          <button onClick={create} disabled={selected.size === 0 || busy} className="w-full btn-gold py-5 rounded-[24px] text-lg font-black shadow-xl disabled:opacity-50">
             {busy ? "جاري التأسيس..." : `تأكيد (${selected.size})`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
