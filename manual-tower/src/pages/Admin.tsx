import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StopWordsManager } from "@/components/admin/StopWordsManager";
import { DockerStatus } from "@/components/admin/DockerStatus";
import { WordStats } from "@/components/admin/WordStats";
import { ModerationPanel } from "@/components/admin/ModerationPanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { SnapshotPanel } from "@/components/admin/SnapshotPanel";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Filter, Container, MessageSquare, LogOut, Settings, Download } from "lucide-react";
import type { CSSProperties } from "react";

const adminThemeVars: CSSProperties = {
  ["--background" as string]: "227 50% 7%",
  ["--foreground" as string]: "0 0% 96%",
  ["--card" as string]: "228 42% 12%",
  ["--card-foreground" as string]: "0 0% 96%",
  ["--popover" as string]: "228 42% 12%",
  ["--popover-foreground" as string]: "0 0% 96%",
  ["--primary" as string]: "352 92% 58%",
  ["--primary-foreground" as string]: "0 0% 100%",
  ["--secondary" as string]: "228 30% 18%",
  ["--secondary-foreground" as string]: "0 0% 96%",
  ["--muted" as string]: "228 20% 16%",
  ["--muted-foreground" as string]: "0 0% 76%",
  ["--accent" as string]: "347 84% 62%",
  ["--accent-foreground" as string]: "0 0% 100%",
  ["--border" as string]: "340 36% 28%",
  ["--input" as string]: "228 26% 20%",
  ["--ring" as string]: "352 92% 58%",
};

const Admin = () => {
  document.title = "админ test";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    navigate("/login");
  };

  return (
    <div
      className="admin-shell relative min-h-screen overflow-hidden bg-background"
      style={adminThemeVars}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_20%_0%,rgba(255,42,98,0.2),transparent_70%),radial-gradient(70%_50%_at_82%_10%,rgba(67,97,255,0.2),transparent_72%),linear-gradient(180deg,rgba(7,9,24,0.96)_0%,rgba(9,6,20,0.92)_100%)]" />
      <div className="relative z-10 max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">admin test</h1>
            <p className="text-sm text-zinc-300/90">
              Управление контентом, статистика и мониторинг
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                На главную
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Выйти">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="moderation" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 border border-[hsl(340_36%_30%_/_0.8)] bg-[hsl(228_36%_14%_/_0.88)] backdrop-blur">
            <TabsTrigger value="moderation" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Модерация</span>
              <span className="sm:hidden">Мод.</span>
            </TabsTrigger>
            <TabsTrigger value="stop-words" className="gap-2">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Стоп-слова</span>
              <span className="sm:hidden">Фильтр</span>
            </TabsTrigger>
            <TabsTrigger value="word-stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Статистика</span>
              <span className="sm:hidden">Стат.</span>
            </TabsTrigger>
            <TabsTrigger value="docker" className="gap-2">
              <Container className="h-4 w-4" />
              <span className="hidden sm:inline">Docker</span>
              <span className="sm:hidden">Docker</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Настройки</span>
              <span className="sm:hidden">Нас.</span>
            </TabsTrigger>
            <TabsTrigger value="snapshot" className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">PNG</span>
              <span className="sm:hidden">PNG</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="moderation">
            <ModerationPanel />
          </TabsContent>

          <TabsContent value="stop-words">
            <StopWordsManager />
          </TabsContent>

          <TabsContent value="word-stats">
            <WordStats />
          </TabsContent>

          <TabsContent value="docker">
            <DockerStatus />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel />
          </TabsContent>

          <TabsContent value="snapshot">
            <SnapshotPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
