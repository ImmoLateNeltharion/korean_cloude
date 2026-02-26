import { useMemo } from "react";

interface WordTowerProps {
  words: Record<string, number>;
}

// Placeholder positive words to fill the tower
const PLACEHOLDER_WORDS: Record<string, number> = {
  "люди": 20, "успех": 18, "команда": 16, "рост": 15, "доверие": 14,
  "будущее": 13, "опыт": 12, "развитие": 11, "инновации": 10, "победа": 9,
  "мечта": 8, "сила": 8, "радость": 7, "знания": 7, "энергия": 7,
  "дружба": 6, "вдохновение": 6, "гармония": 6, "свобода": 5, "любовь": 5,
  "счастье": 5, "надежда": 5, "мудрость": 4, "красота": 4, "добро": 4,
  "свет": 4, "тепло": 3, "улыбка": 3, "вера": 3, "честь": 3,
  "смелость": 3, "талант": 2, "цель": 2, "путь": 2, "звезда": 2,
  "солнце": 2, "мир": 2, "душа": 1, "искра": 1, "рассвет": 1,
};

// Tower silhouette profile: returns width factor (0-1) for a given vertical position (0=top, 1=bottom)
// Shape: thin spire → bulge → thin neck → wide base
function towerProfile(t: number): number {
  if (t < 0.15) {
    // Thin spire tip
    return 0.05 + t * 0.8;
  } else if (t < 0.35) {
    // Widening to bulge
    const local = (t - 0.15) / 0.2;
    return 0.17 + local * 0.45;
  } else if (t < 0.5) {
    // Bulge peak
    const local = (t - 0.35) / 0.15;
    return 0.62 - local * 0.3;
  } else if (t < 0.65) {
    // Narrow neck
    const local = (t - 0.5) / 0.15;
    return 0.32 + local * 0.05;
  } else {
    // Wide base expanding
    const local = (t - 0.65) / 0.35;
    return 0.37 + local * 0.63;
  }
}

const WordTower = ({ words }: WordTowerProps) => {
  const tower = useMemo(() => {
    // Merge user words with placeholders (user words override)
    const merged = { ...PLACEHOLDER_WORDS };
    for (const [w, c] of Object.entries(words)) {
      merged[w] = (merged[w] || 0) + c;
    }

    const entries = Object.entries(merged);
    if (entries.length === 0) return [];

    const maxCount = Math.max(...entries.map(([, c]) => c));
    const minCount = Math.min(...entries.map(([, c]) => c));

    const sized = entries.map(([word, count]) => {
      const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      const fontSize = 11 + ratio * 45;
      return { word, count, fontSize, ratio, isUser: word in words };
    });

    // Sort by size ascending — small words first (top of tower)
    sized.sort((a, b) => a.fontSize - b.fontSize);

    // Build rows following tower silhouette
    const maxWidth = 500;
    const totalRowTarget = 30;
    const rows: { words: typeof sized }[] = [];
    let wordIndex = 0;

    for (let r = 0; r < totalRowTarget && wordIndex < sized.length; r++) {
      const t = r / (totalRowTarget - 1);
      const widthFactor = towerProfile(t);
      const rowWidth = Math.max(50, widthFactor * maxWidth);

      const row: typeof sized = [];
      let usedWidth = 0;

      while (wordIndex < sized.length) {
        const w = sized[wordIndex];
        const estWidth = w.word.length * w.fontSize * 0.52 + 6;
        if (usedWidth + estWidth <= rowWidth || row.length === 0) {
          row.push(w);
          usedWidth += estWidth;
          wordIndex++;
        } else {
          break;
        }
      }
      rows.push({ words: row });
    }

    // Remaining words into extra rows at the base
    while (wordIndex < sized.length) {
      const row: typeof sized = [];
      let usedWidth = 0;
      while (wordIndex < sized.length) {
        const w = sized[wordIndex];
        const estWidth = w.word.length * w.fontSize * 0.52 + 6;
        if (usedWidth + estWidth <= maxWidth || row.length === 0) {
          row.push(w);
          usedWidth += estWidth;
          wordIndex++;
        } else break;
      }
      rows.push({ words: row });
    }

    return rows;
  }, [words]);

  // Generate SVG silhouette path points
  const silhouettePath = useMemo(() => {
    const height = 700;
    const centerX = 250;
    const maxHalfWidth = 250;
    const steps = 60;
    const leftPoints: string[] = [];
    const rightPoints: string[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = t * height;
      const halfW = towerProfile(t) * maxHalfWidth;
      leftPoints.push(`${centerX - halfW},${y}`);
      rightPoints.unshift(`${centerX + halfW},${y}`);
    }

    return `M ${leftPoints.join(" L ")} L ${rightPoints.join(" L ")} Z`;
  }, []);

  if (tower.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-lg">Введите слово, чтобы начать строить башню</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-0 py-8 select-none">
      {/* SVG silhouette behind words */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 500 700"
        preserveAspectRatio="xMidYMid meet"
        style={{ top: '32px' }}
      >
        <path
          d={silhouettePath}
          fill="none"
          stroke="hsl(35 80% 50% / 0.12)"
          strokeWidth="1.5"
        />
        {/* Faint inner glow line */}
        <path
          d={silhouettePath}
          fill="hsl(35 80% 50% / 0.03)"
          stroke="none"
        />
      </svg>

      {/* Words */}
      <div className="relative z-10 flex flex-col items-center gap-0">
        {tower.map((row, ri) => (
          <div
            key={ri}
            className="flex items-baseline justify-center flex-nowrap"
            style={{ gap: "3px", lineHeight: 1.15 }}
          >
            {row.words.map((w, wi) => (
              <span
                key={`${w.word}-${wi}`}
                className="whitespace-nowrap leading-tight"
                style={{
                  fontSize: `${w.fontSize}px`,
                  color: `hsl(${30 + w.ratio * 15}, ${80 + w.ratio * 15}%, ${42 + w.ratio * 33}%)`,
                  textShadow: w.ratio > 0.4
                    ? `0 0 ${w.ratio * 15}px hsl(35 95% 55% / 0.4)`
                    : "none",
                  fontWeight: w.ratio > 0.6 ? 900 : w.ratio > 0.3 ? 700 : 600,
                  opacity: w.isUser ? 1 : 0.7,
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
