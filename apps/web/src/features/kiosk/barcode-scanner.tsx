"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

import { Button } from "@/components/ui/button";

type BarcodeScannerProps = {
  onDetected: (barcode: string) => void;
};

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }

    return "Scanner konnte nicht gestartet werden. Bitte pruefen Sie Kameraberechtigung und HTTPS-Kontext.";
  }

  useEffect(() => {
    if (!active || !videoRef.current) {
      return;
    }

    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    const videoElement = videoRef.current;

    async function startScanner() {
      try {
        setError(null);

        if (typeof window !== "undefined" && !window.isSecureContext) {
          setError(explainScannerError());
          return;
        }

        await reader.decodeFromVideoDevice(undefined, videoElement, (result) => {
          if (result && !stopped) {
            onDetected(result.getText());
            setActive(false);
          }
        });
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
          <p className="text-sm text-slate-400">Kamera starten oder Barcode oben eingeben.</p>
        </div>
        <Button variant={active ? "destructive" : "secondary"} onClick={() => setActive((value) => !value)}>
          {active ? "Scanner stoppen" : "Scanner starten"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      </div>

      {error ? <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">{error}</p> : null}
    </div>
  );
}
