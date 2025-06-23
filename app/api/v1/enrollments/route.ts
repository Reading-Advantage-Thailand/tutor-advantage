import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { withStudentRole } from "@/lib/route-handlers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env.mjs";
import { User } from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { HTTP_ERRORS } from "@/lib/errors";

const enrollmentSchema = z.object({
  classId: z.string(),
  autoRenew: z.boolean().optional().default(false),
});

export const POST = withStudentRole(async (req: NextRequest, user: User) => {
  const body = await req.json();
  const payload = enrollmentSchema.parse(body);

  // Get the class and student
  const [classData, student] = await Promise.all([
    prisma.class.findUnique({
      where: { id: payload.classId },
      include: {
        tutor: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.student.findUnique({
      where: { userId: user.id },
    }),
  ]);

  if (!classData || !student) throw AppError.from(HTTP_ERRORS.NOT_FOUND);

  // Check if student is already enrolled
  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      classId_studentId: {
        classId: classData.id,
        studentId: student.id,
      },
    },
  });

  if (existingEnrollment) {
    console.log("status", existingEnrollment.status);
    if (existingEnrollment.status === "ACTIVE") {
      throw AppError.from(HTTP_ERRORS.BAD_REQUEST);
    } else if (existingEnrollment.status === "PENDING") {
      // If there's a pending enrollment, create a new checkout session
      const amount = classData.packagePrice || classData.pricePerHour * classData.defaultHours;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "promptpay"],
        locale: "th",
        client_reference_id: existingEnrollment.id,
        customer_email: user.email ?? "",
        line_items: [
          {
            price_data: {
              currency: "thb",
              product_data: {
                images: ["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnPdud_AmDXuM63D4VZCsi7EjN3lujKro8mQ&s"],
                name: classData.name,
                description: `สอนโดย ${classData.tutor.user.name} (${classData.defaultHours} ชั่วโมง)`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${env.NEXT_PUBLIC_APP_URL}/student/classes/${classData.id}?success=true`,
        cancel_url: `${env.NEXT_PUBLIC_APP_URL}/student-invitation?canceled=true`,
        metadata: {
          enrollmentId: existingEnrollment.id,
        },
      });

      return NextResponse.json({ url: session.url });
    }
  }

  // Calculate expiration date (6 months from now)
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  // Calculate amount
  const amount = classData.packagePrice || classData.pricePerHour * classData.defaultHours;

  // Create enrollment record
  const enrollment = await prisma.enrollment.create({
    data: {
      classId: classData.id,
      studentId: student.id,
      amount,
      status: "PENDING",
      paymentStatus: "PENDING",
      totalHours: classData.defaultHours,
      hoursRemaining: classData.defaultHours,
      expiresAt,
      autoRenew: payload.autoRenew,
    },
  });

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "promptpay"],
    locale: "th",
    client_reference_id: enrollment.id,
    customer_email: user.email ?? "",
    line_items: [
      {
        price_data: {
          currency: "thb",
          product_data: {
            images: ["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnPdud_AmDXuM63D4VZCsi7EjN3lujKro8mQ&s"],
            name: classData.name,
            description: `สอนโดย ${classData.tutor.user.name} (${classData.defaultHours} ชั่วโมง)`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${env.NEXT_PUBLIC_APP_URL}/student/classes/${classData.id}?success=true`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/student-invitation?canceled=true`,
    metadata: {
      enrollmentId: enrollment.id,
    },
  });

  console.log("status", enrollment.status);

  return NextResponse.json({ url: session.url });
}); 