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

    const draw = async () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Generate QR to offscreen canvas — transparent bg, amber modules
      const offscreen = document.createElement("canvas");
      await QRCode.toCanvas(offscreen, url, {
        width: px,
        margin: 1,
        color: {
          dark: "#ffbe50ff",
          light: "#00000000",
        },
      });

      ctx.clearRect(0, 0, px, px);
      ctx.globalAlpha = 0.88;
      ctx.drawImage(offscreen, 0, 0);
      ctx.globalAlpha = 1;

      // Draw logo centered, maintaining aspect ratio
      const logo = new Image();
      logo.onload = () => {
        const cx = px / 2;
        const cy = px / 2;

        // Fit logo maintaining aspect ratio
        const maxW = px * 0.28;
        const maxH = px * 0.14;
        const aspect = logo.naturalWidth / logo.naturalHeight;
        let lw = maxW, lh = maxW / aspect;
        if (lh > maxH) { lh = maxH; lw = maxH * aspect; }
        const pad = 6;

        // Punch a rounded-rect hole in the QR (use destination-out)
        ctx.globalCompositeOperation = "destination-out";
        const rx = cx - lw / 2 - pad, ry = cy - lh / 2 - pad;
        const rw = lw + pad * 2, rh = lh + pad * 2, r = 6;
        ctx.beginPath();
        ctx.moveTo(rx + r, ry);
        ctx.lineTo(rx + rw - r, ry); ctx.arcTo(rx + rw, ry, rx + rw, ry + r, r);
        ctx.lineTo(rx + rw, ry + rh - r); ctx.arcTo(rx + rw, ry + rh, rx + rw - r, ry + rh, r);
        ctx.lineTo(rx + r, ry + rh); ctx.arcTo(rx, ry + rh, rx, ry + rh - r, r);
        ctx.lineTo(rx, ry + r); ctx.arcTo(rx, ry, rx + r, ry, r);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        // Draw logo with amber glow
        ctx.shadowColor = "rgba(255,190,80,0.6)";
        ctx.shadowBlur = 8;
        ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);
        ctx.shadowBlur = 0;
      };
      logo.src = "/vatech-logo.png";
    };

    draw();
  }, [url, size]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "10px",
        boxShadow: [
          "0 0 8px rgba(255,190,80,0.55)",
          "0 0 20px rgba(255,160,50,0.30)",
          "0 0 40px rgba(255,130,30,0.15)",
          "inset 0 0 8px rgba(255,190,80,0.08)",
        ].join(", "),
        border: "1px solid rgba(255,190,80,0.35)",
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
