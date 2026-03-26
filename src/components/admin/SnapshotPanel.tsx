import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadPNG } from "@/lib/download-snapshot";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function SnapshotPanel() {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadPNG();
      toast.success("PNG скачан");
    } catch {
      toast.error("Не удалось скачать PNG");
    } finally {
      setIsDownloading(false);
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
