"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSENT_STATUS_GRANTED = exports.GUARDIAN_CONSENT_TYPE = exports.GUARDIAN_AGE_THRESHOLD = void 0;
exports.isUnderGuardianAge = isUnderGuardianAge;
exports.requiresGuardianConsent = requiresGuardianConsent;
exports.GUARDIAN_AGE_THRESHOLD = 18;
exports.GUARDIAN_CONSENT_TYPE = "GUARDIAN_CONTACT_PAYMENT";
exports.CONSENT_STATUS_GRANTED = "granted";
function isUnderGuardianAge(dateOfBirth, now = new Date()) {
    const nowIct = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const todayIct = Date.UTC(nowIct.getUTCFullYear(), nowIct.getUTCMonth(), nowIct.getUTCDate());
    const adultDate = Date.UTC(dateOfBirth.getUTCFullYear() + exports.GUARDIAN_AGE_THRESHOLD, dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate());
    return adultDate > todayIct;
}
function requiresGuardianConsent(role, dateOfBirth, hasGrantedConsent, now = new Date()) {
    if (role !== "STUDENT")
        return false;
    if (!dateOfBirth)
        return true;
    return isUnderGuardianAge(dateOfBirth, now) && !hasGrantedConsent;
}
