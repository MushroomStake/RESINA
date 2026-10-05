import { createAdminClient } from "./supabase/admin";
import { inferAlertLevel, type SensorSnapshot } from "./sensor-alerts";
export type SensorAlertDispatchResult = {
    ok: boolean;
    alertLevel: ReturnType<typeof inferAlertLevel>;
    alertLevelName: string;
    alertLevelBadge: string;
    sent: number;
    failed: number;
    skipped?: boolean;
    disabled?: boolean;
    reason?: string;
    previewMessage?: string;
    sourceTable: string | null;
    recordId: string;
};
export declare function dispatchSensorAlertFromSnapshot(adminSupabase: ReturnType<typeof createAdminClient>, snapshot: SensorSnapshot): Promise<SensorAlertDispatchResult>;
//# sourceMappingURL=sensor-alert-dispatch.d.ts.map