
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              <div className="h-6 w-1/2 mx-auto bg-muted rounded animate-pulse" />
            </CardTitle>
            <CardDescription>
              <div className="h-4 w-3/4 mx-auto bg-muted rounded animate-pulse" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                <div className="w-full h-auto flex flex-col items-start text-start p-4 gap-2 border rounded-lg animate-pulse bg-muted/40">
                  <div className="p-2 rounded bg-muted h-10 w-10 mb-2" />
                  <div className="h-5 w-1/3 bg-muted rounded mb-1" />
                  <div className="h-4 w-2/3 bg-muted rounded" />
                </div>
                <div className="w-full h-auto flex flex-col items-start text-start p-4 gap-2 border rounded-lg animate-pulse bg-muted/40">
                  <div className="p-2 rounded bg-muted h-10 w-10 mb-2" />
                  <div className="h-5 w-1/3 bg-muted rounded mb-1" />
                  <div className="h-4 w-2/3 bg-muted rounded" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}