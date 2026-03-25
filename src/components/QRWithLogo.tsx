import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRWithLogoProps {
  url: string;
  size?: number;
}

export function QRWithLogo({ url, size = 150 }: QRWithLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;

    const px = size * 2; // 2x for retina
    canvas.width = px;
    canvas.height = px;

    let cancelled = false;

    const draw = async () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Generate QR to offscreen canvas — transparent bg, silver/white modules
      const offscreen = document.createElement("canvas");
      await QRCode.toCanvas(offscreen, url, {
        width: px,
        margin: 1,
        color: {
          dark: "#f0f0f0ff",
          light: "#00000000",
        },
      });

      if (cancelled) return;

      ctx.clearRect(0, 0, px, px);
      ctx.globalAlpha = 0.88;
      ctx.drawImage(offscreen, 0, 0);
      ctx.globalAlpha = 1;

      // Keep QR clean: no centered logo overlay.
    };

    draw();
    return () => { cancelled = true; };
  }, [url, size]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "10px",
        boxShadow: [
          "0 0 8px rgba(220,24,48,0.55)",
          "0 0 20px rgba(220,24,48,0.28)",
          "0 0 40px rgba(220,24,48,0.12)",
          "inset 0 0 8px rgba(220,24,48,0.06)",
        ].join(", "),
        border: "1px solid rgba(220,24,48,0.40)",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: "block" }}
      />
    </div>
  );
}
