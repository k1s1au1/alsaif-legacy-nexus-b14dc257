import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alsaif.familyhub",
  appName: "المجلس",
  webDir: "dist/client",
  server: {
    url: "https://alsaif-legacy-nexus.lovable.app",
    cleartext: true,
  },
};

export default config;
