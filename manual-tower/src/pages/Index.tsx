import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import WordTower from "@/components/WordTower";
import { useStopWords } from "@/contexts/StopWordsContext";
import { getAllStopWords } from "@/lib/stop-words";
import { downloadPNG, downloadHTML } from "@/lib/download-snapshot";

const BRAND_SWITCH_MS = 10_000;
const HEART_GLOW_KEY = "wordtower-heart-glow";

const Index = () => {
  document.title = "test";
  const { stopWords } = useStopWords();
  const mainRef = useRef<HTMLDivElement>(null);
  const [logoSize, setLogoSize] = useState(190);
  const [showSlogan, setShowSlogan] = useState(false);
  const [heartGlowEnabled, setHeartGlowEnabled] = useState(true);

  useEffect(() => {
    const readGlow = () => {
      const v = localStorage.getItem(HEART_GLOW_KEY);
      setHeartGlowEnabled(v === null ? true : v === "1");
    };
    readGlow();
    const onStorage = (e: StorageEvent) => {
      if (e.key === HEART_GLOW_KEY) readGlow();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setShowSlogan((prev) => !prev);
    }, BRAND_SWITCH_MS);
    return () => window.clearInterval(id);
  }, []);

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
    const autoClose = new URLSearchParams(window.location.search).get("autoclose") === "1";
    const timer = setTimeout(async () => {
      try {
        if (param === 'png') await downloadPNG();
        else if (param === 'html') await downloadHTML();
      } finally {
        if (autoClose) setTimeout(() => window.close(), 2200);
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
        <WordTower
          words={filteredWords}
          qrSize={0}
          centerLogoSize={logoSize}
          heartGlowEnabled={heartGlowEnabled}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <div
          className="heart-core-pulse"
          style={{
            width: `${logoSize * 2.6}px`,
            height: `${logoSize * 1.95}px`,
            transform: "translateY(-26%)",
          }}
        />

        <div
          style={{
            position: "relative",
            width: `${showSlogan ? logoSize * 2.75 : logoSize * 2}px`,
            maxWidth: showSlogan ? "56vw" : "40vw",
            transform: "translateY(-30%)",
            animation: "brandFadePulse 5.2s ease-in-out infinite",
          }}
        >
          <img
            src="/vatech-logo.png"
            alt="Vatech"
            style={{
              width: "100%",
              height: "auto",
              filter: "brightness(0) invert(1) contrast(1.34) drop-shadow(0 0 12px rgba(255,255,255,0.26))",
              opacity: showSlogan ? 0 : 1,
              transition: "opacity 900ms ease",
              display: "block",
              mixBlendMode: "normal",
            }}
          />
          <img
            src="/vatech-slogan-neon.png"
            alt="Всегда на Вашей стороне"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: showSlogan ? 1 : 0,
              transition: "opacity 900ms ease",
              filter: "brightness(0) invert(1) contrast(1.08)",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
