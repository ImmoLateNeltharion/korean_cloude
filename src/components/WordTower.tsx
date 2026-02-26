import { useMemo } from "react";

interface WordTowerProps {
  words: Record<string, number>;
}

const WordTower = ({ words }: WordTowerProps) => {
  const tower = useMemo(() => {
    const entries = Object.entries(words);
    if (entries.length === 0) return [];

    const maxCount = Math.max(...entries.map(([, c]) => c));
    const minCount = Math.min(...entries.map(([, c]) => c));

    // Map each word to a size (font size in px)
    const sized = entries.map(([word, count]) => {
      const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      const fontSize = 14 + ratio * 48; // 14px to 62px
      return { word, count, fontSize, ratio };
    });

    // Sort: largest words in the middle/bottom, smallest at top
    sized.sort((a, b) => a.fontSize - b.fontSize);

    // Build rows that fit within a tower silhouette
    // Tower: narrow at top, wide at bottom
    const totalRows = Math.max(8, Math.ceil(sized.length / 3));
    const rows: { words: typeof sized; maxWidth: number; rowIndex: number }[] = [];

    // Create tower width profile
    for (let i = 0; i < totalRows; i++) {
      const t = i / (totalRows - 1 || 1); // 0 = top, 1 = bottom
      // Tower shape: narrow top, wide bottom with a spire
      const width = 80 + t * 600; // px width budget
      rows.push({ words: [], maxWidth: width, rowIndex: i });
    }

    // Place words into rows, smallest first (top rows)
    let wordIndex = 0;
    for (let r = 0; r < rows.length && wordIndex < sized.length; r++) {
      let usedWidth = 0;
      while (wordIndex < sized.length) {
        const w = sized[wordIndex];
        const estimatedWidth = w.word.length * w.fontSize * 0.6 + 12;
        if (usedWidth + estimatedWidth <= rows[r].maxWidth || rows[r].words.length === 0) {
          rows[r].words.push(w);
          usedWidth += estimatedWidth;
          wordIndex++;
        } else {
          break;
        }
      }
    }

    // Put remaining words in last row
    while (wordIndex < sized.length) {
      rows[rows.length - 1].words.push(sized[wordIndex]);
      wordIndex++;
    }

    return rows.filter(r => r.words.length > 0);
  }, [words]);

  if (tower.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-lg">Введите слово, чтобы начать строить башню</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5 py-8 select-none">
      {tower.map((row, ri) => (
        <div key={ri} className="flex items-baseline justify-center gap-1 flex-nowrap">
          {row.words.map((w, wi) => (
            <span
              key={`${w.word}-${wi}`}
              className="whitespace-nowrap font-bold leading-none transition-all duration-300"
              style={{
                fontSize: `${w.fontSize}px`,
                color: `hsl(${30 + w.ratio * 15}, ${80 + w.ratio * 15}%, ${50 + w.ratio * 25}%)`,
                textShadow: w.ratio > 0.5 ? `0 0 ${w.ratio * 20}px hsl(var(--tower-glow) / 0.3)` : 'none',
                fontWeight: w.ratio > 0.6 ? 900 : w.ratio > 0.3 ? 700 : 600,
              }}
            >
              {w.word}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

export default WordTower;
