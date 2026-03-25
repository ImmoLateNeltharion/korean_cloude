import { useState } from 'react';
import html2canvas from 'html2canvas';

export function DownloadButtons() {
  const [loading, setLoading] = useState<'png' | null>(null);

  const downloadPNG = async () => {
    setLoading('png');
    // Force all CSS animations to their end state so all words are visible
    const style = document.createElement('style');
    style.textContent = '* { animation-duration: 0.001s !important; animation-delay: 0s !important; transition-duration: 0s !important; }';
    document.head.appendChild(style);
    await new Promise(r => setTimeout(r, 150));
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: 2,
        logging: false,
        backgroundColor: '#0a0a0a',
      });
      const link = document.createElement('a');
      link.download = `word-tower-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      style.remove();
      setLoading(null);
    }
  };

  const btn: React.CSSProperties = {
    background: 'rgba(5,5,10,0.65)',
    border: '1px solid rgba(220,24,48,0.45)',
    color: 'rgba(220,24,48,0.88)',
    borderRadius: '6px',
    padding: '5px 11px',
    fontSize: '12px',
    fontFamily: 'sans-serif',
    cursor: loading ? 'wait' : 'pointer',
    backdropFilter: 'blur(6px)',
    letterSpacing: '0.03em',
    transition: 'opacity 0.2s',
    opacity: loading ? 0.5 : 1,
  };

  return (
    <div
      className="absolute z-30 bottom-3 left-3 flex gap-2"
      style={{ pointerEvents: 'auto' }}
    >
      <button onClick={downloadPNG} disabled={!!loading} style={btn} title="Скачать изображение">
        {loading === 'png' ? '…' : '↓ PNG'}
      </button>
    </div>
  );
}
