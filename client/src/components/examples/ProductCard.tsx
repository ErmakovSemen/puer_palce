import ProductCard from '../ProductCard';
import teaImage from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";

export default function ProductCardExample() {
  return (
    <div className="max-w-sm">
      <ProductCard
        id={1}
        name="Шу Пуэр Императорский"
        price={1200}
        description="Выдержанный темный пуэр с глубоким землистым вкусом и нотками сухофруктов"
        image={teaImage}
        onAddToCart={(id) => console.log('Added to cart:', id)}
      />
    </div>
  );
}
