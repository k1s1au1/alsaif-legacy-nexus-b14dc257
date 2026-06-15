// Traditional Saudi Sadu pattern ribbon — red, green, black geometric motifs.
// Pure SVG, fully responsive, repeats horizontally.
export function SaduPattern({ className = "", height = 28 }: { className?: string; height?: number }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        height,
        width: "100%",
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(SADU_SVG)}")`,
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
      }}
    />
  );
}

const SADU_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' width='160' height='28' viewBox='0 0 160 28'>
  <rect width='160' height='28' fill='#FFFFFF'/>
  <rect y='0' width='160' height='3' fill='#0F5A3A'/>
  <rect y='25' width='160' height='3' fill='#0F5A3A'/>
  <g fill='#C62828'>
    <polygon points='0,14 10,5 20,14 10,23'/>
    <polygon points='40,14 50,5 60,14 50,23'/>
    <polygon points='80,14 90,5 100,14 90,23'/>
    <polygon points='120,14 130,5 140,14 130,23'/>
  </g>
  <g fill='#1A1A1A'>
    <polygon points='20,14 30,7 40,14 30,21'/>
    <polygon points='60,14 70,7 80,14 70,21'/>
    <polygon points='100,14 110,7 120,14 110,21'/>
    <polygon points='140,14 150,7 160,14 150,21'/>
  </g>
  <g fill='#0F5A3A'>
    <rect x='8' y='12' width='4' height='4'/>
    <rect x='28' y='12' width='4' height='4'/>
    <rect x='48' y='12' width='4' height='4'/>
    <rect x='68' y='12' width='4' height='4'/>
    <rect x='88' y='12' width='4' height='4'/>
    <rect x='108' y='12' width='4' height='4'/>
    <rect x='128' y='12' width='4' height='4'/>
    <rect x='148' y='12' width='4' height='4'/>
  </g>
</svg>`;
