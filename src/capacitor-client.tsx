import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

// Capacitor starts from a blank document, with no TanStack server hydration
// payload. Start the router normally and load the current client route.
const router = getRouter();
router.update({ defaultSsr: false });

void router.load().then(() => {
  startTransition(() => {
    createRoot(document).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  });
});
