import { FormEvent, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Inbox, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PendingWord {
  id: number;
  word: string;
  count: number;
  telegram_username: string | null;
  telegram_user_id: string | null;
  created_at: string;
}

export function ModerationPanel() {
  const queryClient = useQueryClient();
  const [manualWord, setManualWord] = useState("");
  const [manualCount, setManualCount] = useState("1");

  // ─── Pending words ────────────────────────────────────
  const { data: words = [], isLoading, error } = useQuery<PendingWord[]>({
    queryKey: ["pending-words"],
    queryFn: () => fetch("/api/words/pending").then((r) => {
      if (r.status === 401) throw new Error("Unauthorized");
      return r.json();
    }),
    refetchInterval: 5000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/words/${id}/approve`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Approve failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-words"] });
      queryClient.invalidateQueries({ queryKey: ["approved-words"] });
      toast.success("Слово одобрено");
    },
    onError: () => toast.error("Ошибка при одобрении"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/words/${id}/reject`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Reject failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-words"] });
      toast.success("Слово отклонено");
    },
    onError: () => toast.error("Ошибка при отклонении"),
  });

  // ─── Approved words ───────────────────────────────────
  const { data: approvedMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["approved-words"],
    queryFn: () => fetch("/api/words/approved").then((r) => r.json()),
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: (word: string) =>
      fetch(`/api/words/approved/${encodeURIComponent(word)}`, { method: "DELETE" }).then((r) => {
        if (!r.ok && r.status !== 404) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approved-words"] });
      toast.success("Слово удалено");
    },
    onError: () => toast.error("Ошибка при удалении"),
  });

  const manualAddMutation = useMutation({
    mutationFn: ({ word, count }: { word: string; count: number }) =>
      fetch("/api/words/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, count }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || "Add failed");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approved-words"] });
      setManualWord("");
      setManualCount("1");
      toast.success("Слово добавлено");
    },
    onError: (err: Error) => toast.error(err.message || "Ошибка при добавлении"),
  });

  const addThreeMutation = useMutation({
    mutationFn: () =>
      fetch("/api/words/manual/add-three", {
        method: "POST",
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || "Add three failed");
        }
        return r.json() as Promise<{
          dictionarySize: number;
          added: Array<{ word: string }>;
          remainingUnseen: number;
        }>;
      }),
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["approved-words"] });
      const words = payload.added.map((item) => item.word).join(", ");
      toast.success(`Добавлено 3 слова: ${words}`);
    },
    onError: (err: Error) => toast.error(err.message || "Ошибка при добавлении слов"),
  });

  // Active words on the tower (only real approved words from DB)
  const towerList = useMemo(() => {
    return Object.entries(approvedMap).sort((a, b) => b[1] - a[1]);
  }, [approvedMap]);

  // ─── Render ───────────────────────────────────────────
  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const word = manualWord.trim();
    const count = Math.max(1, Number(manualCount) || 1);
    if (!word) {
      toast.error("Введите слово");
      return;
    }
    manualAddMutation.mutate({ word, count });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Загрузка…</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-destructive">
          Ошибка загрузки. Убедитесь, что сервер запущен.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Добавить слово вручную</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-muted-foreground">Слово</label>
              <input
                value={manualWord}
                onChange={(e) => setManualWord(e.target.value)}
                placeholder="Введите слово"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="sm:w-32">
              <label className="mb-1 block text-sm text-muted-foreground">Частота</label>
              <input
                type="number"
                min={1}
                value={manualCount}
                onChange={(e) => setManualCount(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" disabled={manualAddMutation.isPending}>
              {manualAddMutation.isPending ? "Добавление..." : "Добавить"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={addThreeMutation.isPending}
              onClick={() => addThreeMutation.mutate()}
            >
              {addThreeMutation.isPending ? "Подбор..." : "+3 из словаря Vatech"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending words */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            На модерации
            <Badge variant="secondary">{words.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {words.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2" />
              <p className="text-sm">Нет слов на модерации</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Слово</TableHead>
                  <TableHead className="text-center">Голоса</TableHead>
                  <TableHead>Отправитель</TableHead>
                  <TableHead>Время</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {words.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium text-base">{w.word}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{w.count}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {w.telegram_username ? `@${w.telegram_username}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatTime(w.created_at)}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => approveMutation.mutate(w.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMutation.mutate(w.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* All tower words */}
      {towerList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Активные
              <Badge variant="secondary">{towerList.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Слово</TableHead>
                  <TableHead className="text-center">Частота</TableHead>
                  <TableHead className="text-right">Удалить</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {towerList.map(([word, count]) => (
                  <TableRow key={word}>
                    <TableCell className="font-medium">{word}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(word)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso + "Z"); // SQLite datetime is UTC
    return d.toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
