export const getTeaTypeColor = (teaType: string): string => {
  const colors: Record<string, string> = {
    "Шу Пуэр": "bg-amber-700 text-white border-amber-800",
    "Шен Пуэр": "bg-emerald-600 text-white border-emerald-700",
    "Габа": "bg-purple-600 text-white border-purple-700",
    "Красный": "bg-red-600 text-white border-red-700",
    "Выдержанный": "bg-yellow-700 text-white border-yellow-800",
  };
  
  return colors[teaType] || "bg-secondary text-secondary-foreground border-secondary-border";
};
