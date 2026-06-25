import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

const AR_DAYS = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

export function LiveClock({ variant = "full" }: { variant?: "full" | "date" | "time" }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  try {
    let h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, "0");
    const s = now.getSeconds().toString().padStart(2, "0");
    const suffix = h >= 12 ? "م" : "ص";
    h = h % 12 || 12;

    const dateText = `${AR_DAYS[now.getDay()]}، ${now.getDate()} ${AR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const timeText = `${h.toString().padStart(2, "0")}:${m}:${s} ${suffix}`;

    if (variant === "date") {
      return <span>{dateText}</span>;
    }
    if (variant === "time") {
      return <span>{timeText}</span>;
    }

    return (
      <div className="flex flex-wrap items-baseline justify-center gap-x-2 sm:gap-x-4 gap-y-1 text-[10px] sm:text-xs text-muted-foreground">
        <span className="font-medium text-gold-primary tabular-nums text-xs sm:text-sm tracking-wider">
          {h.toString().padStart(2, "0")}:{m}
          <span className="text-muted-foreground/60 hidden sm:inline">:{s}</span> {suffix}
        </span>
        <span className="truncate">
          {dateText}
        </span>
      </div>
    );
  } catch {
    return <div className="text-xs text-muted-foreground opacity-50">جاري تحميل الوقت...</div>;
  }
}
