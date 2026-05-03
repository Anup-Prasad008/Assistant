export interface ThemeColors {
  bg: string;
  accent: string;
  gradient: string;
  glow: string;
  visualizer: {
    listening: string;
    processing: string;
    speaking: string;
    idle: string;
  };
}

export type ThemeName = "bunny" | "midnight" | "cyber" | "royal" | "blood" | "neon" | "toxic";

export const THEMES: Record<ThemeName, ThemeColors> = {
  bunny: {
    bg: "bg-[#050505]",
    accent: "from-violet-500 to-pink-500",
    gradient: "bg-violet-900/20",
    glow: "shadow-violet-500/60",
    visualizer: {
      listening: "rgba(139, 92, 246, 1)", // violet-500
      processing: "rgba(34, 211, 238, 1)", // cyan-400
      speaking: "rgba(244, 114, 182, 1)", // pink-400
      idle: "rgba(100, 116, 139, 1)", // slate-500
    },
  },
  midnight: {
    bg: "bg-[#000814]",
    accent: "from-blue-600 to-cyan-400",
    gradient: "bg-blue-900/30",
    glow: "shadow-blue-500/60",
    visualizer: {
      listening: "rgba(37, 99, 235, 1)", // blue-600
      processing: "rgba(103, 232, 249, 1)", // cyan-300
      speaking: "rgba(56, 189, 248, 1)", // sky-400
      idle: "rgba(71, 85, 105, 1)", // slate-600
    },
  },
  cyber: {
    bg: "bg-[#020502]",
    accent: "from-green-500 to-emerald-400",
    gradient: "bg-green-900/20",
    glow: "shadow-green-500/60",
    visualizer: {
      listening: "rgba(34, 197, 94, 1)", // green-500
      processing: "rgba(110, 231, 183, 1)", // emerald-300
      speaking: "rgba(16, 185, 129, 1)", // emerald-500
      idle: "rgba(51, 65, 85, 1)", // slate-700
    },
  },
  royal: {
    bg: "bg-[#0c0800]",
    accent: "from-amber-500 to-yellow-600",
    gradient: "bg-amber-900/30",
    glow: "shadow-amber-500/60",
    visualizer: {
      listening: "rgba(245, 158, 11, 1)", // amber-500
      processing: "rgba(252, 211, 77, 1)", // yellow-300
      speaking: "rgba(251, 191, 36, 1)", // amber-400
      idle: "rgba(120, 113, 108, 1)", // stone-500
    },
  },
  blood: {
    bg: "bg-[#050a14]", // Deep space navy/black
    accent: "from-cyan-600 to-teal-500",
    gradient: "bg-cyan-950/20",
    glow: "shadow-cyan-500/60",
    visualizer: {
      listening: "rgba(34, 211, 238, 1)", // cyan-400
      processing: "rgba(103, 232, 249, 1)", // cyan-300
      speaking: "rgba(45, 212, 191, 1)", // teal-400
      idle: "rgba(34, 211, 238, 0.6)", // cyan-400 muted
    },
  },
  neon: {
    bg: "bg-[#0b001a]",
    accent: "from-fuchsia-500 to-cyan-400",
    gradient: "bg-fuchsia-900/20",
    glow: "shadow-fuchsia-500/60",
    visualizer: {
      listening: "rgba(217, 70, 239, 1)", // fuchsia-500
      processing: "rgba(34, 211, 238, 1)", // cyan-400
      speaking: "rgba(192, 38, 211, 1)", // fuchsia-600
      idle: "rgba(59, 7, 100, 1)", // purple-950
    },
  },
  toxic: {
    bg: "bg-[#0a0f00]",
    accent: "from-lime-400 to-yellow-500",
    gradient: "bg-lime-900/20",
    glow: "shadow-lime-500/60",
    visualizer: {
      listening: "rgba(163, 230, 53, 1)", // lime-400
      processing: "rgba(250, 204, 21, 1)", // yellow-400
      speaking: "rgba(132, 204, 22, 1)", // lime-500
      idle: "rgba(45, 59, 10, 1)", // lime-950
    },
  },
};
