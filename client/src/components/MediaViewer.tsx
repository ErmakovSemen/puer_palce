import { useState, useRef, useEffect, useCallback } from "react";
import { X, ShoppingCart, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Media, Product } from "@shared/schema";

interface FeaturedMedia extends Media {
  product: Product;
}

interface MediaViewerProps {
  allMedia: FeaturedMedia[];
  initialMediaId: number;
  onClose: () => void;
  onAddToCart: (productId: number, quantity: number) => void;
}

export default function MediaViewer({ 
  allMedia, 
  initialMediaId, 
  onClose, 
  onAddToCart 
}: MediaViewerProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = allMedia.findIndex(m => m.id === initialMediaId);
    return idx >= 0 ? idx : 0;
  });
  
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchDelta, setTouchDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentMedia = allMedia[currentIndex];
  const currentProduct = currentMedia?.product;

  const goToNext = useCallback(() => {
    if (currentIndex < allMedia.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, allMedia.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleAddToCart = () => {
    if (!currentProduct) return;
    
    const defaultQty = currentProduct.defaultQuantity 
      ? parseInt(currentProduct.defaultQuantity) 
      : (currentProduct.availableQuantities?.[0] ? parseInt(currentProduct.availableQuantities[0]) : 50);
    
    onAddToCart(currentProduct.id, defaultQty);
    toast({ 
      title: "Добавлено в корзину",
      description: `${currentProduct.name} (${defaultQty}${currentProduct.pricingUnit === "piece" ? " шт" : "г"})`
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    setTouchDelta({ x: 0, y: 0 });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const deltaX = e.touches[0].clientX - touchStart.x;
    const deltaY = e.touches[0].clientY - touchStart.y;
    setTouchDelta({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!touchStart) return;
    
    const threshold = 50;
    const absX = Math.abs(touchDelta.x);
    const absY = Math.abs(touchDelta.y);
    
    if (absX > absY && absX > threshold) {
      if (touchDelta.x < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    } else if (absY > threshold) {
      if (touchDelta.y > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    
    setTouchStart(null);
    setTouchDelta({ x: 0, y: 0 });
    setIsDragging(false);
  };

  useEffect(() => {
    if (videoRef.current && currentMedia?.type === "video") {
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, currentMedia?.type]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goToNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goToPrev();
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToNext, goToPrev]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!currentMedia || !currentProduct) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-testid="media-viewer"
    >
      <div className="flex-1 relative overflow-hidden">
        {currentMedia.type === "video" ? (
          <video
            ref={videoRef}
            src={currentMedia.source}
            className="w-full h-full object-contain"
            controls
            playsInline
            autoPlay
            loop
            data-testid="media-video"
          />
        ) : (
          <img
            src={currentMedia.source}
            alt={currentMedia.title || currentProduct.name}
            className="w-full h-full object-contain"
            data-testid="media-image"
          />
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white z-10"
          data-testid="button-close-viewer"
        >
          <X className="w-5 h-5" />
        </button>

        {currentIndex > 0 && (
          <button
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hidden md:flex"
            data-testid="button-prev"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {currentIndex < allMedia.length - 1 && (
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hidden md:flex"
            data-testid="button-next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {currentIndex < allMedia.length - 1 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 animate-bounce md:hidden">
            <ChevronDown className="w-8 h-8 text-white/50" />
          </div>
        )}

        <div className="absolute bottom-20 left-0 right-0 px-4">
          <div className="flex justify-center gap-1">
            {allMedia.slice(Math.max(0, currentIndex - 3), Math.min(allMedia.length, currentIndex + 4)).map((m, i) => {
              const actualIndex = Math.max(0, currentIndex - 3) + i;
              return (
                <div
                  key={m.id}
                  className={`h-1 rounded-full transition-all ${
                    actualIndex === currentIndex 
                      ? "w-6 bg-white" 
                      : "w-1 bg-white/40"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-black/90 backdrop-blur-sm px-4 py-3 flex items-center gap-3 safe-bottom">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white text-sm truncate">
            {currentProduct.name}
          </p>
          <p className="text-white/60 text-xs">
            {currentProduct.pricePerGram}₽/{currentProduct.pricingUnit === "piece" ? "шт" : "г"}
          </p>
        </div>
        
        <Button
          onClick={handleAddToCart}
          className="bg-white text-black hover:bg-white/90 flex-shrink-0"
          data-testid="button-add-to-cart"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          В корзину
        </Button>
      </div>
    </div>
  );
}
