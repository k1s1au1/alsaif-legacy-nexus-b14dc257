import { toast } from "sonner";

/**
 * Generates and downloads an .ics file for mobile/desktop calendar integration
 */
export function addToCalendar({
  title,
  description,
  location,
  startTime,
  durationMinutes,
}: {
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  durationMinutes?: number;
}) {
  try {
    const start = new Date(startTime);
    if (isNaN(start.getTime())) throw new Error("Invalid start time");

    const end = new Date(start.getTime() + (durationMinutes || 60) * 60 * 1000);

    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const escapeICS = (str: string) => {
      return str.replace(/[\\,;]/g, (match) => `\\${match}`).replace(/\n/g, "\\n");
    };

    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Alsaif Nexus//Calendar//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `SUMMARY:${escapeICS(title)}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `DESCRIPTION:${escapeICS(description || "")}`,
      `LOCATION:${escapeICS(location || "")}`,
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const icsString = icsLines.join("\r\n");
    const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsString)}`;

    // Try a direct navigation for mobile first, as it's the most reliable trigger for calendar apps
    if (typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = dataUrl;
    } else {
      // On desktop, a download link is preferred
      const link = document.createElement("a");
      link.href = dataUrl;
      link.setAttribute("download", `${title.replace(/[^a-z0-9]/gi, "_")}.ics`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 100);
    }

    toast.success("جاري فتح التقويم", { description: "يرجى تأكيد الحفظ في هاتفك." });
  } catch (err) {
    console.error("Calendar export error:", err);
    toast.error("فشل تصدير التقويم");
  }
}
