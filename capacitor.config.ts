import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alsaif.familyhub",
  appName: "المجلس",
  webDir: "www",
  server: {
    // This links the APK directly to your live website
    url: "https://alsaif-legacy-nexus.lovable.app",
    cleartext: true,
  },
};

export default config;
