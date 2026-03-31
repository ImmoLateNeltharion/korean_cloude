import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import WordTower from "@/components/WordTower";
import { useStopWords } from "@/contexts/StopWordsContext";
import { getAllStopWords } from "@/lib/stop-words";
import { downloadPNG, downloadHTML } from "@/lib/download-snapshot";

const Index = () => {
  document.title = "test";
  const { stopWords } = useStopWords();
  const mainRef = useRef<HTMLDivElement>(null);
  const [logoSize, setLogoSize] = useState(190);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const compute = () => {
      const side = Math.min(el.clientWidth, el.clientHeight);
      setLogoSize(Math.max(140, Math.min(260, Math.round(side * 0.19))));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-download snapshot when opened with ?snapshot=png|html
  const snapshotDone = useRef(false);
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('snapshot');
    if (!param || snapshotDone.current) return;
    snapshotDone.current = true;
    const timer = setTimeout(async () => {
      try {
        if (param === 'png') await downloadPNG();
        else if (param === 'html') await downloadHTML();
      } finally {
        window.close();
      }
    }, 2500); // wait for tower to paint
    return () => clearTimeout(timer);
  }, []);

  // Poll approved words from the server every 5 seconds
  const { data: approvedWords = {} } = useQuery<Record<string, number>>({
    queryKey: ["approved-words"],
    queryFn: () => fetch("/api/words/approved").then((r) => r.json()),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    retry: 1,
    retryDelay: 2000,
  });

  // Filter out stop words (built-in defaults + user-configured)
  const filteredWords = useMemo(() => {
    const blocked = getAllStopWords(stopWords);
    const map: Record<string, number> = {};
    for (const [w, c] of Object.entries(approvedWords)) {
      if (!blocked.has(w.toLowerCase())) map[w] = c;
    }
    return map;
  }, [approvedWords, stopWords]);

  return (
    <div
      ref={mainRef}
      className="h-screen relative flex flex-col overflow-hidden"
      style={{
        height: '100dvh',
        backgroundColor: '#0b1220',
      }}
    >
      {/* Radial glow behind heart */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 56% 60% at 50% 48%, rgba(70,138,214,0.24) 0%, rgba(30,54,92,0.12) 42%, transparent 74%)' }}
      />

      {/* Tower fills the remaining screen */}
      <div className="relative z-10 flex-1 min-h-0 w-full">
        <WordTower words={filteredWords} qrSize={0} centerLogoSize={logoSize} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <img
          src="/vatech-logo.png"
          alt="Vatech"
          style={{
            width: `${logoSize * 2}px`,
            maxWidth: "40vw",
            height: "auto",
            filter: "grayscale(1) saturate(0) brightness(1.85) contrast(1.34) drop-shadow(0 0 3px rgba(240,244,250,0.45)) drop-shadow(0 0 10px rgba(176,206,240,0.20))",
            opacity: 1,
          }}
        />
      </div>
    </div>
  );
};

export default Index;
