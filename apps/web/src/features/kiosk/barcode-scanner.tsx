"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

import { Button } from "@/components/ui/button";

import { playKioskTone, primeKioskAudio } from "./kiosk-audio";

type BarcodeScannerProps = {
  onDetected: (barcode: string) => boolean | Promise<boolean>;
  compact?: boolean;
};

const SCAN_ZONE_WIDTH_RATIO = 0.74;
const SCAN_ZONE_HEIGHT_RATIO = 0.34;
const SCAN_INTERVAL_MS = 140;
const DUPLICATE_WINDOW_MS = 1500;
const SCAN_WINDOW_MS = 10000;

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

function isPlausibleBarcodeCandidate(value: string) {
  if (value.length < 4) {
    return false;
  }

  return new Set(value).size > 1;
}

export function BarcodeScanner({ onDetected, compact = false }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDetectedRef = useRef(onDetected);
  const autoStopTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const lastDetectedRef = useRef<{ barcode: string; timestamp: number }>({
    barcode: "",
    timestamp: 0
  });
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    return () => {
      clearScanWindowTimers();
    };
  }, []);

  function clearScanWindowTimers() {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

  function stopTimedScan() {
    clearScanWindowTimers();
    setRemainingMs(0);
    setActive(false);
  }

  async function startTimedScan() {
    await primeKioskAudio();

    lastDetectedRef.current = { barcode: "", timestamp: 0 };
    setError(null);

    clearScanWindowTimers();

    const deadline = Date.now() + SCAN_WINDOW_MS;
    setRemainingMs(SCAN_WINDOW_MS);
    setActive(true);

    autoStopTimeoutRef.current = window.setTimeout(() => {
      stopTimedScan();
    }, SCAN_WINDOW_MS);

    countdownIntervalRef.current = window.setInterval(() => {
      const nextRemaining = Math.max(0, deadline - Date.now());
      setRemainingMs(nextRemaining);

      if (nextRemaining <= 0) {
        clearScanWindowTimers();
      }
    }, 200);
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

      if (!normalizedBarcode || !isPlausibleBarcodeCandidate(normalizedBarcode)) {
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
        playKioskTone(wasMatched ? "scan-success" : "scan-error");
        setError(null);
      } catch {
        playKioskTone("scan-error");
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
    <div className={compact ? "space-y-3" : "space-y-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4"}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-white">Live-Scanner</p>
          {!compact ? (
            <p className="text-sm text-slate-400">Scan startet bewusst per Klick auf die Flaeche und stoppt nach 10 Sekunden automatisch.</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {active ? (
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-100">
              {Math.max(1, Math.ceil(remainingMs / 1000))}s aktiv
            </span>
          ) : null}
          <Button variant={active ? "destructive" : "secondary"} onClick={active ? stopTimedScan : () => void startTimedScan()}>
            {active ? "Scanner stoppen" : "10s Scan starten"}
          </Button>
        </div>
      </div>

      <button
        type="button"
        className="relative block w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900 text-left"
        onClick={() => void startTimedScan()}
      >
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
          {!active ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/48">
              <div className="rounded-3xl border border-white/10 bg-slate-950/82 px-5 py-4 text-center shadow-xl">
                <p className="text-sm font-medium text-white">Zum Scannen hier tippen oder klicken</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-300">Aktiv fuer 10 Sekunden</p>
              </div>
            </div>
          ) : null}
        </div>
      </button>

      {!compact ? (
        active ? (
          <p className="text-sm text-cyan-200">
            Scanner aktiv. Gelesen wird nur im markierten Mittelbereich und danach automatisch wieder gestoppt.
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            Kein Dauer-Scan mehr. Die Kamera wertet erst nach einem bewussten Klick auf die Scanflaeche aus.
          </p>
        )
      ) : null}
      {error ? <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">{error}</p> : null}
    </div>
  );
}
