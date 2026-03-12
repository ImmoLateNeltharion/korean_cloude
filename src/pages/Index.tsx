import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import WordTower from "@/components/WordTower";
import { useStopWords } from "@/contexts/StopWordsContext";
import { getAllStopWords } from "@/lib/stop-words";
import { downloadPNG, downloadHTML } from "@/lib/download-snapshot";
import { DownloadButtons } from "@/components/DownloadButtons";
import { QRWithLogo } from "@/components/QRWithLogo";

const QR_KEY = 'wordtower-qr-url';
const QR_FALLBACK = 'https://t.me/YourBotUsername';

const Index = () => {
  document.title = "test";
  const { stopWords } = useStopWords();

  // QR size = space between tower edge and screen edge (tower is centered)
  // towerWidth = min(W*0.85, H*0.68), available right gap = (W - towerWidth) / 2
  const mainRef = useRef<HTMLDivElement>(null);
  const [qrSize, setQrSize] = useState(160);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const compute = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      const towerW = Math.min(W * 0.85, H * 0.68);
      const available = Math.floor((W - towerW) / 2) - 12;
      setQrSize(Math.max(120, available));
    };
    compute();
    const obs = new ResizeObserver(compute);
    obs.observe(el);
    return () => obs.disconnect();
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

      {/* QR code — top right, dynamic */}
      <div className="absolute z-20 top-4 right-4 pointer-events-none">
        <QRWithLogo url={qrUrl} size={qrSize} />
      </div>

      {/* Tower fills the remaining screen */}
      <div className="relative z-10 flex-1 min-h-0 w-full">
        <WordTower words={filteredWords} />
      </div>

      {/* Download buttons — bottom left overlay */}
      <DownloadButtons />
    </div>
  );
};

export default Index;
