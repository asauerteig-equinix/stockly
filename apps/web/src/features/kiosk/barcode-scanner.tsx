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
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const selectedDevice = devices[0]?.deviceId;

        if (!selectedDevice) {
          setError("Keine Kamera gefunden. Bitte Barcode manuell eingeben.");
          return;
        }

        await reader.decodeFromVideoDevice(selectedDevice, videoElement, (result) => {
          if (result && !stopped) {
            onDetected(result.getText());
            setActive(false);
          }
        });
      } catch {
        setError("Scanner konnte nicht gestartet werden. Bitte pruefen Sie die Kameraberechtigung.");
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
          <p className="text-sm text-slate-400">Onboard-Kamera fuer schnelle Lagerbuchungen.</p>
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
