import { useMemo, useRef, useEffect, useState } from "react";

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

function measureWord(word: string, fontSize: number, ratio: number): number {
  const span = getMeasureSpan();
  const weight = ratio > 0.6 ? 900 : ratio > 0.3 ? 700 : 600;
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
};

type TowerRow = {
  placedWords: PlacedWord[];
  targetWidth: number;
  rowT: number;
  height: number;
};

const WordTower = ({ words }: WordTowerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Start at 0 — tower won't render until ResizeObserver provides real dimensions
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);

  // Wait for fonts to load before measuring
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await document.fonts.ready;
      const weights = [400, 600, 700, 900];
      await Promise.all(weights.map(w => document.fonts.load(`${w} 16px Montserrat`)));
      if (_measureSpan) { _measureSpan.remove(); _measureSpan = null; }
      if (!cancelled) setFontsReady(true);
    };
    init();
    // Fallback: if fonts.ready hangs, check after 500ms
    const fallback = setTimeout(() => {
      if (!cancelled && document.fonts.check('16px Montserrat')) {
        if (_measureSpan) { _measureSpan.remove(); _measureSpan = null; }
        setFontsReady(true);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(fallback); };
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
    // Don't render until both fonts loaded AND container measured
    if (!fontsReady || containerWidth === 0 || containerHeight === 0) return [];

    const entries = Object.entries(words);
    if (entries.length === 0) return [];

    const n = entries.length;
    const numRows = 20;
    const maxFontByWidth = containerWidth * 0.124;
    const maxFontByHeight = containerHeight / 18;
    const maxFontSize = Math.max(11, Math.min(maxFontByWidth, maxFontByHeight, 240));
    const minFontSize = Math.max(9, containerWidth * 0.014);

    const maxCount = Math.max(...entries.map(([, c]) => c));
    const minCount = Math.min(...entries.map(([, c]) => c));

    // Percentage-based sizing: scale fonts relative to word count
    // Few words → bigger fonts to fill the tower; many words → smaller fonts
    const idealTotalWords = 60;
    const densityScale = Math.min(1.5, Math.max(0.5, Math.sqrt(idealTotalWords / n)));

    // Flatten power curve when few words (more uniform sizes)
    const power = 1 + Math.min(1.2, (n / 50) * 1.2);

    type WordEntry = { word: string; count: number; fontSize: number; ratio: number };

    const allWords: WordEntry[] = entries.map(([word, count]) => {
      // Percentage-based: count/maxCount. Never 0 — even the smallest word stays visible.
      // Old range formula (count-min)/(max-min) gave 0 for all count=1 words → invisible.
      const ratio = count / maxCount;
      const sizeRatio = Math.pow(ratio, power);
      // densityScale boosts only the range portion, not the minimum — preserves contrast
      const fontSize = Math.min(maxFontSize, minFontSize + sizeRatio * (maxFontSize - minFontSize) * densityScale);
      return { word, count, fontSize, ratio };
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

    const GAP = 3;
    const usedWidths = new Array(numRows).fill(0);
    const wordCounts = new Array(numRows).fill(0);

    const MIN_FONT = 5;

    function maxFontThatFits(word: string, availableWidth: number, maxSize: number, ratio: number): number {
      let lo = MIN_FONT, hi = maxSize;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (measureWord(word, mid, ratio) <= availableWidth) lo = mid;
        else hi = mid;
      }
      return Math.floor(lo);
    }

    function placeWord(entry: WordEntry): boolean {
      let bestRow = -1;
      let bestScore = -Infinity;

      // Iterate bottom→top so base rows win on equal score (they appear first in animation)
      for (let r = numRows - 1; r >= 0; r--) {
        const row = rows[r];
        const gapCost = wordCounts[r] > 0 ? GAP : 0;
        const remaining = row.targetWidth - usedWidths[r] - gapCost;
        if (remaining < 10) continue;
        const maxFontForRow = maxFontThatFits(entry.word, remaining, entry.fontSize, entry.ratio);
        const clampedSize = Math.min(entry.fontSize, Math.max(MIN_FONT, maxFontForRow));
        const wordW = measureWord(entry.word, clampedSize, entry.ratio);

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
        for (let r = numRows - 1; r >= 0; r--) {
          const gapCost = wordCounts[r] > 0 ? GAP : 0;
          const rem = rows[r].targetWidth - usedWidths[r] - gapCost;
          if (rem > maxRemaining) { maxRemaining = rem; bestRow = r; }
        }
      }

      if (bestRow === -1) return false;

      const row = rows[bestRow];
      const gapCost = wordCounts[bestRow] > 0 ? GAP : 0;
      const remaining = row.targetWidth - usedWidths[bestRow] - gapCost;
      const maxFont = maxFontThatFits(entry.word, remaining, entry.fontSize, entry.ratio);
      let fontSize = Math.max(MIN_FONT, Math.min(entry.fontSize, maxFont));
      let wordW = measureWord(entry.word, fontSize, entry.ratio);

      while (wordW > remaining && fontSize > MIN_FONT) {
        fontSize--;
        wordW = measureWord(entry.word, fontSize, entry.ratio);
      }

      if (wordW > remaining) return false;

      row.placedWords.push({ word: entry.word, fontSize, ratio: entry.ratio });
      usedWidths[bestRow] += wordW + gapCost;
      wordCounts[bestRow]++;
      row.height = Math.max(row.height, fontSize * 1.3);
      return true;
    }

    // Pass 1: greedy placement
    const unplaced: WordEntry[] = [];
    for (const entry of allWords) {
      if (!placeWord(entry)) unplaced.push(entry);
    }

    // Pass 2: force-place remaining words by expanding the widest rows
    for (const entry of unplaced) {
      // Find the row with most remaining space
      let bestR = 0;
      let maxRem = -Infinity;
      for (let r = 0; r < numRows; r++) {
        const gapCost = wordCounts[r] > 0 ? GAP : 0;
        const rem = rows[r].targetWidth - usedWidths[r] - gapCost;
        if (rem > maxRem) { maxRem = rem; bestR = r; }
      }
      // Force the word at MIN_FONT even if it overflows slightly
      const row = rows[bestR];
      const gapCost = wordCounts[bestR] > 0 ? GAP : 0;
      const wordW = measureWord(entry.word, MIN_FONT, entry.ratio);
      row.placedWords.push({ word: entry.word, fontSize: MIN_FONT, ratio: entry.ratio });
      usedWidths[bestR] += wordW + gapCost;
      wordCounts[bestR]++;
      row.height = Math.max(row.height, MIN_FONT * 1.3);
      // Expand row target so future words still have accurate remaining calc
      if (usedWidths[bestR] > row.targetWidth) {
        row.targetWidth = usedWidths[bestR];
      }
    }

    // Post-layout: if total height exceeds container, scale all fonts down
    const filledRows = rows.filter(r => r.placedWords.length > 0);
    const totalHeight = filledRows.reduce((sum, r) => sum + r.height, 0) + (filledRows.length - 1) * 2;
    const maxTowerHeight = containerHeight * 0.92;
    if (totalHeight > maxTowerHeight && totalHeight > 0) {
      const scale = maxTowerHeight / totalHeight;
      for (const row of filledRows) {
        for (const pw of row.placedWords) {
          pw.fontSize = Math.max(MIN_FONT, Math.round(pw.fontSize * scale));
        }
        row.height = Math.round(row.height * scale);
      }
    }

    // Shuffle words within each row deterministically
    for (let r = 0; r < filledRows.length; r++) {
      const row = filledRows[r];
      if (row.placedWords.length <= 1) continue;
      let seed = r * 7 + 13;
      const seededRandom = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed >> 16) / 32767;
      };
      for (let i = row.placedWords.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [row.placedWords[i], row.placedWords[j]] = [row.placedWords[j], row.placedWords[i]];
      }
    }

    return filledRows;
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
  }, [containerWidth, containerHeight]);

  // Loading state (fonts or container not ready)
  if (!fontsReady || containerWidth === 0 || containerHeight === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Загрузка...</p>
      </div>
    );
  }

  // No words yet — show empty space (tower appears once words are added)
  if (tower.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full" />
    );
  }

  const towerWidth = Math.min(containerWidth * 0.85, containerHeight * 0.55);

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col items-center justify-end pb-8 select-none">
      {/* Soft radial ambient glow — fixed to full container */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${towerWidth * 2.2}px`,
          height: `${svgHeight * 1.6}px`,
          background: 'radial-gradient(ellipse 40% 50% at center, hsl(35 80% 40% / 0.35) 0%, hsl(30 70% 35% / 0.15) 40%, transparent 70%)',
        }}
      />
      {/* Blurred tower silhouette glow — fixed to full container */}
      <svg
        className="absolute pointer-events-none"
        viewBox={`${-towerWidth * 0.5} ${-svgHeight * 0.3} ${towerWidth * 2} ${svgHeight * 1.6}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${towerWidth * 2}px`,
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
      {/* Word rows */}
      <div className="relative flex flex-col items-center" style={{ gap: '2px' }}>
        {tower.map((row, ri) => (
          <div
            key={ri}
            className="relative flex items-baseline justify-center"
            style={{
              gap: "3px",
              lineHeight: 1.05,
              width: `${row.targetWidth}px`,
              minHeight: `${row.height}px`,
              animation: `towerRowIn 0.4s ease-out ${(tower.length - 1 - ri) * 0.1}s both`,
              '--rise-dist': `${(tower.length - 1 - ri) * 50 + 40}px`,
            } as React.CSSProperties}
          >
            {row.placedWords.map((w, wi) => {
              const h = wordHash(w.word);
              const hue = 25 + (h % 26);
              const sat = 70 + (h % 30);
              const lit = 48 + ((h >> 4) % 32);
              return (
                <span
                  key={`${w.word}-${ri}-${wi}`}
                  className="whitespace-nowrap"
                  style={{
                    fontSize: `${w.fontSize}px`,
                    color: `hsl(${hue}, ${sat}%, ${lit}%)`,
                    textShadow: w.ratio > 0.5
                      ? `0 0 ${8 + w.ratio * 25}px hsl(35 95% 55% / 0.6), 0 0 ${w.ratio * 50}px hsl(30 90% 45% / 0.3), 0 0 ${w.ratio * 80}px hsl(25 80% 40% / 0.15)`
                      : w.ratio > 0.2
                        ? `0 0 ${6 + w.ratio * 16}px hsl(35 90% 55% / 0.4), 0 0 ${w.ratio * 35}px hsl(30 85% 45% / 0.2)`
                        : `0 0 6px hsl(35 80% 55% / 0.25)`,
                    fontWeight: w.ratio > 0.6 ? 900 : w.ratio > 0.3 ? 700 : 600,
                    lineHeight: 1.0,
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WordTower;
