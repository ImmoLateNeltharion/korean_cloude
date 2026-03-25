import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Container, Wifi, WifiOff } from "lucide-react";

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
}

interface DockerStatusResponse {
  available: boolean;
  containers: DockerContainer[];
  error?: string;
}

async function fetchDockerStatus(): Promise<DockerStatusResponse> {
  const res = await fetch("/api/docker/status");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function stateVariant(state: string): "default" | "destructive" | "secondary" | "outline" {
  switch (state) {
    case "running": return "default";
    case "exited": return "destructive";
    case "paused": return "outline";
    default: return "secondary";
  }
}

export function DockerStatus() {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["docker-status"],
    queryFn: fetchDockerStatus,
    refetchInterval: 10_000,
    retry: 1,
  });

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Container className="h-5 w-5" />
              Docker Status
            </CardTitle>
            <CardDescription>
              Состояние контейнеров. Обновляется каждые 10 секунд.
              {lastUpdate && ` Последнее обновление: ${lastUpdate}`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection status */}
        <div className="flex items-center gap-2 text-sm">
          {isError ? (
            <>
              <WifiOff className="h-4 w-4 text-destructive" />
              <span className="text-destructive">API недоступен</span>
            </>
          ) : data?.available ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-green-500">Docker подключен</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-yellow-500" />
              <span className="text-yellow-500">Docker не найден</span>
            </>
          )}
        </div>

        {isError && (
          <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
            <p className="font-medium mb-1">Docker API не доступен</p>
            <p>Убедитесь, что бэкенд-сервер запущен:</p>
            <code className="block mt-2 text-xs bg-background p-2 rounded">
              cd server && npm install && npm run dev
            </code>
          </div>
        )}

        {isLoading && !data && (
          <p className="text-muted-foreground text-sm">Проверяю статус Docker...</p>
        )}

        {data?.containers && data.containers.length > 0 && (
          <div className="space-y-3">
            {data.containers.map((container, i) => (
              <div key={container.id || i}>
                {i > 0 && <Separator className="my-3" />}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-sm">
                      {container.name}
                    </span>
                    <Badge variant={stateVariant(container.state)}>
                      {container.state}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm text-muted-foreground">
                    <div><span className="text-foreground/60">Image:</span> {container.image}</div>
                    <div><span className="text-foreground/60">Status:</span> {container.status}</div>
                    <div><span className="text-foreground/60">Ports:</span> {container.ports || "—"}</div>
                    <div><span className="text-foreground/60">ID:</span> {container.id?.slice(0, 12)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {data?.available && data.containers?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Нет запущенных контейнеров.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
