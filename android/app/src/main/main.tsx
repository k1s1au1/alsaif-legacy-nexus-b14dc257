import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

root.render(
  <div style={{ padding: 24, fontFamily: "Arial", direction: "rtl" }}>
    جاري تشغيل التطبيق...
  </div>
);

async function startApp() {
  try {
    const routerModule = await import("./router");
    const tanstackModule = await import("@tanstack/react-router");

    const router = routerModule.getRouter();
    const RouterProvider = tanstackModule.RouterProvider;

    root.render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>
    );
  } catch (error: any) {
    root.render(
      <div
        style={{
          padding: 20,
          direction: "rtl",
          fontFamily: "Arial",
          color: "red",
          whiteSpace: "pre-wrap",
        }}
      >
        <h2>صار خطأ في تشغيل التطبيق</h2>
        <pre>{error?.stack || error?.message || String(error)}</pre>
      </div>
    );
  }
}

startApp();