// Цветовая палитра для 11 типов пуэра и чая
// Каждый тип имеет уникальный цвет для визуального различия

export interface TeaTypeColor {
  bg: string;  // Цвет фона (hex)
  text: string; // Цвет текста (hex)
}

export const TEA_TYPE_COLORS: Record<string, TeaTypeColor> = {
  "Шу Пуэр": {
    bg: "#8B4513", // Saddle Brown - тёмно-коричневый
    text: "#FFFFFF"
  },
  "Шэн Пуэр": {
    bg: "#228B22", // Forest Green - лесной зелёный
    text: "#FFFFFF"
  },
  "Шен Пуэр": {
    bg: "#228B22", // Forest Green - лесной зелёный (альтернативное написание)
    text: "#FFFFFF"
  },
  "Белый Пуэр": {
    bg: "#D3D3D3", // Light Gray - светло-серый
    text: "#000000"
  },
  "Красный Пуэр": {
    bg: "#DC143C", // Crimson - малиновый
    text: "#FFFFFF"
  },
  "Чёрный Пуэр": {
    bg: "#2F4F4F", // Dark Slate Gray - тёмный серо-синий
    text: "#FFFFFF"
  },
  "Улун": {
    bg: "#FF8C00", // Dark Orange - тёмно-оранжевый
    text: "#FFFFFF"
  },
  "Красный чай": {
    bg: "#B22222", // Fire Brick - кирпично-красный
    text: "#FFFFFF"
  },
  "Зелёный чай": {
    bg: "#32CD32", // Lime Green - лаймовый зелёный
    text: "#000000"
  },
  "Жёлтый чай": {
    bg: "#FFD700", // Gold - золотой
    text: "#000000"
  },
  "Габа": {
    bg: "#9370DB", // Medium Purple - средне-фиолетовый
    text: "#FFFFFF"
  },
  "Выдержанный": {
    bg: "#CD853F", // Peru - коричнево-рыжий
    text: "#000000"
  }
};

// Функция для получения цвета фона по типу чая
export function getTeaTypeColor(teaType: string): string {
  const colorData = TEA_TYPE_COLORS[teaType];
  return colorData ? colorData.bg : "#6B7280"; // По умолчанию серый
}

// Функция для получения полной информации о цвете (фон + текст)
export function getTeaTypeColorData(teaType: string): TeaTypeColor {
  return TEA_TYPE_COLORS[teaType] || { bg: "#6B7280", text: "#FFFFFF" };
}

// Функция для получения inline стилей для Badge
export function getTeaTypeBadgeStyle(teaType: string): React.CSSProperties {
  const colorData = getTeaTypeColorData(teaType);
  return {
    backgroundColor: colorData.bg,
    color: colorData.text,
    border: '3px double black'
  };
}

// Динамическая функция для получения стилей бейджа из tea types загруженных из API
// Включает fallback на hardcoded цвета если тип не найден в базе
export function getTeaTypeBadgeStyleDynamic(
  teaType: string, 
  teaTypes: Array<{ name: string; backgroundColor: string; textColor: string }> | undefined
): React.CSSProperties {
  // Пытаемся найти тип в загруженных из API
  const foundType = teaTypes?.find(t => t.name === teaType);
  
  if (foundType) {
    return {
      backgroundColor: foundType.backgroundColor,
      color: foundType.textColor,
      border: '3px double black'
    };
  }
  
  // Fallback на hardcoded цвета если не найдено в API
  return getTeaTypeBadgeStyle(teaType);
}
