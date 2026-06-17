import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, XCircle, CheckCircle2 } from "lucide-react";
import { ConsentLog } from "../types";

interface PdpaConsentCardProps {
  role: string;
  guardianSetup: boolean;
  consentLogs: ConsentLog[];
}

export function PdpaConsentCard({ role, guardianSetup, consentLogs }: PdpaConsentCardProps) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-card">
      <CardHeader className="pb-3 px-5 pt-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4" />
          PDPA & Consent
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-3">
        {role === "STUDENT" && (
          <div
            className={`flex items-start gap-2 p-3 rounded-xl border text-xs font-medium ${guardianSetup ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "border-amber-500/30 bg-amber-500/5 text-amber-700"}`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {guardianSetup
                ? "ผู้ปกครองยืนยันตัวตนและให้ความยินยอมแล้ว"
                : "รอการยืนยันจากผู้ปกครอง"}
            </span>
          </div>
        )}

        {consentLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            ยังไม่มีประวัติ Consent
          </p>
        ) : (
          <div className="space-y-2">
            {consentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/40 text-xs"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {log.type}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {new Date(log.timestamp).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={`border-none text-[10px] ${
                    log.status === "REVOKED"
                      ? "bg-red-500/10 text-red-600"
                      : "bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  {log.status === "REVOKED" ? (
                    <><XCircle className="h-3 w-3 mr-1" />เพิกถอนแล้ว</>
                  ) : (
                    <><CheckCircle2 className="h-3 w-3 mr-1" />ยอมรับแล้ว</>
                  )}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
