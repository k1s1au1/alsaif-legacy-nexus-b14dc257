import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الرسائل — الصيف" },
      { name: "description", content: "محادثة العائلة المباشرة لجميع الأعضاء." },
    ],
  }),
  component: MessagesPage,
});

type Profile = { id: string; arabic_name: string | null; full_name: string | null };
type Message = { id: string; sender_id: string; body: string; created_at: string };

function roleLabel(r: string | null) {
  if (r === "admin") return "مسؤول النظام";
  if (r === "manager") return "مدير";
  return "عضو";
}

function displayName(p?: Profile) {
  return p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو";
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

function MessagesPage() {
  const [me, setMe] = useState<{ id: string; role: string | null } | null>(null);
  const [shellUser, setShellUser] = useState({ name: "عضو العائلة", role: "عضو", initial: "ص" });
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load: user, profile, role, profiles map, messages
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      const [{ data: profs }, { data: roles }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("id, arabic_name, full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(200),
      ]);

      const pmap: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => (pmap[p.id] = p as Profile));
      setProfiles(pmap);

      const myRoles = (roles ?? []).filter((r) => r.user_id === u.user!.id).map((r) => r.role);
      const admin = myRoles.includes("admin");
      setIsAdmin(admin);
      setMe({ id: u.user.id, role: admin ? "admin" : myRoles[0] ?? null });

      const myName = displayName(pmap[u.user.id]);
      setShellUser({
        name: myName,
        role: roleLabel(admin ? "admin" : myRoles[0] ?? null),
        initial: (myName[0] ?? "ص").toUpperCase(),
      });

      setMessages((msgs ?? []) as Message[]);
    })();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("messages-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
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
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as Message).id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !me || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({ sender_id: me.id, body });
    setSending(false);
    if (error) {
      toast.error("تعذّر إرسال الرسالة");
      return;
    }
    setDraft("");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast.error("تعذّر حذف الرسالة");
  }

  return (
    <AppShell title="الرسائل" user={shellUser}>
      <div className="flex flex-col h-[calc(100vh-9rem)] card-surface overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="eyebrow">القناة العامة</p>
            <h2 className="text-lg font-medium text-ivory mt-1">مجلس العائلة</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {messages.length} رسالة
          </span>
        </div>

        {/* Messages */}
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
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
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
                {isAdmin && (
                  <button
                    onClick={() => remove(m.id)}
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

        {/* Composer */}
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
    </AppShell>
  );
}
