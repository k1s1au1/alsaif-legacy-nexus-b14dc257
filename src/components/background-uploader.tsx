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
  inline = false,
}: {
  settingKey: string;
  label: string;
  className?: string;
  inline?: boolean;
}) {
  const [canEdit, setCanEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setCanEdit(false);
          return;
        }
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const r = (roles ?? []).map((x) => x.role);
        setCanEdit(r.includes("admin") || r.includes("manager") || r.includes("chairman"));
      } catch (err) {
        console.error("Error checking permissions:", err);
      }
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
      // Force refresh to show new background
      window.location.reload();
    } catch (err: any) {
      toast.error("فشل رفع الصورة", { description: err?.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "relative group transition-all duration-300",
          inline
            ? "flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-muted/40 hover:bg-muted border border-border/40 min-h-[140px]"
            : "fixed bottom-6 left-6 z-[60] size-12 rounded-full bg-gold-primary text-navy-base shadow-lg ring-1 ring-black/10 flex items-center justify-center",
          className,
        )}
      >
        <div
          className={cn(
            "rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110",
            inline ? "size-12 bg-card shadow-sm" : "",
          )}
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-primary" />
          ) : (
            <ImagePlus
              className={cn("size-6", inline ? "text-gold-primary" : "text-navy-base")}
              strokeWidth={2}
            />
          )}
        </div>
        {inline && (
          <span className="text-xs font-black uppercase tracking-widest text-primary">{label}</span>
        )}
      </button>
    </>
  );
}
