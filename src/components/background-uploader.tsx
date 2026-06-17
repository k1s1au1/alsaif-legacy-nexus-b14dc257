import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BUCKET = "app-backgrounds";

/**
 * Floating button visible only to admins/managers. Lets them pick an image
 * file to use as the background for the given settingKey (e.g. "auth_bg",
 * "dashboard_bg"). The file is uploaded to the `app-backgrounds` bucket and
 * the path is saved in `app_settings`.
 */
export function BackgroundUploader({
  settingKey,
  label,
  className,
}: {
  settingKey: string;
  label: string;
  className?: string;
}) {
  const [canEdit, setCanEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setCanEdit(false);
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      const r = (roles ?? []).map((x) => x.role);
      setCanEdit(r.includes("admin") || r.includes("manager"));
    })();
  }, []);

  if (!canEdit) return null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("الملف يجب أن يكون صورة");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("حجم الصورة يجب ألا يتجاوز 8MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${settingKey}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const { error: setErr } = await supabase
        .from("app_settings")
        .upsert(
          { key: settingKey, value: path, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (setErr) throw setErr;

      toast.success("تم تحديث الخلفية");
    } catch (err: any) {
      toast.error("فشل رفع الصورة", { description: err?.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={label}
        className={cn(
          "fixed bottom-6 left-6 z-[60] inline-flex items-center gap-2 px-4 py-2.5 rounded-full",
          "bg-gold-primary text-navy-base font-semibold text-xs shadow-lg ring-1 ring-black/10",
          "hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60",
          className,
        )}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ImagePlus className="size-4" strokeWidth={2} />
        )}
        <span>{label}</span>
      </button>
    </>
  );
}
