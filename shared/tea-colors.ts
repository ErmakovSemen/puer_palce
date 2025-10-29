/**
 * Automatically determines tea type color based on name
 * Uses simple includes() checks only
 */
export function getTeaTypeColor(teaTypeName: string): string {
  const normalized = teaTypeName.toLowerCase().trim();
  
  // Priority order: Check most specific types first
  
  // Габа - emerald (изумрудный)
  if (normalized.includes('габа')) {
    return '#10b981';
  }
  
  // Шу пуэр - brown (коричневый)
  if (normalized.includes('шу')) {
    return '#92400e';
  }
  
  // Шен/Шэн пуэр - purple (фиолетовый)
  if (normalized.includes('шен') || normalized.includes('шэн')) {
    return '#a855f7';
  }
  
  // Чайная смола - dark blue (тёмно-синий)
  if (normalized.includes('смола')) {
    return '#1e3a8a';
  }
  
  // Светлый улун - light blue (голубой)
  if (normalized.includes('светлый улун')) {
    return '#38bdf8';
  }
  
  // Темный улун - blue (синий)
  if (normalized.includes('темный улун') || normalized.includes('тёмный улун')) {
    return '#3b82f6';
  }
  
  // Зеленый чай - green
  if (normalized.includes('зелен')) {
    return '#22c55e';
  }
  
  // Красный чай - red
  if (normalized.includes('красн')) {
    return '#ef4444';
  }
  
  // Черный чай - black
  if (normalized.includes('черн') || normalized.includes('чёрн')) {
    return '#000000';
  }
  
  // Травяные сборы - light yellow (светло-желтый)
  if (normalized.includes('травян') || normalized.includes('сбор')) {
    return '#fef08a';
  }
  
  // Default color for unknown types
  return '#f97316';
}
