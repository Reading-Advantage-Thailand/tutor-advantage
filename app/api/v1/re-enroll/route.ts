import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { withStudentRole } from "@/lib/route-handlers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EnrollmentStatus, User } from "@prisma/client";
import { env } from "@/env.mjs";
import { AppError } from "@/lib/app-error";
import { HTTP_ERRORS } from "@/lib/errors";

const reEnrollSchema = z.object({
  enrollmentId: z.string(),
});

export const POST = withStudentRole(async (req: NextRequest, user: User) => {
  const body = await req.json();
  const payload = reEnrollSchema.parse(body);

  // Get the existing enrollment with class details
  const existingEnrollment = await prisma.enrollment.findUnique({
    where: { id: payload.enrollmentId },
    include: {
      class: {
        include: {
          tutor: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!existingEnrollment) throw AppError.from(HTTP_ERRORS.NOT_FOUND)

  // Check if the enrollment is expired or completed
  if (existingEnrollment.status !== EnrollmentStatus.EXPIRED) throw AppError.from(HTTP_ERRORS.BAD_REQUEST);

  // Calculate new expiration date (6 months from now)
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  // Calculate amount
  const amount = existingEnrollment.class.packagePrice ||
    existingEnrollment.class.pricePerHour * existingEnrollment.class.defaultHours;

  // Create new enrollment record
  const newEnrollment = await prisma.enrollment.create({
    data: {
      classId: existingEnrollment.classId,
      studentId: existingEnrollment.studentId,
      amount,
      status: EnrollmentStatus.PENDING,
      expiresAt,
      totalHours: existingEnrollment.class.defaultHours,
      hoursUsed: 0,
    },
  });

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "promptpay"],
    locale: "th",
    client_reference_id: newEnrollment.id,
    customer_email: user.email ?? "",
    line_items: [
      {
        price_data: {
          currency: "thb",
          product_data: {
            images: ["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnPdud_AmDXuM63D4VZCsi7EjN3lujKro8mQ&s"],
            name: existingEnrollment.class.name,
            description: `คอร์สเรียนจาก ${existingEnrollment.class.tutor.user.name} (${existingEnrollment.class.defaultHours} ชั่วโมง) - การลงทะเบียนใหม่`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${env.NEXT_PUBLIC_APP_URL}/student/classes/${existingEnrollment.classId}?success=true`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/student-invitation?canceled=true`,
    metadata: {
      enrollmentId: newEnrollment.id,
    },
  });

  return NextResponse.json({ url: session.url });
}); 