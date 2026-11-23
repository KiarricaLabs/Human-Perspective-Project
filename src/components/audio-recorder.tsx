import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = { onFile: (f: File) => void };

export function AudioRecorder({ onFile }: Props) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  if (typeof MediaRecorder === "undefined") {
    if (supported) setSupported(false);
    return supported ? null : <p className="text-xs text-muted-foreground">Recording not supported in this browser.</p>;
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
        onFile(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mrRef.current = mr;
      setRecording(true);
    } catch {
      setSupported(false);
    }
  }

  function stop() {
    mrRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="flex items-center gap-2">
      {!recording ? (
        <Button type="button" variant="outline" size="sm" onClick={start}>Record audio</Button>
      ) : (
        <Button type="button" size="sm" onClick={stop}>Stop &amp; use recording</Button>
      )}
    </div>
  );
}
