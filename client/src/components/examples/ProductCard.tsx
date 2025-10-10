import ProductCard from '../ProductCard';
import teaImage from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";

export default function ProductCardExample() {
  return (
    <div className="max-w-xs">
      <ProductCard
        id={1}
        name="Шу Пуэр Императорский"
        pricePerGram={12}
        description="Выдержанный темный пуэр с глубоким землистым вкусом и нотками сухофруктов"
        image={teaImage}
        onAddToCart={(id) => console.log('Added to cart:', id)}
      />
    </div>
  );
}
