import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useStopWords } from "@/contexts/StopWordsContext";
import { X } from "lucide-react";

export function StopWordsManager() {
  const { stopWords, addStopWord, removeStopWord, setStopWords } = useStopWords();
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const words = input.split(",").map(w => w.trim().toLowerCase()).filter(Boolean);
    words.forEach(addStopWord);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Стоп-слова</CardTitle>
        <CardDescription>
          Слова из этого списка не будут отображаться на странице.
          {stopWords.length > 0 && ` Активных фильтров: ${stopWords.length}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Добавить стоп-слова (через запятую)</Label>
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="слово1, слово2, слово3..."
            rows={3}
          />
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={!input.trim()}>
              Добавить
            </Button>
            {stopWords.length > 0 && (
              <Button variant="destructive" onClick={() => setStopWords([])}>
                Очистить все
              </Button>
            )}
          </div>
        </div>

        {stopWords.length > 0 && (
          <div className="space-y-2">
            <Label>Активные стоп-слова:</Label>
            <div className="flex flex-wrap gap-2">
              {stopWords.map(word => (
                <Badge
                  key={word}
                  variant="secondary"
                  className="gap-1 text-sm py-1 px-3 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  onClick={() => removeStopWord(word)}
                >
                  {word}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {stopWords.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Нет активных стоп-слов. Все слова отображаются на странице.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
