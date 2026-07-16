/**
 * Simple offline cache helper for high-value data
 */
export const OfflineCache = {
  save: (key: string, data: any) => {
    try {
      localStorage.setItem(`cache:${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error("Cache save error", e);
    }
  },

  load: (key: string) => {
    try {
      const cached = localStorage.getItem(`cache:${key}`);
      if (!cached) return null;
      return JSON.parse(cached).data;
    } catch (e) {
      console.error("Cache load error", e);
      return null;
    }
  }
};
