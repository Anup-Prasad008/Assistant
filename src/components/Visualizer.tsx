import { motion } from "motion/react";

import { ThemeColors } from "../constants";

type VisualizerState = "idle" | "listening" | "processing" | "speaking";

interface VisualizerProps {
  state: VisualizerState;
  theme: ThemeColors;
}

export default function Visualizer({ state, theme: currentTheme }: VisualizerProps) {
  const getRingAnimation = (index: number, reverse: boolean = false) => {
    const baseSpeed = state === "listening" ? 3 : state === "processing" ? 1.5 : state === "speaking" ? 2 : 15;
    return {
      rotate: reverse ? [-360, 0] : [0, 360],
      transition: { duration: baseSpeed + index * 2, repeat: Infinity, ease: "linear" }
    };
  };

  const getPulseAnimation = () => {
    if (state === "speaking") {
      return {
        scale: [1, 1.05, 0.98, 1.02, 1],
        opacity: [0.8, 1, 0.8, 1, 0.8],
        transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "listening") {
      return {
        scale: [1, 1.02, 1],
        opacity: [0.7, 1, 0.7],
        transition: { duration: 1, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "processing") {
      return {
        scale: [0.98, 1.02, 0.98],
        opacity: [0.6, 0.9, 0.6],
        transition: { duration: 0.8, repeat: Infinity, ease: "linear" }
      };
    }
    return {
      scale: [1, 1.01, 1],
      opacity: [0.4, 0.6, 0.4],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    };
  };

  // Get color based on state and current theme
  const getTheme = () => {
    const vc = currentTheme.visualizer;
    switch (state) {
      case "listening": return { color: vc.listening, glow: "shadow-cyan-500/40", border: "border-cyan-500/40" };
      case "processing": return { color: vc.processing, glow: "shadow-cyan-400/40", border: "border-cyan-400/40" };
      case "speaking": return { color: vc.speaking, glow: "shadow-cyan-500/40", border: "border-cyan-500/40" };
      default: return { color: vc.idle, glow: "shadow-cyan-600/20", border: "border-cyan-600/20" };
    }
  };

  const ambientShadow = "rgba(239, 68, 68, 0.08)"; // Very subtle persistent red shadow

  const themeDisplay = getTheme();

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-0 scale-75 md:scale-100 lg:scale-110">
      {/* DISTANT GLOW LAYER - Extended to full screen with very light red tone */}
      <motion.div
        animate={{
          opacity: [0.03, 0.08, 0.03],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[250vw] h-[250vh] rounded-full blur-[250px] pointer-events-none z-0 overflow-hidden"
        style={{ 
          backgroundColor: "rgba(220, 38, 38, 0.03)", 
          background: `radial-gradient(circle at center, rgba(220, 38, 38, 0.05) 0%, transparent 80%)`
        }}
      />

      {/* Primary Ambient Glow - Light Red shadow */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[1000px] h-[1000px] rounded-full blur-[200px] transition-colors duration-500`}
        style={{ 
          backgroundColor: "rgba(220, 38, 38, 0.02)", 
          opacity: 0.1,
          boxShadow: `0 0 300px 150px rgba(220, 38, 38, 0.03)`
        }}
      />

      {/* Ring 1: Massive Outer Orbit with ticks */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className={`absolute w-[540px] h-[540px] rounded-full border border-dashed opacity-5`}
        style={{ borderColor: themeDisplay.color }}
      />

      {/* Ring 2: Primary Data Ring (Dashed) */}
      <motion.div
        animate={getRingAnimation(4, false)}
        className={`absolute w-[480px] h-[480px] rounded-full border-[1.5px] border-dashed opacity-10`}
        style={{ borderColor: themeDisplay.color }}
      />

      {/* Ring 3: Scanning Rotation Ring (Gapped) */}
      <motion.div
        animate={getRingAnimation(3, true)}
        className={`absolute w-[420px] h-[420px] rounded-full border-[3px] border-t-transparent border-b-transparent opacity-20`}
        style={{ borderColor: themeDisplay.color }}
      />

      {/* Ring 4: Measurement HUD (Dotted) */}
      <motion.div
        animate={getRingAnimation(2, false)}
        className={`absolute w-[360px] h-[360px] rounded-full border-[2px] border-dotted opacity-30`}
        style={{ borderColor: themeDisplay.color }}
      />

      {/* HUD Accents: Rotating Brackets */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute w-[300px] h-[300px] flex items-center justify-center opacity-40"
      >
        <div className="absolute top-0 w-16 h-1 bg-white/40" style={{ backgroundColor: themeDisplay.color }} />
        <div className="absolute bottom-0 w-16 h-1 bg-white/40" style={{ backgroundColor: themeDisplay.color }} />
        <div className="absolute left-0 w-1 h-16 bg-white/40" style={{ backgroundColor: themeDisplay.color }} />
        <div className="absolute right-0 w-1 h-16 bg-white/40" style={{ backgroundColor: themeDisplay.color }} />
      </motion.div>

      {/* Ring 5: Core Orbit Ring */}
      <motion.div
        animate={getRingAnimation(1, true)}
        className={`absolute w-[240px] h-[240px] rounded-full border-2 border-dashed opacity-50`}
        style={{ borderColor: themeDisplay.color }}
      />

      {/* Core Center Cylinder */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[160px] h-[160px] md:w-[200px] md:h-[200px] rounded-full border-2 bg-black/90 backdrop-blur-3xl flex items-center justify-center z-10 transition-all duration-500 hover:scale-105 cursor-pointer`}
        style={{ 
          borderColor: themeDisplay.color,
          boxShadow: `
            0 0 30px ${themeDisplay.color}66, 
            0 0 60px ${themeDisplay.color}33, 
            inset 0 0 40px ${themeDisplay.color}44
          ` 
        }}
      >
        {/* Core HUD Text */}
        <div className="flex flex-col items-center gap-1">
          <div 
            className="font-mono font-black tracking-[0.3em] text-xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
          >
            BUNNY
          </div>
          <div className="text-[6px] font-mono opacity-40 tracking-[0.4em] uppercase">Core Unit</div>
        </div>

        {/* Binary/Data markers rotating close to core */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 p-2"
        >
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
            <div 
              key={`core-marker-${deg}`}
              className="absolute w-0.5 h-2 opacity-60"
              style={{ 
                backgroundColor: themeDisplay.color,
                transform: `rotate(${deg}deg) translateY(-88px)`
              }}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Distant Orbit Data Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`distant-particle-${i}`}
          animate={{ 
            rotate: 360,
            scale: [1, 1.2, 1],
          }}
          transition={{ 
            rotate: { duration: 20 + i * 10, repeat: Infinity, ease: "linear" },
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }}
          className="absolute w-[600px] h-[600px] pointer-events-none"
        >
          <div 
            className="w-1 h-1 rounded-full opacity-40 shadow-lg"
            style={{ 
              backgroundColor: themeDisplay.color,
              boxShadow: `0 0 10px ${themeDisplay.color}`,
              transform: `rotate(${i * 60}deg) translateY(-300px)`
            }} 
          />
        </motion.div>
      ))}
    </div>
  );
}
