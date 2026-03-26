import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import WordTower from "@/components/WordTower";
import { useStopWords } from "@/contexts/StopWordsContext";
import { getAllStopWords } from "@/lib/stop-words";
import { downloadPNG, downloadHTML } from "@/lib/download-snapshot";
import { QRWithLogo } from "@/components/QRWithLogo";

const QR_KEY = 'wordtower-qr-url';
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
      const side = Math.min(el.clientWidth, el.clientHeight);
      setLogoSize(Math.max(140, Math.min(260, Math.round(side * 0.19))));
      setQrSize(Math.max(200, Math.min(360, Math.round(side * 0.3))));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Dynamic QR URL from localStorage (syncs across tabs via storage event)
  const [qrUrl, setQrUrl] = useState(() =>
    localStorage.getItem(QR_KEY) || QR_FALLBACK
  );
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === QR_KEY) setQrUrl(e.newValue || QR_FALLBACK);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
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
        backgroundColor: '#060608',
      }}
    >
      {/* Radial glow behind heart */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 55% at 50% 48%, rgba(180,30,60,0.12) 0%, rgba(120,20,40,0.05) 40%, transparent 70%)' }}
      />

      {/* QR code — top right, dynamic */}
      <div className="absolute z-20 top-4 right-4 pointer-events-none">
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
            filter: "brightness(0) invert(1) drop-shadow(0 0 10px rgba(220,220,230,0.7)) drop-shadow(0 0 28px rgba(200,200,220,0.4))",
            opacity: 0.95,
          }}
        />
      </div>
    </div>
  );
};

export default Index;
