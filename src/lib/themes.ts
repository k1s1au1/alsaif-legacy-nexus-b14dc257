export const THEME_COLORS = [
  {
    id: "emerald",
    name: "أخضر السيف (الأصلي)",
    primary: "#0B5D4B",
    secondary: "#C4A260",
    darkPrimary: "#46A982",
    darkSecondary: "#DEC27E",
    foreground: "#FFFFFF",
    isPrimary: true,
    mesh: ["rgba(196, 162, 96, 0.12)", "rgba(11, 93, 75, 0.08)"],
  },
  {
    id: "royal-gold",
    name: "أخضر المجلس",
    primary: "#155E52",
    secondary: "#D1B16B",
    darkPrimary: "#65B99A",
    darkSecondary: "#E4CE94",
    foreground: "#FFFFFF",
    mesh: ["rgba(209, 177, 107, 0.12)", "rgba(21, 94, 82, 0.08)"],
  },
  {
    id: "vibrant-emerald",
    name: "ذهب السيف",
    primary: "#A98445",
    secondary: "#155E52",
    darkPrimary: "#D6B56A",
    darkSecondary: "#5CB392",
    foreground: "#173E35",
    mesh: ["rgba(169, 132, 69, 0.12)", "rgba(21, 94, 82, 0.08)"],
  },
  {
    id: "midnight",
    name: "زيتوني هادئ",
    primary: "#657044",
    secondary: "#C9AA69",
    darkPrimary: "#AAB77C",
    darkSecondary: "#E1C889",
    foreground: "#FFFFFF",
    mesh: ["rgba(201, 170, 105, 0.12)", "rgba(101, 112, 68, 0.08)"],
  },
  {
    id: "burgundy",
    name: "كحلي السمر",
    primary: "#24443F",
    secondary: "#B99A5D",
    darkPrimary: "#6F9B90",
    darkSecondary: "#D9C184",
    foreground: "#FFFFFF",
    mesh: ["rgba(185, 154, 93, 0.12)", "rgba(36, 68, 63, 0.08)"],
  },
  {
    id: "pure-white",
    name: "العاجي الدافئ",
    primary: "#F3ECDD",
    secondary: "#8D7345",
    darkPrimary: "#E9DECA",
    darkSecondary: "#D0B172",
    foreground: "#184E42",
    mesh: ["rgba(141, 115, 69, 0.12)", "rgba(243, 236, 221, 0.16)"],
  },
  {
    id: "sand",
    name: "رمل الديوان",
    primary: "#B7996A",
    secondary: "#315C50",
    darkPrimary: "#D8BF91",
    darkSecondary: "#75AA95",
    foreground: "#243E36",
    mesh: ["rgba(183, 153, 106, 0.12)", "rgba(49, 92, 80, 0.08)"],
  },
];

export function applyThemeColors(colors: (typeof THEME_COLORS)[0]) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");

  root.style.setProperty("--primary", isDark ? colors.darkPrimary : colors.primary);
  root.style.setProperty(
    "--gold-primary",
    isDark ? (colors.darkSecondary || colors.secondary) : colors.secondary
  );
  root.style.setProperty("--primary-foreground", colors.foreground);

  if (colors.mesh) {
    root.style.setProperty("--mesh-color-1", colors.mesh[0]);
    root.style.setProperty("--mesh-color-2", colors.mesh[1]);
  }
}
