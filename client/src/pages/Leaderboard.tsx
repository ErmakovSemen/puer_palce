import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, Medal, Award, RefreshCw } from "lucide-react";
import type { LeaderboardEntry } from "@shared/schema";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const REFETCH_INTERVAL = 5 * 60 * 1000;

export default function Leaderboard() {
  const { data: leaderboard, isLoading, refetch, dataUpdatedAt } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/admin/leaderboard/monthly"],
    refetchInterval: REFETCH_INTERVAL,
    staleTime: REFETCH_INTERVAL,
  });

  const currentMonth = format(new Date(), "LLLL yyyy", { locale: ru });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-amber-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-700" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-lg font-bold text-muted-foreground">{rank}</span>;
    }
  };

  const getGlowClass = (rank: number) => {
    if (rank <= 3) {
      return "relative before:content-[''] before:absolute before:inset-[-2px] before:rounded-lg before:bg-gradient-to-r before:from-amber-400/20 before:via-yellow-300/30 before:to-amber-400/20 before:blur-md before:-z-10";
    }
    return "";
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center border-b">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
                <Trophy className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <CardTitle className="text-2xl md:text-3xl font-serif" data-testid="text-leaderboard-title">
              Топ-10 покупателей
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-2" data-testid="text-leaderboard-month">
              {capitalizedMonth}
            </p>
            <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3" />
              <span>Автообновление каждые 5 минут</span>
              {dataUpdatedAt && (
                <span>• Обновлено: {format(new Date(dataUpdatedAt), "HH:mm")}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : leaderboard && leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-4 p-4 rounded-lg border bg-card transition-all ${getGlowClass(entry.rank)}`}
                    data-testid={`leaderboard-entry-${entry.rank}`}
                  >
                    <div className="flex-shrink-0">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-name-${entry.rank}`}>
                        {entry.name}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="font-bold text-lg text-amber-600 dark:text-amber-400" data-testid={`text-xp-${entry.rank}`}>
                        {entry.xpThisMonth.toLocaleString("ru-RU")}
                      </p>
                      <p className="text-xs text-muted-foreground">XP</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Пока нет данных за этот месяц</p>
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Обновить
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
