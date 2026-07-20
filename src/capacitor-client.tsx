import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { App } from "@capacitor/app";

// Capacitor starts from a blank document, with no TanStack server hydration
// payload. Start the router normally and load the current client route.
const router = getRouter();
router.update({ defaultSsr: false });

// Voice Actions & Deep Linking Handler
App.addListener('appUrlOpen', (event: any) => {
  const url = new URL(event.url);
  const path = url.hostname + url.pathname;

  console.log("[DeepLink] Opening:", path);

  // Example: alsaif://meetings -> /meetings
  if (path.includes('meetings')) {
    router.navigate({ to: '/meetings' });
  } else if (path.includes('steps-challenge')) {
    router.navigate({ to: '/steps-challenge' });
  } else if (path.includes('majlis')) {
    router.navigate({ to: '/majlis' });
  } else if (path.includes('chat')) {
    router.navigate({ to: '/chat' });
  }
});

void router.load().then(() => {
  startTransition(() => {
    createRoot(document).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  });
});
