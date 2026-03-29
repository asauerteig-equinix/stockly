"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

import { Button } from "@/components/ui/button";

type BarcodeScannerProps = {
  onDetected: (barcode: string) => boolean | Promise<boolean>;
};

const SCAN_ZONE_WIDTH_RATIO = 0.74;
const SCAN_ZONE_HEIGHT_RATIO = 0.34;
const SCAN_INTERVAL_MS = 140;
const DUPLICATE_WINDOW_MS = 1500;

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

function isExpectedDecodeMiss(scanError: unknown) {
  if (!scanError || typeof scanError !== "object" || !("name" in scanError)) {
    return false;
  }

  const errorName = String(scanError.name);
  return errorName === "NotFoundException" || errorName === "ChecksumException" || errorName === "FormatException";
}

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const onDetectedRef = useRef(onDetected);
  const lastDetectedRef = useRef<{ barcode: string; timestamp: number }>({
    barcode: "",
    timestamp: 0
  });
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

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
    if (!active || !videoRef.current || !canvasRef.current) {
      return;
    }

    let stopped = false;
    const videoElement = videoRef.current;
    const captureCanvas = canvasRef.current;
    const reader = new BrowserMultiFormatReader(scannerHints);
    let stream: MediaStream | null = null;
    let scanTimeout: number | null = null;

    function stopSession() {
      if (scanTimeout) {
        clearTimeout(scanTimeout);
        scanTimeout = null;
      }

      const resettableReader = reader as BrowserMultiFormatReader & { reset?: () => void };
      resettableReader.reset?.();

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }

      videoElement.pause();
      videoElement.srcObject = null;
    }

    function scheduleNextScan(delay = SCAN_INTERVAL_MS) {
      if (stopped) {
        return;
      }

      scanTimeout = window.setTimeout(() => {
        void scanCurrentFrame();
      }, delay);
    }

    async function handleDetectedBarcode(rawValue: string) {
      const normalizedBarcode = normalizeDetectedBarcode(rawValue);

      if (!normalizedBarcode) {
        return;
      }

      const now = Date.now();
      const isDuplicate =
        lastDetectedRef.current.barcode === normalizedBarcode && now - lastDetectedRef.current.timestamp < DUPLICATE_WINDOW_MS;

      if (isDuplicate) {
        return;
      }

      lastDetectedRef.current = {
        barcode: normalizedBarcode,
        timestamp: now
      };

      try {
        const wasMatched = await Promise.resolve(onDetectedRef.current(normalizedBarcode));
        playFeedbackTone(wasMatched ? "success" : "error");
        setError(null);
      } catch {
        playFeedbackTone("error");
        setError("Erkannter Barcode konnte nicht verarbeitet werden.");
      }
    }

    async function scanCurrentFrame() {
      if (stopped) {
        return;
      }

      if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !videoElement.videoWidth || !videoElement.videoHeight) {
        scheduleNextScan();
        return;
      }

      const sourceWidth = videoElement.videoWidth;
      const sourceHeight = videoElement.videoHeight;
      const zoneWidth = Math.min(sourceWidth, Math.max(320, Math.round(sourceWidth * SCAN_ZONE_WIDTH_RATIO)));
      const zoneHeight = Math.min(sourceHeight, Math.max(180, Math.round(sourceHeight * SCAN_ZONE_HEIGHT_RATIO)));
      const sourceX = Math.round((sourceWidth - zoneWidth) / 2);
      const sourceY = Math.round((sourceHeight - zoneHeight) / 2);

      captureCanvas.width = zoneWidth;
      captureCanvas.height = zoneHeight;

      const context = captureCanvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        setError("Scanbereich konnte nicht vorbereitet werden.");
        return;
      }

      context.drawImage(videoElement, sourceX, sourceY, zoneWidth, zoneHeight, 0, 0, zoneWidth, zoneHeight);

      try {
        const result = reader.decodeFromCanvas(captureCanvas);

        if (result) {
          await handleDetectedBarcode(result.getText());
        }
      } catch (scanError) {
        if (!isExpectedDecodeMiss(scanError) && !stopped) {
          setError(explainScannerError(scanError));
        }
      } finally {
        scheduleNextScan();
      }
    }

    async function startScanner() {
      try {
        setError(null);

        if (typeof window !== "undefined" && !window.isSecureContext) {
          setError(explainScannerError());
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        videoElement.srcObject = stream;
        await videoElement.play();
        scheduleNextScan(220);
      } catch (scannerError) {
        setError(explainScannerError(scannerError));
        stopSession();
      }
    }

    void startScanner();

    return () => {
      stopped = true;
      stopSession();
    };
  }, [active]);

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

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" aria-hidden />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[28%] bg-slate-950/22" />
          <div className="absolute inset-x-0 bottom-0 h-[28%] bg-slate-950/22" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative min-h-28 rounded-[2rem] border border-cyan-300/45 bg-cyan-400/6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              style={{
                width: `${SCAN_ZONE_WIDTH_RATIO * 100}%`,
                height: `${SCAN_ZONE_HEIGHT_RATIO * 100}%`
              }}
            >
              <div className="absolute inset-x-5 top-1/2 h-5 -translate-y-1/2 rounded-full bg-cyan-300/12 blur-md" />
              <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-200 to-transparent" />
              <div className="absolute left-4 top-4 h-6 w-6 rounded-tl-2xl border-l-2 border-t-2 border-cyan-200/80" />
              <div className="absolute right-4 top-4 h-6 w-6 rounded-tr-2xl border-r-2 border-t-2 border-cyan-200/80" />
              <div className="absolute bottom-4 left-4 h-6 w-6 rounded-bl-2xl border-b-2 border-l-2 border-cyan-200/80" />
              <div className="absolute bottom-4 right-4 h-6 w-6 rounded-br-2xl border-b-2 border-r-2 border-cyan-200/80" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
                Barcode hier ausrichten
              </div>
            </div>
          </div>
        </div>
      </div>

      {active ? (
        <p className="text-sm text-cyan-200">
          Scanner aktiv. Gelesen wird vor allem der markierte Mittelbereich mit der Linie.
        </p>
      ) : null}
      {error ? <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">{error}</p> : null}
    </div>
  );
}
