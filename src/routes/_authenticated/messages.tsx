import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Hash, Lock, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الرسائل — الصيف" },
      { name: "description", content: "غرف المحادثة العامة والخاصة لأفراد العائلة." },
    ],
  }),
  component: MessagesIndex,
});

type Room = {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_at: string;
};

function MessagesIndex() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [shellUser, setShellUser] = useState({ name: "عضو العائلة", role: "عضو", initial: "ص" });
  const [showCreate, setShowCreate] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setMeId(u.user.id);

    const [{ data: rs }, { data: roles }, { data: prof }, { data: counts }] = await Promise.all([
      supabase.from("chat_rooms").select("*").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle(),
      supabase.from("chat_room_members").select("room_id"),
    ]);

    const admin = (roles ?? []).some((r) => r.role === "admin");
    setIsAdmin(admin);
    setRooms((rs ?? []) as Room[]);

    const cmap: Record<string, number> = {};
    (counts ?? []).forEach((c: { room_id: string }) => {
      cmap[c.room_id] = (cmap[c.room_id] ?? 0) + 1;
    });
    setCounts(cmap);

    const name =
      prof?.arabic_name?.trim() || prof?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو";
    setShellUser({
      name,
      role: admin ? "مسؤول النظام" : "عضو",
      initial: (name[0] ?? "ص").toUpperCase(),
    });
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("rooms-index")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_rooms" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_room_members" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="الرسائل" user={shellUser}>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">قاعات المجلس</p>
            <h2 className="text-2xl font-medium text-ivory mt-2">غرف المحادثة</h2>
            <p className="text-sm text-muted-foreground mt-2">
              اختر غرفة عامة للجميع أو غرفة خاصة تم دعوتك إليها.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold-primary text-navy-base text-sm font-semibold rounded-xl hover:brightness-110 transition"
            >
              <Plus className="size-4" strokeWidth={2} />
              غرفة جديدة
            </button>
          )}
        </div>

        {rooms.length === 0 && (
          <div className="card-surface p-10 text-center text-sm text-muted-foreground">
            لا توجد غرف متاحة لك بعد.
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((r) => (
            <Link
              key={r.id}
              to="/messages/$roomId"
              params={{ roomId: r.id }}
              className="card-surface p-5 hover:ring-1 hover:ring-gold-primary/40 transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`size-10 rounded-xl grid place-items-center ${
                    r.is_private
                      ? "bg-secondary/60 text-ivory ring-1 ring-border"
                      : "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                  }`}
                >
                  {r.is_private ? (
                    <Lock className="size-4" strokeWidth={1.5} />
                  ) : (
                    <Hash className="size-4" strokeWidth={1.5} />
                  )}
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${
                    r.is_private
                      ? "bg-secondary/60 text-muted-foreground"
                      : "bg-gold-primary/10 text-gold-primary"
                  }`}
                >
                  {r.is_private ? "خاصة" : "عامة"}
                </span>
              </div>
              <h3 className="text-base font-medium text-ivory group-hover:text-gold-primary transition">
                {r.name}
              </h3>
              {r.description && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                  {r.description}
                </p>
              )}
              <div className="mt-4 pt-3 border-t border-border flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Users className="size-3.5" strokeWidth={1.5} />
                {counts[r.id] ?? 0} {(counts[r.id] ?? 0) === 1 ? "عضو" : "أعضاء"}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {showCreate && meId && (
        <CreateRoomDialog
          meId={meId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

function CreateRoomDialog({
  meId,
  onClose,
  onCreated,
}: {
  meId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.from("chat_rooms").insert({
      name: name.trim(),
      description: description.trim() || null,
      is_private: isPrivate,
      created_by: meId,
    });
    setBusy(false);
    if (error) {
      toast.error("تعذّر إنشاء الغرفة");
      return;
    }
    toast.success("تم إنشاء الغرفة");
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 bg-navy-base/80 backdrop-blur-sm grid place-items-center z-[100] p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={create}
        className="card-surface w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-ivory">غرفة جديدة</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-ivory"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">اسم الغرفة</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            className="w-full bg-background/60 border border-border rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-primary/40"
            placeholder="مثل: لجنة الفعاليات"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">وصف مختصر (اختياري)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={2}
            className="w-full bg-background/60 border border-border rounded-xl px-4 py-3 text-sm text-ivory placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold-primary/40 resize-none"
          />
        </div>
        <label className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border cursor-pointer">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="size-4 accent-gold-primary"
          />
          <div className="flex-1">
            <div className="text-sm text-ivory flex items-center gap-2">
              <Lock className="size-3.5" strokeWidth={1.5} />
              غرفة خاصة
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              مرئية فقط للأعضاء الذين تتم إضافتهم.
            </p>
          </div>
        </label>
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="w-full px-4 py-3 bg-gold-primary text-navy-base text-sm font-semibold rounded-xl hover:brightness-110 transition disabled:opacity-40"
        >
          {busy ? "جاري الإنشاء..." : "إنشاء الغرفة"}
        </button>
      </form>
    </div>
  );
}
