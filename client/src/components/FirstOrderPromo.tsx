import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { SiteSettings } from "@shared/schema";

export function FirstOrderPromo() {
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: settings } = useQuery<SiteSettings>({
    queryKey: ["/api/site-settings"],
  });

  const discountPercent = settings?.firstOrderDiscount ?? 20;

  useEffect(() => {
    if (isLoading) return;
    
    if (user) {
      setVisible(false);
      return;
    }

    const showTimer = setTimeout(() => {
      setVisible(true);
    }, 1500);

    return () => clearTimeout(showTimer);
  }, [user, isLoading]);

  useEffect(() => {
    if (!visible) return;

    const hideTimer = setTimeout(() => {
      handleClose();
    }, 6000);

    return () => clearTimeout(hideTimer);
  }, [visible]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setVisible(false);
      setIsExiting(false);
    }, 300);
  };

  const handleClick = () => {
    handleClose();
    setLocation("/auth?tab=register");
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX.current;
    
    if (Math.abs(diff) > 80) {
      handleClose();
    }
    touchStartX.current = null;
  };

  if (!visible) return null;

  return (
    <div 
      ref={containerRef}
      className={`fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm transition-all duration-300 ${
        isExiting ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="promo-first-order"
    >
      <div 
        className="relative bg-black text-white rounded-lg shadow-2xl p-3 cursor-pointer hover-elevate active-elevate-2 border border-white/20"
        onClick={handleClick}
        data-testid="card-promo-first-order"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Gift className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Скидка {discountPercent}% на первый заказ!</p>
            <p className="text-xs text-white/70">Зарегистрируйтесь и получите скидку</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="flex-shrink-0 h-8 w-8 text-white/60 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            data-testid="button-close-promo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
