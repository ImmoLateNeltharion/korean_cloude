import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import WordTower from "@/components/WordTower";
import { useStopWords } from "@/contexts/StopWordsContext";
import { PLACEHOLDER_WORDS } from "@/lib/words";

const Index = () => {
  document.title = "test";
  const { stopWords } = useStopWords();

  // Poll approved words from the server every 5 seconds
  const { data: approvedWords = {} } = useQuery<Record<string, number>>({
    queryKey: ["approved-words"],
    queryFn: () => fetch("/api/words/approved").then((r) => r.json()),
    refetchInterval: 5000,
    retry: 1,
    retryDelay: 2000,
  });

  // Merge placeholder + approved words, then filter out stop words
  const filteredWords = useMemo(() => {
    const merged = { ...PLACEHOLDER_WORDS };
    for (const [w, c] of Object.entries(approvedWords)) {
      merged[w] = (merged[w] || 0) + c;
    }
    for (const sw of stopWords) {
      delete merged[sw];
    }
    return merged;
  }, [approvedWords, stopWords]);

  return (
    <div
      className="h-screen relative flex flex-col overflow-hidden"
      style={{
        height: '100dvh',
        backgroundImage: 'url(/seoul-night-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#0a0a0a',
      }}
    >
      {/* Dark overlay to keep text readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(5,5,10,0.82) 0%, rgba(5,5,10,0.65) 50%, rgba(5,5,10,0.45) 100%)' }}
      />

      {/* Tower fills the entire screen */}
      <div className="relative z-10 flex-1 min-h-0 w-full">
        <WordTower words={filteredWords} />
      </div>
    </div>
  );
};

export default Index;
