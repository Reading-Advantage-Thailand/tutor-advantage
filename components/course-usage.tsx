"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatDistanceToNow } from "date-fns"
import { EnrollmentStatus } from "@prisma/client"
import { ReEnrollButton } from "./re-enroll-button"

interface CourseUsageProps {
  enrollment: {
    id: string
    hoursUsed: number
    totalHours: number
    expiresAt: Date | null
    status: EnrollmentStatus
    class: {
      name: string
      pricePerHour: number
      packagePrice: number | null
    }
  }
}

export function CourseUsage({ enrollment }: CourseUsageProps) {
  const progress = (enrollment.hoursUsed / enrollment.totalHours) * 100
  const hoursRemaining = enrollment.totalHours - enrollment.hoursUsed
  const isExpired = enrollment.status === "EXPIRED"
  const isCompleted = enrollment.status === "COMPLETED"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{enrollment.class.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="flex justify-between text-sm">
          <span>Hours Remaining</span>
          <span>{hoursRemaining} / {enrollment.totalHours}</span>
        </div>

        {enrollment.expiresAt && (
          <div className="flex justify-between text-sm">
            <span>Expires</span>
            <span>{formatDistanceToNow(new Date(enrollment.expiresAt), { addSuffix: true })}</span>
          </div>
        )}

        {(isExpired || isCompleted) && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {isExpired ? "Enrollment expired" : "Course completed"}
            </div>
            <ReEnrollButton
              enrollmentId={enrollment.id}
              price={enrollment.class.packagePrice || enrollment.class.pricePerHour * enrollment.totalHours}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
} 