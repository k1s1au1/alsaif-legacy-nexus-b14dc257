import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alsaif.familyhub',
  appName: 'Alsaif Family Hub',
  webDir: 'dist',
  server: {
    url: 'https://alsaif-legacy-nexus.lovable.app',
    cleartext: false
  }
};

export default config;