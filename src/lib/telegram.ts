import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sends a notification message to a Telegram chat via a Bot.
 * Expects TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in environment variables.
 *
 * Auth: only authenticated admins / chairman / managers can send.
 * The message body is HTML-escaped to prevent injection.
 */
export const sendTelegramNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ message: z.string().min(1).max(1000) }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      console.warn("Telegram configuration missing");
      return { success: false, error: "Configuration missing" };
    }

    try {
      // Authorize caller
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: callerRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const set = new Set((callerRoles ?? []).map((r: any) => r.role));
      if (!(set.has("admin") || set.has("chairman") || set.has("manager"))) {
        return { success: false, error: "غير مصرح" };
      }

      const safeMessage = escapeHtml(data.message);

      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: safeMessage,
          parse_mode: "HTML",
        }),
      });

      if (!response.ok) {
        console.error("Telegram API error:", await response.text().catch(() => ""));
        return { success: false, error: "Telegram dispatch failed" };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send Telegram notification:", error);
      return { success: false, error: "Network or Server error" };
    }
  });
