import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PLACEHOLDER_WORDS } from "@/lib/words";
import { useStopWords } from "@/contexts/StopWordsContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export function WordStats() {
  const { stopWords } = useStopWords();

  // Include approved words from server
  const { data: approvedWords = {} } = useQuery<Record<string, number>>({
    queryKey: ["approved-words"],
    queryFn: () => fetch("/api/words/approved").then((r) => r.json()),
    refetchInterval: 5000,
    retry: 1,
  });

  const stats = useMemo(() => {
    const merged = { ...PLACEHOLDER_WORDS };
    for (const [w, c] of Object.entries(approvedWords)) {
      merged[w] = (merged[w] || 0) + c;
    }
    const all = Object.entries(merged);
    const active = all.filter(([word]) => !stopWords.includes(word.toLowerCase()));
    const sorted = [...active].sort((a, b) => b[1] - a[1]);
    const counts = sorted.map(([, c]) => c);
    const totalFreq = counts.reduce((s, c) => s + c, 0);
    const avg = counts.length ? totalFreq / counts.length : 0;
    const sortedCounts = [...counts].sort((a, b) => a - b);
    const median = sortedCounts.length
      ? sortedCounts[Math.floor(sortedCounts.length / 2)]
      : 0;

    const buckets = [
      { range: "1", min: 1, max: 1, count: 0 },
      { range: "2-3", min: 2, max: 3, count: 0 },
      { range: "4-6", min: 4, max: 6, count: 0 },
      { range: "7-10", min: 7, max: 10, count: 0 },
      { range: "11-15", min: 11, max: 15, count: 0 },
      { range: "16+", min: 16, max: Infinity, count: 0 },
    ];
    for (const c of counts) {
      const bucket = buckets.find(b => c >= b.min && c <= b.max);
      if (bucket) bucket.count++;
    }

    return {
      totalWords: all.length,
      activeWords: active.length,
      filteredOut: all.length - active.length,
      totalFreq,
      avg: avg.toFixed(1),
      median,
      maxFreq: counts[0] || 0,
      top15: sorted.slice(0, 15),
      distribution: buckets,
    };
  }, [stopWords, approvedWords]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.activeWords}</div>
            <p className="text-xs text-muted-foreground">Активных слов</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalFreq}</div>
            <p className="text-xs text-muted-foreground">Суммарная частота</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.avg}</div>
            <p className="text-xs text-muted-foreground">Средняя частота</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold flex items-center gap-2">
              {stats.filteredOut}
              {stats.filteredOut > 0 && (
                <Badge variant="destructive" className="text-xs">filtered</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Отфильтровано</p>
          </CardContent>
        </Card>
      </div>

      {/* Frequency distribution chart */}
      <Card>
        <CardHeader>
          <CardTitle>Распределение частот</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.distribution}>
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                labelStyle={{ color: "#ccc" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {stats.distribution.map((_, i) => (
                  <Cell key={i} fill={`hsl(${30 + i * 5}, 85%, ${55 + i * 3}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top words table */}
      <Card>
        <CardHeader>
          <CardTitle>Топ-15 слов</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Слово</TableHead>
                <TableHead className="text-right">Частота</TableHead>
                <TableHead className="text-right">Доля</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.top15.map(([word, count], i) => (
                <TableRow key={word}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{word}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{count}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {((count / stats.totalFreq) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
