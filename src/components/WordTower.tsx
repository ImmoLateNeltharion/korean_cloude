import { useEffect, useMemo, useRef, useState } from "react";
import { KOREA_SHAPES } from "@/lib/korea-shape";

interface WordTowerProps {
  words: Record<string, number>;
  qrSize?: number;
}

type PlacedWord = {
  word: string;
  count: number;
  ratio: number;
  x: number;
  y: number;
  fontSize: number;
  color: [number, number, number];
  delay: number;
  duration: number;
  swayX: number;
  swayY: number;
  rotate: number;
  box: { left: number; top: number; right: number; bottom: number };
};

type QRAvoidArea = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  r: number;
};

type MapTransform = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  originX: number;
  originY: number;
};

const BRAND_PALETTE: [number, number, number][] = [
  [352, 85, 55],
  [0, 5, 82],
  [350, 65, 72],
  [0, 0, 94],
  [355, 90, 44],
  [5, 12, 76],
  [348, 75, 63],
  [0, 3, 88],
];

const QR_MARGIN = 6;
const QR_BREATHING = 4;
const WORD_GAP = 1;
const GLOBAL_FONT_SCALE = 1.15;
const SILHOUETTE_SCALE = 0.92;
const MAP_PAD_X = 6;
const MAP_PAD_Y = 6;

let measureCanvas: HTMLCanvasElement | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d");
}

function hashWord(word: string): number {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function modPos(n: number, m: number): number {
  if (m <= 0) return 0;
  return ((n % m) + m) % m;
}

function coprimeStep(mod: number, seed: number): number {
  if (mod <= 1) return 1;
  let step = (modPos(seed, mod - 1) + 1) | 1;
  while (gcd(step, mod) !== 1) {
    step += 2;
    if (step >= mod) step = (step % mod) || 1;
  }
  return step;
}

function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonCentroid(poly: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [px, py] of poly) {
    x += px;
    y += py;
  }
  return [x / poly.length, y / poly.length];
}

const ACTIVE_KOREA_SHAPES = KOREA_SHAPES.filter((poly) => {
  const [cx, cy] = polygonCentroid(poly);
  if (cx < -0.65 && cy < -0.75) return false;
  return true;
});

const SHAPE_BOUNDS = (() => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const poly of ACTIVE_KOREA_SHAPES) {
    for (const [x, y] of poly) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, maxX, minY, maxY };
})();

function buildMapTransform(width: number, height: number): MapTransform {
  const shapeW = SHAPE_BOUNDS.maxX - SHAPE_BOUNDS.minX;
  const shapeH = SHAPE_BOUNDS.maxY - SHAPE_BOUNDS.minY;
  const availW = Math.max(120, width - MAP_PAD_X * 2);
  const availH = Math.max(120, height - MAP_PAD_Y * 2);
  const scale = Math.min(availW / shapeW, availH / shapeH) * SILHOUETTE_SCALE;
  const drawW = shapeW * scale;
  const drawH = shapeH * scale;
  const originX = (width - drawW) / 2;
  const originY = (height - drawH) / 2;
  return {
    minX: SHAPE_BOUNDS.minX,
    maxX: SHAPE_BOUNDS.maxX,
    minY: SHAPE_BOUNDS.minY,
    maxY: SHAPE_BOUNDS.maxY,
    scale,
    originX,
    originY,
  };
}

function shapeToScreen(nx: number, ny: number, tr: MapTransform): [number, number] {
  const x = tr.originX + (nx - tr.minX) * tr.scale;
  const y = tr.originY + (tr.maxY - ny) * tr.scale;
  return [x, y];
}

function screenToShape(x: number, y: number, tr: MapTransform): [number, number] {
  const nx = (x - tr.originX) / tr.scale + tr.minX;
  const ny = tr.maxY - (y - tr.originY) / tr.scale;
  return [nx, ny];
}

function isInKoreaShape(nx: number, ny: number): boolean {
  return ACTIVE_KOREA_SHAPES.some((poly) => pointInPolygon(nx, ny, poly));
}

function rectsOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function measureWordWidth(word: string, fontSize: number): number {
  const ctx = getMeasureCtx();
  if (!ctx) return Math.max(word.length * fontSize * 0.58, fontSize * 1.8);
  ctx.font = `400 ${fontSize}px Vatech, sans-serif`;
  return Math.ceil(ctx.measureText(word).width * 1.06) + 2;
}

function boxFitsShape(
  box: { left: number; top: number; right: number; bottom: number },
  tr: MapTransform,
  minInside = 6
): boolean {
  const points: [number, number][] = [
    [box.left, box.top],
    [box.right, box.top],
    [box.left, box.bottom],
    [box.right, box.bottom],
    [(box.left + box.right) / 2, box.top],
    [(box.left + box.right) / 2, box.bottom],
    [box.left, (box.top + box.bottom) / 2],
    [box.right, (box.top + box.bottom) / 2],
    [(box.left + box.right) / 2, (box.top + box.bottom) / 2],
  ];

  let inside = 0;
  for (const [px, py] of points) {
    const [nx, ny] = screenToShape(px, py, tr);
    if (isInKoreaShape(nx, ny)) inside++;
  }
  return inside >= minInside;
}

function boxIntersectsCircle(
  box: { left: number; top: number; right: number; bottom: number },
  cx: number,
  cy: number,
  r: number
): boolean {
  const nearestX = Math.max(box.left, Math.min(cx, box.right));
  const nearestY = Math.max(box.top, Math.min(cy, box.bottom));
  const dx = nearestX - cx;
  const dy = nearestY - cy;
  return dx * dx + dy * dy < r * r;
}

function intersectsQRArea(
  box: { left: number; top: number; right: number; bottom: number },
  qr: QRAvoidArea
): boolean {
  if (boxIntersectsCircle(box, qr.cx, qr.cy, qr.r)) return true;
  const hardStripe = {
    left: qr.left + (qr.right - qr.left) * 0.66,
    right: qr.right,
    top: qr.top,
    bottom: qr.top + (qr.bottom - qr.top) * 0.45,
  };
  return rectsOverlap(box, hardStripe);
}

function pointInsideQRArea(x: number, y: number, qr: QRAvoidArea): boolean {
  const dx = x - qr.cx;
  const dy = y - qr.cy;
  if (dx * dx + dy * dy < qr.r * qr.r) return true;
  const hardStripe = {
    left: qr.left + (qr.right - qr.left) * 0.66,
    right: qr.right,
    top: qr.top,
    bottom: qr.top + (qr.bottom - qr.top) * 0.45,
  };
  return x >= hardStripe.left && x <= hardStripe.right && y >= hardStripe.top && y <= hardStripe.bottom;
}

function getKoreaOutlinePaths(tr: MapTransform): string[] {
  if (tr.scale <= 0) return [];
  return ACTIVE_KOREA_SHAPES.filter((poly) => poly.length >= 3).map((poly) => {
    const pts = poly.map(([nx, ny]) => {
      const [x, y] = shapeToScreen(nx, ny, tr);
      return `${x},${y}`;
    });
    return `M ${pts.join(" L ")} Z`;
  });
}

const WordTower = ({ words, qrSize = 160 }: WordTowerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await document.fonts.ready;
      await document.fonts.load("400 18px Vatech");
      if (!cancelled) setFontsReady(true);
    };
    run();
    const fallback = setTimeout(() => {
      if (!cancelled) setFontsReady(true);
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = useMemo(() => {
    try {
      const entries = Object.entries(words);
      if (!entries.length || !fontsReady || size.width === 0 || size.height === 0) return [] as PlacedWord[];

      const dynamicWordLimit = Math.max(110, Math.min(190, Math.round((size.width * size.height) / 15500)));
      const sorted = [...entries].sort((a, b) => b[1] - a[1]).slice(0, dynamicWordLimit);
      const maxCount = Math.max(...sorted.map(([, c]) => c));
      const minCount = Math.min(...sorted.map(([, c]) => c));
      const range = Math.max(1, maxCount - minCount);

      const width = size.width;
      const height = size.height;
      const moscowCount = sorted.find(([w]) => w.trim().toLowerCase() === "москва")?.[1] ?? minCount;
      const moscowRatio = (moscowCount - minCount) / range;
      const moscowBaseSizeRaw = Math.round((11 + moscowRatio * 30) * GLOBAL_FONT_SCALE);
      const moscowBaseSize = Math.max(9, Math.min(moscowBaseSizeRaw, Math.round(Math.min(width, height) * 0.023)));
      const minWordSize = Math.max(5, Math.round(moscowBaseSize * 0.24));

      const tr = buildMapTransform(width, height);
      const mapW = (tr.maxX - tr.minX) * tr.scale;
      const mapH = (tr.maxY - tr.minY) * tr.scale;
      const cx = tr.originX + mapW / 2;
      const cy = tr.originY + mapH / 2;

      const qrBox = {
        left: width - QR_MARGIN - qrSize - QR_BREATHING,
        top: QR_MARGIN - QR_BREATHING,
        right: width - QR_MARGIN + QR_BREATHING,
        bottom: QR_MARGIN + qrSize + QR_BREATHING,
      };
      const qrArea: QRAvoidArea = {
        ...qrBox,
        cx: (qrBox.left + qrBox.right) / 2,
        cy: (qrBox.top + qrBox.bottom) / 2,
        r: (qrSize * 0.5) + 6,
      };

      const candidates: [number, number][] = [];
      const step = Math.max(8, Math.min(14, Math.round(Math.min(width, height) / 58)));
      const addGrid = (ox: number, oy: number) => {
        for (let y = tr.originY + 4 + oy; y <= tr.originY + mapH - 4; y += step) {
          for (let x = tr.originX + 4 + ox; x <= tr.originX + mapW - 4; x += step) {
            if (pointInsideQRArea(x, y, qrArea)) continue;
            const [nx, ny] = screenToShape(x, y, tr);
            if (!isInKoreaShape(nx, ny)) continue;
            candidates.push([x, y]);
          }
        }
      };
      addGrid(0, 0);
      addGrid(step / 2, step / 2);
      if (candidates.length < 120) return [];

      const gridCols = 20;
      const gridRows = 30;
      const occGrid = new Uint16Array(gridCols * gridRows);
      const cellIndex = (x: number, y: number) => {
        const nx = Math.max(0, Math.min(0.999, (x - tr.originX) / Math.max(1, mapW)));
        const ny = Math.max(0, Math.min(0.999, (y - tr.originY) / Math.max(1, mapH)));
        const gx = Math.min(gridCols - 1, Math.floor(nx * gridCols));
        const gy = Math.min(gridRows - 1, Math.floor(ny * gridRows));
        return gy * gridCols + gx;
      };
      const neighborOcc = (idx: number) => {
        const gx = idx % gridCols;
        const gy = Math.floor(idx / gridCols);
        let sum = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const x = gx + ox;
            const y = gy + oy;
            if (x < 0 || x >= gridCols || y < 0 || y >= gridRows) continue;
            const w = ox === 0 && oy === 0 ? 1 : 0.55;
            sum += occGrid[y * gridCols + x] * w;
          }
        }
        return sum;
      };
      const isCore = (x: number, y: number) => {
        const dx = (x - cx) / Math.max(1, mapW);
        const dy = (y - cy) / Math.max(1, mapH);
        return (dx * dx) / (0.33 * 0.33) + (dy * dy) / (0.28 * 0.28) <= 1;
      };

      const result: PlacedWord[] = [];
      let corePlaced = 0;
      const targetCoreRatio = 0.34;

      const bucketSize = Math.max(14, Math.round(minWordSize * 1.8));
      const buckets = new Map<string, number[]>();
      const bucketKey = (bx: number, by: number) => `${bx},${by}`;
      const bucketRange = (box: { left: number; top: number; right: number; bottom: number }) => ({
        bx0: Math.floor(box.left / bucketSize),
        bx1: Math.floor(box.right / bucketSize),
        by0: Math.floor(box.top / bucketSize),
        by1: Math.floor(box.bottom / bucketSize),
      });
      const overlapsPlaced = (box: { left: number; top: number; right: number; bottom: number }) => {
        const { bx0, bx1, by0, by1 } = bucketRange(box);
        for (let by = by0; by <= by1; by++) {
          for (let bx = bx0; bx <= bx1; bx++) {
            const ids = buckets.get(bucketKey(bx, by));
            if (!ids) continue;
            for (const id of ids) {
              if (rectsOverlap(box, result[id].box)) return true;
            }
          }
        }
        return false;
      };
      const addToBuckets = (idx: number) => {
        const { bx0, bx1, by0, by1 } = bucketRange(result[idx].box);
        for (let by = by0; by <= by1; by++) {
          for (let bx = bx0; bx <= bx1; bx++) {
            const key = bucketKey(bx, by);
            const arr = buckets.get(key);
            if (arr) arr.push(idx);
            else buckets.set(key, [idx]);
          }
        }
      };

      for (let wi = 0; wi < sorted.length; wi++) {
        const [word, count] = sorted[wi];
        const ratio = (count - minCount) / range;
        const baseSize = Math.max(minWordSize, Math.round((9 + ratio * 21) * GLOBAL_FONT_SCALE));
        const seed = hashWord(word);
        const color = BRAND_PALETTE[seed % BRAND_PALETTE.length];
        const coreDeficit = targetCoreRatio * (result.length + 1) - corePlaced;
        let placedWord: PlacedWord | null = null;

        for (const scale of [1, 0.9, 0.82, 0.74, 0.66]) {
          const fontSize = Math.max(minWordSize, Math.round(baseSize * scale));
          const wordWidth = measureWordWidth(word, fontSize);
          const wordHeight = Math.ceil(fontSize * 1.14);
          const sampleCount = Math.min(280, candidates.length);
          const start = seed % candidates.length;
          const walk = coprimeStep(candidates.length, seed ^ (wi * 2654435761));
          let best: { x: number; y: number; box: { left: number; top: number; right: number; bottom: number }; score: number } | null = null;

          for (let i = 0; i < sampleCount; i++) {
            const idx = modPos(start + i * walk, candidates.length);
            const [x, y] = candidates[idx];
            const box = {
              left: x - wordWidth / 2 - WORD_GAP,
              right: x + wordWidth / 2 + WORD_GAP,
              top: y - wordHeight / 2 - WORD_GAP,
              bottom: y + wordHeight / 2 + WORD_GAP,
            };

            if (box.left < 3 || box.right > width - 3 || box.top < 3 || box.bottom > height - 3) continue;
            if (intersectsQRArea(box, qrArea)) continue;
            if (!boxFitsShape(box, tr, 1)) continue;
            if (overlapsPlaced(box)) continue;

            const occ = neighborOcc(cellIndex(x, y));
            const coreWeight = coreDeficit > 0 ? (isCore(x, y) ? -0.95 : 0.85) : 0;
            const score = occ + coreWeight;
            if (!best || score < best.score) best = { x, y, box, score };
          }

          if (best) {
            placedWord = {
              word,
              count,
              ratio,
              x: best.x,
              y: best.y,
              fontSize,
              color,
              delay: (seed % 1200) / 100,
              duration: 4.8 + (seed % 280) / 100,
              swayX: 2 + (seed % 7),
              swayY: 4 + (seed % 8),
              rotate: ((seed % 7) - 3) * 0.25,
              box: best.box,
            };
            break;
          }
        }

        if (placedWord) {
          const idx = result.length;
          result.push(placedWord);
          addToBuckets(idx);
          occGrid[cellIndex(placedWord.x, placedWord.y)] = Math.min(65535, occGrid[cellIndex(placedWord.x, placedWord.y)] + 1);
          if (isCore(placedWord.x, placedWord.y)) corePlaced++;
        }
      }

      return result;
    } catch (err) {
      console.error("Word cloud layout failed:", err);
      return [];
    }
  }, [fontsReady, qrSize, size.height, size.width, words]);

  const koreaOutlinePaths = useMemo(() => {
    if (size.width === 0 || size.height === 0) return [];
    return getKoreaOutlinePaths(buildMapTransform(size.width, size.height));
  }, [size.height, size.width]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none">
      <div className="absolute inset-0 pointer-events-none word-cloud-bg" />
      {koreaOutlinePaths.length > 0 && (
        <svg className="absolute inset-0 pointer-events-none word-cloud-outline" width={size.width} height={size.height}>
          <defs>
            <filter id="koreaNeonGlow" x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation="4.5" result="blur1" />
              <feGaussianBlur stdDeviation="9" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {koreaOutlinePaths.map((d, i) => (
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke="hsl(352 96% 64%)"
                strokeWidth={i === 0 ? "7.5" : "5.5"}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#koreaNeonGlow)"
                opacity={i === 0 ? 0.26 : 0.2}
              />
              <path
                d={d}
                fill="none"
                stroke="hsl(352 98% 72%)"
                strokeWidth={i === 0 ? "2.3" : "1.8"}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#koreaNeonGlow)"
                opacity={i === 0 ? 0.96 : 0.8}
              />
            </g>
          ))}
        </svg>
      )}

      {placed.map((item) => (
        <span
          key={item.word}
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap word-cloud-item"
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            fontFamily: "Vatech, sans-serif",
            fontSize: `${item.fontSize}px`,
            color: `hsl(${item.color[0]} ${item.color[1]}% ${item.color[2]}%)`,
            textShadow: `
              0 0 7px hsl(${item.color[0]} ${item.color[1]}% ${Math.min(97, item.color[2] + 10)}% / 0.88),
              0 0 18px hsl(${item.color[0]} ${Math.max(50, item.color[1] - 8)}% ${Math.max(34, item.color[2] - 8)}% / 0.58),
              0 0 34px hsl(352 80% 44% / 0.36)
            `,
            animationDuration: `${item.duration}s`,
            animationDelay: `-${item.delay}s`,
            ["--sway-x" as string]: `${item.swayX}px`,
            ["--sway-y" as string]: `${item.swayY}px`,
            ["--tilt" as string]: `${item.rotate}deg`,
          }}
          title={`${item.word}: ${item.count}`}
        >
          {item.word}
        </span>
      ))}
    </div>
  );
};

export default WordTower;
