import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { computeExecutionHealthBundle } from "@/lib/execution-health/execution-health";
import { listAllTaskStatusEvents, listAllTasks } from "@/lib/meetings/api";

export const executionHealthQueryKey = ["execution-health"] as const;

export function useExecutionHealth() {
  const query = useQuery({
    queryKey: executionHealthQueryKey,
    queryFn: async () => {
      const [tasks, events] = await Promise.all([listAllTasks(), listAllTaskStatusEvents()]);
      return { tasks, events };
    },
    staleTime: 30_000,
  });

  const bundle = useMemo(() => {
    if (!query.data) return null;
    return computeExecutionHealthBundle(query.data.tasks, query.data.events);
  }, [query.data]);

  return {
    bundle,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
