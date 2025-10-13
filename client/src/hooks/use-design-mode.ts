import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Settings } from "@shared/schema";

export function useDesignMode() {
  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/settings'],
  });

  useEffect(() => {
    const designMode = settings?.designMode || "classic";
    
    if (designMode === "minimalist") {
      document.body.classList.add("minimalist");
    } else {
      document.body.classList.remove("minimalist");
    }
  }, [settings?.designMode]);

  return settings?.designMode || "classic";
}
