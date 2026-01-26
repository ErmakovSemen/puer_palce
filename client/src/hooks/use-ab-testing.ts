import { useState, useEffect, useCallback, useMemo, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthContext } from "@/hooks/use-auth";
import type { Experiment } from "@shared/schema";

const DEVICE_ID_KEY = "ab_test_device_id";

interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, any>;
}

interface TestAssignment {
  testId: string;
  variantId: string;
  config: Record<string, any>;
}

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = "dev_" + crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

function djbx33xHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & 0xFFFFFFFF;
  }
  return Math.abs(hash);
}

function determineVariant(identifier: string, testId: string, variants: ExperimentVariant[]): ExperimentVariant {
  const combined = identifier + "-" + testId;
  const userNumber = djbx33xHash(combined) % 100;
  
  let accumulated = 0;
  for (const variant of variants) {
    accumulated += variant.weight;
    if (userNumber < accumulated) {
      return variant;
    }
  }
  
  return variants[variants.length - 1];
}

export function useAbTesting() {
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;
  const [deviceId] = useState(() => getOrCreateDeviceId());
  
  const identifier = useMemo(() => {
    return user?.id || deviceId;
  }, [user?.id, deviceId]);

  const { data: experiments = [] } = useQuery<Experiment[]>({
    queryKey: ["/api/experiments/active"],
    staleTime: 60000,
  });

  useEffect(() => {
    if (user?.id && deviceId && deviceId.startsWith("dev_")) {
      fetch("/api/device-user-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, userId: user.id }),
      }).catch(console.error);
    }
  }, [user?.id, deviceId]);

  const getTestVariant = useCallback((testId: string): TestAssignment | null => {
    const experiment = experiments.find(e => e.testId === testId && e.status === "active");
    
    if (!experiment) {
      return null;
    }

    let variants: ExperimentVariant[] = [];
    try {
      variants = JSON.parse(experiment.variants);
    } catch (e) {
      console.error("[A/B Testing] Failed to parse variants:", e);
      return null;
    }

    if (variants.length === 0) {
      return null;
    }

    const variant = determineVariant(identifier, testId, variants);
    
    return {
      testId,
      variantId: variant.id,
      config: variant.config,
    };
  }, [experiments, identifier]);

  const getAllTestAssignments = useCallback((): Record<string, TestAssignment> => {
    const assignments: Record<string, TestAssignment> = {};
    
    for (const experiment of experiments) {
      if (experiment.status !== "active") continue;
      
      const assignment = getTestVariant(experiment.testId);
      if (assignment) {
        assignments[experiment.testId] = assignment;
      }
    }
    
    return assignments;
  }, [experiments, getTestVariant]);

  const getPriceMultiplier = useCallback((testId?: string): number => {
    // If testId provided, use that specific experiment
    if (testId) {
      const assignment = getTestVariant(testId);
      if (!assignment) return 1;
      return assignment.config.price_multy ?? 1;
    }
    
    // Otherwise, find the first active experiment with price_multy in config
    for (const experiment of experiments) {
      if (experiment.status !== "active") continue;
      
      try {
        const variants: ExperimentVariant[] = JSON.parse(experiment.variants);
        const hasPriceMultiplier = variants.some(v => 
          v.config && typeof v.config.price_multy === "number"
        );
        if (hasPriceMultiplier) {
          const assignment = getTestVariant(experiment.testId);
          if (assignment && typeof assignment.config.price_multy === "number") {
            return assignment.config.price_multy;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return 1;
  }, [experiments, getTestVariant]);

  const applyPriceMultiplier = useCallback((basePrice: number, testId?: string): number => {
    const multiplier = getPriceMultiplier(testId);
    return Math.round(basePrice * multiplier);
  }, [getPriceMultiplier]);

  return {
    identifier,
    deviceId,
    userId: user?.id || null,
    experiments,
    getTestVariant,
    getAllTestAssignments,
    getPriceMultiplier,
    applyPriceMultiplier,
  };
}

export function useAbEvent() {
  const { identifier, userId, deviceId, getAllTestAssignments } = useAbTesting();

  const logEvent = useCallback(async (
    eventType: string,
    eventData: Record<string, any> = {}
  ) => {
    const testAssignments = getAllTestAssignments();
    
    try {
      await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          userIdentifier: identifier,
          userId: userId || null,
          deviceId: deviceId.startsWith("dev_") ? deviceId : null,
          testAssignments,
          eventData,
        }),
      });
    } catch (error) {
      console.error("[A/B Event] Failed to log event:", error);
    }
  }, [identifier, userId, deviceId, getAllTestAssignments]);

  return { logEvent };
}
