export type AlertLevelKey = "normal" | "critical" | "evacuation" | "spilling";
export type SensorSnapshot = {
    waterLevel: number | null;
    statusText: string | null;
    updatedAt: string | null;
    sourceTable: string | null;
    recordId: string;
};
type AlertLevelInfo = {
    title: string;
    badge: string;
    rangeLabel: string;
    englishDescription: string;
    tagalogDescription: string;
    smsEnglishDescription: string;
    smsTagalogDescription: string;
};
export declare const ALERT_LEVELS: Record<AlertLevelKey, AlertLevelInfo>;
export declare function inferAlertLevel(snapshot: Pick<SensorSnapshot, "waterLevel" | "statusText">): AlertLevelKey;
export declare function isAlertLevelCriticalOrAbove(level: AlertLevelKey): boolean;
export declare function formatWaterLevel(level: number | null): string;
export declare function formatAlertLevelName(level: AlertLevelKey): string;
export declare function formatAlertLevelBadge(level: AlertLevelKey): string;
export declare function buildSensorAlertMessage(snapshot: SensorSnapshot, opts?: {
    location?: string;
}): string;
export declare function buildSensorAlertMessages(snapshot: SensorSnapshot, opts?: {
    location?: string;
}): {
    tagalog: string;
    english: string;
};
export {};
//# sourceMappingURL=sensor-alerts.d.ts.map