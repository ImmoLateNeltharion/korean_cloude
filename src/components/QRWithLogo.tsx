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

    const draw = async () => {
      // Generate QR to an offscreen canvas
      const offscreen = document.createElement("canvas");
      await QRCode.toCanvas(offscreen, url, {
        width: size * 2, // 2x for sharpness
        margin: 1,
        color: {
          dark: "#ffbe50ff",   // amber modules
          light: "#00000000",  // transparent background
        },
      });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = size * 2;
      canvas.height = size * 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw QR
      ctx.globalAlpha = 0.85;
      ctx.drawImage(offscreen, 0, 0);
      ctx.globalAlpha = 1;

      // Draw logo in center
      const logo = new Image();
      logo.onload = () => {
        const logoSize = size * 2 * 0.22; // 22% of QR size
        const cx = (size * 2 - logoSize) / 2;
        const cy = (size * 2 - logoSize) / 2;

        // White circle backdrop
        ctx.beginPath();
        ctx.arc(size, size, logoSize * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(10,10,10,0.85)";
        ctx.fill();

        ctx.drawImage(logo, cx, cy, logoSize, logoSize);
      };
      logo.src = "/vatech-logo.png";
    };

    draw();
  }, [url, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        borderRadius: "8px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
      }}
    />
  );
}
