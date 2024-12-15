import React from "react"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UserCircle } from "lucide-react"

type ClassProps = {}

export default function Class({}: ClassProps) {
  return (
    <Card className="hover:shadow-lg hover:cursor-pointer">
      <CardHeader>
        <CardTitle>Class Title</CardTitle>
        <CardDescription>Class Description</CardDescription>
      </CardHeader>
      <CardFooter className="bg-blue-200 dark:bg-blue-900 pt-10 rounded-b-xl">
        <UserCircle className="w-6 h-6 mr-2 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">4 students</span>
      </CardFooter>
    </Card>
  )
}
