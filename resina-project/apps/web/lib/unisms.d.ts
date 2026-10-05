type UnismsSendOptions = {
    phoneNumber: string;
    message: string;
};
type UnismsBlastOptions = {
    phoneNumbers: string[];
    message: string;
    metadata?: Record<string, unknown>;
};
export declare function isUnismsDisabled(): boolean;
export declare function sendUnismsSms(options: UnismsSendOptions): Promise<{
    messageId: string | null;
}>;
export declare function sendUnismsBlast(options: UnismsBlastOptions): Promise<{
    blastId: string | null;
}>;
export {};
//# sourceMappingURL=unisms.d.ts.map