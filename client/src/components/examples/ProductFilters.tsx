import ProductFilters from '../ProductFilters';
import { useState } from 'react';

export default function ProductFiltersExample() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);

  return (
    <div className="p-6">
      <ProductFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedTypes={selectedTypes}
        onTypesChange={setSelectedTypes}
        selectedEffects={selectedEffects}
        onEffectsChange={setSelectedEffects}
        onQuizClick={() => console.log('Quiz clicked')}
      />
    </div>
  );
}
