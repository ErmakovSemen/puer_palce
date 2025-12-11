import { useState, useEffect } from "react";
import { type InfoBanner as InfoBannerType, type BannerButton } from "@shared/schema";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  return isMobile;
}

interface InfoBannerProps {
  banner: InfoBannerType;
  onButtonClick?: (action: string) => void;
}

export default function InfoBanner({ banner, onButtonClick }: InfoBannerProps) {
  let buttons: BannerButton[] = [];
  try {
    buttons = banner.buttons ? JSON.parse(banner.buttons) : [];
  } catch {
    buttons = [];
  }

  const IconComponent = banner.icon 
    ? (LucideIcons as any)[banner.icon] 
    : null;

  const isDark = banner.theme === "dark";

  const handleButtonClick = (btn: BannerButton) => {
    if (btn.action) {
      if (btn.action.startsWith("http") || btn.action.startsWith("/")) {
        window.location.href = btn.action;
      } else if (onButtonClick) {
        onButtonClick(btn.action);
      }
    }
  };

  return (
    <div
      className={`rounded-2xl p-6 md:p-8 ${
        isDark
          ? "bg-black text-white"
          : "bg-gray-100 text-black border border-gray-200"
      }`}
      data-testid={`info-banner-${banner.id}`}
    >
      {IconComponent && (
        <div className="mb-4">
          <IconComponent 
            className={`w-8 h-8 ${isDark ? "text-white" : "text-black"}`} 
          />
        </div>
      )}
      
      <h3 
        className="font-bold text-2xl md:text-3xl uppercase leading-tight mb-4"
        style={{ fontFamily: "inherit" }}
      >
        {banner.title}
      </h3>
      
      <p className={`text-base md:text-lg leading-relaxed ${
        isDark ? "text-gray-300" : "text-gray-600"
      }`}>
        {banner.description}
      </p>

      {buttons.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {buttons.map((btn, index) => (
            <Button
              key={index}
              variant={isDark ? "secondary" : "default"}
              className={`uppercase font-semibold px-6 ${
                isDark 
                  ? "bg-white text-black hover:bg-gray-200" 
                  : "bg-black text-white hover:bg-gray-800"
              }`}
              onClick={() => handleButtonClick(btn)}
              data-testid={`banner-button-${banner.id}-${index}`}
            >
              {btn.text}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

interface BannerSlotProps {
  slotId: string;
  banners: InfoBannerType[];
  className?: string;
  onButtonClick?: (action: string) => void;
}

export function BannerSlot({ slotId, banners, className = "", onButtonClick }: BannerSlotProps) {
  const isMobile = useIsMobile();
  
  const slotBanners = banners.filter(b => {
    const slot = isMobile ? b.mobileSlot : b.desktopSlot;
    const hidden = isMobile ? b.hideOnMobile : b.hideOnDesktop;
    return slot === slotId && !hidden && b.isActive;
  });

  const sortedBanners = slotBanners.sort((a, b) => {
    if (isMobile) return a.mobileOrder - b.mobileOrder;
    return a.desktopOrder - b.desktopOrder;
  });

  if (sortedBanners.length === 0) return null;

  return (
    <div 
      className={`grid gap-4 ${
        sortedBanners.length > 1 ? "md:grid-cols-2" : ""
      } ${className}`}
      data-testid={`banner-slot-${slotId}`}
    >
      {sortedBanners.map(banner => (
        <InfoBanner 
          key={banner.id} 
          banner={banner} 
          onButtonClick={onButtonClick}
        />
      ))}
    </div>
  );
}
