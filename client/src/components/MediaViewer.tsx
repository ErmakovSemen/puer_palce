import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, ShoppingCart, ChevronLeft, ChevronRight, ChevronDown, Info } from "lucide-react";
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
  
  const productMediaGroups = useMemo(() => {
    const groups: { productId: number; media: FeaturedMedia[] }[] = [];
    const productOrder: number[] = [];
    
    for (const media of allMedia) {
      if (!productOrder.includes(media.productId)) {
        productOrder.push(media.productId);
        groups.push({ productId: media.productId, media: [] });
      }
      const group = groups.find(g => g.productId === media.productId);
      if (group) {
        group.media.push(media);
      }
    }
    return groups;
  }, [allMedia]);

  const [currentProductIndex, setCurrentProductIndex] = useState(() => {
    const initialMedia = allMedia.find(m => m.id === initialMediaId);
    if (!initialMedia) return 0;
    const idx = productMediaGroups.findIndex(g => g.productId === initialMedia.productId);
    return idx >= 0 ? idx : 0;
  });

  const [currentMediaIndexInProduct, setCurrentMediaIndexInProduct] = useState(() => {
    const initialMedia = allMedia.find(m => m.id === initialMediaId);
    if (!initialMedia) return 0;
    const group = productMediaGroups.find(g => g.productId === initialMedia.productId);
    if (!group) return 0;
    const idx = group.media.findIndex(m => m.id === initialMediaId);
    return idx >= 0 ? idx : 0;
  });
  
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchDelta, setTouchDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentProductGroup = productMediaGroups[currentProductIndex];
  const currentMedia = currentProductGroup?.media[currentMediaIndexInProduct];
  const currentProduct = currentMedia?.product;

  const goToNextProduct = useCallback(() => {
    if (currentProductIndex < productMediaGroups.length - 1) {
      setCurrentProductIndex(prev => prev + 1);
      setCurrentMediaIndexInProduct(0);
    }
  }, [currentProductIndex, productMediaGroups.length]);

  const goToPrevProduct = useCallback(() => {
    if (currentProductIndex > 0) {
      setCurrentProductIndex(prev => prev - 1);
      setCurrentMediaIndexInProduct(0);
    }
  }, [currentProductIndex]);

  const goToNextMedia = useCallback(() => {
    if (!currentProductGroup) return;
    if (currentMediaIndexInProduct < currentProductGroup.media.length - 1) {
      setCurrentMediaIndexInProduct(prev => prev + 1);
    } else {
      goToNextProduct();
    }
  }, [currentMediaIndexInProduct, currentProductGroup, goToNextProduct]);

  const goToPrevMedia = useCallback(() => {
    if (currentMediaIndexInProduct > 0) {
      setCurrentMediaIndexInProduct(prev => prev - 1);
    } else {
      goToPrevProduct();
    }
  }, [currentMediaIndexInProduct, goToPrevProduct]);

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
    
    if (absY > absX && absY > threshold) {
      // Свайп вниз/вверх - переключение между товарами
      if (touchDelta.y < 0) {
        goToNextProduct();
      } else {
        goToPrevProduct();
      }
      setShowInfo(false);
    } else if (absX > threshold) {
      // Свайп вправо/влево - переключение между медиа или показ информации
      if (touchDelta.x < 0) {
        // Свайп влево - следующее медиа
        goToNextMedia();
        setShowInfo(false);
      } else {
        // Свайп вправо - показать информацию о товаре
        setShowInfo(true);
      }
    } else {
      // Небольшое движение - переключить показ controls
      if (!showControls && !showInfo) {
        setShowControls(true);
        setTimeout(() => setShowControls(false), 3000);
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
    // Сбрасываем показ информации при смене товара
    setShowInfo(false);
  }, [currentProductIndex, currentMediaIndexInProduct, currentMedia?.type]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showInfo) {
          setShowInfo(false);
        } else {
          onClose();
        }
      }
      if (e.key === "ArrowDown") goToNextProduct();
      if (e.key === "ArrowUp") goToPrevProduct();
      if (e.key === "ArrowRight") {
        if (showInfo) {
          setShowInfo(false);
        } else {
          goToNextMedia();
        }
      }
      if (e.key === "ArrowLeft") goToPrevMedia();
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToNextProduct, goToPrevProduct, goToNextMedia, goToPrevMedia, showInfo]);

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
        {showInfo ? (
          // Показываем информацию о товаре
          <div 
            className="w-full h-full overflow-y-auto bg-black/95 p-6"
            onClick={() => setShowInfo(false)}
          >
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold text-white">{currentProduct.name}</h2>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo(false);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {currentProduct.description && (
                <p className="text-white/90 leading-relaxed">{currentProduct.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-sm">Тип чая</p>
                  <p className="text-white font-medium">{currentProduct.teaType}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Цена</p>
                  <p className="text-white font-medium">
                    {currentProduct.pricePerGram}₽/{currentProduct.pricingUnit === "piece" ? "шт" : "г"}
                  </p>
                </div>
              </div>
              
              {currentProduct.effects && currentProduct.effects.length > 0 && (
                <div>
                  <p className="text-white/60 text-sm mb-2">Эффекты</p>
                  <div className="flex flex-wrap gap-2">
                    {currentProduct.effects.map((effect, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-white/10 text-white rounded-full text-sm"
                      >
                        {effect}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {currentProduct.images && currentProduct.images.length > 0 && (
                <div>
                  <p className="text-white/60 text-sm mb-3">Другие фото</p>
                  <div className="grid grid-cols-2 gap-3">
                    {currentProduct.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`${currentProduct.name} ${idx + 1}`}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}
              
              <div className="pt-4">
                <Button
                  onClick={handleAddToCart}
                  className="w-full bg-white text-black hover:bg-white/90"
                  size="lg"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Добавить в корзину
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {currentMedia.type === "video" ? (
              <video
                ref={videoRef}
                src={currentMedia.source}
                className="w-full h-full object-contain"
                controls={showControls}
                playsInline
                autoPlay
                loop
                muted={false}
                data-testid="media-video"
                onClick={() => {
                  setShowControls(!showControls);
                  if (!showControls) {
                    setTimeout(() => setShowControls(false), 3000);
                  }
                }}
              />
            ) : (
              <img
                src={currentMedia.source}
                alt={currentMedia.title || currentProduct.name}
                className="w-full h-full object-contain"
                data-testid="media-image"
                onClick={() => {
                  setShowControls(!showControls);
                  if (!showControls) {
                    setTimeout(() => setShowControls(false), 3000);
                  }
                }}
              />
            )}

            <button
              onClick={onClose}
              className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white z-10 transition-opacity ${
                showControls ? "opacity-100" : "opacity-0"
              }`}
              data-testid="button-close-viewer"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Индикатор свайпа вправо для информации */}
            {currentProductIndex < productMediaGroups.length - 1 && (
              <div className="absolute top-4 left-4 z-10">
                <div className="bg-black/50 backdrop-blur-sm rounded-full p-2 text-white/80">
                  <Info className="w-5 h-5" />
                </div>
              </div>
            )}
          </>
        )}

        {currentProductIndex > 0 && (
          <button
            onClick={goToPrevProduct}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hidden md:flex"
            data-testid="button-prev"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {currentProductIndex < productMediaGroups.length - 1 && (
          <button
            onClick={goToNextProduct}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hidden md:flex"
            data-testid="button-next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {currentProductIndex < productMediaGroups.length - 1 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 animate-bounce md:hidden">
            <ChevronDown className="w-8 h-8 text-white/50" />
          </div>
        )}

        <div className="absolute bottom-20 left-0 right-0 px-4">
          <div className="flex justify-center gap-1">
            {productMediaGroups.slice(Math.max(0, currentProductIndex - 3), Math.min(productMediaGroups.length, currentProductIndex + 4)).map((g, i) => {
              const actualIndex = Math.max(0, currentProductIndex - 3) + i;
              return (
                <div
                  key={g.productId}
                  className={`h-1 rounded-full transition-all ${
                    actualIndex === currentProductIndex 
                      ? "w-6 bg-white" 
                      : "w-1 bg-white/40"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {!showInfo && (
        <div className={`bg-black/90 backdrop-blur-sm px-4 py-3 flex items-center gap-3 safe-bottom transition-opacity ${
          showControls ? "opacity-100" : "opacity-0"
        }`}>
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
      )}
      
      {/* Минималистичная кнопка добавления в корзину (всегда видна когда не показывается информация) */}
      {!showInfo && !showControls && (
        <div className="absolute bottom-6 right-6 z-10">
          <Button
            onClick={handleAddToCart}
            className="bg-white text-black hover:bg-white/90 rounded-full w-14 h-14 p-0 shadow-lg"
            data-testid="button-add-to-cart-minimal"
          >
            <ShoppingCart className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
