/**
 * Automatically determines tea type color based on name
 * Uses word boundary checks to avoid false matches
 */
export function getTeaTypeColor(teaTypeName: string): string {
  const normalized = teaTypeName.toLowerCase().trim();
  
  // Helper to check if word exists with boundary (Unicode-aware for Cyrillic)
  // Uses Unicode letter class \p{L} for proper word boundaries with Cyrillic
  const hasWord = (word: string) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'u').test(normalized);
  };
  
  // Priority order: Check most specific types first
  
  // Габа - emerald (изумрудный)
  if (hasWord('габа')) {
    return '#10b981'; // emerald-500
  }
  
  // Шу пуэр - brown (коричневый)
  if (normalized.includes('шу пуэр') || hasWord('шу')) {
    return '#92400e'; // brown-800
  }
  
  // Шен/Шэн пуэр - purple (фиолетовый)
  if (normalized.includes('шен пуэр') || normalized.includes('шэн пуэр') || 
      hasWord('шен') || hasWord('шэн')) {
    return '#a855f7'; // purple-500
  }
  
  // Чайная смола - dark blue (тёмно-синий)
  if (hasWord('смола') || normalized.includes('чайная смола')) {
    return '#1e3a8a'; // blue-900
  }
  
  // Светлый улун - light blue (голубой)
  if (normalized.includes('светлый улун')) {
    return '#38bdf8'; // sky-400
  }
  
  // Темный улун - blue (синий)
  if (normalized.includes('темный улун') || normalized.includes('тёмный улун')) {
    return '#3b82f6'; // blue-500
  }
  
  // Зеленый чай - green (word-based to avoid "Зелёненький")
  if (normalized.includes('зеленый чай') || hasWord('зеленый') || hasWord('зелёный')) {
    return '#22c55e'; // green-500
  }
  
  // Красный чай - red (only for explicit red tea, not regional names like "Краснодарский")
  if (normalized === 'красный' || normalized.includes('красный чай') || 
      normalized.includes('красный пуэр')) {
    return '#ef4444'; // red-500
  }
  
  // Черный чай - black (word-based to avoid "Черничный")
  if (normalized.includes('черный чай') || normalized.includes('чёрный чай') ||
      hasWord('черный') || hasWord('чёрный')) {
    return '#000000'; // black
  }
  
  // Травяные сборы - light yellow (светло-желтый)
  if (hasWord('травяной') || hasWord('травяная') || hasWord('травяные') || 
      hasWord('сбор') || normalized.includes('травян')) {
    return '#fef08a'; // yellow-200
  }
  
  // Default color for unknown types
  return '#f97316'; // orange-500 (оранжевый)
}
