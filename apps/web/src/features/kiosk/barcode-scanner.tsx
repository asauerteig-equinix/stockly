"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

import { Button } from "@/components/ui/button";

type BarcodeScannerProps = {
  onDetected: (barcode: string) => void;
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
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureAudioContext() {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextConstructor = window.AudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    const audioContext = audioContextRef.current ?? new AudioContextConstructor();
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

  function playSuccessTone() {
    const audioContext = audioContextRef.current;

    if (!audioContext || audioContext.state !== "running") {
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startAt = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(1320, startAt + 0.08);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + 0.18);
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
      delayBetweenScanSuccess: 1200
    });
    readerRef.current = reader;
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
          (result, _error, controls) => {
            if (result && !stopped) {
              playSuccessTone();
              onDetected(normalizeDetectedBarcode(result.getText()));
              controls.stop();
              const resettableReader = reader as BrowserMultiFormatReader & { reset?: () => void };
              resettableReader.reset?.();
              setError(null);
              setActive(false);
            }
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
          <p className="font-medium text-white">Barcode-Scan</p>
          <p className="text-sm text-slate-400">Barcode mittig vor die Kamera halten. Bei Treffer gibt es einen kurzen Signalton.</p>
        </div>
        <Button
          variant={active ? "destructive" : "secondary"}
          onClick={async () => {
            if (!active) {
              await ensureAudioContext();
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

      {active ? <p className="text-sm text-cyan-200">Scanner aktiv. Gute Beleuchtung und etwas Abstand helfen der Erkennung.</p> : null}
      {error ? <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">{error}</p> : null}
    </div>
  );
}
