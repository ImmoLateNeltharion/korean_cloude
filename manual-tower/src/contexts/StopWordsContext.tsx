import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { loadStopWords, saveStopWords } from "@/lib/stop-words";

interface StopWordsContextType {
  stopWords: string[];
  addStopWord: (word: string) => void;
  removeStopWord: (word: string) => void;
  setStopWords: (words: string[]) => void;
}

const StopWordsContext = createContext<StopWordsContextType | null>(null);

export function StopWordsProvider({ children }: { children: ReactNode }) {
  const [stopWords, setStopWordsState] = useState<string[]>(loadStopWords);

  const setStopWords = useCallback((words: string[]) => {
    const unique = [...new Set(words.map(w => w.trim().toLowerCase()).filter(Boolean))];
    setStopWordsState(unique);
    saveStopWords(unique);
  }, []);

  const addStopWord = useCallback((word: string) => {
    setStopWordsState(prev => {
      const normalized = word.trim().toLowerCase();
      if (!normalized || prev.includes(normalized)) return prev;
      const next = [...prev, normalized];
      saveStopWords(next);
      return next;
    });
  }, []);

  const removeStopWord = useCallback((word: string) => {
    setStopWordsState(prev => {
      const next = prev.filter(w => w !== word);
      saveStopWords(next);
      return next;
    });
  }, []);

  return (
    <StopWordsContext.Provider value={{ stopWords, addStopWord, removeStopWord, setStopWords }}>
      {children}
    </StopWordsContext.Provider>
  );
}

export function useStopWords() {
  const ctx = useContext(StopWordsContext);
  if (!ctx) throw new Error("useStopWords must be within StopWordsProvider");
  return ctx;
}
