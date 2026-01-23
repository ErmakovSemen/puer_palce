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

const TRIPLE_PRESS_WINDOW = 700;

interface AnimationState {
  newUsers: Set<string>;      // userId новых пользователей
  movedUp: Set<string>;       // userId тех кто поднялся
  movedDown: Set<string>;     // userId тех кто опустился
  leaving: LeaderboardEntry[]; // пользователи покидающие топ-10
}

export default function TVDisplay() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pressCountRef = useRef<number>(0);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const firstPressTimeRef = useRef<number>(0);
  const prevLeaderboardRef = useRef<LeaderboardEntry[]>([]);
  const [animations, setAnimations] = useState<AnimationState>({
    newUsers: new Set(),
    movedUp: new Set(),
    movedDown: new Set(),
    leaving: [],
  });
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [cachedSlides, setCachedSlides] = useState<TvSlide[]>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.slides || [];
      } catch {
        return [];
      }
    }
    return [];
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
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (displayData?.slides) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ slides: displayData.slides }));
      setCachedSlides(displayData.slides);
    }
  }, [displayData?.slides]);

  // Сравнение лидербордов и определение анимаций
  useEffect(() => {
    if (!displayData?.leaderboard || displayData.leaderboard.length === 0) return;
    
    const newLeaderboard = displayData.leaderboard;
    const prevLeaderboard = prevLeaderboardRef.current;
    
    // Пропускаем первую загрузку
    if (prevLeaderboard.length === 0) {
      prevLeaderboardRef.current = newLeaderboard;
      return;
    }
    
    const prevUserIds = new Set(prevLeaderboard.map(e => e.userId));
    const newUserIds = new Set(newLeaderboard.map(e => e.userId));
    const prevRanks = new Map(prevLeaderboard.map(e => [e.userId, e.rank]));
    
    const newUsers = new Set<string>();
    const movedUp = new Set<string>();
    const movedDown = new Set<string>();
    const leaving: LeaderboardEntry[] = [];
    
    // Проверяем новых и изменивших позицию
    for (const entry of newLeaderboard) {
      if (!prevUserIds.has(entry.userId)) {
        newUsers.add(entry.userId);
      } else {
        const prevRank = prevRanks.get(entry.userId);
        if (prevRank !== undefined && prevRank !== entry.rank) {
          if (entry.rank < prevRank) {
            movedUp.add(entry.userId);
          } else {
            movedDown.add(entry.userId);
          }
        }
      }
    }
    
    // Проверяем ушедших из топ-10
    for (const entry of prevLeaderboard) {
      if (!newUserIds.has(entry.userId)) {
        leaving.push(entry);
      }
    }
    
    // Запускаем анимации только если есть изменения
    if (newUsers.size > 0 || movedUp.size > 0 || movedDown.size > 0 || leaving.length > 0) {
      // Очищаем предыдущий таймаут
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      
      setAnimations({ newUsers, movedUp, movedDown, leaving });
      
      // Сбрасываем анимации через 2 секунды
      animationTimeoutRef.current = setTimeout(() => {
        setAnimations({
          newUsers: new Set(),
          movedUp: new Set(),
          movedDown: new Set(),
          leaving: [],
        });
      }, 2000);
    }
    
    prevLeaderboardRef.current = newLeaderboard;
  }, [displayData?.leaderboard]);
  
  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const slides = displayData?.slides || cachedSlides;
  const leaderboard = displayData?.leaderboard || [];

  // Функция для получения CSS класса анимации
  const getAnimationClass = (userId: string): string => {
    if (animations.newUsers.has(userId)) return "animate-slide-in";
    if (animations.movedUp.has(userId)) return "animate-glow-green";
    if (animations.movedDown.has(userId)) return "animate-glow-red";
    return "";
  };

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
    const resetPressState = () => {
      pressCountRef.current = 0;
      firstPressTimeRef.current = 0;
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Select") {
        const now = Date.now();
        
        if (pressCountRef.current === 0 || now - firstPressTimeRef.current > TRIPLE_PRESS_WINDOW) {
          resetPressState();
          firstPressTimeRef.current = now;
          pressCountRef.current = 1;
          
          pressTimerRef.current = setTimeout(() => {
            const count = pressCountRef.current;
            resetPressState();
            if (count === 1) {
              goToNextSlide();
            } else if (count === 2) {
              toggleFullscreen();
            }
          }, TRIPLE_PRESS_WINDOW);
        } else {
          pressCountRef.current += 1;
        }
      } else if (e.key === "ArrowRight" || e.key === "ChannelUp") {
        goToNextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "ChannelDown") {
        goToPrevSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      resetPressState();
    };
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

  const first = leaderboard[0];
  const second = leaderboard[1];
  const third = leaderboard[2];
  const rest = leaderboard.slice(3, 10);

  const renderHeroTile = (entry: LeaderboardEntry) => (
    <div 
      className="rounded-2xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-800/60 via-amber-900/50 to-stone-900/70 backdrop-blur flex flex-col items-center justify-center text-center relative overflow-hidden"
      style={{ height: "100%" }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent" />
      <Crown style={{ width: "8vh", height: "8vh" }} className="text-amber-400 mb-1" />
      <p data-testid={`text-name-${entry.rank}`} className="font-bold text-white truncate max-w-full px-4" style={{ fontSize: "5vh", lineHeight: 1.1 }}>
        {entry.name}
      </p>
      <div className="flex items-baseline mt-2" style={{ gap: "1vw" }}>
        <p data-testid={`text-xp-${entry.rank}`} className="font-bold text-amber-300" style={{ fontSize: "6vh", lineHeight: 1 }}>
          {entry.xpThisMonth.toLocaleString("ru-RU")}
        </p>
        <p className="text-amber-200/70" style={{ fontSize: "3vh" }}>XP</p>
      </div>
    </div>
  );

  const renderMediumTile = (entry: LeaderboardEntry, Icon: typeof Medal) => (
    <div 
      className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-900/50 to-stone-900/60 backdrop-blur flex flex-col items-center justify-center text-center"
      style={{ height: "100%" }}
    >
      <Icon style={{ width: "5vh", height: "5vh" }} className={entry.rank === 2 ? "text-gray-300" : "text-amber-600"} />
      <p data-testid={`text-name-${entry.rank}`} className="font-bold text-white truncate max-w-full px-3 mt-1" style={{ fontSize: "3.5vh", lineHeight: 1.1 }}>
        {entry.name}
      </p>
      <div className="flex items-baseline mt-1" style={{ gap: "0.5vw" }}>
        <p data-testid={`text-xp-${entry.rank}`} className="font-bold text-amber-400" style={{ fontSize: "4vh", lineHeight: 1 }}>
          {entry.xpThisMonth.toLocaleString("ru-RU")}
        </p>
        <p className="text-amber-200/60" style={{ fontSize: "2vh" }}>XP</p>
      </div>
    </div>
  );

  const renderSmallTile = (entry: LeaderboardEntry) => (
    <div 
      className="rounded-lg border border-amber-400/20 bg-gradient-to-br from-amber-900/30 to-stone-900/50 backdrop-blur flex flex-col items-center justify-center text-center overflow-hidden"
      style={{ height: "100%", padding: "1vh 1vw" }}
    >
      <div className="flex items-center" style={{ gap: "1vw", marginBottom: "0.5vh" }}>
        <span className="font-bold text-amber-300/80" style={{ fontSize: "2.8vh" }}>
          {entry.rank}
        </span>
        <p data-testid={`text-name-${entry.rank}`} className="font-bold text-white truncate" style={{ fontSize: "2.8vh", lineHeight: 1 }}>
          {entry.name}
        </p>
      </div>
      <div className="flex items-baseline" style={{ gap: "0.5vw" }}>
        <p data-testid={`text-xp-${entry.rank}`} className="font-bold text-amber-400" style={{ fontSize: "2.5vh", lineHeight: 1 }}>
          {entry.xpThisMonth.toLocaleString("ru-RU")}
        </p>
        <p className="text-amber-200/50" style={{ fontSize: "1.6vh" }}>XP</p>
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div 
      className="h-screen bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950 flex flex-col overflow-hidden"
      style={{ padding: "1.5vh 2vw" }}
    >
      {/* Header */}
      <div className="text-center flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ height: "7vh", gap: "1vw" }}>
        <Trophy style={{ width: "4vh", height: "4vh" }} className="text-amber-400" />
        <h1 className="font-serif font-bold text-white whitespace-nowrap" style={{ fontSize: "3.5vh", lineHeight: 1 }}>
          Топ-10 покупателей
        </h1>
        <span className="text-amber-200/70 whitespace-nowrap" style={{ fontSize: "2.5vh" }}>• {capitalizedMonth}</span>
      </div>

      {leaderboard.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-amber-200/60" style={{ fontSize: "3vh" }}>
          Пока нет данных за этот месяц
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ gap: "1.5vh" }}>
          {/* Top 3 Section */}
          <div className="flex overflow-visible" style={{ height: "42vh", gap: "1.5vw" }}>
            {/* 1st Place - Hero */}
            {first && (
              <div className={getAnimationClass(first.userId)} style={{ flex: "1.2" }} data-testid="tile-rank-1">
                {renderHeroTile(first)}
              </div>
            )}
            {/* 2nd & 3rd Place */}
            <div className="flex flex-col overflow-visible" style={{ flex: "0.8", gap: "1.5vh" }}>
              {second && (
                <div className={getAnimationClass(second.userId)} style={{ flex: 1 }} data-testid="tile-rank-2">
                  {renderMediumTile(second, Medal)}
                </div>
              )}
              {third && (
                <div className={getAnimationClass(third.userId)} style={{ flex: 1 }} data-testid="tile-rank-3">
                  {renderMediumTile(third, Award)}
                </div>
              )}
            </div>
          </div>

          {/* 4-10 Section - Row 1: 4-5-6 (full width), Row 2: 7-8-9-10 (shorter) */}
          {rest.length > 0 && (() => {
            const row1 = rest.slice(0, 3); // места 4, 5, 6
            const row2 = rest.slice(3);    // места 7, 8, 9, 10
            
            return (
              <div className="flex-1 flex flex-col overflow-visible" style={{ gap: "1.5vh" }}>
                {/* Ряд 4-5-6: на всю ширину */}
                {row1.length > 0 && (
                  <div className="flex overflow-visible" style={{ flex: 1, gap: "1.5vw" }}>
                    {row1.map((entry) => (
                      <div key={entry.userId} className={getAnimationClass(entry.userId)} data-testid={`tile-rank-${entry.rank}`} style={{ flex: 1 }}>
                        {renderSmallTile(entry)}
                      </div>
                    ))}
                  </div>
                )}
                {/* Ряд 7-8-9-10: покороче, центрирован */}
                {row2.length > 0 && (
                  <div className="flex justify-center overflow-visible" style={{ flex: 1, gap: "1.5vw" }}>
                    {row2.map((entry) => (
                      <div key={entry.userId} className={getAnimationClass(entry.userId)} data-testid={`tile-rank-${entry.rank}`} style={{ flex: "0 0 22%" }}>
                        {renderSmallTile(entry)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
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

  if (isError && cachedSlides.length === 0) {
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
