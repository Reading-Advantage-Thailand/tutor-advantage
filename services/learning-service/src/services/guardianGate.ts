import { prisma } from "@tutor-advantage/database";
import {
  CONSENT_STATUS_GRANTED,
  GUARDIAN_CONSENT_TYPE,
  isUnderGuardianAge,
} from "@tutor-advantage/shared-config";

type GateClient = Pick<typeof prisma, "user" | "userConsent">;

export type GuardianBlock = "DATE_OF_BIRTH_REQUIRED" | "GUARDIAN_CONSENT_REQUIRED";

/**
 * Same rule as the payment gate (finance getPaymentGuardianGate): a student
 * needs a date of birth, and an under-18 needs recorded guardian consent,
 * before an enrollment can turn ACTIVE (which also opens chat with the tutor).
 */
export async function getGuardianBlock(
  userId: string,
  client: GateClient = prisma,
): Promise<GuardianBlock | null> {
  const student = await client.user.findUnique({
    where: { userId },
    select: { dateOfBirth: true },
  });
  if (!student?.dateOfBirth) return "DATE_OF_BIRTH_REQUIRED";
  if (!isUnderGuardianAge(student.dateOfBirth)) return null;

  const consent = await client.userConsent.findFirst({
    where: {
      userId,
      consentType: GUARDIAN_CONSENT_TYPE,
      status: CONSENT_STATUS_GRANTED,
    },
    select: { userConsentId: true },
  });
  return consent ? null : "GUARDIAN_CONSENT_REQUIRED";
}

export function guardianBlockResponse(code: GuardianBlock) {
  return code === "DATE_OF_BIRTH_REQUIRED"
    ? { status: 400, message: "Date of birth is required before joining a class" }
    : { status: 403, message: "Guardian consent is required before joining a class" };
}
