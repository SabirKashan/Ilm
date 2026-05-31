import { createServiceSupabaseClient } from "./supabase-server";

type LogParams = {
  schoolId: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
};

/**
 * Fire-and-forget activity log. Uses service role so it bypasses RLS.
 * Call without await in API routes.
 */
export async function logActivity(params: LogParams) {
  try {
    const supabase = createServiceSupabaseClient();
    await supabase.from("activity_logs").insert({
      school_id:    params.schoolId,
      user_id:      params.userId ?? null,
      user_name:    params.userName ?? null,
      action:       params.action,
      entity_type:  params.entityType ?? null,
      entity_id:    params.entityId ?? null,
      entity_label: params.entityLabel ?? null,
    });
  } catch {
    // Never throw — logging is non-critical
  }
}
