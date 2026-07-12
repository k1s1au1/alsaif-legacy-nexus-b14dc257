import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import {
  Archive,
  Upload,
  Pin,
  PinOff,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  Clock,
  Users,
  CalendarDays,
  Sparkles,
  Plane,
  Lock,
  Plus,
  X,
  Play,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  MoreVertical,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSiteLogo } from "@/hooks/use-site-logo";

export const Route = createFileRoute("/_authenticated/archive")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الألبوم العائلي — السيف" },
      { name: "description", content: "أرشيف الصور ومقاطع الفيديو التذكارية لعائلة السيف." },
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

type ItemWithUrl = ArchiveItem & { url: string; uploaderName: string; avatar_url?: string | null };

const SECTIONS: {
  key: SectionKey;
  label: string;
  icon: any;
  hint: string;
  privOnly: boolean;
  gradient: string;
}[] = [
  {
    key: "family",
    label: "ألبوم العائلة",
    icon: Users,
    hint: "لحظاتنا اليومية العفوية التي تجمعنا سوياً.",
    privOnly: false,
    gradient: "from-blue-500/20 to-indigo-500/20",
  },
  {
    key: "meetings",
    label: "الاجتماعات",
    icon: CalendarDays,
    hint: "توثيق الاجتماعات الدورية واللقاءات الرسمية.",
    privOnly: true,
    gradient: "from-amber-500/20 to-orange-500/20",
  },
  {
    key: "events",
    label: "المناسبات",
    icon: Sparkles,
    hint: "أفراح العائلة، الأعياد، والمناسبات الكبرى.",
    privOnly: true,
    gradient: "from-rose-500/20 to-pink-500/20",
  },
  {
    key: "trips",
    label: "الترفيه",
    icon: Plane,
    hint: "أرشيف الرحلات العائلية، الكشتات، والمغامرات.",
    privOnly: true,
    gradient: "from-emerald-500/20 to-teal-500/20",
  },
];

function daysLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(ms / 86400000));
  return days;
}

const MAX_BYTES = 50 * 1024 * 1024;

function ArchivePage() {
  const [profile, setProfile] = useState({
    name: "...",
    role: "...",
    initial: "ص",
    avatarPath: null as string | null,
  });
  const [me, setMe] = useState<{ id: string; isPriv: boolean } | null>(null);
  const [items, setItems] = useState<ItemWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("family");
  const [selectedItem, setSelectedItem] = useState<ItemWithUrl | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dynamicLogo = useSiteLogo();
  const { userId, primaryRole } = useUserRole();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("archive_items")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const uploaderIds = [...new Set((rows ?? []).map((r) => r.uploader_id))];
      const { data: profs } = uploaderIds.length
        ? await supabase
            .from("profiles")
            .select("id, arabic_name, full_name, avatar_url")
            .in("id", uploaderIds)
        : { data: [] };

      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

      const withUrls = await Promise.all(
        (rows ?? []).map(async (r) => {
          const { data: signed } = await supabase.storage
            .from("archive-media")
            .createSignedUrl(r.storage_path, 60 * 60);

          const p = profMap.get(r.uploader_id) as any;
          return {
            ...(r as ArchiveItem),
            url: signed?.signedUrl ?? "",
            uploaderName: p?.arabic_name || p?.full_name || "عضو",
            avatar_url: p?.avatar_url,
          };
        }),
      );
      setItems(withUrls);
    } catch (err) {
      console.error("Archive load error:", err);
      toast.error("فشل تحميل الألبوم");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, arabic_name, full_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at",
          )
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      const name =
        p?.arabic_name?.trim() ||
        p?.full_name?.trim() ||
        u.user.email?.split("@")[0] ||
        "عضو العائلة";
      const rs = (roles ?? []).map((r) => r.role);
      setProfile({
        name,
        role: roleLabel(
          rs.includes("admin")
            ? "admin"
            : rs.includes("chairman")
              ? "chairman"
              : rs.includes("manager")
                ? "manager"
                : "member",
        ),
        initial: (name[0] ?? "س").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
      });
      setMe({
        id: u.user.id,
        isPriv: rs.includes("admin") || rs.includes("manager") || rs.includes("chairman"),
      });
      await load();
    })();

    const ch = supabase
      .channel("archive-items-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "archive_items" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const currentSection = SECTIONS.find((s) => s.key === activeSection)!;
  const canUpload = !!me && (!currentSection.privOnly || me.isPriv);
  const filtered = useMemo(
    () => items.filter((i) => i.section === activeSection),
    [items, activeSection],
  );

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
    toast.loading("جاري رفع الوسائط للألبوم...");
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
      toast.dismiss();
      toast.success("تم تحديث الألبوم بنجاح ✨");
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
    else load();
  }

  async function removeItem(item: ItemWithUrl) {
    if (!confirm("هل تريد حذف هذا الذكرى نهائياً؟")) return;
    const { error } = await supabase.from("archive_items").delete().eq("id", item.id);
    if (error) {
      toast.error("تعذر الحذف");
      return;
    }
    await supabase.storage.from("archive-media").remove([item.storage_path]);
    toast.success("تم حذف الذكرى");
    if (selectedItem?.id === item.id) setSelectedItem(null);
    load();
  }

  const canManage = (item: ItemWithUrl) => {
    if (!me) return false;
    if (item.section === "family") return me.isPriv || item.uploader_id === me.id;
    return me.isPriv;
  };

  return (
    <AppShell title="الألبوم العائلي" user={profile}>
      <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4 md:px-0" dir="rtl">
        {/* Immersive Header Banner */}
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[44px] md:rounded-[60px] bg-[#0d1a16] border border-white/5 shadow-2xl group min-h-[300px] md:min-h-[400px] flex items-center p-8 md:p-20">
            {/* Mesh background effect */}
            <div className="absolute inset-0 z-0">
              <div className="absolute top-0 right-0 size-[500px] bg-gold-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 animate-pulse" />
              <div className="absolute bottom-0 left-0 size-[400px] bg-blue-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />
              {/* Decorative Logo */}
              <div className="absolute left-10 md:left-20 top-1/2 -translate-y-1/2 opacity-[0.03] md:opacity-[0.05] pointer-events-none transition-transform duration-[2000ms] group-hover:scale-110">
                <div
                  className="size-48 md:size-[450px] logo-alsaif-banner"
                  style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
                />
              </div>
            </div>

            <div className="relative z-10 w-full flex flex-col md:flex-row md:items-center justify-between gap-10">
              <div className="space-y-6 md:space-y-8 text-center md:text-right flex-1">
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <div className="h-0.5 w-12 bg-gold-primary/60 shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.5em] text-gold-primary">
                    ذاكرة السيف
                  </span>
                </div>
                <div className="space-y-3">
                  <h2 className="text-4xl md:text-8xl font-black tracking-tighter leading-none text-white drop-shadow-2xl">
                    ألبوم
                    <br />
                    <span className="text-white/20">العائلة</span>
                  </h2>
                  <p className="text-sm md:text-2xl font-bold text-white/50 max-w-2xl leading-relaxed">
                    أرشيف ملكي يجمع ذكرياتنا، رحلاتنا، وأجمل اللحظات التي عشناها سوياً عبر السنين.
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-center md:self-auto flex flex-col items-center gap-6">
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
                  className="group/up relative p-1 rounded-full bg-gradient-to-br from-gold-primary to-amber-700 shadow-2xl active:scale-95 transition-all"
                >
                  <div className="bg-navy-base group-hover/up:bg-transparent rounded-full px-8 py-5 md:px-12 md:py-7 flex items-center gap-4 transition-colors">
                    {uploading ? (
                      <Loader2 className="size-6 md:size-8 animate-spin text-gold-primary" />
                    ) : (
                      <Plus
                        className="size-6 md:size-8 text-gold-primary group-hover/up:text-white transition-colors"
                        strokeWidth={3}
                      />
                    )}
                    <span className="text-base md:text-2xl font-black text-white">
                      {uploading ? "جاري الرفع..." : "إضافة ذكرى"}
                    </span>
                  </div>
                </button>
                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/10 text-white/40">
                  <Archive size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {items.length} عنصر في الأرشيف
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <QuickActionsBanner />

        {/* Dynamic Navigation Tabs */}
        <div
          className="flex flex-col md:flex-row items-center justify-between gap-8 animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex items-center gap-3 p-2 bg-muted/40 backdrop-blur-2xl rounded-[32px] border border-border/40 overflow-x-auto no-scrollbar w-full md:w-auto shadow-inner">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = s.key === activeSection;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={cn(
                    "relative px-6 py-4 rounded-[24px] text-sm font-black transition-all duration-500 flex items-center gap-3 shrink-0 whitespace-nowrap overflow-hidden group/tab",
                    active ? "text-white scale-105" : "text-muted-foreground hover:text-primary",
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="archive-tab-active"
                      className={cn(
                        "absolute inset-0 bg-primary shadow-xl",
                        s.key === "family" && "bg-blue-600",
                        s.key === "meetings" && "bg-amber-600",
                        s.key === "events" && "bg-rose-600",
                        s.key === "trips" && "bg-emerald-600",
                      )}
                    />
                  )}
                  <Icon
                    className={cn(
                      "size-5 relative z-10 transition-transform group-hover/tab:scale-110",
                      active ? "text-white" : "text-muted-foreground",
                    )}
                  />
                  <span className="relative z-10">{s.label}</span>
                  <span
                    className={cn(
                      "relative z-10 px-2 py-0.5 rounded-lg text-[10px] font-black",
                      active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[s.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="px-6 py-3 rounded-2xl bg-gold-primary/5 border border-gold-primary/10 flex items-center gap-4 max-w-sm">
            <div className="size-10 rounded-xl bg-gold-primary/20 flex items-center justify-center text-gold-primary shrink-0">
              <Clock className="size-5" />
            </div>
            <p className="text-[11px] md:text-xs font-bold text-gold-primary/80 leading-relaxed italic">
              {currentSection.hint}
            </p>
          </div>
        </div>

        {/* Gallery Grid */}
        {loading ? (
          <div className="py-40 flex flex-col items-center gap-4 text-primary opacity-20">
            <Loader2 className="size-16 animate-spin" strokeWidth={3} />
            <p className="font-black tracking-[0.3em] uppercase text-xs">جاري جلب الذكريات...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-40 flex flex-col items-center text-center gap-8 animate-fade-up">
            <div className="size-32 rounded-[50px] bg-muted/20 border-4 border-dashed border-border/40 flex items-center justify-center text-muted-foreground opacity-20">
              <Archive size={60} />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-primary">الألبوم شاغر حالياً</h3>
              <p className="text-muted-foreground font-bold">
                كن أول من يوثق لحظات {currentSection.label}.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8 animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            {filtered.map((item, idx) => (
              <MediaCard
                key={item.id}
                item={item}
                index={idx}
                onView={() => setSelectedItem(item)}
                canManage={canManage(item)}
                onTogglePin={() => togglePin(item)}
                onDelete={() => removeItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cinema Mode Lightbox */}
      <AnimatePresence>
        {selectedItem && (
          <CinemaMode
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onDelete={canManage(selectedItem) ? () => removeItem(selectedItem) : undefined}
            onDownload={() => window.open(selectedItem.url, "_blank")}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function MediaCard({ item, index, onView, canManage, onTogglePin, onDelete }: any) {
  const left = daysLeft(item.expires_at);
  const isVideo = item.media_type === "video";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="group relative aspect-[4/5] rounded-[32px] md:rounded-[40px] overflow-hidden bg-muted cursor-pointer shadow-xl border border-white/5"
      onClick={onView}
    >
      <div className="absolute inset-0 z-0">
        {isVideo ? (
          <div className="size-full relative">
            <video src={item.url} className="size-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play className="size-12 text-white/80 fill-white/20" />
            </div>
          </div>
        ) : (
          <img
            src={item.url}
            className="size-full object-cover transition-transform duration-1000 group-hover:scale-110"
            alt=""
            loading="lazy"
          />
        )}
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-40 transition-opacity" />
      </div>

      {/* Badges */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
        {item.pinned && (
          <div className="px-3 py-1 rounded-full bg-gold-primary text-black text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 animate-bounce">
            <Pin size={10} fill="currentColor" /> مثبت
          </div>
        )}
        {left !== null && (
          <div
            className={cn(
              "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md border",
              left <= 1
                ? "bg-rose-500 text-white border-rose-400"
                : "bg-white/10 text-white border-white/20",
            )}
          >
            {left === 0 ? "يُحذف قريباً" : `بقي ${left} أيام`}
          </div>
        )}
      </div>

      {/* Floating UI */}
      <div className="absolute inset-0 z-10 p-6 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-all duration-500">
        <div className="flex justify-end gap-2">
          {canManage && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}
                className="size-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-gold-primary hover:text-black transition-all shadow-xl"
              >
                {item.pinned ? <PinOff size={18} /> : <Pin size={18} />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="size-10 rounded-2xl bg-rose-500/20 backdrop-blur-md border border-rose-500/30 text-rose-300 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-xl"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
          <div className="size-12 rounded-[18px] border-2 border-white shadow-2xl overflow-hidden shrink-0">
            <img
              src={
                item.avatar_url ||
                "https://api.dicebear.com/7.x/avataaars/svg?seed=" + item.uploaderName
              }
              className="size-full object-cover"
              alt=""
            />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">بواسطة</p>
            <p className="text-xs font-black text-white truncate drop-shadow-md">
              {item.uploaderName}
            </p>
          </div>
          <div className="ms-auto">
            <Maximize2 size={16} className="text-white/60" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CinemaMode({ item, onClose, onDelete, onDownload }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center"
      dir="rtl"
    >
      {/* Controls Top */}
      <div className="absolute top-0 inset-x-0 p-6 md:p-10 flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          <button
            onClick={onClose}
            className="size-14 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all shadow-2xl active:scale-95"
          >
            <X size={28} />
          </button>
          <div className="hidden md:block">
            <h4 className="text-xl font-black text-white tracking-tight">
              {item.media_type === "image" ? "معاينة الصورة" : "مشاهدة الفيديو"}
            </h4>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
              تاريخ الرفع: {new Date(item.created_at).toLocaleDateString("ar-SA")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onDownload}
            className="size-14 rounded-2xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-gold-primary hover:text-black transition-all"
            title="تحميل"
          >
            <Download size={22} />
          </button>
          <button className="size-14 rounded-2xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all">
            <Share2 size={22} />
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="size-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
            >
              <Trash2 size={22} />
            </button>
          )}
        </div>
      </div>

      {/* Media Canvas */}
      <div className="w-full max-w-6xl h-full flex items-center justify-center p-4 md:p-20">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-full max-h-full flex items-center justify-center"
        >
          {item.media_type === "image" ? (
            <img
              src={item.url}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-[0_0_100px_rgba(212,175,55,0.1)] border border-white/5"
              alt=""
            />
          ) : (
            <video
              src={item.url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl border border-white/5"
            />
          )}
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-0 inset-x-0 p-8 md:p-14 bg-gradient-to-t from-black via-black/40 to-transparent">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-10">
          <div className="flex items-center gap-6">
            <div className="size-16 rounded-[24px] border-2 border-gold-primary shadow-2xl overflow-hidden shrink-0">
              <img
                src={
                  item.avatar_url ||
                  "https://api.dicebear.com/7.x/avataaars/svg?seed=" + item.uploaderName
                }
                className="size-full object-cover"
                alt=""
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-gold-primary uppercase tracking-[0.3em]">
                الناشر
              </p>
              <h3 className="text-2xl font-black text-white">{item.uploaderName}</h3>
            </div>
          </div>

          <div className="flex gap-8">
            <div className="text-center">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">
                القسم
              </p>
              <span className="px-4 py-1 rounded-full bg-white/10 text-white text-xs font-black">
                {SECTIONS.find((s) => s.key === item.section)?.label}
              </span>
            </div>
            {item.expires_at && (
              <div className="text-center">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">
                  الحالة
                </p>
                <span className="text-rose-400 text-xs font-black">مؤقت</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
