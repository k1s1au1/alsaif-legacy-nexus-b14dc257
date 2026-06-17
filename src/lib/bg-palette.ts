// Sample a background image and derive a coherent UI palette
// (text color, muted, card surface, border, accent) — based on the
// image's average luminance and most saturated color.

export type BgPalette = {
  isDark: boolean;
  bg: string; // average background color (hex)
  fg: string; // primary text color
  muted: string; // muted text
  card: string; // card surface
  border: string; // border lines
  accent: string; // dominant accent from image
  accentSoft: string; // soft variant of accent
};

function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function luminance(r: number, g: number, b: number) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

export async function samplePaletteFromUrl(url: string): Promise<BgPalette | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0, g = 0, b = 0, n = 0;
        let aR = 0, aG = 0, aB = 0, aN = 0; // accent accumulator (saturated pixels)
        let bestSat = 0;
        let bestR = 0, bestG = 0, bestB = 0;

        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          r += pr; g += pg; b += pb; n++;
          const s = saturation(pr, pg, pb);
          if (s > 0.35) {
            aR += pr; aG += pg; aB += pb; aN++;
          }
          if (s > bestSat) {
            bestSat = s;
            bestR = pr; bestG = pg; bestB = pb;
          }
        }
        const avgR = Math.round(r / n), avgG = Math.round(g / n), avgB = Math.round(b / n);
        const lum = luminance(avgR, avgG, avgB);
        const isDark = lum < 0.5;

        let accR: number, accG: number, accB: number;
        if (aN > 16) {
          accR = Math.round(aR / aN);
          accG = Math.round(aG / aN);
          accB = Math.round(aB / aN);
        } else {
          accR = bestR; accG = bestG; accB = bestB;
        }
        // If accent is too washed out, keep current dark green
        if (saturation(accR, accG, accB) < 0.15) {
          accR = 15; accG = 106; accB = 75;
        }

        const palette: BgPalette = {
          isDark,
          bg: rgbToHex(avgR, avgG, avgB),
          fg: isDark ? "#F8FAFC" : "#0F172A",
          muted: isDark ? "rgba(248,250,252,0.72)" : "rgba(15,23,42,0.62)",
          card: isDark ? "rgba(15,17,22,0.72)" : "rgba(255,255,255,0.88)",
          border: isDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.10)",
          accent: rgbToHex(accR, accG, accB),
          accentSoft: `rgba(${accR}, ${accG}, ${accB}, 0.14)`,
        };
        resolve(palette);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Map a palette to CSS variables that override the project's semantic
 * design tokens for whatever subtree the style is applied to.
 */
export function paletteToCssVars(p: BgPalette): React.CSSProperties {
  return {
    // semantic tokens
    ["--foreground" as never]: p.fg,
    ["--card" as never]: p.card,
    ["--card-foreground" as never]: p.fg,
    ["--popover" as never]: p.card,
    ["--popover-foreground" as never]: p.fg,
    ["--muted" as never]: p.isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)",
    ["--muted-foreground" as never]: p.muted,
    ["--border" as never]: p.border,
    ["--input" as never]: p.card,
    ["--secondary" as never]: p.isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
    ["--secondary-foreground" as never]: p.fg,
    ["--accent" as never]: p.accentSoft,
    ["--accent-foreground" as never]: p.accent,
    ["--primary" as never]: p.accent,
    ["--primary-foreground" as never]: p.isDark ? "#0F172A" : "#FFFFFF",
    // brand tokens used directly in components
    ["--ivory" as never]: p.fg,
    ["--gold-primary" as never]: p.accent,
    ["--gold-soft" as never]: p.accentSoft,
    color: p.fg,
  };
}
