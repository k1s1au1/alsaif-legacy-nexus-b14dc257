import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  ArrowRight,
  Hash,
  Lock,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  UserPlus,
  X,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/$roomId")({
  ssr: false,
  component: RoomPage,
});

type Profile = { id: string; arabic_name: string | null; full_name: string | null };
type Message = { id: string; sender_id: string; body: string; created_at: string; room_id: string };
type Room = {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_by: string | null;
};
type RoomMember = { id: string; user_id: string; room_role: "owner" | "admin" | "member" };

function displayName(p?: Profile) {
  return p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو";
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}
function roomRoleLabel(r: string) {
  if (r === "owner") return "المالك";
  if (r === "admin") return "مشرف";
  return "عضو";
}

function RoomPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();

  const [me, setMe] = useState<{ id: string } | null>(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [shellUser, setShellUser] = useState({ name: "عضو العائلة", role: "عضو", initial: "ص" });
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const myMembership = useMemo(
    () => members.find((m) => m.user_id === me?.id),
    [members, me?.id],
  );
  const canManage = isGlobalAdmin || myMembership?.room_role === "owner" || myMembership?.room_role === "admin";

  async function loadAll() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setMe({ id: u.user.id });

    const [{ data: roles }, { data: r }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase.from("chat_rooms").select("*").eq("id", roomId).maybeSingle(),
      supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle(),
    ]);

    const admin = (roles ?? []).some((rr) => rr.role === "admin");
    setIsGlobalAdmin(admin);
    const name =
      prof?.arabic_name?.trim() || prof?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو";
    setShellUser({
      name,
      role: admin ? "مسؤول النظام" : "عضو",
      initial: (name[0] ?? "ص").toUpperCase(),
    });

    if (!r) {
      setNotFound(true);
      return;
    }
    setRoom(r as Room);

    const [{ data: mems }, { data: msgs }, { data: allProfs }] = await Promise.all([
      supabase.from("chat_room_members").select("id, user_id, room_role").eq("room_id", roomId),
      supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(300),
      supabase.from("profiles").select("id, arabic_name, full_name"),
    ]);

    setMembers((mems ?? []) as RoomMember[]);
    setMessages((msgs ?? []) as Message[]);

    const pmap: Record<string, Profile> = {};
    (allProfs ?? []).forEach((p) => (pmap[p.id] = p as Profile));
    setProfiles(pmap);
  }

  useEffect(() => {
    setRoom(null);
    setMessages([]);
    setMembers([]);
    setNotFound(false);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Realtime: messages for this room
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id)
              ? prev
              : [...prev, payload.new as Message],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as Message).id));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_room_members",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          supabase
            .from("chat_room_members")
            .select("id, user_id, room_role")
            .eq("room_id", roomId)
            .then(({ data }) => setMembers((data ?? []) as RoomMember[]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !me || sending || !room) return;
    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ sender_id: me.id, body, room_id: room.id });
    setSending(false);
    if (error) {
      toast.error("تعذّر إرسال الرسالة");
      return;
    }
    setDraft("");
  }

  async function deleteMessage(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast.error("تعذّر حذف الرسالة");
  }

  async function removeMember(memberRowId: string, userId: string) {
    if (userId === room?.created_by) {
      toast.error("لا يمكن إزالة مالك الغرفة");
      return;
    }
    const { error } = await supabase.from("chat_room_members").delete().eq("id", memberRowId);
    if (error) toast.error("تعذّر إزالة العضو");
    else toast.success("تمت الإزالة");
  }

  if (notFound) {
    return (
      <AppShell title="الرسائل" user={shellUser}>
        <div className="card-surface p-10 text-center space-y-4">
          <p className="text-ivory">الغرفة غير موجودة أو ليست لديك صلاحية الوصول إليها.</p>
          <Link
            to="/messages"
            className="inline-flex items-center gap-2 text-sm text-gold-primary hover:underline"
          >
            <ArrowRight className="size-4" />
            العودة إلى الغرف
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!room) {
    return (
      <AppShell title="الرسائل" user={shellUser}>
        <div className="card-surface p-10 text-center text-sm text-muted-foreground">
          جارٍ التحميل...
        </div>
      </AppShell>
    );
  }

  const sortedMembers = [...members].sort((a, b) => {
    const order = { owner: 0, admin: 1, member: 2 };
    if (order[a.room_role] !== order[b.room_role]) return order[a.room_role] - order[b.room_role];
    return displayName(profiles[a.user_id]).localeCompare(displayName(profiles[b.user_id]), "ar");
  });

  return (
    <AppShell title="الرسائل" user={shellUser}>
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-9rem)]">
        {/* Conversation */}
        <div className="flex flex-col flex-1 card-surface overflow-hidden min-h-0">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate({ to: "/messages" })}
                className="size-9 grid place-items-center rounded-lg text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition shrink-0"
                aria-label="العودة"
              >
                <ArrowRight className="size-4" strokeWidth={1.5} />
              </button>
              <div
                className={`size-10 rounded-xl grid place-items-center shrink-0 ${
                  room.is_private
                    ? "bg-secondary/60 text-ivory ring-1 ring-border"
                    : "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                }`}
              >
                {room.is_private ? (
                  <Lock className="size-4" strokeWidth={1.5} />
                ) : (
                  <Hash className="size-4" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0">
                <p className="eyebrow">{room.is_private ? "غرفة خاصة" : "قناة عامة"}</p>
                <h2 className="text-lg font-medium text-ivory mt-0.5 truncate">{room.name}</h2>
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {messages.length} رسالة
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-4">
            {messages.length === 0 && (
              <div className="h-full grid place-items-center text-center text-muted-foreground text-sm">
                لا توجد رسائل بعد — كن أول من يبدأ المحادثة.
              </div>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === me?.id;
              const author = profiles[m.sender_id];
              const name = displayName(author);
              const initial = (name[0] ?? "ص").toUpperCase();
              const canDelete = isGlobalAdmin || canManage;
              return (
                <div
                  key={m.id}
                  className={`group flex items-end gap-3 ${mine ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`size-9 rounded-full grid place-items-center text-xs font-medium shrink-0 ${
                      mine
                        ? "bg-gold-primary text-navy-base"
                        : "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                    }`}
                  >
                    {initial}
                  </div>
                  <div
                    className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}
                  >
                    <div className="flex items-center gap-2 mb-1 text-[11px] text-muted-foreground">
                      <span className="font-medium text-ivory/70">{mine ? "أنت" : name}</span>
                      <span>{timeLabel(m.created_at)}</span>
                    </div>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        mine
                          ? "bg-gold-primary text-navy-base rounded-br-sm"
                          : "bg-secondary/60 text-ivory ring-1 ring-border rounded-bl-sm"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => deleteMessage(m.id)}
                      className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-red-400 p-1"
                      aria-label="حذف الرسالة"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={send}
            className="border-t border-border px-4 lg:px-6 py-4 flex items-center gap-3 bg-card/60"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="اكتب رسالتك..."
              maxLength={4000}
              disabled={!me || sending}
              className="flex-1 bg-background/60 border border-border rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
            />
            <button
              type="submit"
              disabled={!draft.trim() || !me || sending}
              className="inline-flex items-center gap-2 px-5 py-3 bg-gold-primary text-navy-base text-sm font-semibold rounded-xl hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="size-4" strokeWidth={2} />
              <span className="hidden sm:inline">إرسال</span>
            </button>
          </form>
        </div>

        {/* Members panel */}
        <aside className="card-surface w-full lg:w-72 shrink-0 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="eyebrow">الأعضاء</p>
              <h3 className="text-sm font-medium text-ivory mt-1 flex items-center gap-1.5">
                <Users className="size-3.5" strokeWidth={1.5} />
                {members.length}
              </h3>
            </div>
            {canManage && (
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 text-xs text-gold-primary hover:brightness-110 px-3 py-1.5 rounded-lg bg-gold-primary/10 ring-1 ring-gold-primary/20"
              >
                <UserPlus className="size-3.5" strokeWidth={1.5} />
                إضافة
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {sortedMembers.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">لا يوجد أعضاء بعد.</p>
            )}
            {sortedMembers.map((m) => {
              const name = displayName(profiles[m.user_id]);
              const initial = (name[0] ?? "ص").toUpperCase();
              const isOwner = m.room_role === "owner";
              const isAdmin = m.room_role === "admin";
              const isMe = m.user_id === me?.id;
              return (
                <div
                  key={m.id}
                  className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/40 transition"
                >
                  <div
                    className={`size-8 rounded-full grid place-items-center text-xs font-medium shrink-0 ${
                      isOwner || isAdmin
                        ? "bg-gold-primary text-navy-base"
                        : "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                    }`}
                  >
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ivory truncate flex items-center gap-1.5">
                      {name}
                      {isMe && <span className="text-[10px] text-muted-foreground">(أنت)</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {isOwner && <Crown className="size-3" strokeWidth={1.5} />}
                      {isAdmin && <ShieldCheck className="size-3" strokeWidth={1.5} />}
                      {roomRoleLabel(m.room_role)}
                    </div>
                  </div>
                  {canManage && !isOwner && !isMe && (
                    <button
                      onClick={() => removeMember(m.id, m.user_id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition p-1"
                      aria-label="إزالة العضو"
                    >
                      <X className="size-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {showAdd && room && (
        <AddMemberDialog
          roomId={room.id}
          existing={new Set(members.map((m) => m.user_id))}
          onClose={() => setShowAdd(false)}
          onAdded={() => setShowAdd(false)}
        />
      )}
    </AppShell>
  );
}

function AddMemberDialog({
  roomId,
  existing,
  onClose,
  onAdded,
}: {
  roomId: string;
  existing: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, arabic_name, full_name")
      .then(({ data }) => setProfiles((data ?? []) as Profile[]));
  }, []);

  const candidates = profiles
    .filter((p) => !existing.has(p.id))
    .filter((p) => {
      if (!q.trim()) return true;
      const name = displayName(p).toLowerCase();
      return name.includes(q.toLowerCase());
    });

  async function add(userId: string) {
    setBusy(userId);
    const { error } = await supabase
      .from("chat_room_members")
      .insert({ room_id: roomId, user_id: userId, room_role: "member" });
    setBusy(null);
    if (error) {
      toast.error("تعذّر إضافة العضو");
      return;
    }
    toast.success("تمت الإضافة");
    onAdded();
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
          <h3 className="text-lg font-medium text-ivory">إضافة عضو</h3>
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
          {candidates.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">
              لا يوجد أعضاء متاحون للإضافة.
            </p>
          )}
          {candidates.map((p) => {
            const name = displayName(p);
            const initial = (name[0] ?? "ص").toUpperCase();
            return (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                disabled={busy === p.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/40 transition text-right disabled:opacity-40"
              >
                <div className="size-8 rounded-full bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20 grid place-items-center text-xs font-medium shrink-0">
                  {initial}
                </div>
                <span className="flex-1 text-sm text-ivory truncate">{name}</span>
                <UserPlus className="size-4 text-gold-primary" strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
