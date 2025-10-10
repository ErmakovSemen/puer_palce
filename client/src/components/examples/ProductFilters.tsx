import ProductFilters from '../ProductFilters';
import { useState } from 'react';

export default function ProductFiltersExample() {
  const [searchTerm, setSearchTerm] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 3000]);
  const [selectedType, setSelectedType] = useState("all");

  return (
    <div className="max-w-sm p-6">
      <ProductFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
      />
    </div>
  );
}
