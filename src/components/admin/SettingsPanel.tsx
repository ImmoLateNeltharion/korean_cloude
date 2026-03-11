import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, QrCode } from 'lucide-react';

const QR_KEY = 'wordtower-qr-url';
const QR_FALLBACK = 'https://t.me/YourBotUsername';

export function SettingsPanel() {
  const [url, setUrl] = useState(() => localStorage.getItem(QR_KEY) || QR_FALLBACK);
  const [saved, setSaved] = useState(false);

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

  const openSnapshot = (type: 'png' | 'html') => {
    window.open(`/?snapshot=${type}`, '_blank', 'width=1440,height=900,menubar=no,toolbar=no');
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
            </div>
            <div className="shrink-0">
              <div className="p-3 bg-white rounded-lg shadow-sm inline-block">
                <QRCodeSVG
                  value={qrPreview}
                  size={150}
                  bgColor="white"
                  fgColor="#0a0a0a"
                  level="M"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">Предпросмотр</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export snapshots */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Экспорт башни
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Открывает главную страницу в новом окне, дожидается отрисовки башни и скачивает снапшот.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => openSnapshot('png')}>
              <Download className="h-4 w-4 mr-2" />
              Скачать PNG
            </Button>
            <Button variant="outline" onClick={() => openSnapshot('html')}>
              <Download className="h-4 w-4 mr-2" />
              Скачать HTML
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
