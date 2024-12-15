import React from "react"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pencil, Share } from "lucide-react"
import { Button } from "@/components/ui/button"

type TutorClassProps = {}

export default function TutorClassPage({}: TutorClassProps) {
  return (
    <div>
      <Card className="bg-muted flex flex-row items-center justify-between">
        <CardHeader>
          <CardTitle>Class Title</CardTitle>
          <CardDescription>Class Description</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline">
            <Pencil className="w-4 h-4 mr-2" />
            Edit Class
          </Button>
        </CardFooter>
      </Card>
      <Tabs defaultValue="forum" className="mt-5">
        <TabsList>
          <TabsTrigger value="forum">Forum</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="forum">
          disscussion forum here
        </TabsContent>
        <TabsContent value="people">Change your password here.</TabsContent>
      </Tabs>
    </div>
  )
}
