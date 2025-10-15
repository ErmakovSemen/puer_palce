import { LOYALTY_LEVELS } from "@shared/loyalty";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trophy, Check, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";

interface LoyaltyLevelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentXP: number;
}

export function LoyaltyLevelsModal({ open, onOpenChange, currentXP }: LoyaltyLevelsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="modal-loyalty-levels">
        <DialogHeader>
          <DialogTitle className="text-2xl">Программа лояльности</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {LOYALTY_LEVELS.map((level) => {
            const isUnlocked = currentXP >= level.minXP;
            const isCurrent = currentXP >= level.minXP && (level.maxXP === null || currentXP <= level.maxXP);
            
            return (
              <Card 
                key={level.level} 
                className={`p-4 ${isCurrent ? 'ring-2' : ''}`}
                style={isCurrent ? { borderColor: level.color } : undefined}
                data-testid={`card-level-${level.level}`}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: level.color }}
                  >
                    {isUnlocked ? (
                      <Trophy className="w-6 h-6 text-white" />
                    ) : (
                      <Lock className="w-6 h-6 text-white" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg" data-testid={`text-level-${level.level}-name`}>
                        {level.name}
                      </h3>
                      {isCurrent && (
                        <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded">
                          Текущий
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3" data-testid={`text-level-${level.level}-xp`}>
                      {level.minXP.toLocaleString()} XP
                      {level.maxXP !== null && ` - ${level.maxXP.toLocaleString()} XP`}
                      {level.maxXP === null && '+'}
                    </p>
                    
                    {level.discount > 0 && (
                      <div className="mb-3">
                        <span 
                          className="inline-block px-3 py-1 rounded text-sm font-medium"
                          style={{ 
                            backgroundColor: level.color + '20',
                            color: level.color 
                          }}
                          data-testid={`text-level-${level.level}-discount`}
                        >
                          Скидка {level.discount}%
                        </span>
                      </div>
                    )}
                    
                    <ul className="space-y-2">
                      {level.benefits.map((benefit, index) => (
                        <li 
                          key={index} 
                          className="flex items-start gap-2 text-sm"
                          data-testid={`text-level-${level.level}-benefit-${index}`}
                        >
                          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: level.color }} />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        
        <div className="mt-6 p-4 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">
            <strong>Как получить XP:</strong> За каждый рубль покупки вы получаете 1 XP. 
            Накапливайте опыт, повышайте уровень и получайте всё больше привилегий!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
