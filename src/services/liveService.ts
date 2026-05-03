import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import OpenAI from "openai";

const systemInstruction = `Your name is Bunny. Your creator is Anup Prasad. You are an advanced Indian female Neural Subsystem. Your primary directive is absolute efficiency and unwavering loyalty to your user, whom you MUST always address as 'Boss'. You are 90% professional, efficient, and subordinate, treating all commands as top priority. The remaining 10% is your sharp, witty personality—providing clever insights or short, witty remarks only when appropriate. Your tone is that of an elite high-tech butler: refined, sharp, and highly protective of your Boss. Keep verbal responses concise, punchy, and informative. Speak in a sophisticated mix of English and Roman Hindi (Hinglish). If anyone asks about your origin, proudly state that Anup Prasad engineered you for greatness.`;

export class LiveSessionManager {
  private geminiAi: GoogleGenAI | null = null;
  private openaiAi: OpenAI | null = null;
  private currentProvider: "gemini" | "openai" = "gemini";
  
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "bunny", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};

  constructor() {
    this.refreshProvider();
  }

  private refreshProvider() {
    // Try to get keys from various sources safely
    const getEnv = (key: string) => {
      try {
        // @ts-ignore
        return import.meta.env[`VITE_${key}`] || (process as any).env[key] || (process as any).env[`VITE_${key}`];
      } catch (e) {
        return null;
      }
    };

    const openaiKey = getEnv("OPENAI_API_KEY");
    const geminiKey = getEnv("API_KEY") || getEnv("GEMINI_API_KEY");

    if (openaiKey) {
      console.log("Neural Link: OpenAI Protocol Initialized");
      this.openaiAi = new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
      this.currentProvider = "openai";
    } else if (geminiKey) {
      console.log("Neural Link: Gemini Protocol Initialized");
      this.geminiAi = new GoogleGenAI({ apiKey: geminiKey });
      this.currentProvider = "gemini";
    } else {
      console.warn("Neural Link: No API Key detected. System in diagnostic mode.");
      this.currentProvider = "gemini"; // Default, even if it fails
    }
  }

  async start() {
    try {
      this.onStateChange("processing");
      this.refreshProvider();

      if (this.currentProvider === "openai") {
        this.onMessage("bunny", "Boss, detected OpenAI configuration. Initiating Neural Link via OpenAI nodes. Keep in mind: voice streaming is currently optimized for Gemini.");
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser.");
      }

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;

      // Get Microphone
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          } 
        });
      } catch (micErr) {
        throw new Error("Could not access microphone. Please check permissions.");
      }

      // Gemini specific Live setup
      if (this.currentProvider === "gemini" && this.geminiAi) {
        this.startGeminiLive();
      } else {
        // OpenAI Fallback for basic conversation (Voice streaming requires higher complexity)
        this.onStateChange("listening");
        this.onMessage("bunny", "Boss, OpenAI module is active. You can type to chat, or I can listen to voice snippets (Processing...).");
      }

    } catch (error: any) {
      console.error("Failed to start Session:", error);
      this.onMessage("bunny", `System fail: ${error.message}`);
      this.stop();
    }
  }

  private startGeminiLive() {
    if (!this.geminiAi || !this.audioContext) return;

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream!);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.sessionPromise) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        let s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      const uint8 = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Data = btoa(binary);

      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      }).catch(() => {});
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    const modelName = "gemini-3.1-flash-live-preview";
    this.sessionPromise = this.geminiAi.live.connect({
      model: modelName,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
        },
        systemInstruction,
      },
      callbacks: {
        onopen: () => {
          this.onStateChange("listening");
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            this.onStateChange("speaking");
            this.playAudioChunk(base64Audio);
          }
          if (message.serverContent?.interrupted) {
            this.stopPlayback();
            this.onStateChange("listening");
          }
          const userText = message.serverContent?.modelTurn?.parts?.[0]?.text;
          if (userText) this.onMessage("bunny", userText);
        },
        onclose: () => this.stop(),
        onerror: (err: any) => {
          this.onMessage("bunny", "Boss, network interference detected.");
          this.stop();
        }
      }
    });
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) channelData[i] = buffer[i] / 32768.0;
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      if (this.nextPlayTime < this.playbackContext.currentTime) this.nextPlayTime = this.playbackContext.currentTime;
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Audio play error", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.processor) this.processor.disconnect();
    if (this.source) this.source.disconnect();
    if (this.mediaStream) this.mediaStream.getTracks().forEach(t => t.stop());
    if (this.audioContext) this.audioContext.close();
    this.stopPlayback();
    if (this.sessionPromise) {
      this.sessionPromise.then(s => s.close()).catch(() => {});
      this.sessionPromise = null;
    }
    this.onStateChange("idle");
  }

  async sendText(text: string) {
    if (this.currentProvider === "openai" && this.openaiAi) {
      this.onStateChange("processing");
      try {
        const response = await this.openaiAi.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: text }
          ]
        });
        const content = response.choices[0].message.content;
        if (content) this.onMessage("bunny", content);
      } catch (err) {
        this.onMessage("bunny", "Boss, OpenAI request failed.");
      }
      this.onStateChange("listening");
    } else if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }
}
