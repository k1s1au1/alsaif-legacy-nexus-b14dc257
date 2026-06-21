import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({
  value,
  duration = 1200,
  decimals = 0,
  className,
  suffix,
}: {
  value: number | null | undefined;
  duration?: number;
  decimals?: number;
  className?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value)) return;
    const from = fromRef.current;
    const to = Number(value);
    startRef.current = null;
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  if (value === null || value === undefined) return <span className={className}>—</span>;

  return (
    <span className={className}>
      {display.toLocaleString("en-US", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })}
      {suffix ? <span className="text-sm text-gold-primary mr-1">{suffix}</span> : null}
    </span>
  );
}
