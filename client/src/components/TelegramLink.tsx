import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Link2, Unlink, ExternalLink, Copy, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TelegramProfile {
  linked: boolean;
  username?: string;
  firstName?: string;
  linkedAt?: string;
}

interface MagicLinkResponse {
  success: boolean;
  deepLink: string;
  shortCode: string;
  token: string;
  expiresIn: number;
}

const TOKEN_REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes

export function TelegramLink() {
  const { toast } = useToast();
  const [linkData, setLinkData] = useState<MagicLinkResponse | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: telegramProfile, isLoading } = useQuery<TelegramProfile>({
    queryKey: ["/api/telegram/profile"],
  });

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/telegram/magic-link", {});
      return res.json() as Promise<MagicLinkResponse>;
    },
    onSuccess: (data) => {
      setLinkData(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-refresh token every 14 minutes
  useEffect(() => {
    // Clear any existing interval first
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    // Only set up refresh if link exists and account not linked
    if (linkData && !telegramProfile?.linked) {
      refreshIntervalRef.current = setInterval(() => {
        createLinkMutation.mutate();
      }, TOKEN_REFRESH_INTERVAL);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [linkData, telegramProfile?.linked]);

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/telegram/profile");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/profile"] });
      setLinkData(null);
      toast({
        title: "Telegram отвязан",
        description: "Вы можете привязать другой аккаунт",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCopyCode = async () => {
    if (!linkData?.token) return;
    const copyText = `LINK ${linkData.token}`;
    try {
      await navigator.clipboard.writeText(copyText);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      toast({
        title: "Скопировано",
        description: "Код скопирован в буфер обмена",
      });
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать код",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (telegramProfile?.linked) {
    return (
      <Card data-testid="card-telegram-linked">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Telegram</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Привязан
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {telegramProfile.firstName}
                  {telegramProfile.username && ` (@${telegramProfile.username})`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}
              data-testid="button-unlink-telegram"
            >
              {unlinkMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Unlink className="w-4 h-4 mr-2" />
                  Отвязать
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-telegram-link">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-full">
            <MessageCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium mb-1">Telegram</h3>
            <p className="text-sm text-muted-foreground">
              Привяжите Telegram для отслеживания лояльности и уведомлений
            </p>
          </div>
        </div>

        {linkData ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="text-sm text-muted-foreground">
                1. Откройте бота в Telegram
              </div>
              <div className="text-sm text-muted-foreground">
                2. Отправьте боту этот код:
              </div>
              <div className="flex items-center gap-2 p-3 bg-background rounded border">
                <span className="text-sm font-mono flex-1 break-all">LINK {linkData.token}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="flex-1"
                data-testid="button-copy-code"
              >
                {codeCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Скопировано
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Копировать код
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => window.open(linkData.deepLink, "_blank")}
                className="flex-1"
                data-testid="button-open-telegram"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Открыть бота
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => createLinkMutation.mutate()}
            disabled={createLinkMutation.isPending}
            className="w-full"
            data-testid="button-link-telegram"
          >
            {createLinkMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4 mr-2" />
            )}
            Привязать Telegram
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
