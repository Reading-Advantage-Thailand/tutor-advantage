"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { handleClientError } from "@/lib/error-mapper"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconSelector } from "@/components/icon-selector"

const TEACHING_LEVELS = [
  {
    id: "A1",
    title: "A1 - เนื้อหาการสอนพื้นฐาน",
    description: "เนื้อหาการสอนพื้นฐานสำหรับนักเรียนที่เริ่มต้นเรียนรู้",
  },
  {
    id: "A2",
    title: "A2 - เนื้อหาการสอนขั้นสูง",
    description: "เนื้อหาการสอนสำหรับนักเรียนที่มีพื้นฐานแล้ว",
  },
  {
    id: "B1",
    title: "B1 - เนื้อหาการสอนสำหรับผู้เรียนที่มีพื้นฐาน",
    description: "สำหรับผู้เรียนที่ต้องการพัฒนาทักษะต่อจากระดับพื้นฐาน",
  },
  {
    id: "B2",
    title: "B2 - เนื้อหาการสอนสำหรับผู้เรียนที่มีพื้นฐานดี",
    description: "เหมาะสำหรับผู้เรียนที่มีพื้นฐานดีและต้องการเรียนขั้นสูง",
  },
  {
    id: "C1",
    title: "C1 - เนื้อหาการสอนสำหรับผู้เรียนที่มีพื้นฐานสูง",
    description: "เหมาะสำหรับผู้เรียนที่มีพื้นฐานสูงและต้องการเรียนต่อยอด",
  },
  {
    id: "C2",
    title: "C2 - เนื้อหาการสอนสำหรับผู้เรียนที่มีพื้นฐานสูงมาก",
    description: "เหมาะสำหรับผู้เรียนที่ต้องการความท้าทายระดับสูงสุด",
  },
]

export default function ClassCreationForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("")
  const [pricePerHour, setPricePerHour] = useState("")
  const [defaultHours, setDefaultHours] = useState("")
  const [packagePrice, setPackagePrice] = useState("")
  const [selectedLevels, setSelectedLevels] = useState<string[]>(["A1"])
  const [isLoading, setIsLoading] = useState(false)

  const toggleLevel = (id: string) => {
    setSelectedLevels((prev) =>
      prev.includes(id)
        ? prev.filter((level) => level !== id)
        : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Validate required fields
    if (!name || !selectedIcon || !pricePerHour || !defaultHours) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน")
      setIsLoading(false)
      return
    }

    // Parse numbers and validate
    const pricePerHourNum = parseFloat(pricePerHour)
    const defaultHoursNum = parseFloat(defaultHours)
    const packagePriceNum = packagePrice ? parseFloat(packagePrice) : null

    if (isNaN(pricePerHourNum) || pricePerHourNum < 0) {
      toast.error("กรุณากรอกราคาต่อชั่วโมงให้ถูกต้อง")
      setIsLoading(false)
      return
    }

    if (isNaN(defaultHoursNum) || defaultHoursNum < 1) {
      toast.error("กรุณากรอกจำนวนชั่วโมงให้ถูกต้อง")
      setIsLoading(false)
      return
    }

    if (packagePrice && (isNaN(packagePriceNum!) || packagePriceNum! < 0)) {
      toast.error("กรุณากรอกราคาแพ็คเกจให้ถูกต้อง")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/v1/tutors/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          icon: selectedIcon,
          pricePerHour: pricePerHourNum,
          defaultHours: defaultHoursNum,
          packagePrice: packagePriceNum,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      toast.success("สร้างชั้นเรียนสำเร็จ")
      router.push(`/tutor/classes/${data.id}`)
    } catch (error) {
      toast.error(handleClientError(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">สร้างห้องเรียน</CardTitle>
        <CardDescription>
          กรอกข้อมูลห้องเรียนเพื่อสร้างชั้นเรียนใหม่
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-6">
          <div className="grid gap-3">
            <Label htmlFor="class-name">ชื่อห้องเรียน</Label>
            <Input
              id="class-name"
              type="text"
              placeholder="ชื่อ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
            />

            <Label htmlFor="class-icon">ไอคอนห้องเรียน</Label>
            <IconSelector onSelect={setSelectedIcon} value={selectedIcon} />

            <Label htmlFor="price-per-hour">ราคาต่อชั่วโมง (บาท)</Label>
            <Input
              id="price-per-hour"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={pricePerHour}
              onChange={(e) => setPricePerHour(e.target.value)}
              disabled={isLoading}
              required
            />

            <Label htmlFor="default-hours">จำนวนชั่วโมงเริ่มต้น</Label>
            <Input
              id="default-hours"
              type="number"
              min="1"
              step="1"
              placeholder="1"
              value={defaultHours}
              onChange={(e) => setDefaultHours(e.target.value)}
              disabled={isLoading}
              required
            />

            <Label htmlFor="package-price">ราคาแพ็คเกจ (บาท) - ไม่บังคับ</Label>
            <Input
              id="package-price"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={packagePrice}
              onChange={(e) => setPackagePrice(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-3">
            <Label>เนื้อหาการสอน</Label>
            {TEACHING_LEVELS.map((level) => (
              <Label
                key={level.id}
                className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950"
              >
                <Checkbox
                  checked={selectedLevels.includes(level.id)}
                  onCheckedChange={() => toggleLevel(level.id)}
                  className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                />
                <div className="grid gap-1.5 font-normal">
                  <p className="text-sm leading-none font-medium">{level.title}</p>
                  <p className="text-muted-foreground text-sm">{level.description}</p>
                </div>
              </Label>
            ))}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !name || !selectedIcon || !pricePerHour || !defaultHours}
          >
            {isLoading ? "กำลังสร้าง..." : "สร้างห้องเรียน"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
