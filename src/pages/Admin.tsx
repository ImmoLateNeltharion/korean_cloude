import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StopWordsManager } from "@/components/admin/StopWordsManager";
import { DockerStatus } from "@/components/admin/DockerStatus";
import { WordStats } from "@/components/admin/WordStats";
import { ModerationPanel } from "@/components/admin/ModerationPanel";
import { MessagingPanel } from "@/components/admin/MessagingPanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Filter, Container, MessageSquare, Send, LogOut, Settings } from "lucide-react";

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
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">admin test</h1>
            <p className="text-sm text-muted-foreground">
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
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
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
            <TabsTrigger value="messaging" className="gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Сообщения</span>
              <span className="sm:hidden">Чат</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Настройки</span>
              <span className="sm:hidden">Нас.</span>
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

          <TabsContent value="messaging">
            <MessagingPanel />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
