import { useMemo } from "react";

interface WordTowerProps {
  words: Record<string, number>;
}

const FILLER_WORDS = [
  "свет", "мир", "путь", "дар", "лад", "дух", "ритм", "шаг", "жар", "миг",
  "тон", "луч", "вид", "час", "дом", "сон", "ход", "зов", "рай", "бег",
  "жизнь", "вера", "воля", "тепло", "суть", "связь", "явь", "лик", "нрав",
  "след", "блик", "рост", "толк", "пыл", "взлёт", "клад", "край", "старт",
  "смысл", "честь", "труд", "плод", "весть", "блеск", "гимн", "знак", "круг",
  "ум", "да", "ок", "мы", "ты", "он", "я", "до", "по", "за",
  "огонь", "нота", "тень", "дождь", "ветер", "река", "заря", "пик", "код",
  "сад", "лес", "день", "ночь", "год", "век", "мост", "порт", "центр",
  "глаз", "рука", "лёд", "гром", "штиль", "нить", "стиль", "ключ",
  "роль", "факт", "темп", "план", "курс", "фон", "цвет", "форма", "точка",
  "идея", "опора", "база", "цена", "сеть", "связь", "корень", "поток", "грань",
  "мера", "доля", "суть", "взор", "пласт", "слой", "ярус", "скала", "стена",
];

const PLACEHOLDER_WORDS: Record<string, number> = {
  "люди": 22, "успех": 18, "команда": 17, "рост": 15, "доверие": 14,
  "будущее": 13, "опыт": 12, "развитие": 11, "инновации": 10, "победа": 9,
  "мечта": 8, "сила": 8, "радость": 7, "знания": 7, "энергия": 7,
  "дружба": 6, "вдохновение": 6, "гармония": 6, "свобода": 5, "любовь": 5,
  "счастье": 5, "надежда": 5, "мудрость": 4, "красота": 4, "добро": 4,
  "свет": 4, "тепло": 3, "улыбка": 3, "вера": 3, "честь": 3,
  "смелость": 3, "талант": 2, "цель": 2, "путь": 2, "звезда": 2,
  "солнце": 2, "мир": 2, "душа": 1, "искра": 1, "рассвет": 1,
};

// Tower silhouette profile: t=0 top, t=1 bottom. Returns half-width factor 0..1
function towerProfile(t: number): number {
  if (t < 0.12) {
    const s = t / 0.12;
    return 0.015 + s * s * 0.055;
  }
  if (t < 0.30) {
    const s = (t - 0.12) / 0.18;
    return 0.07 + s * 0.28;
  }
  if (t < 0.40) {
    const s = (t - 0.30) / 0.10;
    const bulge = Math.sin(s * Math.PI);
    return 0.35 + bulge * 0.08;
  }
  if (t < 0.52) {
    const s = (t - 0.40) / 0.12;
    return 0.35 - s * 0.10;
  }
  const s = (t - 0.52) / 0.48;
  return 0.25 + s * s * 0.75;
}

function measureWord(word: string, fontSize: number): number {
  return word.length * fontSize * 0.55 + 6;
}

type PlacedWord = {
  word: string;
  fontSize: number;
  ratio: number;
  isUser: boolean;
  isFiller: boolean;
  x: number; // center x position
};

type TowerRow = {
  placedWords: PlacedWord[];
  targetWidth: number;
  rowT: number;
  height: number;
};

const WordTower = ({ words }: WordTowerProps) => {
  const tower = useMemo(() => {
    const merged = { ...PLACEHOLDER_WORDS };
    for (const [w, c] of Object.entries(words)) {
      merged[w] = (merged[w] || 0) + c;
    }

    const entries = Object.entries(merged);
    if (entries.length === 0) return [];

    const maxCount = Math.max(...entries.map(([, c]) => c));
    const minCount = Math.min(...entries.map(([, c]) => c));

    type WordEntry = { word: string; count: number; fontSize: number; ratio: number; isUser: boolean };

    const allWords: WordEntry[] = entries.map(([word, count]) => {
      const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      const fontSize = 11 + ratio * 52;
      return { word, count, fontSize, ratio, isUser: word in words };
    });

    // Sort descending by count — big words first
    allWords.sort((a, b) => b.count - a.count);

    const containerWidth = 420;
    const numRows = 55;
    const rows: TowerRow[] = [];

    for (let r = 0; r < numRows; r++) {
      const t = r / (numRows - 1);
      const w = towerProfile(t) * containerWidth;
      rows.push({ placedWords: [], targetWidth: Math.max(20, w), rowT: t, height: 0 });
    }

    // Distribute words evenly: score by fill ratio (prefer least-filled rows)
    let zigzag = 0;
    const usedWidths = new Array(numRows).fill(0);

    for (const entry of allWords) {
      let bestRow = -1;
      let bestScore = -Infinity;

      for (let r = 0; r < numRows; r++) {
        const row = rows[r];
        const remaining = row.targetWidth - usedWidths[r];
        const maxFontForRow = remaining / (entry.word.length * 0.55 + 0.5);
        const clampedSize = Math.min(entry.fontSize, Math.max(7, maxFontForRow));
        const wordW = measureWord(entry.word, clampedSize);

        if (usedWidths[r] + wordW <= row.targetWidth + 4) {
          const fillRatio = usedWidths[r] / row.targetWidth; // 0 = empty, 1 = full
          const sizeRatio = clampedSize / entry.fontSize; // 1 = no clamping
          // Strongly prefer empty rows, also prefer rows where word fits at full size
          const score = sizeRatio * 50 + (1 - fillRatio) * 80;
          if (score > bestScore) {
            bestScore = score;
            bestRow = r;
          }
        }
      }

      if (bestRow === -1) {
        let maxRemaining = -1;
        for (let r = 0; r < numRows; r++) {
          const rem = rows[r].targetWidth - usedWidths[r];
          if (rem > maxRemaining) { maxRemaining = rem; bestRow = r; }
        }
      }

      const row = rows[bestRow];
      const maxFont = (row.targetWidth - usedWidths[bestRow]) / (entry.word.length * 0.55 + 0.5);
      const fontSize = Math.max(7, Math.min(entry.fontSize, maxFont));
      const wordW = measureWord(entry.word, fontSize);

      const availableOffset = (row.targetWidth - usedWidths[bestRow] - wordW) / 2;
      const offset = availableOffset > 4 ? (zigzag % 2 === 0 ? -1 : 1) * Math.min(availableOffset * 0.3, 12) : 0;

      row.placedWords.push({
        word: entry.word,
        fontSize,
        ratio: entry.ratio,
        isUser: entry.isUser,
        isFiller: false,
        x: offset,
      });
      usedWidths[bestRow] += wordW;
      row.height = Math.max(row.height, fontSize * 1.15);
      zigzag++;
    }

    // Fill remaining space with filler words
    let fillerIdx = 0;
    for (let r = 0; r < numRows; r++) {
      const row = rows[r];
      let used = usedWidths[r];
      let attempts = 0;

      while (used < row.targetWidth - 4 && attempts < 50) {
        const filler = FILLER_WORDS[fillerIdx % FILLER_WORDS.length];
        fillerIdx++;
        const fillerSize = 7 + Math.random() * 4;
        const fw = measureWord(filler, fillerSize);

        if (used + fw <= row.targetWidth + 2) {
          // Place filler on whichever side has more space
          row.placedWords.push({
            word: filler,
            fontSize: fillerSize,
            ratio: 0,
            isUser: false,
            isFiller: true,
            x: 0,
          });
          used += fw;
          if (row.height === 0) row.height = fillerSize * 1.2;
        }
        attempts++;
      }
      usedWidths[r] = used;
    }

    // Also fill empty rows with only fillers
    for (let r = 0; r < numRows; r++) {
      const row = rows[r];
      if (row.placedWords.length === 0 && row.targetWidth > 15) {
        let used = 0;
        let attempts = 0;
        while (used < row.targetWidth - 4 && attempts < 40) {
          const filler = FILLER_WORDS[fillerIdx % FILLER_WORDS.length];
          fillerIdx++;
          const fillerSize = 7 + Math.random() * 3;
          const fw = measureWord(filler, fillerSize);
          if (used + fw <= row.targetWidth + 2) {
            row.placedWords.push({
              word: filler, fontSize: fillerSize, ratio: 0,
              isUser: false, isFiller: true, x: 0,
            });
            used += fw;
            row.height = Math.max(row.height, fillerSize * 1.2);
          }
          attempts++;
        }
      }
    }

    return rows.filter(r => r.placedWords.length > 0);
  }, [words]);

  // SVG silhouette for glow
  const silhouettePath = useMemo(() => {
    const h = 700, cx = 250, hw = 250, steps = 80;
    const left: string[] = [], right: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = t * h;
      const w = towerProfile(t) * hw;
      left.push(`${cx - w},${y}`);
      right.unshift(`${cx + w},${y}`);
    }
    return `M ${left.join(" L ")} L ${right.join(" L ")} Z`;
  }, []);

  if (tower.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-lg">Введите слово, чтобы начать строить башню</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center py-8 select-none">
      {/* Blurred glow silhouette */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 500 700"
        preserveAspectRatio="xMidYMid meet"
        style={{ top: '32px', opacity: 0.25, filter: 'blur(25px)' }}
      >
        <path d={silhouettePath} fill="hsl(35 70% 40%)" stroke="none" />
      </svg>

      {/* Word rows */}
      <div className="relative z-10 flex flex-col items-center" style={{ gap: '0px' }}>
        {tower.map((row, ri) => (
          <div
            key={ri}
            className="flex items-baseline justify-center flex-wrap"
            style={{
              gap: "3px",
              lineHeight: 1.05,
              width: `${row.targetWidth}px`,
              minHeight: `${row.height}px`,
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
                    : `hsl(${32 + w.ratio * 12}, ${75 + w.ratio * 20}%, ${45 + w.ratio * 30}%)`,
                  textShadow: !w.isFiller && w.ratio > 0.4
                    ? `0 0 ${w.ratio * 15}px hsl(35 90% 55% / 0.35)`
                    : "none",
                  fontWeight: w.isFiller ? 400 : (w.ratio > 0.6 ? 900 : w.ratio > 0.3 ? 700 : 600),
                  opacity: w.isFiller ? 0.4 : (w.isUser ? 1 : 0.8),
                  lineHeight: 1.0,
                  marginLeft: !w.isFiller && w.x ? `${w.x}px` : undefined,
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
