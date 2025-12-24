import { type InfoBanner as InfoBannerType, type BannerButton, type BannerWidthVariant, type BannerHeightVariant } from "@shared/schema";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";

interface InfoBannerProps {
  banner: InfoBannerType;
  onButtonClick?: (action: string) => void;
}

const getHeightClasses = (heightVariant: BannerHeightVariant): string => {
  switch (heightVariant) {
    case "compact":
      return "p-4 md:p-5";
    case "tall":
      return "p-8 md:p-12";
    default:
      return "p-6 md:p-8";
  }
};

const getTitleClasses = (heightVariant: BannerHeightVariant): string => {
  switch (heightVariant) {
    case "compact":
      return "text-lg md:text-xl mb-2";
    case "tall":
      return "text-3xl md:text-4xl mb-6";
    default:
      return "text-2xl md:text-3xl mb-4";
  }
};

const getDescriptionClasses = (heightVariant: BannerHeightVariant): string => {
  switch (heightVariant) {
    case "compact":
      return "text-sm md:text-base";
    case "tall":
      return "text-lg md:text-xl";
    default:
      return "text-base md:text-lg";
  }
};

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
  const heightVariant: BannerHeightVariant = (banner.heightVariant as BannerHeightVariant) || "standard";

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
      className={`rounded-2xl ${getHeightClasses(heightVariant)} ${
        isDark
          ? "bg-black text-white"
          : "bg-gray-100 text-black border border-gray-200"
      }`}
      data-testid={`info-banner-${banner.id}`}
    >
      {IconComponent && (
        <div className={heightVariant === "compact" ? "mb-2" : "mb-4"}>
          <IconComponent 
            className={`${heightVariant === "compact" ? "w-6 h-6" : heightVariant === "tall" ? "w-10 h-10" : "w-8 h-8"} ${isDark ? "text-white" : "text-black"}`} 
          />
        </div>
      )}
      
      <h3 
        className={`font-bold uppercase leading-tight ${getTitleClasses(heightVariant)}`}
        style={{ fontFamily: "inherit" }}
      >
        {banner.title}
      </h3>
      
      <p className={`leading-relaxed ${getDescriptionClasses(heightVariant)} ${
        isDark ? "text-gray-300" : "text-gray-600"
      }`}>
        {banner.description}
      </p>

      {buttons.length > 0 && (
        <div className={`flex flex-wrap gap-3 ${heightVariant === "compact" ? "mt-3" : heightVariant === "tall" ? "mt-8" : "mt-6"}`}>
          {buttons.map((btn, index) => (
            <Button
              key={index}
              variant={isDark ? "secondary" : "default"}
              size={heightVariant === "compact" ? "sm" : "default"}
              className={`uppercase font-semibold ${heightVariant === "compact" ? "px-4" : "px-6"} ${
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
  betweenRowIndex?: number;
}

const getWidthClass = (widthVariant: string): string => {
  switch (widthVariant) {
    case "quarter":
      return "w-full md:w-1/4";
    case "half":
      return "w-full md:w-1/2";
    case "threeQuarter":
      return "w-full md:w-3/4";
    default:
      return "w-full";
  }
};

export function BannerSlot({ slotId, banners, className = "", onButtonClick, betweenRowIndex }: BannerSlotProps) {
  const filterBanners = (isMobile: boolean) => {
    return banners.filter(b => {
      const slot = isMobile ? b.mobileSlot : b.desktopSlot;
      const isHidden = isMobile ? b.hideOnMobile : b.hideOnDesktop;
      
      if (slot !== slotId || isHidden || !b.isActive) return false;
      
      if (slotId === "between_products" && betweenRowIndex !== undefined) {
        const bannerRowIndex = isMobile ? b.betweenRowIndexMobile : b.betweenRowIndexDesktop;
        return bannerRowIndex === betweenRowIndex;
      }
      
      return true;
    }).sort((a, b) => {
      const orderA = isMobile ? a.mobileOrder : a.desktopOrder;
      const orderB = isMobile ? b.mobileOrder : b.desktopOrder;
      return orderA - orderB;
    });
  };

  const desktopBanners = filterBanners(false);
  const mobileBanners = filterBanners(true);

  if (desktopBanners.length === 0 && mobileBanners.length === 0) return null;

  return (
    <>
      {desktopBanners.length > 0 && (
        <div 
          className={`hidden md:flex flex-wrap gap-4 ${className}`}
          data-testid={`banner-slot-${slotId}${betweenRowIndex !== undefined ? `-${betweenRowIndex}` : ""}-desktop`}
        >
          {desktopBanners.map(banner => (
            <div key={banner.id} className={getWidthClass(banner.widthVariant)}>
              <InfoBanner 
                banner={banner} 
                onButtonClick={onButtonClick}
              />
            </div>
          ))}
        </div>
      )}
      {mobileBanners.length > 0 && (
        <div 
          className={`flex md:hidden flex-wrap gap-4 ${className}`}
          data-testid={`banner-slot-${slotId}${betweenRowIndex !== undefined ? `-${betweenRowIndex}` : ""}-mobile`}
        >
          {mobileBanners.map(banner => (
            <div key={banner.id} className="w-full">
              <InfoBanner 
                banner={banner} 
                onButtonClick={onButtonClick}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
