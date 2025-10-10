import { Button } from "@/components/ui/button";
import heroImage from "@assets/stock_images/traditional_chinese__1662580a.jpg";

export default function Hero() {
  const scrollToCatalog = () => {
    const catalogElement = document.getElementById('catalog');
    catalogElement?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-[60vh] md:min-h-[75vh] flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
      
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="font-serif text-5xl md:text-7xl font-bold text-white mb-6" data-testid="text-hero-title">
          Пуэр Паб
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed" data-testid="text-hero-subtitle">
          Откройте для себя древние традиции настоящего китайского чая Пуэр
        </p>
        <Button 
          size="lg"
          onClick={scrollToCatalog}
          className="bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
          data-testid="button-explore-catalog"
        >
          Исследовать коллекцию
        </Button>
      </div>
    </div>
  );
}
