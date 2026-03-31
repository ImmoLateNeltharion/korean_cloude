import { useEffect, useMemo, useRef, useState } from "react";

interface WordTowerProps {
  words: Record<string, number>;
  qrSize?: number;
  centerLogoSize?: number;
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
  distNorm: number; // 0 = on outline, 1 = far away
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
  [0, 0, 96],   // bright silver-white
  [0, 0, 90],   // soft silver
  [0, 0, 82],   // graphite silver
  [358, 84, 52],// vivid red
  [352, 78, 58],// warm red
  [348, 66, 64],// muted red
  [0, 0, 88],   // neutral light silver
  [355, 72, 46],// deep red
];

const QR_MARGIN = 6;
const QR_BREATHING = 4;
const QR_SAFE_PAD_MAX = 64;
const WORD_GAP = 1;
const GLOBAL_FONT_SCALE = 1.34;
const MOBILE_FONT_SCALE = 1.08;
const SILHOUETTE_SCALE = 0.64;
const MOBILE_SILHOUETTE_SCALE = 0.54;
const MAP_PAD_X = 6;
const MAP_PAD_Y = 6;

function sizeTierForCount(rawCount: number): number {
  const count = Math.max(1, Math.floor(rawCount || 1));
  if (count <= 1) return 1.0;   // 1: minimal
  if (count <= 3) return 1.3;   // 2-3: slightly bigger
  if (count <= 6) return 1.65;  // 4-6: medium
  if (count <= 8) return 2.1;   // 7-8: above medium
  return 2.6;                   // 9+: max, hard cap
}

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

function createHeartShape(pointsCount = 360): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < pointsCount; i++) {
    const t = (i / pointsCount) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    points.push([x, y]);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  return points.map(([x, y]) => [
    ((x - minX) / w) * 2 - 1,
    ((y - minY) / h) * 2 - 1,
  ]);
}

function isInPolygons(nx: number, ny: number, polygons: [number, number][][]): boolean {
  return polygons.some((poly) => pointInPolygon(nx, ny, poly));
}

const INNER_SHAPES: [number, number][][] = [createHeartShape(360)];

const SHAPE_BOUNDS = (() => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const poly of INNER_SHAPES) {
    for (const [x, y] of poly) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, maxX, minY, maxY };
})();

function buildMapTransform(width: number, height: number, scaleFactor = SILHOUETTE_SCALE): MapTransform {
  const shapeW = SHAPE_BOUNDS.maxX - SHAPE_BOUNDS.minX;
  const shapeH = SHAPE_BOUNDS.maxY - SHAPE_BOUNDS.minY;
  const availW = Math.max(120, width - MAP_PAD_X * 2);
  const availH = Math.max(120, height - MAP_PAD_Y * 2);
  const scale = Math.min(availW / shapeW, availH / shapeH) * scaleFactor;
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
  if (rectsOverlap(box, qr)) return true;
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
  if (x >= qr.left && x <= qr.right && y >= qr.top && y <= qr.bottom) return true;
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

function pointInsideHeartHole(x: number, y: number, tr: MapTransform): boolean {
  const [nx, ny] = screenToShape(x, y, tr);
  return isInPolygons(nx, ny, INNER_SHAPES);
}

function boxIntersectsHeartHole(
  box: { left: number; top: number; right: number; bottom: number },
  tr: MapTransform
): boolean {
  const points: [number, number][] = [];
  const cols = 7;
  const rows = 5;
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const fx = rx / (cols - 1);
      const fy = ry / (rows - 1);
      points.push([
        box.left + (box.right - box.left) * fx,
        box.top + (box.bottom - box.top) * fy,
      ]);
    }
  }
  return points.some(([x, y]) => pointInsideHeartHole(x, y, tr));
}

// Precompute sampled outline points for distance queries
const OUTLINE_SAMPLES: [number, number][] = (() => {
  const pts: [number, number][] = [];
  for (const poly of INNER_SHAPES) {
    // Sample every 3rd point for performance
    for (let i = 0; i < poly.length; i += 3) {
      pts.push(poly[i]);
    }
  }
  return pts;
})();

function distToShapeOutline(sx: number, sy: number, tr: MapTransform): number {
  const [nx, ny] = screenToShape(sx, sy, tr);
  let minDist = Infinity;
  for (const [ox, oy] of OUTLINE_SAMPLES) {
    const dx = nx - ox;
    const dy = ny - oy;
    const d = dx * dx + dy * dy;
    if (d < minDist) minDist = d;
  }
  return Math.sqrt(minDist);
}

function getShapeOutlinePaths(tr: MapTransform): string[] {
  if (tr.scale <= 0) return [];
  return INNER_SHAPES.filter((poly) => poly.length >= 3).map((poly) => {
    const pts = poly.map(([nx, ny]) => {
      const [x, y] = shapeToScreen(nx, ny, tr);
      return `${x},${y}`;
    });
    return `M ${pts.join(" L ")} Z`;
  });
}

const WordTower = ({ words, qrSize = 160, centerLogoSize = 0 }: WordTowerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fontsReady, setFontsReady] = useState(false);
  const stablePositionsRef = useRef<
    Record<string, Pick<PlacedWord, "x" | "y" | "delay" | "duration" | "swayX" | "swayY" | "rotate">>
  >({});

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
      const width = size.width;
      const height = size.height;
      const isMobile = width < 768;
      const silhouetteScale = width < 768 ? MOBILE_SILHOUETTE_SCALE : SILHOUETTE_SCALE;
      const fontScale = isMobile ? MOBILE_FONT_SCALE : GLOBAL_FONT_SCALE;
      const minWordSize = Math.max(
        isMobile ? 16 : 24,
        Math.min(
          Math.round(Math.min(width, height) * (isMobile ? 0.03 : 0.042)),
          isMobile ? 30 : 44
        )
      );

      const tr = buildMapTransform(width, height, silhouetteScale);
      const mapW = (tr.maxX - tr.minX) * tr.scale;
      const mapH = (tr.maxY - tr.minY) * tr.scale;
      const cx = tr.originX + mapW / 2;
      const cy = tr.originY + mapH / 2;

      const hasQrArea = qrSize > 0;
      const hasCenterArea = centerLogoSize > 0;
      const qrSafePad = hasQrArea
        ? Math.max(20, Math.min(QR_SAFE_PAD_MAX, Math.round(qrSize * 0.28)))
        : 0;
      const qrBox = {
        left: width - QR_MARGIN - qrSize - QR_BREATHING - qrSafePad,
        top: QR_MARGIN - QR_BREATHING - qrSafePad,
        right: width - QR_MARGIN + QR_BREATHING + qrSafePad,
        bottom: QR_MARGIN + qrSize + QR_BREATHING + qrSafePad,
      };
      const qrArea: QRAvoidArea = {
        ...qrBox,
        cx: (qrBox.left + qrBox.right) / 2,
        cy: (qrBox.top + qrBox.bottom) / 2,
        r: (qrSize * 0.5) + qrSafePad,
      };
      const centerArea: QRAvoidArea = {
        left: cx - centerLogoSize * 0.62,
        right: cx + centerLogoSize * 0.62,
        top: cy - centerLogoSize * 0.42,
        bottom: cy + centerLogoSize * 0.42,
        cx,
        cy,
        r: centerLogoSize * 0.48,
      };

      const candidates: [number, number][] = [];
      const step = Math.max(7, Math.min(12, Math.round(Math.min(width, height) / 64)));
      const addGrid = (ox: number, oy: number) => {
        for (let y = 6 + oy; y <= height - 6; y += step) {
          for (let x = 6 + ox; x <= width - 6; x += step) {
            if (hasQrArea && pointInsideQRArea(x, y, qrArea)) continue;
            if (hasCenterArea && pointInsideQRArea(x, y, centerArea)) continue;
            if (pointInsideHeartHole(x, y, tr)) continue;
            candidates.push([x, y]);
          }
        }
      };
      addGrid(0, 0);
      addGrid(step / 2, step / 2);
      if (candidates.length < 120) return [];

      const gridCols = 28;
      const gridRows = 18;
      const occGrid = new Uint16Array(gridCols * gridRows);
      const cellIndex = (x: number, y: number) => {
        const nx = Math.max(0, Math.min(0.999, x / Math.max(1, width)));
        const ny = Math.max(0, Math.min(0.999, y / Math.max(1, height)));
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
      const result: PlacedWord[] = [];

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

      const buildBox = (x: number, y: number, wordWidth: number, wordHeight: number) => ({
        left: x - wordWidth / 2 - WORD_GAP,
        right: x + wordWidth / 2 + WORD_GAP,
        top: y - wordHeight / 2 - WORD_GAP,
        bottom: y + wordHeight / 2 + WORD_GAP,
      });
      const heartSafePad = Math.max(12, Math.round(minWordSize * 0.7));

      const isBoxValid = (box: { left: number; top: number; right: number; bottom: number }) => {
        if (box.left < 3 || box.right > width - 3 || box.top < 3 || box.bottom > height - 3) return false;
        if (hasQrArea && intersectsQRArea(box, qrArea)) return false;
        if (hasCenterArea && intersectsQRArea(box, centerArea)) return false;
        if (
          boxIntersectsHeartHole(
            {
              left: box.left - heartSafePad,
              top: box.top - heartSafePad,
              right: box.right + heartSafePad,
              bottom: box.bottom + heartSafePad,
            },
            tr
          )
        ) return false;
        if (overlapsPlaced(box)) return false;
        return true;
      };

      const reused = new Set<string>();
      const prevStable = stablePositionsRef.current;

      // First pass: keep existing words where possible to avoid full relayout/flicker.
      for (let wi = 0; wi < sorted.length; wi++) {
        const [word, count] = sorted[wi];
        const prev = prevStable[word];
        if (!prev) continue;

        const cappedForRatio = Math.min(10, Math.max(1, count));
        const ratio = (cappedForRatio - 1) / 9;
        const tier = sizeTierForCount(cappedForRatio);
        const baseSize = Math.round(minWordSize * tier * fontScale);
        const seed = hashWord(word);
        const color = BRAND_PALETTE[seed % BRAND_PALETTE.length];

        let reusedWord: PlacedWord | null = null;
        for (const scale of [1, 0.9, 0.82, 0.74, 0.66]) {
          const fontSize = Math.max(minWordSize, Math.round(baseSize * scale));
          const wordWidth = measureWordWidth(word, fontSize);
          const wordHeight = Math.ceil(fontSize * 1.14);
          const box = buildBox(prev.x, prev.y, wordWidth, wordHeight);
          if (!isBoxValid(box)) continue;

          reusedWord = {
            word,
            count,
            ratio,
            x: prev.x,
            y: prev.y,
            fontSize,
            color,
            delay: prev.delay,
            duration: prev.duration,
            swayX: prev.swayX,
            swayY: prev.swayY,
            rotate: prev.rotate,
            box,
            distNorm: distToShapeOutline(prev.x, prev.y, tr),
          };
          break;
        }

        if (reusedWord) {
          const idx = result.length;
          result.push(reusedWord);
          addToBuckets(idx);
          occGrid[cellIndex(reusedWord.x, reusedWord.y)] = Math.min(
            65535,
            occGrid[cellIndex(reusedWord.x, reusedWord.y)] + 1
          );
          reused.add(word);
        }
      }

      for (let wi = 0; wi < sorted.length; wi++) {
        const [word, count] = sorted[wi];
        if (reused.has(word)) continue;
        const cappedForRatio = Math.min(10, Math.max(1, count));
        const ratio = (cappedForRatio - 1) / 9;
        const tier = sizeTierForCount(cappedForRatio);
        const baseSize = Math.round(minWordSize * tier * fontScale);
        const seed = hashWord(word);
        const color = BRAND_PALETTE[seed % BRAND_PALETTE.length];
        let placedWord: PlacedWord | null = null;

        for (const scale of [1, 0.9, 0.82, 0.74, 0.66]) {
          const fontSize = Math.max(minWordSize, Math.round(baseSize * scale));
          const wordWidth = measureWordWidth(word, fontSize);
          const wordHeight = Math.ceil(fontSize * 1.14);
          const sampleCount = Math.min(280, candidates.length);
          const start = seed % candidates.length;
          const walk = coprimeStep(candidates.length, seed ^ (wi * 2654435761));
          let best: { x: number; y: number; box: { left: number; top: number; right: number; bottom: number }; score: number; dist: number } | null = null;

          for (let i = 0; i < sampleCount; i++) {
            const idx = modPos(start + i * walk, candidates.length);
            const [x, y] = candidates[idx];
            const box = buildBox(x, y, wordWidth, wordHeight);
            if (!isBoxValid(box)) continue;

            const occ = neighborOcc(cellIndex(x, y));
            // Strongly prefer positions near the heart outline
            const distToOutline = distToShapeOutline(x, y, tr);
            const proximityScore = distToOutline * distToOutline * 40;
            const score = occ * 0.15 + proximityScore;
            if (!best || score < best.score) best = { x, y, box, score, dist: distToOutline };
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
              distNorm: best.dist,
            };
            break;
          }
        }

        if (placedWord) {
          const idx = result.length;
          result.push(placedWord);
          addToBuckets(idx);
          occGrid[cellIndex(placedWord.x, placedWord.y)] = Math.min(65535, occGrid[cellIndex(placedWord.x, placedWord.y)] + 1);
        }
      }

      const nextStable: Record<string, Pick<PlacedWord, "x" | "y" | "delay" | "duration" | "swayX" | "swayY" | "rotate">> = {};
      for (const w of result) {
        nextStable[w.word] = {
          x: w.x,
          y: w.y,
          delay: w.delay,
          duration: w.duration,
          swayX: w.swayX,
          swayY: w.swayY,
          rotate: w.rotate,
        };
      }
      stablePositionsRef.current = nextStable;

      return result;
    } catch (err) {
      console.error("Word cloud layout failed:", err);
      return [];
    }
  }, [centerLogoSize, fontsReady, qrSize, size.height, size.width, words]);

  const shapeOutlinePaths = useMemo(() => {
    if (size.width === 0 || size.height === 0) return [];
    const silhouetteScale = size.width < 768 ? MOBILE_SILHOUETTE_SCALE : SILHOUETTE_SCALE;
    return getShapeOutlinePaths(buildMapTransform(size.width, size.height, silhouetteScale));
  }, [size.height, size.width]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none">
      <div className="absolute inset-0 pointer-events-none word-cloud-bg" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 72% 68% at 50% 50%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.14) 78%, rgba(0,0,0,0.28) 100%)",
        }}
      />

      {placed.map((item) => {
        // Stable shading by absolute distance to outline (no frame-to-frame re-normalization).
        const proximity = Math.max(0, Math.min(1, 1 - item.distNorm / 0.75));
        const opacity = 0.48 + proximity * 0.42;
        const glowIntensity = proximity;
        const satBoost = Math.round(proximity * 15);
        const lightBoost = Math.round(proximity * 12);

        return (
          <span
            key={item.word}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap word-cloud-item"
            style={{
              left: `${item.x}px`,
              top: `${item.y}px`,
              fontFamily: "Vatech, sans-serif",
              fontSize: `${item.fontSize}px`,
              color: `hsl(${item.color[0]} ${Math.min(100, item.color[1] + satBoost)}% ${Math.min(97, item.color[2] + lightBoost)}%)`,
              opacity,
              textShadow: glowIntensity > 0.3
                ? `0 0 ${6 + glowIntensity * 12}px hsl(${item.color[0]} ${item.color[1]}% ${Math.min(97, item.color[2] + 10)}% / ${0.4 + glowIntensity * 0.5}),
                   0 0 ${16 + glowIntensity * 20}px hsl(${item.color[0]} ${Math.max(50, item.color[1])}% ${Math.max(34, item.color[2])}% / ${glowIntensity * 0.45})`
                : "none",
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
        );
      })}
    </div>
  );
};

export default WordTower;
