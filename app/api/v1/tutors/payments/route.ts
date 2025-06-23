import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/error-mapper"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const tutor = await prisma.tutor.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    })

    if (!tutor) {
      return NextResponse.json(
        { message: "Tutor not found" },
        { status: 404 }
      )
    }

    const payments = await prisma.payment.findMany({
      where: {
        enrollment: {
          class: {
            tutorId: tutor.id
          }
        }
      },
      include: {
        enrollment: {
          include: {
            class: {
              select: {
                name: true
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

    return NextResponse.json(payments)
  } catch (error) {
    return handleApiError(error)
  }
} 