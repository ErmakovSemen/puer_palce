import { useQuery } from "@tanstack/react-query";
import type { SiteSettings } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trophy, Check, Lock } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface LoyaltyLevelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentXP: number;
}

export function LoyaltyLevelsModal({ open, onOpenChange, currentXP }: LoyaltyLevelsModalProps) {
  const { data: settings } = useQuery<SiteSettings>({
    queryKey: ["/api/site-settings"],
    enabled: open,
  });

  const getLevels = () => {
    const level2MinXP = settings?.loyaltyLevel2MinXP ?? 3000;
    const level3MinXP = settings?.loyaltyLevel3MinXP ?? 7000;
    const level4MinXP = settings?.loyaltyLevel4MinXP ?? 15000;
    
    const level2Discount = settings?.loyaltyLevel2Discount ?? 5;
    const level3Discount = settings?.loyaltyLevel3Discount ?? 10;
    const level4Discount = settings?.loyaltyLevel4Discount ?? 15;
    
    const level1Perks = settings?.loyaltyLevel1Perks ?? ["Доступ к базовому каталогу"];
    const level2Perks = settings?.loyaltyLevel2Perks ?? ["Доступ к базовому каталогу"];
    const level3Perks = settings?.loyaltyLevel3Perks ?? ["Персональный чат с консультациями", "Приглашения на закрытые чайные вечеринки", "Возможность запросить любой чай"];
    const level4Perks = settings?.loyaltyLevel4Perks ?? ["Все привилегии уровня 3", "Приоритетное обслуживание", "Эксклюзивные предложения"];

    return [
      {
        level: 1,
        name: "Новичок",
        minXP: 0,
        maxXP: level2MinXP - 1,
        discount: 0,
        benefits: level1Perks,
      },
      {
        level: 2,
        name: "Ценитель",
        minXP: level2MinXP,
        maxXP: level3MinXP - 1,
        discount: level2Discount,
        benefits: [`Скидка ${level2Discount}% на все покупки`, ...level2Perks],
      },
      {
        level: 3,
        name: "Чайный мастер",
        minXP: level3MinXP,
        maxXP: level4MinXP - 1,
        discount: level3Discount,
        benefits: [`Скидка ${level3Discount}% на все покупки`, ...level3Perks],
      },
      {
        level: 4,
        name: "Чайный Гуру",
        minXP: level4MinXP,
        maxXP: null as number | null,
        discount: level4Discount,
        benefits: [`Скидка ${level4Discount}% на все покупки`, ...level4Perks],
      },
    ];
  };

  const levels = getLevels();
  const xpMultiplier = settings?.xpMultiplier ?? 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-4 max-h-[90vh]" data-testid="modal-loyalty-levels">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-xl">Программа лояльности</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2">
          {levels.map((level, index) => {
            const isUnlocked = currentXP >= level.minXP;
            const isCurrent = currentXP >= level.minXP && (level.maxXP === null || currentXP <= level.maxXP);
            
            return (
              <div key={level.level} className="flex items-start">
                <div 
                  className={`flex-shrink-0 p-3 ${isCurrent ? 'ring-2 ring-primary rounded' : ''}`}
                  style={{ minWidth: '230px' }}
                  data-testid={`card-level-${level.level}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-8 h-8 rounded border-2 border-border bg-background flex items-center justify-center flex-shrink-0">
                      {isUnlocked ? (
                        <Trophy className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="font-semibold text-sm" data-testid={`text-level-${level.level}-name`}>
                          {level.name}
                        </h3>
                        {isCurrent && (
                          <span className="text-xs px-1.5 py-0.5 bg-foreground text-background rounded">
                            Текущий
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground" data-testid={`text-level-${level.level}-xp`}>
                        {level.minXP.toLocaleString()} XP
                        {level.maxXP !== null && ` - ${level.maxXP.toLocaleString()} XP`}
                        {level.maxXP === null && '+'}
                      </p>
                    </div>
                  </div>
                  
                  {level.discount > 0 && (
                    <div className="mb-2">
                      <span 
                        className="inline-block px-2 py-0.5 border border-border rounded text-xs"
                        data-testid={`text-level-${level.level}-discount`}
                      >
                        Скидка {level.discount}%
                      </span>
                    </div>
                  )}
                  
                  <ul className="space-y-1">
                    {level.benefits.map((benefit, benefitIndex) => (
                      <li 
                        key={benefitIndex} 
                        className="flex items-start gap-1.5 text-xs"
                        data-testid={`text-level-${level.level}-benefit-${benefitIndex}`}
                      >
                        <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="text-xs">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {index < levels.length - 1 && (
                  <Separator orientation="vertical" className="h-auto self-stretch mx-1" />
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-3 p-3 border border-border rounded">
          <p className="text-xs text-muted-foreground">
            <strong>Как получить XP:</strong> За каждый рубль покупки вы получаете {xpMultiplier} XP. 
            Накапливайте опыт, повышайте уровень и получайте всё больше привилегий!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
