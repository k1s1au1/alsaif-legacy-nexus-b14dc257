// Chat shared types, helpers, and constants
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type GroupSendPermission = "all" | "admins" | "selected";

export type Conversation = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
  send_permission: GroupSendPermission;
};

export type Participant = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  last_read_at: string;
  archived_at: string | null;
  muted: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: "text" | "image" | "video" | "audio" | "file";
  body: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime: string | null;
  attachment_duration_ms: number | null;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type Delivery = {
  id: string;
  message_id: string;
  conversation_id: string;
  user_id: string;
  delivered_at: string | null;
  read_at: string | null;
};

export type Presence = {
  user_id: string;
  status: "online" | "offline";
  last_seen_at: string;
};

export function displayName(p?: Profile | null) {
  return p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو";
}

export function initialOf(name: string) {
  return (name?.trim()?.[0] ?? "ص").toUpperCase();
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

export function lastSeenLabel(iso: string | null) {
  if (!iso) return "غير متصل";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "متصل الآن";
  if (min < 60) return `آخر ظهور قبل ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `آخر ظهور قبل ${hr} ساعة`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `آخر ظهور قبل ${day} يوم`;
  return `آخر ظهور: ${d.toLocaleDateString("ar-SA")}`;
}

export function chatTimeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-SA", { month: "numeric", day: "numeric" });
}

export function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024) return `${n} ب`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ك.ب`;
  return `${(n / (1024 * 1024)).toFixed(1)} م.ب`;
}

export function formatDuration(ms: number | null | undefined) {
  if (!ms || ms < 0) return "0:00";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function messagePreview(m: Message | undefined) {
  if (!m) return "لا توجد رسائل بعد";
  if (m.deleted_at) return "🚫 تم حذف الرسالة";
  switch (m.kind) {
    case "image":
      return "📷 صورة";
    case "video":
      return "🎬 فيديو";
    case "audio":
      return "🎙 رسالة صوتية";
    case "file":
      return `📎 ${m.attachment_name ?? "ملف"}`;
    default:
      return (m.body ?? "").slice(0, 80);
  }
}

export async function getSignedAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export function conversationTitle(
  c: Conversation,
  participants: Participant[],
  profiles: Record<string, Profile>,
  meId: string | null,
): string {
  if (c.kind === "group") return c.title || "مجموعة";
  const other = participants.find((p) => p.user_id !== meId);
  return displayName(profiles[other?.user_id ?? ""]);
}

export function conversationAvatarInitial(
  c: Conversation,
  participants: Participant[],
  profiles: Record<string, Profile>,
  meId: string | null,
): string {
  if (c.kind === "group") return initialOf(c.title ?? "م");
  const other = participants.find((p) => p.user_id !== meId);
  return initialOf(displayName(profiles[other?.user_id ?? ""]));
}

export const EMOJI_QUICK = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];

export const EMOJI_PICKER = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😍","🥰","😘",
  "😗","😙","😚","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐",
  "😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤧",
  "🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯",
  "😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩",
  "😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽",
  "👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾","💋","👋","🤚","🖐","✋",
  "🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍",
  "👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾",
  "❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖",
  "💘","💝","💟","🔥","✨","⭐","🌟","💫","🎉","🎊","🎁","🏆","🥇","🎯",
];
