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
const GLOBAL_FONT_SCALE = 1.34;
const SILHOUETTE_SCALE = 0.92;
const MAP_PAD_X = 6;
const MAP_PAD_Y = 6;
const CANDIDATE_TARGET = 1500;
const CANDIDATE_MAX_TRIES = 25000;

let measureCanvas: HTMLCanvasElement | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
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

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return ((s >>> 0) & 0xffffffff) / 0x100000000;
  };
}

function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
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
  // Remove the small top-left island near the DPRK border area.
  if (cx < -0.65 && cy < -0.75) return false;
  return true;
});

type MapTransform = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  originX: number;
  originY: number;
};

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
  const y = tr.originY + (tr.maxY - ny) * tr.scale; // flip to screen coords
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
  const measured = ctx.measureText(word).width;
  return Math.ceil(measured * 1.06) + 2;
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

function canShiftAll(
  words: PlacedWord[],
  dx: number,
  dy: number,
  width: number,
  height: number,
  qrBox: { left: number; top: number; right: number; bottom: number }
): boolean {
  for (const w of words) {
    const shifted = {
      left: w.box.left + dx,
      right: w.box.right + dx,
      top: w.box.top + dy,
      bottom: w.box.bottom + dy,
    };
    if (shifted.left < 4 || shifted.right > width - 4 || shifted.top < 4 || shifted.bottom > height - 4) {
      return false;
    }
    if (rectsOverlap(shifted, qrBox)) return false;
  }
  return true;
}

function canApplyScale(
  words: PlacedWord[],
  scale: number,
  width: number,
  height: number,
  tr: MapTransform,
  qrBox: { left: number; top: number; right: number; bottom: number }
): { boxes: { left: number; top: number; right: number; bottom: number }[]; sizes: number[] } | null {
  const boxes: { left: number; top: number; right: number; bottom: number }[] = [];
  const sizes: number[] = [];

  for (const w of words) {
    const fontSize = Math.max(9, Math.round(w.fontSize * scale));
    const wordWidth = measureWordWidth(w.word, fontSize);
    const wordHeight = Math.ceil(fontSize * 1.14);
    const box = {
      left: w.x - wordWidth / 2 - WORD_GAP,
      right: w.x + wordWidth / 2 + WORD_GAP,
      top: w.y - wordHeight / 2 - WORD_GAP,
      bottom: w.y + wordHeight / 2 + WORD_GAP,
    };

    if (box.left < 4 || box.right > width - 4 || box.top < 4 || box.bottom > height - 4) return null;
    if (rectsOverlap(box, qrBox)) return null;
    if (!boxFitsShape(box, tr, 1)) return null;

    boxes.push(box);
    sizes.push(fontSize);
  }

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (rectsOverlap(boxes[i], boxes[j])) return null;
    }
  }

  return { boxes, sizes };
}

function canPlaceWordAtXY(
  words: PlacedWord[],
  index: number,
  x: number,
  y: number,
  fontSize: number,
  width: number,
  height: number,
  tr: MapTransform,
  qrBox: { left: number; top: number; right: number; bottom: number }
): { left: number; top: number; right: number; bottom: number } | null {
  const w = words[index];
  const wordWidth = measureWordWidth(w.word, fontSize);
  const wordHeight = Math.ceil(fontSize * 1.14);
  const box = {
    left: x - wordWidth / 2 - WORD_GAP,
    right: x + wordWidth / 2 + WORD_GAP,
    top: y - wordHeight / 2 - WORD_GAP,
    bottom: y + wordHeight / 2 + WORD_GAP,
  };
  if (box.left < 3 || box.right > width - 3 || box.top < 3 || box.bottom > height - 3) return null;
  if (rectsOverlap(box, qrBox)) return null;
  if (!boxFitsShape(box, tr, 1)) return null;
  for (let j = 0; j < words.length; j++) {
    if (j === index) continue;
    if (rectsOverlap(box, words[j].box)) return null;
  }
  return box;
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

    const sorted = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 90);
    const maxCount = Math.max(...sorted.map(([, c]) => c));
    const minCount = Math.min(...sorted.map(([, c]) => c));
    const range = Math.max(1, maxCount - minCount);
    const width = size.width;
    const height = size.height;
    const moscowCount = sorted.find(([w]) => w.trim().toLowerCase() === "москва")?.[1] ?? minCount;
    const moscowRatio = (moscowCount - minCount) / range;
    const moscowBaseSizeRaw = Math.round((12 + moscowRatio * 34) * GLOBAL_FONT_SCALE);
    // Keep Moscow as baseline, but allow smaller words so the silhouette can hold more entries.
    const moscowBaseSize = Math.max(10, Math.min(moscowBaseSizeRaw, Math.round(Math.min(width, height) * 0.028)));
    const minWordSize = Math.max(8, Math.round(moscowBaseSize * 0.6));
    const tr = buildMapTransform(width, height);

    const qrBox = {
      left: width - QR_MARGIN - qrSize - QR_BREATHING,
      top: QR_MARGIN - QR_BREATHING,
      right: width - QR_MARGIN + QR_BREATHING,
      bottom: QR_MARGIN + qrSize + QR_BREATHING,
    };

    const candidates: [number, number][] = [];
    const random = seeded(0x5f3759df + sorted.length * 31 + width * 7 + height);

    for (let tries = 0; tries < CANDIDATE_MAX_TRIES && candidates.length < CANDIDATE_TARGET; tries++) {
      const nx = SHAPE_BOUNDS.minX + random() * (SHAPE_BOUNDS.maxX - SHAPE_BOUNDS.minX);
      const ny = SHAPE_BOUNDS.minY + random() * (SHAPE_BOUNDS.maxY - SHAPE_BOUNDS.minY);
      if (!isInKoreaShape(nx, ny)) continue;

      const [x, y] = shapeToScreen(nx, ny, tr);

      if (x > qrBox.left && x < qrBox.right && y > qrBox.top && y < qrBox.bottom) continue;
      if (x < 6 || x > width - 6 || y < 6 || y > height - 6) continue;

      candidates.push([x, y]);
    }
    if (candidates.length < 140) return [];

    const cx = width / 2;
    const cy = height / 2;
    const centerOrdered = [...candidates.keys()].sort((a, b) => {
      const da = (candidates[a][0] - cx) ** 2 + (candidates[a][1] - cy) ** 2;
      const db = (candidates[b][0] - cx) ** 2 + (candidates[b][1] - cy) ** 2;
      return da - db;
    });
    const edgeOrdered = [...centerOrdered].reverse();

    const result: PlacedWord[] = [];
    let cursor = 0;

    for (const [word, count] of sorted) {
      const ratio = (count - minCount) / range;
      const baseSize = Math.max(
        minWordSize,
        Math.round((10 + ratio * 24) * GLOBAL_FONT_SCALE)
      );
      const seed = hashWord(word);

      let placedWord: PlacedWord | null = null;

      for (const scale of [1, 0.9, 0.8, 0.7]) {
        const fontSize = Math.max(minWordSize, Math.round(baseSize * scale));
        const wordWidth = measureWordWidth(word, fontSize);
        const wordHeight = Math.ceil(fontSize * 1.14);

        const order = ratio > 0.62 ? centerOrdered : edgeOrdered;
        const offset = seed % order.length;
        const attempts = Math.min(ratio > 0.62 ? 520 : 760, order.length);

        for (let i = 0; i < attempts; i++) {
          const ordIdx = (cursor + offset + i * 13) % order.length;
          const idx = order[ordIdx];
          const [x, y] = candidates[idx];
          const box = {
            left: x - wordWidth / 2 - WORD_GAP,
            right: x + wordWidth / 2 + WORD_GAP,
            top: y - wordHeight / 2 - WORD_GAP,
            bottom: y + wordHeight / 2 + WORD_GAP,
          };

          if (box.left < 3 || box.right > width - 3 || box.top < 3 || box.bottom > height - 3) continue;
          if (rectsOverlap(box, qrBox)) continue;
          if (!boxFitsShape(box, tr, 1)) continue;
          if (result.some((r) => rectsOverlap(box, r.box))) continue;

          const color = BRAND_PALETTE[seed % BRAND_PALETTE.length];

          placedWord = {
            word,
            count,
            ratio,
            x,
            y,
            fontSize,
            color,
            delay: (seed % 1200) / 100,
            duration: 4.8 + (seed % 280) / 100,
            swayX: 2 + (seed % 7),
            swayY: 4 + (seed % 8),
            rotate: ((seed % 7) - 3) * 0.25,
            box,
          };
          cursor = (ordIdx + 1) % order.length;

          break;
        }

        if (placedWord) break;
      }

      // Fallback pass: keep no-overlap/QR rules, but allow looser match to Korea contour.
      if (!placedWord) {
        for (const scale of [0.72, 0.62, 0.54]) {
          const fontSize = Math.max(minWordSize, Math.round(baseSize * scale));
          const wordWidth = measureWordWidth(word, fontSize);
          const wordHeight = Math.ceil(fontSize * 1.14);
          const order = edgeOrdered;
          const offset = (seed * 3) % order.length;
          const attempts = Math.min(820, order.length);

          for (let i = 0; i < attempts; i++) {
            const ordIdx = (cursor + offset + i * 19) % order.length;
            const idx = order[ordIdx];
            const [x, y] = candidates[idx];
            const box = {
              left: x - wordWidth / 2 - WORD_GAP,
              right: x + wordWidth / 2 + WORD_GAP,
              top: y - wordHeight / 2 - WORD_GAP,
              bottom: y + wordHeight / 2 + WORD_GAP,
            };

            if (box.left < 3 || box.right > width - 3 || box.top < 3 || box.bottom > height - 3) continue;
            if (rectsOverlap(box, qrBox)) continue;
            if (!boxFitsShape(box, tr, 1)) continue;
            if (result.some((r) => rectsOverlap(box, r.box))) continue;

            const color = BRAND_PALETTE[seed % BRAND_PALETTE.length];
            placedWord = {
              word,
              count,
              ratio,
              x,
              y,
              fontSize,
              color,
              delay: (seed % 1200) / 100,
              duration: 4.8 + (seed % 280) / 100,
              swayX: 2 + (seed % 7),
              swayY: 4 + (seed % 8),
              rotate: ((seed % 7) - 3) * 0.25,
              box,
            };
            cursor = (ordIdx + 1) % order.length;
            break;
          }

          if (placedWord) break;
        }
      }

      // Final fallback: keep no-overlap and QR avoidance, relax shape-fit check.
      if (!placedWord) {
        const fontSize = minWordSize;
        const wordWidth = measureWordWidth(word, fontSize);
        const wordHeight = Math.ceil(fontSize * 1.14);
        const order = edgeOrdered;
        const offset = (seed * 5) % order.length;
        const attempts = Math.min(900, order.length);

        for (let i = 0; i < attempts; i++) {
          const ordIdx = (cursor + offset + i * 17) % order.length;
          const idx = order[ordIdx];
          const [x, y] = candidates[idx];
          const box = {
            left: x - wordWidth / 2 - WORD_GAP,
            right: x + wordWidth / 2 + WORD_GAP,
            top: y - wordHeight / 2 - WORD_GAP,
            bottom: y + wordHeight / 2 + WORD_GAP,
          };

          if (box.left < 3 || box.right > width - 3 || box.top < 3 || box.bottom > height - 3) continue;
          if (rectsOverlap(box, qrBox)) continue;
          if (result.some((r) => rectsOverlap(box, r.box))) continue;

          const color = BRAND_PALETTE[seed % BRAND_PALETTE.length];
          placedWord = {
            word,
            count,
            ratio,
            x,
            y,
            fontSize,
            color,
            delay: (seed % 1200) / 100,
            duration: 4.8 + (seed % 280) / 100,
            swayX: 2 + (seed % 7),
            swayY: 4 + (seed % 8),
            rotate: ((seed % 7) - 3) * 0.25,
            box,
          };
          cursor = (ordIdx + 1) % order.length;
          break;
        }
      }

      if (placedWord) result.push(placedWord);
    }

    if (result.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const w of result) {
        minX = Math.min(minX, w.box.left);
        maxX = Math.max(maxX, w.box.right);
        minY = Math.min(minY, w.box.top);
        maxY = Math.max(maxY, w.box.bottom);
      }

      const currentCx = (minX + maxX) / 2;
      const currentCy = (minY + maxY) / 2;
      const targetCx = width * 0.5;
      const targetCy = height * 0.52;
      const desiredDx = targetCx - currentCx;
      const desiredDy = targetCy - currentCy;

      let factor = 1;
      while (factor > 0.1) {
        const dx = desiredDx * factor;
        const dy = desiredDy * factor;
        if (canShiftAll(result, dx, dy, width, height, qrBox)) {
          for (const w of result) {
            w.x += dx;
            w.y += dy;
            w.box = {
              left: w.box.left + dx,
              right: w.box.right + dx,
              top: w.box.top + dy,
              bottom: w.box.bottom + dy,
            };
          }
          break;
        }
        factor *= 0.8;
      }
    }

    // Auto-scale words to fill as much silhouette area as possible while keeping no-overlap.
    if (result.length > 0) {
      let lo = 1;
      let hi = 2.2;
      let best = canApplyScale(result, 1, width, height, tr, qrBox);

      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        const attempt = canApplyScale(result, mid, width, height, tr, qrBox);
        if (attempt) {
          lo = mid;
          best = attempt;
        } else {
          hi = mid;
        }
      }

      if (best && lo > 1.01) {
        for (let i = 0; i < result.length; i++) {
          result[i].fontSize = best.sizes[i];
          result[i].box = best.boxes[i];
        }
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
