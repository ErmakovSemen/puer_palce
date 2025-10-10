import ProductFilters from '../ProductFilters';
import { useState } from 'react';

export default function ProductFiltersExample() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  return (
    <div className="p-6">
      <ProductFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
      />
    </div>
  );
}
