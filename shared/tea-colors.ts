/**
 * Automatically determines tea type color based on name
 * Uses simple string matching to avoid regex compatibility issues
 */
export function getTeaTypeColor(teaTypeName: string): string {
  const normalized = teaTypeName.toLowerCase().trim();
  
  // Helper to check if a word exists as a separate word (not part of another word)
  // Split by spaces and check if the word is in the array
  const hasWord = (word: string): boolean => {
    const words = normalized.split(/\s+/);
    return words.includes(word);
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
  
  // Зеленый чай - green
  if (normalized.includes('зеленый чай') || normalized.includes('зелёный чай') || 
      hasWord('зеленый') || hasWord('зелёный')) {
    return '#22c55e'; // green-500
  }
  
  // Красный чай - red (only for explicit red tea)
  if (normalized === 'красный' || normalized.includes('красный чай') || 
      normalized.includes('красный пуэр')) {
    return '#ef4444'; // red-500
  }
  
  // Черный чай - black (check as word to avoid "черничный")
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
