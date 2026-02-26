import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import WordTower from "@/components/WordTower";

const Index = () => {
  const [words, setWords] = useState<Record<string, number>>({});
  const [input, setInput] = useState("");

  const addWord = useCallback(() => {
    const w = input.trim().toLowerCase();
    if (!w) return;
    setWords(prev => ({ ...prev, [w]: (prev[w] || 0) + 1 }));
    setInput("");
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addWord();
  };

  const totalWords = Object.values(words).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen flex flex-col items-center bg-background">
      {/* Header */}
      <header className="w-full text-center pt-12 pb-6 px-4">
        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
          Башня Слов
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Введите слово — и оно станет частью башни
        </p>
      </header>

      {/* Input */}
      <div className="flex gap-2 w-full max-w-md px-4 mb-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите слово..."
          className="bg-card border-border text-foreground placeholder:text-muted-foreground text-lg h-12"
        />
        <Button onClick={addWord} className="h-12 px-6 font-bold text-base">
          Добавить
        </Button>
      </div>

      {totalWords > 0 && (
        <p className="text-muted-foreground text-xs mb-4">
          {totalWords} {totalWords === 1 ? "слово" : "слов"} · {Object.keys(words).length} уникальных
        </p>
      )}

      {/* Tower */}
      <div className="w-full max-w-3xl px-4 flex-1">
        <WordTower words={words} />
      </div>
    </div>
  );
};

export default Index;
