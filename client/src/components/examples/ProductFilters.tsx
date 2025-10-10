import ProductFilters from '../ProductFilters';
import { useState } from 'react';

export default function ProductFiltersExample() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);

  return (
    <div className="p-6">
      <ProductFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedEffects={selectedEffects}
        onEffectsChange={setSelectedEffects}
      />
    </div>
  );
}
