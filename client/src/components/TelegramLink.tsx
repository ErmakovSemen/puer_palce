import { useState } from "react";
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
  expiresIn: number;
}

export function TelegramLink() {
  const { toast } = useToast();
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: telegramProfile, isLoading } = useQuery<TelegramProfile>({
    queryKey: ["/api/telegram/profile"],
  });

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/telegram/magic-link", {});
      return res.json() as Promise<MagicLinkResponse>;
    },
    onSuccess: (data) => {
      setDeepLink(data.deepLink);
      toast({
        title: "Ссылка создана",
        description: `Действует ${data.expiresIn} минут`,
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

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/telegram/profile");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/profile"] });
      setDeepLink(null);
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

  const handleCopyLink = async () => {
    if (!deepLink) return;
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Скопировано",
        description: "Ссылка скопирована в буфер обмена",
      });
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать ссылку",
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

        {deepLink ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-mono truncate flex-1">{deepLink}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="flex-1"
                data-testid="button-copy-link"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Скопировано
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Копировать
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => window.open(deepLink, "_blank")}
                className="flex-1"
                data-testid="button-open-telegram"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Открыть Telegram
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Ссылка действует 15 минут
            </p>
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
