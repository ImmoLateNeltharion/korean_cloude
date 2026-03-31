import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function SnapshotPanel() {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const url = `${window.location.origin}/?snapshot=png`;
      const win = window.open(url, "_blank", "noopener,noreferrer,width=1400,height=900");
      if (!win) throw new Error("Popup blocked");
      toast.success("Снимок облака готовится в новом окне");
    } catch {
      toast.error("Не удалось скачать PNG");
    } finally {
      setTimeout(() => setIsDownloading(false), 400);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Экспорт PNG</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleDownload} disabled={isDownloading}>
          <Download className="h-4 w-4 mr-2" />
          {isDownloading ? "Подготовка..." : "Скачать PNG текущей сцены"}
        </Button>
      </CardContent>
    </Card>
  );
}
