"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface EnrollmentStatusProps {
  enrollment: {
    id: string;
    status: "PENDING" | "ACTIVE" | "COMPLETED" | "EXPIRED";
    hoursUsed: number;
    hoursRemaining: number;
    totalHours: number;
    expiresAt: Date;
    class: {
      id: string;
      name: string;
      pricePerHour: number;
      packagePrice: number | null;
    };
  };
}

export function EnrollmentStatus({ enrollment }: EnrollmentStatusProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleReEnroll = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/enrollments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classId: enrollment.class.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to re-enroll");
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error("Error re-enrolling:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const progress = (enrollment.hoursUsed / enrollment.totalHours) * 100;
  const status = enrollment.status === "ACTIVE" ? "active" :
    enrollment.status === "EXPIRED" ? "expired" :
      enrollment.status === "COMPLETED" ? "completed" : "pending";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{enrollment.class.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Status</span>
            <span className={`text-sm font-medium ${status === "active" ? "text-green-600" :
              status === "expired" ? "text-red-600" :
                status === "completed" ? "text-blue-600" :
                  "text-yellow-600"
              }`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          <div className="flex justify-between text-sm">
            <span>Hours Remaining</span>
            <span>{enrollment.hoursRemaining} / {enrollment.totalHours}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span>Expires</span>
            <span>{formatDistanceToNow(new Date(enrollment.expiresAt), { addSuffix: true })}</span>
          </div>

          {(enrollment.status === "EXPIRED" || enrollment.status === "COMPLETED") && (
            <Button
              onClick={handleReEnroll}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Re-enroll"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 