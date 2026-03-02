import { useMemo, useRef, useEffect, useState } from "react";
import { FILLER_WORDS } from "@/lib/words";

interface WordTowerProps {
  words: Record<string, number>;
}

// Deterministic hash for a word string → stable per-word color seed
function wordHash(word: string): number {
  let h = 0;
  for (let i = 0; i < word.length; i++) {
    h = ((h << 5) - h + word.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Tower silhouette profile: t=0 top, t=1 bottom. Returns half-width factor 0..1
// Namsan Tower shape: antenna tip → observation deck bulge → narrow shaft → wider base
function towerProfile(t: number): number {
  if (t < 0.03) return 0.02;                          // thin antenna tip
  if (t < 0.08) {
    const s = (t - 0.03) / 0.05;
    return 0.02 + s * 0.33;                           // 0.02 → 0.35 (expand to observation deck)
  }
  if (t < 0.20) {
    const s = (t - 0.08) / 0.12;
    const bulge = Math.sin(s * Math.PI);
    return 0.35 + bulge * 0.10;                       // 0.35 → 0.45 peak → 0.35 (observation deck)
  }
  if (t < 0.30) {
    const s = (t - 0.20) / 0.10;
    return 0.35 - s * 0.10;                           // 0.35 → 0.25 (narrow to shaft)
  }
  if (t < 0.80) {
    const s = (t - 0.30) / 0.50;
    return 0.25 + s * 0.05;                           // 0.25 → 0.30 (long narrow shaft)
  }
  const s = (t - 0.80) / 0.20;
  return 0.30 + s * s * 0.40;                         // 0.30 → 0.70 (base widens)
}

// Hidden DOM span for pixel-perfect text measurement (uses actually loaded font)
let _measureSpan: HTMLSpanElement | null = null;
function getMeasureSpan(): HTMLSpanElement {
  if (!_measureSpan) {
    _measureSpan = document.createElement('span');
    _measureSpan.style.cssText = 'position:absolute;left:-9999px;top:-9999px;white-space:nowrap;visibility:hidden;font-family:Montserrat,sans-serif;';
    document.body.appendChild(_measureSpan);
  }
  return _measureSpan;
}

function measureWord(word: string, fontSize: number, ratio: number, isFiller: boolean): number {
  const span = getMeasureSpan();
  const weight = isFiller ? 400 : (ratio > 0.6 ? 900 : ratio > 0.3 ? 700 : 600);
  span.style.fontWeight = String(weight);
  span.style.fontSize = `${fontSize}px`;
  span.textContent = word;
  // 3% safety margin + 2px flat — handles sub-pixel rounding at all font sizes
  return Math.ceil(span.offsetWidth * 1.03) + 2;
}

type PlacedWord = {
  word: string;
  fontSize: number;
  ratio: number;
  isUser: boolean;
  isFiller: boolean;
};

type TowerRow = {
  placedWords: PlacedWord[];
  targetWidth: number;
  rowT: number;
  height: number;
};

const WordTower = ({ words }: WordTowerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [containerHeight, setContainerHeight] = useState(600);
  const [fontsReady, setFontsReady] = useState(false);

  // Wait for fonts to load before measuring — this is critical!
  // Without this, measureWord uses fallback sans-serif which is narrower than Montserrat,
  // causing words to overflow their measured widths when the real font renders.
  useEffect(() => {
    document.fonts.ready.then(() => {
      // Force-load Montserrat at all weights we use
      const weights = [400, 600, 700, 900];
      Promise.all(
        weights.map(w => document.fonts.load(`${w} 16px Montserrat`))
      ).then(() => {
        // Reset measurement span so it picks up the freshly loaded font
        if (_measureSpan) {
          _measureSpan.remove();
          _measureSpan = null;
        }
        setFontsReady(true);
      });
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0) setContainerWidth(Math.floor(width));
      if (height > 0) setContainerHeight(Math.floor(height));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const tower = useMemo(() => {
    if (!fontsReady) return [];

    const maxFontByWidth = containerWidth * 0.124;
    const maxFontByHeight = containerHeight / 18;
    const maxFontSize = Math.max(11, Math.min(maxFontByWidth, maxFontByHeight, 240));
    const minFontSize = Math.max(9, containerWidth * 0.014);
    const numRows = 20;

    const entries = Object.entries(words);
    if (entries.length === 0) return [];

    const maxCount = Math.max(...entries.map(([, c]) => c));
    const minCount = Math.min(...entries.map(([, c]) => c));

    type WordEntry = { word: string; count: number; fontSize: number; ratio: number; isUser: boolean };

    const allWords: WordEntry[] = entries.map(([word, count]) => {
      const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      // Power curve: only top 5-7 words get large sizes, rest are notably smaller
      const sizeRatio = Math.pow(ratio, 2.2);
      const fontSize = minFontSize + sizeRatio * (maxFontSize - minFontSize);
      return { word, count, fontSize, ratio, isUser: word in words };
    });

    allWords.sort((a, b) => b.count - a.count);

    // Tower width scales with container but capped to keep Namsan shape
    const towerWidth = Math.min(containerWidth * 0.85, containerHeight * 0.55);

    const rows: TowerRow[] = [];
    for (let r = 0; r < numRows; r++) {
      const t = r / (numRows - 1);
      const w = towerProfile(t) * towerWidth;
      rows.push({ placedWords: [], targetWidth: Math.max(20, w), rowT: t, height: 0 });
    }

    const GAP = 3; // must match CSS gap between words
    const usedWidths = new Array(numRows).fill(0);
    const wordCounts = new Array(numRows).fill(0); // track word count per row for gap calc

    // Find max font size that fits within availableWidth using binary search
    function maxFontThatFits(word: string, availableWidth: number, maxSize: number, ratio: number, isFiller: boolean): number {
      let lo = 7, hi = maxSize;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (measureWord(word, mid, ratio, isFiller) <= availableWidth) lo = mid;
        else hi = mid;
      }
      return Math.floor(lo);
    }

    for (const entry of allWords) {
      let bestRow = -1;
      let bestScore = -Infinity;

      for (let r = 0; r < numRows; r++) {
        const row = rows[r];
        const gapCost = wordCounts[r] > 0 ? GAP : 0;
        const remaining = row.targetWidth - usedWidths[r] - gapCost;
        if (remaining < 10) continue;
        const maxFontForRow = maxFontThatFits(entry.word, remaining, entry.fontSize, entry.ratio, false);
        const clampedSize = Math.min(entry.fontSize, Math.max(7, maxFontForRow));
        const wordW = measureWord(entry.word, clampedSize, entry.ratio, false);

        if (usedWidths[r] + gapCost + wordW <= row.targetWidth) {
          const fillRatio = usedWidths[r] / row.targetWidth;
          const sizeRatio = clampedSize / entry.fontSize;
          const score = sizeRatio * 80 + (1 - fillRatio) * 20;
          if (score > bestScore) {
            bestScore = score;
            bestRow = r;
          }
        }
      }

      if (bestRow === -1) {
        let maxRemaining = -Infinity;
        for (let r = 0; r < numRows; r++) {
          const gapCost = wordCounts[r] > 0 ? GAP : 0;
          const rem = rows[r].targetWidth - usedWidths[r] - gapCost;
          if (rem > maxRemaining) { maxRemaining = rem; bestRow = r; }
        }
      }

      if (bestRow === -1) continue;

      const row = rows[bestRow];
      const gapCost = wordCounts[bestRow] > 0 ? GAP : 0;
      const remaining = row.targetWidth - usedWidths[bestRow] - gapCost;
      const maxFont = maxFontThatFits(entry.word, remaining, entry.fontSize, entry.ratio, false);
      let fontSize = Math.max(7, Math.min(entry.fontSize, maxFont));
      let wordW = measureWord(entry.word, fontSize, entry.ratio, false);

      // Reduce font size step by step until word actually fits (handles measurement rounding)
      while (wordW > remaining && fontSize > 7) {
        fontSize--;
        wordW = measureWord(entry.word, fontSize, entry.ratio, false);
      }

      // Skip word only if it truly doesn't fit even at minimum font size
      if (wordW > remaining) continue;

      row.placedWords.push({
        word: entry.word,
        fontSize,
        ratio: entry.ratio,
        isUser: entry.isUser,
        isFiller: false,
      });
      usedWidths[bestRow] += wordW + gapCost;
      wordCounts[bestRow]++;
      row.height = Math.max(row.height, fontSize * 1.3);
    }

    // Fill remaining space with filler words
    const fillerMinSize = Math.max(7, containerWidth * 0.008);
    const fillerMaxSize = fillerMinSize + Math.max(3, containerWidth * 0.004);
    let fillerIdx = 0;

    for (let r = 0; r < numRows; r++) {
      const row = rows[r];
      let used = usedWidths[r];
      let wc = wordCounts[r];
      let attempts = 0;

      while (used < row.targetWidth - 8 && attempts < 50) {
        const filler = FILLER_WORDS[fillerIdx % FILLER_WORDS.length];
        fillerIdx++;
        const fillerSize = fillerMinSize + Math.random() * (fillerMaxSize - fillerMinSize);
        const fw = measureWord(filler, fillerSize, 0, true);
        const gc = wc > 0 ? GAP : 0;

        if (used + gc + fw <= row.targetWidth) {
          row.placedWords.push({
            word: filler, fontSize: fillerSize, ratio: 0,
            isUser: false, isFiller: true,
          });
          used += gc + fw;
          wc++;
          if (row.height === 0) row.height = fillerSize * 1.2;
        }
        attempts++;
      }
      usedWidths[r] = used;
      wordCounts[r] = wc;
    }

    for (let r = 0; r < numRows; r++) {
      const row = rows[r];
      if (row.placedWords.length === 0 && row.targetWidth > 15) {
        let used = 0;
        let wc = 0;
        let attempts = 0;
        while (used < row.targetWidth - 8 && attempts < 40) {
          const filler = FILLER_WORDS[fillerIdx % FILLER_WORDS.length];
          fillerIdx++;
          const fillerSize = fillerMinSize + Math.random() * (fillerMaxSize - fillerMinSize) * 0.7;
          const fw = measureWord(filler, fillerSize, 0, true);
          const gc = wc > 0 ? GAP : 0;
          if (used + gc + fw <= row.targetWidth) {
            row.placedWords.push({
              word: filler, fontSize: fillerSize, ratio: 0,
              isUser: false, isFiller: true,
            });
            used += gc + fw;
            wc++;
            row.height = Math.max(row.height, fillerSize * 1.2);
          }
          attempts++;
        }
      }
    }

    // Shuffle words within each row so big/small words are mixed (like reference)
    // Deterministic shuffle using row index as seed
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (row.placedWords.length <= 1) continue;
      let seed = r * 7 + 13;
      const seededRandom = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed >> 16) / 32767;
      };
      // Fisher-Yates shuffle with seeded random
      for (let i = row.placedWords.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [row.placedWords[i], row.placedWords[j]] = [row.placedWords[j], row.placedWords[i]];
      }
    }

    return rows.filter(r => r.placedWords.length > 0);
  }, [words, containerWidth, containerHeight, fontsReady]);

  const { silhouettePath, svgHeight } = useMemo(() => {
    const cw = Math.min(containerWidth * 0.85, containerHeight * 0.55);
    const h = cw * 1.6;
    const cx = cw / 2;
    const hw = cw / 2;
    const steps = 80;
    const left: string[] = [], right: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = t * h;
      const w = towerProfile(t) * hw;
      left.push(`${cx - w},${y}`);
      right.unshift(`${cx + w},${y}`);
    }
    return {
      silhouettePath: `M ${left.join(" L ")} L ${right.join(" L ")} Z`,
      svgHeight: h,
    };
  }, [containerWidth]);

  if (tower.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center py-20">
        <p className="text-muted-foreground text-lg">Загрузка...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col items-center justify-center py-2 select-none">
      {/* Word rows with glow behind */}
      <div className="relative flex flex-col items-center" style={{ gap: '2px' }}>
        {/* Soft radial ambient glow behind tower */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${Math.min(containerWidth * 0.85, containerHeight * 0.55) * 2.2}px`,
            height: `${svgHeight * 1.6}px`,
            background: 'radial-gradient(ellipse 40% 50% at center, hsl(35 80% 40% / 0.35) 0%, hsl(30 70% 35% / 0.15) 40%, transparent 70%)',
          }}
        />
        {/* Blurred tower silhouette glow — uses SVG filter for soft edges */}
        <svg
          className="absolute pointer-events-none"
          viewBox={`${-Math.min(containerWidth * 0.85, containerHeight * 0.55) * 0.5} ${-svgHeight * 0.3} ${Math.min(containerWidth * 0.85, containerHeight * 0.55) * 2} ${svgHeight * 1.6}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${Math.min(containerWidth * 0.85, containerHeight * 0.55) * 2}px`,
            height: `${svgHeight * 1.6}px`,
            overflow: 'visible',
          }}
        >
          <defs>
            <filter id="towerGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="35" />
            </filter>
          </defs>
          <path d={silhouettePath} fill="hsl(35 85% 45%)" stroke="none" filter="url(#towerGlow)" opacity="0.4" />
        </svg>
        {tower.map((row, ri) => (
          <div
            key={ri}
            className="flex items-baseline justify-center"
            style={{
              gap: "3px",
              lineHeight: 1.05,
              width: `${row.targetWidth}px`,
              minHeight: `${row.height}px`,
              animation: `towerRowIn 0.5s ease-out ${(tower.length - 1 - ri) * 0.04}s both`,
            }}
          >
            {row.placedWords.map((w, wi) => (
              <span
                key={`${w.word}-${ri}-${wi}`}
                className="whitespace-nowrap"
                style={{
                  fontSize: `${w.fontSize}px`,
                  color: w.isFiller
                    ? `hsl(30, 40%, 45%)`
                    : (() => {
                        // Seeded color variation: hue 25-50 (orange→gold→warm yellow)
                        const h = wordHash(w.word);
                        const hue = 25 + (h % 26);            // 25..50
                        const sat = 70 + (h % 30);            // 70..99
                        const lit = 48 + ((h >> 4) % 32);     // 48..79 (some whiter)
                        return `hsl(${hue}, ${sat}%, ${lit}%)`;
                      })(),
                  textShadow: w.isFiller
                    ? "none"
                    : w.ratio > 0.5
                      ? `0 0 ${8 + w.ratio * 25}px hsl(35 95% 55% / 0.6), 0 0 ${w.ratio * 50}px hsl(30 90% 45% / 0.3), 0 0 ${w.ratio * 80}px hsl(25 80% 40% / 0.15)`
                      : w.ratio > 0.2
                        ? `0 0 ${6 + w.ratio * 16}px hsl(35 90% 55% / 0.4), 0 0 ${w.ratio * 35}px hsl(30 85% 45% / 0.2)`
                        : `0 0 6px hsl(35 80% 55% / 0.25)`,
                  fontWeight: w.isFiller ? 400 : (w.ratio > 0.6 ? 900 : w.ratio > 0.3 ? 700 : 600),
                  opacity: w.isFiller ? 0.4 : (w.isUser ? 1 : 0.8),
                  lineHeight: 1.0,
                }}
              >
                {w.word}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WordTower;
