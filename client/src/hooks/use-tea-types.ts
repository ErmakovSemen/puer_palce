import { useQuery } from "@tanstack/react-query";
import type { TeaType } from "@shared/schema";

export function useTeaTypes() {
  return useQuery<TeaType[]>({
    queryKey: ["/api/tea-types"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes since tea types don't change often
  });
}
