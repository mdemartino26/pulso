"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/*
 * Escáner de códigos de barras.
 * - La cámara se usa solo mientras este panel está abierto, y se apaga al
 *   cerrarlo. El video NO se sube a ningún lado: se lee en el navegador.
 * - Permissions-Policy permite la cámara solo a nuestro propio origen.
 * - Usa BarcodeDetector (Chrome/Android) y, si no existe (iPhone), la
 *   librería ZXing, que se descarga recién cuando hace falta.
 */

interface DetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => DetectorLike;
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const VALID = /^(\d{8}|\d{12,14})$/;

export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "denied" | "unsupported">("starting");
  const [manual, setManual] = useState("");
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let zxingControls: { stop: () => void } | undefined;

    const found = (code: string) => {
      if (stopped || !VALID.test(code)) return false;
      stopped = true;
      navigator.vibrate?.(50);
      onCodeRef.current(code);
      return true;
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setStatus("denied");
        return;
      }
      const video = videoRef.current;
      if (stopped || !video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setStatus("scanning");

      if (window.BarcodeDetector) {
        const detector = new window.BarcodeDetector({ formats: FORMATS });
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            if (codes.some((c) => found(c.rawValue))) return;
          } catch {
            // frame no listo: seguimos
          }
          timer = setTimeout(tick, 200);
        };
        void tick();
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (stopped) return;
        const reader = new BrowserMultiFormatReader();
        zxingControls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) found(result.getText());
        });
      }
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const code = manual.replace(/\D/g, "");
    if (VALID.test(code)) onCode(code);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Escanear código de barras" className="bg-background fixed inset-0 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-semibold">Escanear código</h2>
        <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </div>
      <div className="relative mx-4 aspect-[3/4] overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        {status === "scanning" ? (
          <div aria-hidden className="border-primary pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2" />
        ) : null}
        <p className="absolute inset-x-0 bottom-3 text-center text-sm text-white" role="status">
          {status === "starting" && "Abriendo la cámara…"}
          {status === "scanning" && "Apuntá al código de barras"}
          {status === "denied" && "No pudimos usar la cámara. Podés escribir el código abajo."}
          {status === "unsupported" && "Este navegador no permite usar la cámara. Escribí el código abajo."}
        </p>
      </div>
      <form onSubmit={submitManual} className="flex gap-2 p-4">
        <Input
          inputMode="numeric"
          autoComplete="off"
          placeholder="O escribí el código"
          aria-label="Código de barras"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          className="h-11"
        />
        <Button type="submit" className="h-11">
          Buscar
        </Button>
      </form>
    </div>
  );
}
