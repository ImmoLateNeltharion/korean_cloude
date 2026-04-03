import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Sparkles } from 'lucide-react';

const QR_KEY = 'wordtower-qr-url';
const QR_FALLBACK = 'https://t.me/YourBotUsername';
const HEART_GLOW_KEY = "wordtower-heart-glow";

export function SettingsPanel() {
  const [url, setUrl] = useState(() => localStorage.getItem(QR_KEY) || QR_FALLBACK);
  const [saved, setSaved] = useState(false);
  const [heartGlowEnabled, setHeartGlowEnabled] = useState(() => {
    const v = localStorage.getItem(HEART_GLOW_KEY);
    return v === null ? true : v === "1";
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== HEART_GLOW_KEY) return;
      const v = localStorage.getItem(HEART_GLOW_KEY);
      setHeartGlowEnabled(v === null ? true : v === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = () => {
    localStorage.setItem(QR_KEY, url);
    // Notify other tabs (main page will update its QR live)
    window.dispatchEvent(new StorageEvent('storage', {
      key: QR_KEY,
      newValue: url,
      storageArea: localStorage,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const qrPreview = url.trim() || QR_FALLBACK;

  return (
    <div className="space-y-4">
      {/* QR settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR-код
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 items-start flex-wrap">
            <div className="flex-1 min-w-[220px] space-y-3">
              <div className="space-y-1">
                <Label htmlFor="qr-url">URL (ссылка или текст)</Label>
                <Input
                  id="qr-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://t.me/..."
                />
              </div>
              <Button onClick={save} variant={saved ? 'default' : 'outline'} className="w-full sm:w-auto">
                {saved ? '✓ Сохранено' : 'Сохранить'}
              </Button>
              <p className="text-xs text-muted-foreground">
                QR на главной странице обновится автоматически при смене URL.
              </p>
              <div className="pt-2">
                <Label className="mb-2 block">Свечение контура</Label>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const next = !heartGlowEnabled;
                    setHeartGlowEnabled(next);
                    localStorage.setItem(HEART_GLOW_KEY, next ? "1" : "0");
                    window.dispatchEvent(new StorageEvent("storage", {
                      key: HEART_GLOW_KEY,
                      newValue: next ? "1" : "0",
                      storageArea: localStorage,
                    }));
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Свечение: {heartGlowEnabled ? "Вкл" : "Выкл"}
                </Button>
              </div>
            </div>
            <div className="shrink-0">
              <div className="p-3 bg-white rounded-lg shadow-sm inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrPreview)}&size=300x300&margin=6`}
                  width={150}
                  height={150}
                  alt="QR preview"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">Предпросмотр</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
