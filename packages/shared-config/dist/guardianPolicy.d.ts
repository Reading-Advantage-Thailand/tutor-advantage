export declare const GUARDIAN_AGE_THRESHOLD = 18;
export declare const GUARDIAN_CONSENT_TYPE = "GUARDIAN_CONTACT_PAYMENT";
export declare const CONSENT_STATUS_GRANTED = "granted";
export declare function isUnderGuardianAge(dateOfBirth: Date, now?: Date): boolean;
export declare function requiresGuardianConsent(role: string, dateOfBirth: Date | null | undefined, hasGrantedConsent: boolean, now?: Date): boolean;
