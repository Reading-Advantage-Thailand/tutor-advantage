import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface RightToForgetCardProps {
  userId: string;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  handleDelete: () => void;
  isDeleting: boolean;
}

export function RightToForgetCard({
  userId,
  showDeleteConfirm,
  setShowDeleteConfirm,
  deleteConfirmText,
  setDeleteConfirmText,
  handleDelete,
  isDeleting
}: RightToForgetCardProps) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-card border-red-500/20">
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
          <Trash2 className="h-4 w-4" />
          Right to be Forgotten
        </CardTitle>
        <CardDescription>
          ลบข้อมูลส่วนตัว (PII) ตามคำขอของเจ้าของข้อมูล —
          ข้อมูลธุรกรรมยังคงอยู่เพื่อการตรวจสอบบัญชี
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {!showDeleteConfirm ? (
          <Button
            variant="destructive"
            className="rounded-xl font-bold"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            เริ่มกระบวนการลบข้อมูล
          </Button>
        ) : (
          <div className="space-y-4 p-4 border border-red-500/30 rounded-2xl bg-red-500/5">
            <Alert
              variant="destructive"
              className="bg-transparent border-none p-0"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>ยืนยันการทำ Data Anonymization</AlertTitle>
              <AlertDescription>
                การกระทำนี้ไม่สามารถย้อนกลับได้ พิมพ์{" "}
                <span className="font-mono font-bold">{userId}</span>{" "}
                เพื่อยืนยัน
              </AlertDescription>
            </Alert>
            <Input
              placeholder="พิมพ์ User ID เพื่อยืนยัน"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="border-red-500/40 focus-visible:ring-red-500 font-mono"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
              >
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl font-bold"
                disabled={deleteConfirmText !== userId || isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                ยืนยันการลบข้อมูล
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
