import { getSupabaseEnv } from "./env";
import { formatSupabaseSchemaError, isSupabaseSchemaCacheError } from "./project-ref";

export function wrapSupabaseError(error: { message: string }, context: string): Error {
  if (!isSupabaseSchemaCacheError(error.message)) {
    return new Error(error.message);
  }

  let projectUrl: string | undefined;
  try {
    projectUrl = getSupabaseEnv().url;
  } catch {
    projectUrl = undefined;
  }

  return new Error(formatSupabaseSchemaError(error.message, context, projectUrl));
}
