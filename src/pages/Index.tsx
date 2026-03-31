import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import WordTower from "@/components/WordTower";
import { useStopWords } from "@/contexts/StopWordsContext";
import { getAllStopWords } from "@/lib/stop-words";
import { downloadPNG, downloadHTML } from "@/lib/download-snapshot";
import { QRWithLogo } from "@/components/QRWithLogo";

const QR_FALLBACK = 'https://t.me/YourBotUsername';

const Index = () => {
  document.title = "test";
  const { stopWords } = useStopWords();
  const mainRef = useRef<HTMLDivElement>(null);
  const [logoSize, setLogoSize] = useState(190);
  const [qrSize, setQrSize] = useState(160);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const compute = () => {
      const width = el.clientWidth;
      const side = Math.min(width, el.clientHeight);
      const isMobile = width < 768;
      setLogoSize(Math.max(140, Math.min(260, Math.round(side * 0.19))));
      setQrSize(
        isMobile
          ? Math.max(84, Math.min(128, Math.round(side * 0.16)))
          : Math.max(200, Math.min(360, Math.round(side * 0.3)))
      );
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { data: publicSettings } = useQuery<{ botLink: string }>({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public").then((r) => {
      if (!r.ok) throw new Error("Failed to load public settings");
      return r.json();
    }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

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
    queryFn: () => fetch("/api/words/approved", { cache: "no-store" }).then((r) => r.json()),
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
  const qrUrl = publicSettings?.botLink?.trim() || QR_FALLBACK;

  return (
    <div
      ref={mainRef}
      className="h-screen relative flex flex-col overflow-hidden"
      style={{
        height: '100dvh',
        backgroundColor: '#060608',
      }}
    >
      {/* Radial glow behind heart */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 54% 58% at 50% 48%, rgba(44,92,156,0.16) 0%, rgba(20,36,64,0.08) 38%, transparent 72%)' }}
      />

      {/* QR code — top right, dynamic */}
      <div className="absolute z-20 top-2 right-2 sm:top-4 sm:right-4 pointer-events-none">
        <QRWithLogo url={qrUrl} size={qrSize} />
      </div>

      {/* Tower fills the remaining screen */}
      <div className="relative z-10 flex-1 min-h-0 w-full">
        <WordTower words={filteredWords} qrSize={qrSize} centerLogoSize={logoSize} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <img
          src="/vatech-logo.png"
          alt="Vatech"
          style={{
            width: `${logoSize * 2}px`,
            maxWidth: "40vw",
            height: "auto",
            filter: "grayscale(1) saturate(0) brightness(1.25) contrast(1.08) drop-shadow(0 0 8px rgba(228,233,242,0.45)) drop-shadow(0 0 24px rgba(138,176,228,0.24))",
            opacity: 0.92,
          }}
        />
      </div>
    </div>
  );
};

export default Index;
