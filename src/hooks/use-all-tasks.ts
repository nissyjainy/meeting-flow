import { useQuery } from "@tanstack/react-query";
import { listAllTasks } from "@/lib/meetings/api";

export const allTasksQueryKey = ["all-tasks"] as const;

export function useAllTasks() {
  return useQuery({
    queryKey: allTasksQueryKey,
    queryFn: listAllTasks,
  });
}
