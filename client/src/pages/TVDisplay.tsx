import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Crown, Medal, Award } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { TvSlide, LeaderboardEntry } from "@shared/schema";

interface DisplayData {
  slides: TvSlide[];
  leaderboard: LeaderboardEntry[];
  timestamp: number;
}

const REFETCH_INTERVAL = 60 * 1000;
const CACHE_KEY = "tv-display-cache";

const DOUBLE_PRESS_DELAY = 500;

export default function TVDisplay() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastEnterPressRef = useRef<number>(0);
  const [cachedData, setCachedData] = useState<DisplayData | null>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  });

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const { data: displayData, isError } = useQuery<DisplayData>({
    queryKey: ["/api/tv/display"],
    refetchInterval: REFETCH_INTERVAL,
    staleTime: REFETCH_INTERVAL,
  });

  useEffect(() => {
    if (displayData) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(displayData));
      setCachedData(displayData);
    }
  }, [displayData]);

  const data = displayData || cachedData;
  const slides = data?.slides || [];
  const leaderboard = data?.leaderboard || [];

  const goToNextSlide = useCallback(() => {
    if (slides.length === 0) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
      setIsTransitioning(false);
    }, 500);
  }, [slides.length]);

  const goToPrevSlide = useCallback(() => {
    if (slides.length === 0) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
      setIsTransitioning(false);
    }, 500);
  }, [slides.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Select") {
        const now = Date.now();
        if (now - lastEnterPressRef.current < DOUBLE_PRESS_DELAY) {
          toggleFullscreen();
          lastEnterPressRef.current = 0;
        } else {
          lastEnterPressRef.current = now;
        }
      } else if (e.key === "ArrowRight" || e.key === "ChannelUp") {
        goToNextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "ChannelDown") {
        goToPrevSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFullscreen, goToNextSlide, goToPrevSlide]);

  useEffect(() => {
    if (slides.length === 0) return;

    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      goToNextSlide();
    }, currentSlide.durationSeconds * 1000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentSlideIndex, slides, goToNextSlide]);

  const currentMonth = format(new Date(), "LLLL yyyy", { locale: ru });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const getRankIcon = (rank: number) => {
    const iconStyle = { width: "3vh", height: "3vh" };
    switch (rank) {
      case 1:
        return <Crown style={iconStyle} className="text-amber-500" />;
      case 2:
        return <Medal style={iconStyle} className="text-gray-400" />;
      case 3:
        return <Award style={iconStyle} className="text-amber-700" />;
      default:
        return (
          <span className="flex items-center justify-center font-bold text-muted-foreground" style={{ width: "3vh", height: "3vh", fontSize: "clamp(0.75rem, 2vh, 1.25rem)" }}>
            {rank}
          </span>
        );
    }
  };

  const getGlowClass = (rank: number) => {
    if (rank <= 3) {
      return "relative before:content-[''] before:absolute before:inset-[-2px] before:rounded-xl before:bg-gradient-to-r before:from-amber-400/30 before:via-yellow-300/40 before:to-amber-400/30 before:blur-md before:-z-10";
    }
    return "";
  };

  const renderLeaderboard = () => (
    <div 
      className="h-screen bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950 flex flex-col overflow-hidden"
      style={{ 
        padding: "1vh 2vw",
        "--header-height": "10vh",
        "--list-height": "calc(100vh - var(--header-height) - 2vh)",
        "--row-height": "calc((var(--list-height) - 4.5vh) / 10)",
      } as React.CSSProperties}
    >
      <div className="text-center flex-shrink-0 flex flex-col justify-center overflow-hidden" style={{ height: "var(--header-height)" }}>
        <div className="inline-flex items-center justify-center rounded-full bg-amber-100/10 mx-auto" style={{ padding: "0.8vh", marginBottom: "0.3vh" }}>
          <Trophy style={{ width: "3vh", height: "3vh" }} className="text-amber-400" />
        </div>
        <h1 className="font-serif font-bold text-white whitespace-nowrap overflow-hidden" style={{ fontSize: "2.5vh", lineHeight: 1 }}>
          Топ-10 покупателей
        </h1>
        <p className="text-amber-200/80 whitespace-nowrap overflow-hidden" style={{ fontSize: "1.8vh", lineHeight: 1 }}>{capitalizedMonth}</p>
      </div>

      <div className="flex flex-col overflow-hidden" style={{ height: "var(--list-height)" }}>
        {leaderboard.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-amber-200/60" style={{ fontSize: "2vh" }}>
            Пока нет данных за этот месяц
          </div>
        ) : (
          <div className="w-full max-w-4xl mx-auto flex flex-col" style={{ gap: "0.5vh" }}>
            {leaderboard.map((entry) => (
              <div
                key={entry.userId}
                className={`flex items-center rounded-lg border border-amber-400/20 bg-gradient-to-r from-amber-900/40 to-stone-900/60 backdrop-blur transition-all ${getGlowClass(entry.rank)}`}
                style={{ gap: "1.5vw", padding: "0 1.5vw", height: "var(--row-height)" }}
              >
                <div className="flex-shrink-0">{getRankIcon(entry.rank)}</div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-bold text-white truncate" style={{ fontSize: "2vh", lineHeight: 1 }}>
                    {entry.name}
                  </p>
                </div>
                <div className="text-right flex items-center flex-shrink-0" style={{ gap: "0.5vw" }}>
                  <p className="font-bold text-amber-400 whitespace-nowrap" style={{ fontSize: "2.5vh", lineHeight: 1 }}>
                    {entry.xpThisMonth.toLocaleString("ru-RU")}
                  </p>
                  <p className="text-amber-200/60 whitespace-nowrap" style={{ fontSize: "1.5vh", lineHeight: 1 }}>XP</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderImageSlide = (slide: TvSlide) => (
    <div className="min-h-screen bg-black flex items-center justify-center">
      {slide.imageUrl ? (
        <img
          src={slide.imageUrl}
          alt={slide.title || "Слайд"}
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="text-4xl text-white/40">Изображение недоступно</div>
      )}
      {slide.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-16">
          <h2 className="text-6xl font-serif font-bold text-white text-center">
            {slide.title}
          </h2>
        </div>
      )}
    </div>
  );

  const renderCurrentSlide = () => {
    if (slides.length === 0) {
      return renderLeaderboard();
    }

    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return renderLeaderboard();

    if (currentSlide.type === "leaderboard") {
      return renderLeaderboard();
    }

    return renderImageSlide(currentSlide);
  };

  if (isError && !cachedData) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Trophy className="w-32 h-32 mx-auto mb-8 text-amber-400" />
          <h1 className="text-6xl font-serif mb-4">Puer Pub</h1>
          <p className="text-2xl text-amber-200/60">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onDoubleClick={toggleFullscreen}
      className={`transition-opacity duration-500 cursor-pointer ${
        isTransitioning ? "opacity-0" : "opacity-100"
      }`}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {renderCurrentSlide()}
    </div>
  );
}
