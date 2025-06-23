import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/error-mapper"
import { AppError } from "@/lib/app-error"
import { HTTP_ERRORS } from "@/lib/errors"
// import { Role } from "@prisma/client"

export interface PaymentResponse {
  payments: {
    id: string
    amount: number
    currency: string
    status: string
    description: string | null
    receiptUrl: string | null
    createdAt: string
    enrollment: {
      className: string
      tutorName: string
      studentName: string
    }
  }[]
  classes: {
    id: string
    name: string
    tutor: {
      id: string
      name: string
    }
    students: {
      id: string
      name: string,
      status: string,
    }[]
  }[]
  totalRevenue: number
}
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) throw AppError.from(HTTP_ERRORS.UNAUTHORIZED)

    // Check if user is admin
    // const user = await prisma.user.findUnique({
    //   where: { id: session.user.id },
    //   select: { role: true }
    // })

    // if (!user || user.role !== Role.ADMIN) {
    //   return NextResponse.json(
    //     { message: "Forbidden" },
    //     { status: 403 }
    //   )
    // }

    const payments = await prisma.payment.findMany({
      include: {
        enrollment: {
          include: {
            class: {
              include: {
                tutor: {
                  include: {
                    user: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            },
            student: {
              include: {
                user: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    const classes = await prisma.class.findMany({
      include: {
        tutor: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        enrollments: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json({
      payments: payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        receiptUrl: payment.receiptUrl,
        createdAt: payment.createdAt.toISOString(),
        enrollment: {
          className: payment.enrollment.class.name,
          tutorName: payment.enrollment.class.tutor.user.name,
          studentName: payment.enrollment.student.user.name,
        }
      })),
      classes: classes.map(cls => ({
        id: cls.id,
        name: cls.name,
        tutor: {
          id: cls.tutor.user.id,
          name: cls.tutor.user.name
        },
        students: cls.enrollments.map(enrollment => ({
          id: enrollment.student.user.id,
          name: enrollment.student.user.name,
          status: enrollment.status,
        }))
      })),
      totalRevenue: payments.reduce((total, payment) => total + payment.amount, 0)
    })
  } catch (error) {
    return handleApiError(error)
  }
} 