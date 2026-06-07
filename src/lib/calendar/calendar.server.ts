import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  CALENDAR_EVENT_COLUMNS,
  mapCalendarEventRow,
  queryCalendarEventById,
  queryCalendarEvents,
} from "./api";
import type { CalendarEventRecord } from "./types";

export const listCalendarEventsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CalendarEventRecord[]> => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(authError.message);
    }

    if (!user) {
      throw new Error("You must be signed in to view calendar events.");
    }

    return queryCalendarEvents(supabase);
  },
);

const GetCalendarEventInput = z.object({
  id: z.string().uuid(),
});

export const getCalendarEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => GetCalendarEventInput.parse(data))
  .handler(async ({ data }): Promise<CalendarEventRecord | null> => {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(authError.message);
    }

    if (!user) {
      throw new Error("You must be signed in to view this scheduled meeting.");
    }

    return queryCalendarEventById(supabase, data.id);
  });

export { CALENDAR_EVENT_COLUMNS };
