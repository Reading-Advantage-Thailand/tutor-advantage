import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

// Recursive function to get all descendants (children, sub-children, etc.) of a user
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAllDescendants(parentId: string): Promise<any> {
  // Find all children for the given parentId
  const children = await db.user.findMany({
    where: { parentId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })
  console.log("children", children)

  // For each child, recursively get their children (sub-children)
  const descendants = await Promise.all(
    children.map(async (child) => {
      const subChildren = await getAllDescendants(child.id)
      return { ...child, children: subChildren }
    })
  )

  return descendants
}


export async function GET(req: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return new Response(null, { status: 401 }) // Unauthorized if no user is found
    }

    const url = new URL(req.url)
    const email = url.searchParams.get("email") // Extract email from query params

    if (!email) {
      return new Response("Email parameter is missing", { status: 400 })
    }

    // Find the user with the given email
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    })

    if (!user) {
      return new Response("User not found", { status: 404 })
    }

    // Get all descendants (children, sub-children, etc.) of this user
    const descendants = await getAllDescendants(user.id)
    console.log("descendants", descendants)

    // Return the user and their descendants
    return NextResponse.json({ user, descendants })
  } catch (error) {
    console.error(error)
    return new Response("Internal Server Error", { status: 500 })
  }
}