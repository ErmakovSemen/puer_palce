import { Play } from "lucide-react";
import type { Media, Product } from "@shared/schema";

interface VideoCardProps {
  media: Media;
  product: Product;
  onClick: () => void;
}

export default function VideoCard({ media, product, onClick }: VideoCardProps) {
  const thumbnailSrc = media.thumbnail || (media.type === "image" ? media.source : null);

  return (
    <div
      className="group cursor-pointer"
      onClick={onClick}
      data-testid={`video-card-${media.id}`}
    >
      <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={media.title || product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <Play className="w-12 h-12 text-white/60" />
          </div>
        )}
        
        {media.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-transform group-hover:scale-110">
              <Play className="w-6 h-6 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
          <p className="font-serif font-medium text-white text-sm line-clamp-2">
            {media.title || product.name}
          </p>
          <p className="text-white/80 text-xs mt-1">
            {product.pricePerGram}₽/{product.pricingUnit === "piece" ? "шт" : "г"}
          </p>
        </div>
      </div>
    </div>
  );
}
