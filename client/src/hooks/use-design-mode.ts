import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Settings } from "@shared/schema";

export function useDesignMode() {
  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/settings'],
  });

  useEffect(() => {
    const designMode = settings?.designMode || "classic";
    
    // Remove both theme classes first
    document.body.classList.remove("minimalist", "classic");
    
    // Add the current theme class
    document.body.classList.add(designMode);
  }, [settings?.designMode]);

  return settings?.designMode || "classic";
}
