import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ExampleComponent() {
  return (
    // Card with half width and centered on page
    <Card className="w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
      <CardHeader className="flex justify-between">
        <CardTitle>Tutor Advantage</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline">Sign In</Button>
          <Button variant="outline">Sign Up</Button>
        </div>
      </CardHeader>
      <CardContent>
        <form>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Enter your name" />
            </div>
            <Button>Submit</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}