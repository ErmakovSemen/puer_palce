import { LOYALTY_LEVELS } from "@shared/loyalty";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto" data-testid="modal-loyalty-levels">
        <DialogHeader>
          <DialogTitle className="text-2xl">Программа лояльности</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-6 mt-6 overflow-x-auto pb-4">
          {LOYALTY_LEVELS.map((level, index) => {
            const isUnlocked = currentXP >= level.minXP;
            const isCurrent = currentXP >= level.minXP && (level.maxXP === null || currentXP <= level.maxXP);
            
            return (
              <div key={level.level} className="flex items-start">
                <div 
                  className={`flex-shrink-0 p-4 ${isCurrent ? 'ring-2 ring-primary rounded' : ''}`}
                  style={{ minWidth: '280px' }}
                  data-testid={`card-level-${level.level}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded border-2 border-border bg-background flex items-center justify-center flex-shrink-0">
                      {isUnlocked ? (
                        <Trophy className="w-5 h-5" />
                      ) : (
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base" data-testid={`text-level-${level.level}-name`}>
                          {level.name}
                        </h3>
                        {isCurrent && (
                          <span className="text-xs px-2 py-0.5 bg-foreground text-background rounded">
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
                    <div className="mb-3">
                      <span 
                        className="inline-block px-2 py-1 border border-border rounded text-sm"
                        data-testid={`text-level-${level.level}-discount`}
                      >
                        Скидка {level.discount}%
                      </span>
                    </div>
                  )}
                  
                  <ul className="space-y-2">
                    {level.benefits.map((benefit, benefitIndex) => (
                      <li 
                        key={benefitIndex} 
                        className="flex items-start gap-2 text-sm"
                        data-testid={`text-level-${level.level}-benefit-${benefitIndex}`}
                      >
                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {index < LOYALTY_LEVELS.length - 1 && (
                  <Separator orientation="vertical" className="h-auto self-stretch mx-2" />
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-4 border border-border rounded">
          <p className="text-sm text-muted-foreground">
            <strong>Как получить XP:</strong> За каждый рубль покупки вы получаете 1 XP. 
            Накапливайте опыт, повышайте уровень и получайте всё больше привилегий!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
