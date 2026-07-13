import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FCM_VAPID_KEY, FIREBASE_CONFIG } from "@/lib/fcm-config";
import { toast } from "sonner";
import { setupPushNotifications } from "@/lib/pushNotifications";

export function useFcm() {
  const navigate = useNavigate();

  useEffect(() => {
    const win = window as any;

    const saveToken = async (token: string) => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const userId = auth.user.id;
        // Multi-device store
        await supabase
          .from("push_tokens")
          .upsert(
            {
              user_id: userId,
              token,
              platform: "web",
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,token" },
          );
        // Back-compat single-token mirror
        await supabase.from("profiles").update({ fcm_token: token }).eq("id", userId);
      } catch (e) {
        console.error("FCM Save Token Exception:", e);
      }
    };

    const initPush = async () => {
      // 1. Native Platform (Mobile App)
      if (win.Capacitor?.isNativePlatform()) {
        await setupPushNotifications(navigate);
        return;

        try {
          const { PushNotifications } = win.Capacitor.Plugins;
          if (!PushNotifications) return;

          let perm = await PushNotifications.checkPermissions();
          if (perm.receive !== "granted") {
            perm = await PushNotifications.requestPermissions();
          }
          if (perm.receive !== "granted") return;

          await PushNotifications.register();

          // 1.1 Register Action Types for Interactivity
          await PushNotifications.registerActionTypes({
            types: [
              {
                id: "MEETING_INVITE",
                actions: [
                  {
                    id: "going",
                    title: "سأحضر ✅",
                    foreground: false, // Handle in background if possible
                  },
                  {
                    id: "not_going",
                    title: "أعتذر ❌",
                    foreground: false,
                    destructive: true,
                  },
                ],
              },
            ],
          });

          // 1.2 Handle Action Performed (Clicking a button or the notification itself)
          PushNotifications.addListener(
            "pushNotificationActionPerformed",
            async (notification: any) => {
              const { actionId, notification: data } = notification;
              const meetingId = data.data?.meeting_id;
              const url = data.data?.url;

              // 1.2.1 Handle specific button actions
              if (meetingId && (actionId === "going" || actionId === "not_going")) {
                try {
                  const { data: auth } = await supabase.auth.getUser();
                  if (!auth.user) return;

                  if (actionId === "going") {
                    await supabase
                      .from("meeting_attendees")
                      .upsert(
                        { meeting_id: meetingId, user_id: auth.user.id, rsvp: "going" },
                        { onConflict: "meeting_id,user_id" },
                      );
                    toast.success("تم تأكيد حضورك للاجتماع بنجاح ✨");
                  } else {
                    await supabase
                      .from("meeting_attendees")
                      .upsert(
                        { meeting_id: meetingId, user_id: auth.user.id, rsvp: "not_going" },
                        { onConflict: "meeting_id,user_id" },
                      );
                    toast.info("تم تسجيل اعتذارك عن الحضور.");
                  }
                } catch (e) {
                  console.error("Background RSVP error:", e);
                }
              }

              // 1.2.2 Handle Deep Linking (if user tapped the notification or if URL is provided)
              if (url) {
                // If it's a relative path, navigate to it
                if (url.startsWith("/")) {
                  navigate({ to: url as any });
                } else if (url.startsWith("http")) {
                  window.open(url, "_blank");
                }
              }
            },
          );

          PushNotifications.addListener("registration", async (token: { value: string }) => {
            await saveToken(token.value);
          });

          PushNotifications.addListener("registrationError", (err: any) => {
            console.error("Push registration error:", err);
          });
        } catch (err) {
          console.error("Native FCM Initialization error:", err);
        }
      }
      // 2. Web Platform (Browser) - use Firebase JS SDK getToken
      else if (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "Notification" in window
      ) {
        try {
          const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
          const { initializeApp, getApps } = await import("firebase/app");

          if (!(await isSupported())) {
            console.warn("FCM not supported in this browser");
            return;
          }

          if (Notification.permission === "default") {
            await Notification.requestPermission();
          }
          if (Notification.permission !== "granted") return;

          const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
            scope: "/",
          });
          await navigator.serviceWorker.ready;

          const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
          const messaging = getMessaging(app);

          const token = await getToken(messaging, {
            vapidKey: FCM_VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (token) {
            console.log("FCM Web Token obtained");
            await saveToken(token);
          } else {
            console.warn("No FCM token returned");
          }
        } catch (err: any) {
          console.warn("Web FCM initialization failed:", err?.code, err?.message, err);
          // Silent fail — don't show toast on every page load. User can re-enable from settings.
        }
      }
    };

    initPush();
  }, []);
}
