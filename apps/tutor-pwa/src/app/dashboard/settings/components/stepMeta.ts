import { BookUser, BriefcaseBusiness, IdCard, Landmark, MapPin, ReceiptText, type LucideIcon } from "lucide-react";
import type { TileTone } from "@/components/app";
import type { VerificationField } from "../lib/verification";

/**
 * Tone tile per KYC document (patterns.md T8 upload rows; one tone per
 * meaning: identity blue, bank orange like payments, address teal, tax
 * amber, work permit purple). Presentation only.
 */
export function stepTile(field: VerificationField, isPassport: boolean): { icon: LucideIcon; tone: TileTone } {
  switch (field) {
    case "idCard":
      return { icon: isPassport ? BookUser : IdCard, tone: "blue" };
    case "bankBook":
      return { icon: Landmark, tone: "orange" };
    case "address":
      return { icon: MapPin, tone: "teal" };
    case "taxInfo":
      return { icon: ReceiptText, tone: "amber" };
    case "workPermit":
      return { icon: BriefcaseBusiness, tone: "purple" };
  }
}
