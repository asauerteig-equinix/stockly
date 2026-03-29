"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

import { Button } from "@/components/ui/button";

type BarcodeScannerProps = {
  onDetected: (barcode: string) => boolean | Promise<boolean>;
};

const scannerHints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.CODABAR,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.EAN_8,
      BarcodeFormat.EAN_13,
      BarcodeFormat.ITF,
      BarcodeFormat.PDF_417,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.RSS_14,
      BarcodeFormat.RSS_EXPANDED,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E
    ]
  ]
]);

function normalizeDetectedBarcode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastDetectedRef = useRef<{ barcode: string; timestamp: number }>({
    barcode: "",
    timestamp: 0
  });
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureAudioContext() {
    if (typeof window === "undefined" || !window.AudioContext) {
      return null;
    }

    const audioContext = audioContextRef.current ?? new window.AudioContext();
    audioContextRef.current = audioContext;

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch {
        return audioContext;
      }
    }

    return audioContext;
  }

  function playFeedbackTone(type: "success" | "error") {
    const audioContext = audioContextRef.current;

    if (!audioContext || audioContext.state !== "running") {
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startAt = audioContext.currentTime;

    oscillator.type = type === "success" ? "sine" : "triangle";

    if (type === "success") {
      oscillator.frequency.setValueAtTime(880, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(1320, startAt + 0.08);
    } else {
      oscillator.frequency.setValueAtTime(440, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(220, startAt + 0.14);
    }

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(type === "success" ? 0.12 : 0.08, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + (type === "success" ? 0.18 : 0.22));

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + (type === "success" ? 0.18 : 0.22));
  }

  function explainScannerError(scannerError?: unknown) {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return "Kamera-Scan braucht HTTPS oder localhost. Ueber normales HTTP blockiert der Browser den Kamerazugriff komplett.";
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return "Dieser Browser stellt keinen Kamera-Zugriff bereit. Bitte HTTPS verwenden oder den Barcode manuell eingeben.";
    }

    if (scannerError && typeof scannerError === "object" && "name" in scannerError) {
      const errorName = String(scannerError.name);

      if (errorName === "NotAllowedError" || errorName === "SecurityError") {
        return "Kamera-Zugriff wurde blockiert. Bitte Browserberechtigung und HTTPS-Kontext pruefen.";
      }

      if (errorName === "NotFoundError") {
        return "Es wurde keine Kamera gefunden. Bitte Barcode manuell eingeben.";
      }

      if (errorName === "NotReadableError") {
        return "Die Kamera ist bereits in Benutzung oder konnte nicht geoeffnet werden.";
      }

      if (errorName === "OverconstrainedError") {
        return "Die angeforderte Kameraeinstellung wird von diesem Geraet nicht unterstuetzt.";
      }
    }

    return "Scanner konnte nicht gestartet werden. Bitte pruefen Sie Kameraberechtigung und HTTPS-Kontext.";
  }

  useEffect(() => {
    if (!active || !videoRef.current) {
      return;
    }

    let stopped = false;
    const reader = new BrowserMultiFormatReader(scannerHints, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 900
    });
    const videoElement = videoRef.current;

    async function startScanner() {
      try {
        setError(null);

        if (typeof window !== "undefined" && !window.isSecureContext) {
          setError(explainScannerError());
          return;
        }

        await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          },
          videoElement,
          (result) => {
            if (!result || stopped) {
              return;
            }

            const normalizedBarcode = normalizeDetectedBarcode(result.getText());

            if (!normalizedBarcode) {
              return;
            }

            const now = Date.now();
            const isDuplicate =
              lastDetectedRef.current.barcode === normalizedBarcode && now - lastDetectedRef.current.timestamp < 1500;

            if (isDuplicate) {
              return;
            }

            lastDetectedRef.current = {
              barcode: normalizedBarcode,
              timestamp: now
            };

            void Promise.resolve(onDetected(normalizedBarcode)).then((wasMatched) => {
              playFeedbackTone(wasMatched ? "success" : "error");
              setError(null);
            });
          }
        );
      } catch (scannerError) {
        setError(explainScannerError(scannerError));
      }
    }

    void startScanner();

    return () => {
      stopped = true;
      const resettableReader = reader as BrowserMultiFormatReader & { reset?: () => void };
      resettableReader.reset?.();
    };
  }, [active, onDetected]);

  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-white">Live-Scanner</p>
          <p className="text-sm text-slate-400">Scanner bleibt aktiv. Hoher Ton bei Treffer, tiefer Ton bei unbekanntem Code.</p>
        </div>
        <Button
          variant={active ? "destructive" : "secondary"}
          onClick={async () => {
            if (!active) {
              await ensureAudioContext();
              lastDetectedRef.current = { barcode: "", timestamp: 0 };
            }

            setActive((value) => !value);
          }}
        >
          {active ? "Scanner stoppen" : "Scanner starten"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      </div>

      {active ? <p className="text-sm text-cyan-200">Scanner aktiv. Barcode mittig halten, Mehrfachtreffer werden kurz entprellt.</p> : null}
      {error ? <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">{error}</p> : null}
    </div>
  );
}
