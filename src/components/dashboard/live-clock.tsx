import { useEffect, useState } from "react";

const AR_DAYS = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

export function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const s = now.getSeconds().toString().padStart(2, "0");
  const suffix = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="font-medium text-gold-primary tabular-nums text-sm tracking-wider">
        {h.toString().padStart(2, "0")}:{m}
        <span className="text-muted-foreground/60">:{s}</span> {suffix}
      </span>
      <span>
        {AR_DAYS[now.getDay()]}، {now.getDate()} {AR_MONTHS[now.getMonth()]} {now.getFullYear()}
      </span>
    </div>
  );
}
