import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Sends a notification message to a Telegram chat via a Bot.
 * Expects TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in environment variables.
 */
export const sendTelegramNotification = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ message: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      console.warn("Telegram configuration missing: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
      return { success: false, error: "Configuration missing" };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: data.message,
          parse_mode: "HTML",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Telegram API error:", result);
        return { success: false, error: result.description };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send Telegram notification:", error);
      return { success: false, error: "Network or Server error" };
    }
  });
