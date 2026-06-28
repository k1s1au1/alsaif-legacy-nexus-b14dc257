import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Archive,
  Upload,
  Pin,
  PinOff,
  Trash2,
  Image as ImageIcon,
  Video as VideoIcon,
  Clock,
  Users,
  CalendarDays,
  Sparkles,
  Plane,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/archive")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الأرشيف — السيف" },
      { name: "description", content: "أرشيف صور وفيديوهات العائلة." },
    ],
  }),
  component: ArchivePage,
});

type SectionKey = "family" | "meetings" | "events" | "trips";

type ArchiveItem = {
  id: string;
  uploader_id: string;
  media_type: "image" | "video";
  storage_path: string;
  caption: string | null;
  pinned: boolean;
  expires_at: string | null;
  created_at: string;
  section: SectionKey;
};

type ItemWithUrl = ArchiveItem & { url: string; uploaderName: string };

const SECTIONS: {
  key: SectionKey;
  label: string;
  icon: typeof Users;
  hint: string;
  privOnly: boolean;
}[] = [
  { key: "family", label: "العائلة", icon: Users, hint: "متاح لجميع الأعضاء — تُحذف الوسائط تلقائياً خلال 3 أيام كحد أقصى.", privOnly: false },
  { key: "meetings", label: "الاجتماعات", icon: CalendarDays, hint: "الرفع والحذف لمسؤولين الأقسام والمسؤولين التقنيين فقط.", privOnly: true },
  { key: "events", label: "المهام", icon: Sparkles, hint: "الرفع والحذف لمسؤولين الأقسام والمسؤولين التقنيين فقط.", privOnly: true },
  { key: "trips", label: "الترفيه", icon: Plane, hint: "الرفع والحذف لمسؤولين الأقسام والمسؤولين التقنيين فقط.", privOnly: true },
];

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول تقني";
  if (role === "manager") return "مسؤول قسم";
  if (role === "chairman") return "رئيس المجلس";
  return "عضو";
}

function daysLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

const MAX_BYTES = 50 * 1024 * 1024;

function ArchivePage() {
  const [profile, setProfile] = useState({
    name: "عضو العائلة",
    role: "عضو",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [me, setMe] = useState<{ id: string; isPriv: boolean } | null>(null);
  const [items, setItems] = useState<ItemWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("family");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from("archive_items")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذر تحميل الأرشيف");
      setLoading(false);
      return;
    }

    const uploaderIds = [...new Set((rows ?? []).map((r) => r.uploader_id))];
    const { data: profs } = uploaderIds.length
      ? await supabase.from("profiles").select("id, arabic_name, full_name").in("id", uploaderIds)
      : { data: [] as { id: string; arabic_name: string | null; full_name: string | null }[] };
    const nameMap = new Map((profs ?? []).map((p) => [p.id, p.arabic_name || p.full_name || "عضو"]));

    const withUrls = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: signed } = await supabase.storage
          .from("archive-media")
          .createSignedUrl(r.storage_path, 60 * 60);
        return {
          ...(r as ArchiveItem),
          url: signed?.signedUrl ?? "",
          uploaderName: nameMap.get(r.uploader_id) ?? "عضو",
        };
      }),
    );
    setItems(withUrls);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const name = p?.arabic_name?.trim() || p?.full_name?.trim() || u.user.email?.split("@")[0] || "عضو العائلة";
      const rs = (roles ?? []).map((r) => r.role);
      setProfile({
        name,
        role: roleLabel(rs[0] ?? null),
        initial: (name[0] ?? "س").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
      });
      setMe({ id: u.user.id, isPriv: rs.includes("admin") || rs.includes("manager") || rs.includes("chairman") });
      await load();
    })();

    const ch = supabase
      .channel("archive-items-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "archive_items" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const currentSection = SECTIONS.find((s) => s.key === activeSection)!;
  const canUpload = !!me && (!currentSection.privOnly || me.isPriv);
  const filtered = useMemo(() => items.filter((i) => i.section === activeSection), [items, activeSection]);
  const counts = useMemo(() => {
    const c: Record<SectionKey, number> = { family: 0, meetings: 0, events: 0, trips: 0 };
    for (const it of items) c[it.section] = (c[it.section] ?? 0) + 1;
    return c;
  }, [items]);

  async function onPickFiles(files: FileList | null) {
    if (!files || !files.length || !me) return;
    if (!canUpload) {
      toast.error("لا تملك صلاحية الرفع في هذا القسم");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: الحجم يتجاوز 50 ميجابايت`);
          continue;
        }
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isImage && !isVideo) {
          toast.error(`${file.name}: نوع غير مدعوم`);
          continue;
        }
        const ext = file.name.split(".").pop() || (isImage ? "jpg" : "mp4");
        const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("archive-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`فشل رفع ${file.name}`);
          continue;
        }
        const { error: insErr } = await supabase.from("archive_items").insert({
          uploader_id: me.id,
          media_type: isImage ? "image" : "video",
          storage_path: path,
          caption: null,
          section: activeSection,
        });
        if (insErr) {
          await supabase.storage.from("archive-media").remove([path]);
          toast.error(`فشل حفظ ${file.name}`);
        }
      }
      toast.success("تم رفع الملفات");
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function togglePin(item: ItemWithUrl) {
    const { error } = await supabase
      .from("archive_items")
      .update({ pinned: !item.pinned })
      .eq("id", item.id);
    if (error) toast.error("تعذر التحديث");
  }

  async function removeItem(item: ItemWithUrl) {
    if (!confirm("هل تريد حذف هذا العنصر نهائياً؟")) return;
    const { error } = await supabase.from("archive_items").delete().eq("id", item.id);
    if (error) {
      toast.error("تعذر الحذف");
      return;
    }
    await supabase.storage.from("archive-media").remove([item.storage_path]);
    toast.success("تم الحذف");
  }

  const canManage = (item: ItemWithUrl) => {
    if (!me) return false;
    if (item.section === "family") return me.isPriv || item.uploader_id === me.id;
    return me.isPriv;
  };

  return (
    <AppShell title="الأرشيف" user={profile}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-card/60 border border-border">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-gold-primary/10 ring-1 ring-gold-primary/30 grid place-items-center">
              <Archive className="size-5 text-gold-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-medium text-ivory">أرشيف العائلة</h2>
              <p className="text-xs text-muted-foreground">{currentSection.hint}</p>
            </div>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !canUpload}
              title={!canUpload ? "غير متاح في هذا القسم" : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary text-navy-base text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {canUpload ? <Upload className="size-4" strokeWidth={1.8} /> : <Lock className="size-4" strokeWidth={1.8} />}
              {uploading ? "جارٍ الرفع…" : "رفع وسائط"}
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.key === activeSection;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition ${
                  active
                    ? "bg-gold-primary/10 border-gold-primary/40 text-ivory"
                    : "bg-card/40 border-border text-muted-foreground hover:text-ivory"
                }`}
              >
                <Icon className="size-4" strokeWidth={1.6} />
                <span className="font-medium">{s.label}</span>
                <span className="ms-auto text-xs opacity-70">{counts[s.key]}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-16">جارٍ التحميل…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border">
            <Archive className="size-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.2} />
            <p className="text-sm text-muted-foreground">لا توجد عناصر في هذا القسم بعد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const left = daysLeft(item.expires_at);
              return (
                <article
                  key={item.id}
                  className="group relative rounded-xl overflow-hidden border border-border bg-card/50"
                >
                  <div className="aspect-video bg-secondary/30 grid place-items-center overflow-hidden">
                    {item.media_type === "image" ? (
                      <img src={item.url} alt={item.caption ?? ""} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <video src={item.url} controls playsInline className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {item.media_type === "image" ? (
                          <ImageIcon className="size-3.5" strokeWidth={1.5} />
                        ) : (
                          <VideoIcon className="size-3.5" strokeWidth={1.5} />
                        )}
                        {item.uploaderName}
                      </span>
                      {item.pinned ? (
                        <span className="inline-flex items-center gap-1 text-gold-primary">
                          <Pin className="size-3.5" strokeWidth={1.8} />
                          مثبت
                        </span>
                      ) : left !== null ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Clock className="size-3.5" strokeWidth={1.5} />
                          متبقي {left} يوم
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">دائم</span>
                      )}
                    </div>
                    {canManage(item) && (
                      <div className="flex items-center gap-2 pt-1">
                        {item.section === "family" && (
                          <button
                            onClick={() => togglePin(item)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs bg-secondary/60 hover:bg-secondary text-ivory"
                          >
                            {item.pinned ? (
                              <>
                                <PinOff className="size-3.5" strokeWidth={1.5} />
                                إلغاء التثبيت
                              </>
                            ) : (
                              <>
                                <Pin className="size-3.5" strokeWidth={1.5} />
                                تثبيت
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => removeItem(item)}
                          className={`${item.section === "family" ? "" : "flex-1"} inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs bg-destructive/15 hover:bg-destructive/25 text-destructive`}
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.5} />
                          حذف
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
