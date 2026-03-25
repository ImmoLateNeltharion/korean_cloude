import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Loader2, MessageCircle, Megaphone, Inbox, User } from "lucide-react";
import { toast } from "sonner";

interface TgUser {
  telegram_user_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
  message_count: number;
}

interface Message {
  id: number;
  telegram_user_id: string;
  direction: "incoming" | "outgoing";
  text: string;
  created_at: string;
}

function displayName(u: TgUser): string {
  if (u.username) return `@${u.username}`;
  if (u.first_name) return u.first_name + (u.last_name ? ` ${u.last_name}` : "");
  return u.telegram_user_id;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso + "Z");
    return d.toLocaleString("ru-RU", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function MessagingPanel() {
  const [selectedUser, setSelectedUser] = useState<TgUser | null>(null);
  const [broadcastText, setBroadcastText] = useState("");
  const [messageText, setMessageText] = useState("");
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Users list ───────────────────────────────────────
  const { data: users = [], isLoading: usersLoading } = useQuery<TgUser[]>({
    queryKey: ["messaging-users"],
    queryFn: () => fetch("/api/messages/users").then(r => {
      if (r.status === 401) throw new Error("Unauthorized");
      return r.json();
    }),
    refetchInterval: 10_000,
  });

  // ─── Conversation ─────────────────────────────────────
  const { data: rawMessages = [] } = useQuery<Message[]>({
    queryKey: ["messages", selectedUser?.telegram_user_id],
    queryFn: () => fetch(`/api/messages/${selectedUser!.telegram_user_id}`).then(r => r.json()),
    enabled: !!selectedUser,
    refetchInterval: 3_000,
  });

  const messages = useMemo(() => [...rawMessages].reverse(), [rawMessages]); // API returns DESC, we want ASC

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rawMessages.length]);

  // ─── Send to user ─────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (data: { userId: string; text: string }) =>
      fetch(`/api/messages/${data.userId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text }),
      }).then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.error); });
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedUser?.telegram_user_id] });
      setMessageText("");
      toast.success("Сообщение отправлено");
    },
    onError: (err: Error) => toast.error(err.message || "Ошибка отправки"),
  });

  // ─── Broadcast ────────────────────────────────────────
  const broadcastMutation = useMutation({
    mutationFn: (text: string) =>
      fetch("/api/messages/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.error); });
        return r.json();
      }),
    onSuccess: (data: { sent: number; failed: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ["messaging-users"] });
      setBroadcastText("");
      toast.success(`Отправлено: ${data.sent}/${data.total}${data.failed ? `, ошибок: ${data.failed}` : ""}`);
    },
    onError: (err: Error) => toast.error(err.message || "Ошибка рассылки"),
  });

  // ─── Conversation view ────────────────────────────────
  if (selectedUser) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
          <div>
            <span className="font-semibold">{displayName(selectedUser)}</span>
            <span className="text-muted-foreground text-sm ml-2">ID: {selectedUser.telegram_user_id}</span>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Inbox className="h-8 w-8 mb-2" />
                  <p className="text-sm">Нет сообщений</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === "outgoing" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          m.direction === "outgoing"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-xs opacity-70">
                            {m.direction === "incoming" ? displayName(selectedUser) : "Админ"}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className={`text-[10px] mt-1 ${m.direction === "outgoing" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="border-t p-3 flex gap-2">
              <Textarea
                placeholder="Написать сообщение..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="min-h-[40px] max-h-[120px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (messageText.trim()) {
                      sendMutation.mutate({ userId: selectedUser.telegram_user_id, text: messageText.trim() });
                    }
                  }
                }}
              />
              <Button
                size="icon"
                disabled={!messageText.trim() || sendMutation.isPending}
                onClick={() => sendMutation.mutate({ userId: selectedUser.telegram_user_id, text: messageText.trim() })}
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── User list view ───────────────────────────────────
  if (usersLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Загрузка…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Broadcast */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Рассылка
          </CardTitle>
          <CardDescription>
            Отправить сообщение всем пользователям ({users.length})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Текст рассылки..."
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            className="min-h-[80px]"
          />
          <Button
            disabled={!broadcastText.trim() || broadcastMutation.isPending}
            onClick={() => broadcastMutation.mutate(broadcastText.trim())}
          >
            {broadcastMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Отправка…</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Отправить всем</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* User list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Пользователи
            <Badge variant="secondary">{users.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2" />
              <p className="text-sm">Нет пользователей</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead className="text-center">Сообщений</TableHead>
                  <TableHead>Последний визит</TableHead>
                  <TableHead className="text-right">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.telegram_user_id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{displayName(u)}</span>
                        {u.username && u.first_name && (
                          <span className="text-muted-foreground text-xs ml-1">({u.first_name})</span>
                        )}
                      </div>
                      <span className="text-muted-foreground text-xs">ID: {u.telegram_user_id}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{u.message_count}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatTime(u.last_seen_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedUser(u)}>
                        <MessageCircle className="h-4 w-4 mr-1" /> Написать
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
