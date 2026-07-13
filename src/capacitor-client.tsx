import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

// The Android app ships without server-rendered HTML.  Render from scratch
// instead of trying to hydrate an empty Capacitor WebView document.
startTransition(() => {
  createRoot(document).render(
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
