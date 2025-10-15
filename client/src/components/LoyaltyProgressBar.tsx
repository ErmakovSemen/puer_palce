import { getLoyaltyProgress } from "@shared/loyalty";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Trophy, ChevronRight } from "lucide-react";

interface LoyaltyProgressBarProps {
  xp: number;
  onClick?: () => void;
}

export function LoyaltyProgressBar({ xp, onClick }: LoyaltyProgressBarProps) {
  const progress = getLoyaltyProgress(xp);
  const { currentLevel, nextLevel, progressPercentage, xpToNextLevel } = progress;

  return (
    <Card
      className="p-4 hover-elevate active-elevate-2 cursor-pointer"
      onClick={onClick}
      data-testid="card-loyalty-progress"
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: currentLevel.color }}
        >
          <Trophy className="w-5 h-5 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium" data-testid="text-current-level">
                {currentLevel.name}
              </span>
              {currentLevel.discount > 0 && (
                <span className="text-sm text-muted-foreground" data-testid="text-current-discount">
                  (-{currentLevel.discount}%)
                </span>
              )}
            </div>
            <span className="text-sm text-muted-foreground" data-testid="text-current-xp">
              {xp} XP
            </span>
          </div>
          
          <div className="space-y-1">
            <Progress 
              value={progressPercentage} 
              className="h-2"
              data-testid="progress-loyalty"
            />
            {nextLevel ? (
              <p className="text-xs text-muted-foreground" data-testid="text-next-level">
                Ещё {xpToNextLevel} XP до уровня "{nextLevel.name}"
              </p>
            ) : (
              <p className="text-xs text-muted-foreground" data-testid="text-max-level">
                Максимальный уровень достигнут!
              </p>
            )}
          </div>
        </div>
        
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>
    </Card>
  );
}
