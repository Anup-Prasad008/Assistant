import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, AlertTriangle } from "lucide-react";
import { getBunnyResponse, getBunnyAudio, resetBunnySession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";
import { THEMES, ThemeName } from "./constants";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "bunny";
  text: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("bunny_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("bunny_chat_history", JSON.stringify(messages));
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentThemeName] = useState<ThemeName>("blood");
  const [mobileActiveView, setMobileActiveView] = useState<"stats" | "core" | "chat">("core");
  const [keyMissingError, setKeyMissingError] = useState<boolean>(false);

  useEffect(() => {
    // Check if any key is available
    const hasKey = !!(
      (process as any).env?.GEMINI_API_KEY || 
      (process as any).env?.OPENAI_API_KEY ||
      // @ts-ignore
      import.meta.env?.VITE_GEMINI_API_KEY ||
      // @ts-ignore
      import.meta.env?.VITE_OPENAI_API_KEY
    );
    if (!hasKey) {
      console.error("Neural Link: API Keys missing in environment.");
      setKeyMissingError(true);
    }
  }, []);

  const theme = THEMES[currentThemeName];

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const generateId = (prefix: string) => {
    const randomPart = Math.random().toString(36).substring(2, 15);
    const timePart = Date.now().toString(36);
    return `${prefix}-${timePart}-${randomPart}`;
  };

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    setMessages((prev) => [...prev, { id: generateId("user"), sender: "user", text: finalTranscript }]);
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for browser commands
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: generateId("bunny"), sender: "bunny", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getBunnyAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini
      responseText = await getBunnyResponse(finalTranscript, messagesRef.current);
      setMessages((prev) => [...prev, { id: generateId("bunny"), sender: "bunny", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getBunnyAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetBunnySession();
    } else {
      try {
        // Check for API key if using Live
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === "function") {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey && typeof window.aistudio.openSelectKey === "function") {
            await window.aistudio.openSelectKey();
            // Proceed anyway as per skill recommendation
          }
        }

        setIsSessionActive(true);
        resetBunnySession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: generateId(sender), sender, text }]);
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        await session.start();
      } catch (e) {
        console.error("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className={`h-[100dvh] w-screen ${theme.bg} text-white flex flex-col font-sans relative overflow-hidden m-0 p-0 transition-colors duration-700 select-none antialiased`}>
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* BACKGROUND HUD LAYER */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] ${theme.gradient} blur-[120px] rounded-full transition-all duration-700 opacity-20`} />
        <div className={`absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] ${theme.gradient} blur-[120px] rounded-full transition-all duration-700 opacity-10`} />
        
        {/* Infinite Futuristic Grid */}
        <div className="absolute inset-0 perspective-grid overflow-hidden">
          <div className="absolute inset-0 grid-plane opacity-10" />
        </div>

        {/* Global HUD Scanning Effect */}
        <div className="absolute top-0 left-0 w-full scan-line pointer-events-none opacity-10 z-10" />
      </div>

      {/* KEY MISSING WARNING */}
      {keyMissingError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md bg-red-500/20 border border-red-500/50 backdrop-blur-3xl p-4 rounded-xl text-center shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <div className="text-red-400 font-mono text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
            <AlertTriangle size={14} className="animate-pulse" /> System Critical: API Failure
          </div>
          <p className="text-[10px] text-white/70 font-mono leading-relaxed">
            Boss, API keys nahi mil rahe hain. GitHub par chalane ke liye: <br/>
            1. <strong>Settings &gt; Secrets</strong> mein jaao. <br/>
            2. <code>VITE_OPENAI_API_KEY</code> (OpenAI ke liye) add karo. <br/>
            3. Page ko refresh karo.
          </p>
          <button 
            onClick={() => setKeyMissingError(false)}
            className="mt-3 px-4 py-1 border border-white/20 rounded-full text-[9px] font-mono text-white/50 hover:bg-white/5 transition-colors"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* HUD TOP BAR */}
      <header className="relative w-full h-14 md:h-16 border-b border-white/5 flex justify-between items-center px-4 md:px-6 z-50 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-2 md:gap-4">
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1.5 md:gap-2 text-[9px] md:text-xs font-mono tracking-[0.2em] md:tracking-[0.3em] text-cyan-400"
          >
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]" />
            <span className="hidden xs:inline">BUNNY.OS</span> v2.0
          </motion.div>
          <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
          <div className="text-[8px] md:text-[10px] font-mono opacity-40 uppercase tracking-widest hidden sm:block">
            Link: Online
          </div>
        </div>

        {/* Center Clock HUD - Responsive scaling */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-8 text-[9px] md:text-[11px] font-mono tracking-widest opacity-80 bg-white/5 px-3 md:px-6 py-1 md:py-1.5 rounded-full border border-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-1.5 md:gap-3">
            <span className="text-cyan-400 font-bold hidden xs:inline">TIME:</span>
            <span className="text-white drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-1.5 md:gap-3">
            <span className="text-cyan-400 font-bold hidden xs:inline">DATE:</span>
            <span className="text-white drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
           {/* Secondary status on desktop */}
           <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-white/30 uppercase">
             <span>SECURE</span>
             <div className="w-1 h-1 bg-green-500 rounded-full" />
           </div>
        </div>
      </header>

      {/* DASHBOARD CORE LAYOUT */}
      <main className="flex-1 flex w-full h-full relative z-10 overflow-hidden pb-16 md:pb-0">
        
      {/* LEFT HUD: SYSTEM WIDGETS */}
        <aside className={`w-80 h-full flex-col gap-4 p-4 border-r border-white/5 bg-black/20 backdrop-blur-md overflow-y-auto scrollbar-hide ${mobileActiveView === 'stats' ? 'flex w-full absolute inset-0 z-40 bg-black/90' : 'hidden xl:flex'}`}>
          
          {/* Module: System Health */}
          <div className="flex flex-col gap-3 p-4 bg-cyan-500/5 border-l-2 border-l-cyan-500 border border-white/5 rounded-r-xl relative overflow-hidden group backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan-400 animate-pulse" />
                Core Systems
              </div>
            </div>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] opacity-60 font-mono tracking-tighter">
                  <span>NEURAL LOAD</span>
                  <span>{appState === 'processing' ? '94.2%' : '12.8%'}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    animate={{ width: appState === 'processing' ? "94.2%" : "12.8%" }}
                    className="h-full bg-cyan-400 shadow-[0_0_10px_cyan]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] opacity-60 font-mono tracking-tighter">
                  <span>MEM BUFFER</span>
                  <span>4,812 MB / 16,384 MB</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full w-[29%] bg-violet-500 shadow-[0_0_10px_violet]" />
                </div>
              </div>
            </div>
          </div>

          {/* Module: Atmospheric Sensor */}
          <div className="flex flex-col gap-3 p-4 bg-cyan-500/5 border-l-2 border-l-cyan-500 border border-white/5 rounded-r-xl relative overflow-hidden group backdrop-blur-xl shadow-lg">
             <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan-400 animate-pulse" />
                Faridabad Station
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="text-3xl font-mono tracking-tighter text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">24.5°C</div>
              <div className="text-[9px] text-right font-mono opacity-50 leading-tight">
                HARYANA, IN<br/>AZIMUTH: 182°<br/>HUMIDITY: 42%
              </div>
            </div>
          </div>

          {/* Module: Optical Feed */}
          <div className="flex-1 flex flex-col gap-3 p-4 bg-white/5 border border-white/10 rounded-xl overflow-hidden relative backdrop-blur-xl">
            <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400 uppercase">
              <span>Optical Stream</span>
              <div className={`w-2 h-2 rounded-full ${isSessionActive ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`} />
            </div>
            <div className="flex-1 border border-white/10 rounded-lg flex flex-col items-center justify-center relative overflow-hidden bg-black/60 group">
              {/* Camera CRT Effect overlay */}
              <div className="absolute inset-0 pointer-events-none z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,rgba(0,128,0,0.2)_0%,rgba(0,0,0,0.8)_100%)] z-10" />
              
              {isSessionActive ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-[10px] font-mono text-red-400 uppercase tracking-widest animate-pulse font-bold">
                    [ RECORDING ]
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <motion.div 
                        key={`optical-feed-bar-${i}`}
                        animate={{ height: [8, 20, 8] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        className="w-1 bg-cyan-400 shadow-[0_0_5px_cyan]"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 opacity-30 group-hover:opacity-50 transition-opacity">
                  <MicOff size={32} />
                  <span className="text-[9px] font-mono uppercase tracking-[0.3em]">Standby State</span>
                </div>
              )}
            </div>
          </div>

          {/* Module: About Bunny */}
          <div className="flex flex-col gap-3 p-4 bg-cyan-500/5 border-l-2 border-l-cyan-500 border border-white/5 rounded-r-xl relative overflow-hidden group backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan-400 animate-pulse" />
                Subsystem Profile
              </div>
            </div>
            <div className="pt-2 space-y-3">
              <p className="text-[10px] font-mono text-white/70 leading-relaxed tracking-tight">
                <span className="text-cyan-400 font-bold">BUNNY</span> is an advanced Neural Subsystem engineered for seamless human-machine synergy.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-2 rounded border border-white/5">
                  <div className="text-[8px] opacity-40 uppercase mb-1">Personality</div>
                  <div className="text-[9px] text-cyan-300 font-bold uppercase tracking-tighter">Witty & Sharp</div>
                </div>
                <div className="bg-white/5 p-2 rounded border border-white/5">
                  <div className="text-[8px] opacity-40 uppercase mb-1">Creator</div>
                  <div className="text-[9px] text-cyan-300 font-bold uppercase tracking-tighter">Anup Prasad</div>
                </div>
              </div>
              <button 
                onClick={() => handleTextCommand("Introduce yourself and mention your creator Anup Prasad")}
                className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/30 rounded text-[9px] font-mono uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
              >
                <Volume2 size={12} className="text-cyan-400" />
                Initialize Intro
              </button>
            </div>
          </div>

          {/* Module: System Uptime */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center">
            <div className="text-[9px] font-mono opacity-50 uppercase tracking-widest">Neural Uptime</div>
            <div className="text-xs font-mono text-cyan-400">00:42:15:08</div>
          </div>
        </aside>

        {/* CENTRAL CORE: THE NEXUS VISUALIZER */}
        <section className={`flex-1 relative items-center justify-center overflow-hidden ${mobileActiveView === 'core' ? 'flex' : 'hidden md:flex'}`}>
          {/* Background HUD Accents */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/20 rounded-full" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-cyan-500/10 rounded-full" />
             <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-500/10" />
             <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-500/10" />
          </div>

          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <div className="z-10 w-[80%] h-[80%] flex items-center justify-center">
              <Visualizer state={appState} theme={theme} />
            </div>
            
            {/* HUD Central Info */}
            <div className="absolute bottom-16 flex flex-col items-center gap-8 z-30 pointer-events-auto">
              <div className="flex flex-col items-center gap-1">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-cyan-400 font-mono text-[10px] tracking-[0.5em] font-bold uppercase mb-2"
                >
                  Neural Interface v2.0
                </motion.div>
                <div className="text-center font-mono uppercase tracking-[0.4em] text-[10px] opacity-40">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={appState}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                    >
                      {appState === 'idle' ? 'Scanning for wake word...' : 
                       appState === 'listening' ? 'Acquiring input data stream...' :
                       appState === 'processing' ? 'Synthesizing output buffer...' : 
                       'Broadcasting audio transmission'}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* HUD Main Control Button */}
              <div className="flex items-center gap-6">
                <button
                  onClick={toggleListening}
                  className="group relative flex items-center justify-center"
                >
                  <div className={`absolute -inset-4 rounded-full blur-2xl transition-all duration-700 opacity-20 group-hover:opacity-40 ${isSessionActive ? 'bg-red-500' : 'bg-cyan-500'}`} />
                  <div className={`w-20 h-20 rounded-full border flex items-center justify-center backdrop-blur-2xl transition-all duration-500 relative z-10 ${
                    isSessionActive ? 'border-red-500 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'border-white/20 text-white/60 hover:border-cyan-400 hover:text-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]'
                  }`}>
                    {isSessionActive ? <MicOff size={28} /> : <Mic size={28} />}
                    {/* Rotating Border Accent */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className={`absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400/30 opacity-40`}
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* HUD Corner Accents */}
          <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/10" />
          <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-white/10" />
          <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-white/10" />
          <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/10" />
        </section>

        {/* RIGHT HUD: CONVERSATION MODULE */}
        <aside className={`w-80 lg:w-[400px] h-full flex flex-col border-l border-white/5 bg-black/40 backdrop-blur-3xl z-40 ${mobileActiveView === 'chat' ? 'flex w-full absolute inset-0 z-40 bg-black/90' : 'hidden lg:flex'}`}>
          <div className="h-14 border-b border-white/5 flex justify-between items-center px-6">
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-[0.4em] font-bold flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-cyan-400 animate-pulse" />
              Conversation Log
            </span>
            <div className="flex gap-4 items-center">
              <button 
                onClick={() => setMessages([])} 
                className="text-[9px] font-mono flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/40 px-2 py-1 rounded transition-all duration-300 text-white/40 hover:text-red-400"
                title="Clear Logs"
              >
                <Trash2 size={10} /> CLEAR
              </button>
              <div className="h-4 w-px bg-white/10" />
              <button onClick={() => setIsMuted(!isMuted)} className={`transition-colors ${isMuted ? 'text-red-400' : 'text-white/40 hover:text-white'}`}>
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <button onClick={() => setShowTextInput(!showTextInput)} className={`transition-colors ${showTextInput ? 'text-cyan-400' : 'text-white/40 hover:text-white'}`}>
                <Keyboard size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-6">
            <AnimatePresence mode="popLayout" initial={false}>
              {messages.length === 0 && (
                <div key="empty-state" className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                  <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center mb-6">
                    <Send size={24} className="opacity-40" />
                  </div>
                  <div className="space-y-2 font-mono text-[10px] tracking-widest uppercase">
                    <p>Subsystem Waiting</p>
                    <p>Encryption: Active</p>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  key={`${msg.id}-${i}`}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`px-5 py-3 rounded-2xl text-xs md:text-sm max-w-[90%] font-mono tracking-tight leading-relaxed shadow-lg relative ${
                    msg.sender === 'user' 
                      ? 'bg-white/5 border border-white/10 text-white rounded-br-none' 
                      : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-100 rounded-bl-none'
                  }`}>
                    {msg.sender === 'bunny' && (
                       <div className="absolute -top-4 -left-1 text-[8px] opacity-40 font-bold uppercase tracking-widest text-cyan-400">
                         Bunny.sys
                       </div>
                    )}
                    {msg.sender === 'user' && (
                       <div className="absolute -top-4 -right-1 text-[8px] opacity-40 font-bold uppercase tracking-widest text-white">
                         Authenticated User
                       </div>
                    )}
                    {msg.text}
                  </div>
                  <span className="text-[8px] mt-2 opacity-20 font-mono uppercase tracking-[0.2em] font-bold px-2">
                    Recieved: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </AnimatePresence>
          </div>

          {/* HUD Command Console */}
          <div className="p-6 border-t border-white/5 bg-black/60 relative">
            <AnimatePresence>
              {showTextInput ? (
                <motion.form 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onSubmit={handleTextSubmit} 
                  className="flex gap-3 pointer-events-auto"
                >
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="ENTER COMMAND SEQUENCE..."
                    autoFocus
                    className="flex-1 bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 focus:bg-cyan-500/5 transition-all uppercase tracking-wider"
                  />
                  <button 
                    type="submit"
                    className="bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-black px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] transition-all shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                  >
                    SEND
                  </button>
                </motion.form>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-2 cursor-pointer group" onClick={() => setShowTextInput(true)}>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <motion.div 
                        key={`console-standby-dot-${i}`} 
                        animate={{ opacity: [0.2, 1, 0.2] }} 
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400/40" 
                      />
                    ))}
                  </div>
                  <span className="text-[8px] font-mono text-cyan-400/40 uppercase tracking-[0.4em] font-bold group-hover:text-cyan-400/80 transition-colors">Neural Interface Standby</span>
                </div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </main>

      {/* MOBILE HUD NAVIGATION */}
      <footer className="md:hidden fixed bottom-4 left-4 right-4 h-14 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center justify-around px-2 z-[100] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <button 
          onClick={() => setMobileActiveView("stats")}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${mobileActiveView === 'stats' ? 'text-cyan-400 scale-110' : 'text-white/40'}`}
        >
          <div className={`w-1 h-1 rounded-full mb-0.5 transition-all ${mobileActiveView === 'stats' ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-transparent'}`} />
          <div className="p-1.5"><Loader2 size={18} className={mobileActiveView === 'stats' ? 'animate-spin-slow' : ''} /></div>
          <span className="text-[8px] font-mono font-bold tracking-widest uppercase">STATS</span>
        </button>
        
        <div className="h-8 w-px bg-white/5" />

        <button 
          onClick={() => setMobileActiveView("core")}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${mobileActiveView === 'core' ? 'text-cyan-400 scale-110' : 'text-white/40'}`}
        >
          <div className={`w-1 h-1 rounded-full mb-0.5 transition-all ${mobileActiveView === 'core' ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-transparent'}`} />
          <div className="p-1.5"><div className="w-5 h-5 rounded-full border-2 border-current animate-pulse" /></div>
          <span className="text-[8px] font-mono font-bold tracking-widest uppercase">CORE</span>
        </button>

        <div className="h-8 w-px bg-white/5" />

        <button 
          onClick={() => setMobileActiveView("chat")}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${mobileActiveView === 'chat' ? 'text-cyan-400 scale-110' : 'text-white/40'}`}
        >
          <div className={`w-1 h-1 rounded-full mb-0.5 transition-all ${mobileActiveView === 'chat' ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-transparent'}`} />
          <div className="p-1.5"><Send size={18} /></div>
          <span className="text-[8px] font-mono font-bold tracking-widest uppercase">CHAT</span>
        </button>
      </footer>

    </div>
  );
}
