import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PushData = Record<string, string | undefined>;
type AppNavigator = (options: { to: string }) => void;

let appNavigate: AppNavigator | undefined;
let listenersAttached = false;
let authListenerAttached = false;
let latestNativeToken: string | undefined;

/** Converts a notification payload into a safe in-app route. */
export function notificationRoute(data: PushData = {}): string {
  const rawUrl = data.url;
  if (rawUrl?.startsWith("/")) return rawUrl;

  if (data.conversation_id) return `/chat/${data.conversation_id}`;
  if (data.meeting_id) return "/meetings";
  if (data.event_id) return "/events";
  if (data.task_id || data.type === "tasks") return "/tasks";
  if (data.type === "chat") return "/chat";
  if (data.type === "news" || data.type === "announcement") return "/majlis";
  if (data.type === "entertainment" || data.trip_id) return "/trips";
  if (data.type === "sos" || data.category === "SOS") return "/dashboard";
  return "/dashboard";
}

async function saveToken(token: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: auth.user.id,
      token,
      platform: Capacitor.getPlatform(),
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );
  return !error;
}

/** Registers native notification actions once and sends taps to the right page. */
export async function setupPushNotifications(navigate?: AppNavigator) {
  if (navigate) appNavigate = navigate;
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "denied") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== "granted") return;

    const actionPlugin = PushNotifications as typeof PushNotifications & {
      registerActionTypes?: (options: {
        types: Array<{
          id: string;
          actions: Array<{ id: string; title: string; foreground?: boolean; destructive?: boolean }>;
        }>;
      }) => Promise<void>;
    };

    await actionPlugin.registerActionTypes?.({
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

    if (!listenersAttached) {
      listenersAttached = true;

      await PushNotifications.addListener("registration", async (token) => {
        try {
          latestNativeToken = token.value;
          await saveToken(token.value);
        } catch (error) {
          console.error("Push token save failed", error);
        }
      });

      await PushNotifications.addListener("registrationError", (error) => {
        console.error("Push registration error", error);
      });

      await PushNotifications.addListener("pushNotificationActionPerformed", async (event: any) => {
        const actionId = event.actionId;
        const data = (event.notification?.data ?? {}) as PushData;
        const meetingId = data.meeting_id;

        if (meetingId && (actionId === "going" || actionId === "not_going")) {
          try {
            const { data: auth } = await supabase.auth.getUser();
            if (auth.user) {
              const rsvp = actionId === "going" ? "going" : "not_going";
              await supabase
                .from("meeting_attendees")
                .upsert(
                  { meeting_id: meetingId, user_id: auth.user.id, rsvp },
                  { onConflict: "meeting_id,user_id" },
                );
              toast.success(rsvp === "going" ? "تم تأكيد حضورك ✨" : "تم تسجيل اعتذارك.");
            }
          } catch (error) {
            console.error("Meeting notification action failed", error);
          }
        }

        appNavigate?.({ to: notificationRoute(data) });
      });

      // On a fresh install, Android can generate the token before the user
      // signs in. Keep it and attach it to the account as soon as auth exists.
      if (!authListenerAttached) {
        authListenerAttached = true;
        supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user && latestNativeToken) {
            void saveToken(latestNativeToken);
          }
        });
      }
    }

    await PushNotifications.register();
  } catch (error) {
    console.error("[Push] setup failed:", error);
  }
}
