type SecurityEnvironment = Record<string, string | undefined>;
export declare function getJwtSecret(env?: SecurityEnvironment): string;
export declare function getAllowedOrigins(env?: SecurityEnvironment): string[];
export declare function isOriginAllowed(origin: string | undefined, allowedOrigins: string[], env?: SecurityEnvironment): boolean;
export declare function areDevRoutesEnabled(env?: SecurityEnvironment): boolean;
export declare function assertProductionSecurityConfig(env?: SecurityEnvironment): void;
export {};
