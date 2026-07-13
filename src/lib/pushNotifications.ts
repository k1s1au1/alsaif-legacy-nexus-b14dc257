import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Sets up native push notifications (Android/iOS via Capacitor).
 * No-op when running on the web.
 */
export async function setupPushNotifications(navigate?: (options: { to: string }) => void) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "denied") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    // 1. Add listeners FIRST
    await PushNotifications.addListener("registration", async (token) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      await supabase.from("push_tokens").upsert(
        {
          user_id: auth.user.id,
          token: token.value,
          platform: Capacitor.getPlatform(),
          is_active: true,
        },
        { onConflict: "token" },
      );
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", async (notification: any) => {
      const { actionId, notification: data } = notification;
      const meetingId = data.data?.meeting_id;
      const url = data.data?.url;

      // 1.1 Handle Interactive Actions (Buttons)
      if (meetingId && (actionId === "going" || actionId === "not_going")) {
        try {
          const { data: auth } = await supabase.auth.getUser();
          if (!auth.user) return;

          const rsvp = actionId === "going" ? "going" : "not_going";
          await supabase
            .from("meeting_attendees")
            .upsert(
              { meeting_id: meetingId, user_id: auth.user.id, rsvp },
              { onConflict: "meeting_id,user_id" },
            );

          if (rsvp === "going") toast.success("تم تأكيد حضورك ✨");
          else toast.info("تم تسجيل اعتذارك.");
        } catch (e) {
          console.error("Background action error:", e);
        }
      }

      // 1.2 Handle Deep Linking (Redirection)
      if (url && navigate) {
        if (url.startsWith("/")) {
          navigate({ to: url as any });
        } else if (url.startsWith("http")) {
          window.open(url, "_blank");
        }
      }
    });

    // 2. Register ACTION TYPES (The buttons)
    const pushNotificationsWithActions = PushNotifications as typeof PushNotifications & {
      registerActionTypes?: (options: {
        types: Array<{
          id: string;
          actions: Array<{
            id: string;
            title: string;
            foreground?: boolean;
            destructive?: boolean;
          }>;
        }>;
      }) => Promise<void>;
    };

    await pushNotificationsWithActions.registerActionTypes?.({
      types: [
        {
          id: "MEETING_INVITE",
          actions: [
            { id: "going", title: "سأحضر ✅", foreground: false },
            { id: "not_going", title: "أعتذر ❌", foreground: false, destructive: true },
          ],
        },
      ],
    });

    // 3. Register AFTER adding listeners
    await PushNotifications.register();
  } catch (e) {
    console.error("[Push] setup failed:", e);
  }
}
