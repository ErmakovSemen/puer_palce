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

export default function TVDisplay() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [cachedData, setCachedData] = useState<DisplayData | null>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  });

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
    const iconClass = "w-10 h-10";
    switch (rank) {
      case 1:
        return <Crown className={`${iconClass} text-amber-500`} />;
      case 2:
        return <Medal className={`${iconClass} text-gray-400`} />;
      case 3:
        return <Award className={`${iconClass} text-amber-700`} />;
      default:
        return (
          <span className="w-10 h-10 flex items-center justify-center text-2xl font-bold text-muted-foreground">
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
    <div className="h-screen bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950 p-6 flex flex-col overflow-hidden">
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center rounded-full bg-amber-100/10 p-3 mb-2">
          <Trophy className="w-12 h-12 text-amber-400" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-white mb-1">
          Топ-10 покупателей
        </h1>
        <p className="text-xl text-amber-200/80">{capitalizedMonth}</p>
      </div>

      <div className="flex-1 flex items-start justify-center overflow-hidden">
        {leaderboard.length === 0 ? (
          <div className="text-center text-amber-200/60 text-2xl">
            Пока нет данных за этот месяц
          </div>
        ) : (
          <div className="w-full max-w-4xl grid grid-cols-1 gap-2">
            {leaderboard.map((entry) => (
              <div
                key={entry.userId}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl border border-amber-400/20 bg-gradient-to-r from-amber-900/40 to-stone-900/60 backdrop-blur transition-all ${getGlowClass(entry.rank)}`}
              >
                <div className="flex-shrink-0">{getRankIcon(entry.rank)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold text-white truncate">
                    {entry.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-400">
                    {entry.xpThisMonth.toLocaleString("ru-RU")}
                  </p>
                  <p className="text-sm text-amber-200/60">XP</p>
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
      className={`transition-opacity duration-500 ${
        isTransitioning ? "opacity-0" : "opacity-100"
      }`}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {renderCurrentSlide()}
      
      {slides.length > 1 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`w-6 h-6 rounded-full transition-all ${
                index === currentSlideIndex
                  ? "bg-amber-400 scale-125"
                  : "bg-white/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
