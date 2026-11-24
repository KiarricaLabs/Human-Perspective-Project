import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = { onTranscript: (text: string) => void; onAudioFile?: (f: File) => void; label?: string };

export function VoiceDictation({ onTranscript, onAudioFile, label = "Dictate" }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setTranscript(finalText + interim);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  useEffect(() => {
    if (listening) {
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [listening]);

  if (!supported) {
    return (
      <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground shadow-lg">
        Voice dictation not supported in this browser.
      </div>
    );
  }

  async function toggle() {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      try { mrRef.current?.stop(); } catch {}
      setListening(false);
      if (transcript.trim()) onTranscript(transcript.trim());
      setTranscript("");
    } else {
      setTranscript("");
      chunksRef.current = [];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
          const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
          onAudioFile?.(file);
          stream.getTracks().forEach((t) => t.stop());
        };
        mr.start();
        mrRef.current = mr;
        rec.start();
        setListening(true);
      } catch {}
    }
  }

  function save() {
    if (transcript.trim()) onTranscript(transcript.trim());
    try { recRef.current?.stop(); } catch {}
    try { mrRef.current?.stop(); } catch {}
    setListening(false);
    setTranscript("");
  }

  function discard() {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
    setTranscript("");
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {listening && (
        <div className="w-80 max-w-[90vw] rounded-lg border border-border bg-card p-3 text-sm shadow-lg">
          <p className="mb-2 font-semibold text-primary">Review your words</p>
          <p className="max-h-32 overflow-auto whitespace-pre-wrap text-foreground/80">{transcript || "Speak now…"}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={save}>Save to field</Button>
            <Button size="sm" variant="outline" onClick={discard}>Discard</Button>
          </div>
        </div>
      )}
      <div className="flex h-14 w-72 max-w-[90vw] items-center gap-3 rounded-full bg-[#1F2A44] px-3 shadow-md">
        <button
          type="button"
          onClick={toggle}
          aria-label={listening ? "Stop recording" : `Start ${label}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F04B4B]"
        >
          <span className="block h-3.5 w-3.5 rounded-sm bg-white" />
        </button>
        <div className="flex flex-col leading-tight">
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-white">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F04B4B]" /> REC
          </span>
          <span className="text-xs text-white/90">{mm}:{ss}</span>
        </div>
        <div className="ml-auto flex h-8 items-end gap-[2px]">
          {Array.from({ length: 24 }).map((_, i) => {
            const h = listening ? 4 + Math.round(Math.abs(Math.sin((i + seconds) * 0.9)) * 18) : 4 + (i % 3) * 2;
            return <span key={i} className="w-[2px] rounded-full bg-white" style={{ height: `${h}px` }} />;
          })}
        </div>
      </div>
      {!listening && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
