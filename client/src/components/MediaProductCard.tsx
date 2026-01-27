import { useRef, useEffect, useState } from "react";
import { Play } from "lucide-react";
import type { Product, Media } from "@shared/schema";

interface MediaProductCardProps {
  product: Product;
  media: Media | undefined;
  thumbnailSrc: string | null;
  hasMedia: boolean;
  isVideo: boolean;
  onMediaClick: () => void;
  onProductClick: () => void;
}

export default function MediaProductCard({
  product,
  media,
  thumbnailSrc,
  hasMedia,
  isVideo,
  onMediaClick,
  onProductClick,
}: MediaProductCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Intersection Observer для автозапуска видео
  useEffect(() => {
    if (!isVideo || !videoRef.current || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.9;
          setIsIntersecting(isVisible);

          if (isVisible && videoRef.current && !isPlaying) {
            // Видео полностью видно - запускаем автоплей
            videoRef.current.play().catch((err) => {
              console.log("[MediaCard] Autoplay prevented:", err);
            });
            setIsPlaying(true);
          } else if (!isVisible && videoRef.current && isPlaying) {
            // Видео не видно - останавливаем
            videoRef.current.pause();
            setIsPlaying(false);
          }
        });
      },
      {
        threshold: [0, 0.5, 0.9, 1.0], // Проверяем разные уровни видимости
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isVideo, isPlaying]);

  // Обработка клика на видео
  const handleClick = () => {
    if (hasMedia && isVideo && videoRef.current) {
      // Если видео уже играет, открываем MediaViewer
      if (isPlaying) {
        onMediaClick();
      } else {
        // Иначе запускаем видео
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else if (hasMedia) {
      onMediaClick();
    } else {
      onProductClick();
    }
  };

  return (
    <div
      ref={containerRef}
      className="group cursor-pointer h-full"
      onClick={handleClick}
      data-testid={`media-product-card-${product.id}`}
    >
      <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden">
        {isVideo && media?.source ? (
          <>
            <video
              ref={videoRef}
              src={media.source}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              playsInline
              loop
              muted
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-transform group-hover:scale-110">
                  <Play className="w-6 h-6 text-white fill-white ml-1" />
                </div>
              </div>
            )}
          </>
        ) : thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <Play className="w-12 h-12 text-white/60" />
          </div>
        )}

        {(isVideo && !isPlaying) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-transform group-hover:scale-110">
              <Play className="w-6 h-6 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
          <p className="font-serif font-medium text-white text-sm line-clamp-2">
            {product.name}
          </p>
          <p className="text-white/80 text-xs mt-1">
            {product.pricePerGram}₽/{product.pricingUnit === "piece" ? "шт" : "г"}
          </p>
        </div>
      </div>
    </div>
  );
}
