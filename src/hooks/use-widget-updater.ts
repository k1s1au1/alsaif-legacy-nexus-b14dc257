import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Widget } from "@/lib/native-bridge";

export function useWidgetUpdater(upcomingMeetings: any[], upcomingTrips: any[]) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const updateWidget = async () => {
      try {
        let title = "لا توجد فعاليات قريبة";
        let date = "المجلس يرحب بكم";
        let label = "المجلس";

        if (upcomingMeetings && upcomingMeetings.length > 0) {
          const m = upcomingMeetings[0];
          title = m.title;
          const d = new Date(m.scheduled_at);
          date = d.toLocaleString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
          label = "اجتماع قادم";
        } else if (upcomingTrips && upcomingTrips.length > 0) {
          const t = upcomingTrips[0];
          title = t.title;
          const d = new Date(t.start_date);
          date = d.toLocaleString("ar-SA", { day: 'numeric', month: 'long' });
          label = "رحلة قادمة";
        }

        await Widget.updateData({ title, date, label });
      } catch (e) {
        console.warn("Failed to update widget", e);
      }
    };

    updateWidget();
  }, [upcomingMeetings, upcomingTrips]);
}
