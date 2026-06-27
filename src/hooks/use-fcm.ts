import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FCM_VAPID_KEY } from "@/lib/fcm-config";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useFcm() {
  useEffect(() => {
    const win = window as any;

    const saveToken = async (token: string, type: string) => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;

        console.log(`FCM: Registering ${type} token...`);
        const { error } = await (supabase as any).from("user_fcm_tokens").upsert({
          user_id: auth.user.id,
          token: token,
          device_type: type
        }, { onConflict: "user_id, token" });

        if (error) {
          console.error("FCM Token Save Error:", error);
          toast.error("فشل حفظ رمز الجهاز في قاعدة البيانات");
        } else {
          console.log("FCM Token saved successfully.");
          toast.success("تم ربط جهازك بنظام الإشعارات بنجاح! 🔔");
        }
      } catch (e) {
        console.error("FCM Save Token Exception:", e);
      }
    };

    const initPush = async () => {
      // 1. Native Platform (Mobile App)
      if (win.Capacitor?.isNativePlatform()) {
        try {
          const { PushNotifications } = win.Capacitor.Plugins;
          if (!PushNotifications) return;

          let perm = await PushNotifications.checkPermissions();
          if (perm.receive !== "granted") {
            perm = await PushNotifications.requestPermissions();
          }

          if (perm.receive !== "granted") {
            console.warn("Push permissions denied on mobile.");
            return;
          }

          await PushNotifications.register();

          // Listen for registration (getting the token)
          PushNotifications.addListener("registration", async (token: { value: string }) => {
            console.log("Push registration success (Native):", token.value);
            await saveToken(token.value, win.Capacitor.getPlatform());
          });

          // Listen for errors
          PushNotifications.addListener("registrationError", (err: any) => {
            console.error("Push registration error:", err);
            toast.error("خطأ في تسجيل إشعارات الجوال");
          });

        } catch (err) {
          console.error("Native FCM Initialization error:", err);
        }
      }
      // 2. Web Platform (Browser)
      else if (typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window) {
        try {
          if (Notification.permission === "default") {
            await Notification.requestPermission();
          }

          if (Notification.permission === "granted") {
            // Register service worker for Web Push
            try {
              const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
              });

              // Wait for it to be ready
              const sw = await navigator.serviceWorker.ready;

              if (sw.pushManager) {
                const subscription = await sw.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(FCM_VAPID_KEY)
                });

                if (subscription) {
                  const webToken = JSON.stringify(subscription);
                  console.log("Web Push Registration Success");
                  await saveToken(webToken, "web");
                }
              }
            } catch (swErr: any) {
              console.warn("Service Worker registration failed:", swErr);
              if (swErr.name !== 'AbortError') {
                toast.error("تعذر تسجيل المتصفح في نظام الإشعارات");
              }
            }
          }
        } catch (err) {
          console.warn("Web Push initialization failed:", err);
        }
      }
    };

    initPush();
  }, []);
}
