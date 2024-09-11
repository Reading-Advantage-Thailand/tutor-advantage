import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, Users, BarChart, Rocket } from 'lucide-react'

export const metadata = {
  title: 'วิธีการทำงานของ Tutor Advantage',
  description: 'เรียนรู้วิธีการทำงานของระบบ Tutor Advantage สำหรับนักเรียนและติวเตอร์',
}

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 to-white" lang="th">
      <header className="p-5 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold">Tutor Advantage</Link>
        <nav>
          <Button asChild>
            <Link href="/login">เข้าสู่ระบบ</Link>
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          วิธีการทำงานของ Tutor Advantage
        </h1>
        <p className="text-xl mb-8">
          ค้นพบวิธีที่ Tutor Advantage ช่วยให้การเรียนและการสอนภาษาอังกฤษมีประสิทธิภาพและน่าสนใจมากขึ้น
        </p>
      </section>

      {/* How It Works Tabs */}
      <section className="container mx-auto px-4 py-12">
        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="students">สำหรับนักเรียน</TabsTrigger>
            <TabsTrigger value="tutors">สำหรับติวเตอร์</TabsTrigger>
          </TabsList>
          <TabsContent value="students">
            <div className="mt-6">
              <h2 className="text-3xl font-bold mb-6">กระบวนการสำหรับนักเรียน</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { icon: <BookOpen className="w-12 h-12 text-blue-500" />, title: "ลงทะเบียนและทำแบบทดสอบ", description: "สมัครและทำแบบทดสอบเพื่อประเมินระดับภาษาอังกฤษของคุณ" },
                  { icon: <Users className="w-12 h-12 text-green-500" />, title: "จับคู่กับติวเตอร์", description: "เลือกติวเตอร์ที่เหมาะสมกับเป้าหมายและสไตล์การเรียนของคุณ" },
                  { icon: <Rocket className="w-12 h-12 text-purple-500" />, title: "เริ่มเรียน", description: "เข้าร่วมบทเรียนที่ปรับแต่งให้เหมาะกับคุณโดยใช้เครื่องมือ AI ของเรา" },
                  { icon: <BarChart className="w-12 h-12 text-red-500" />, title: "ติดตามความก้าวหน้า", description: "ดูความก้าวหน้าของคุณและรับข้อเสนอแนะอย่างต่อเนื่อง" },
                ].map((step, index) => (
                  <div key={index} className="text-center">
                    <div className="flex justify-center mb-4">{step.icon}</div>
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-12">
                <h3 className="text-2xl font-bold mb-4">รายละเอียดเพิ่มเติม</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>เรียนรู้ด้วยบทเรียนที่สร้างโดย AI ซึ่งปรับให้เหมาะกับระดับ CEFR ของคุณ</li>
                  <li>ใช้ระบบการอ่านแบบขยายที่มีบทความหลายพันบทความในทุกระดับ</li>
                  <li>ฝึกฝนทักษะการอ่าน การเขียน การพูด และการฟังในทุกบทเรียน</li>
                  <li>ใช้เครื่องมือโต้ตอบ เช่น การเล่นเสียง การแปลประโยค และเกมคำศัพท์</li>
                  <li>รับการสนับสนุนและคำแนะนำส่วนตัวจากติวเตอร์ของคุณ</li>
                </ul>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="tutors">
            <div className="mt-6">
              <h2 className="text-3xl font-bold mb-6">กระบวนการสำหรับติวเตอร์</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { icon: <Users className="w-12 h-12 text-blue-500" />, title: "สมัครและสัมภาษณ์", description: "ส่งใบสมัครและผ่านกระบวนการคัดเลือกของเรา" },
                  { icon: <BookOpen className="w-12 h-12 text-green-500" />, title: "ฝึกอบรม", description: "เข้าร่วมโปรแกรมการฝึกอบรมที่ครอบคลุมของเรา" },
                  { icon: <Rocket className="w-12 h-12 text-purple-500" />, title: "เริ่มสอน", description: "เริ่มสอนนักเรียนโดยใช้เครื่องมือและทรัพยากรของเรา" },
                  { icon: <BarChart className="w-12 h-12 text-red-500" />, title: "เติบโตและพัฒนา", description: "สร้างเครือข่ายและพัฒนาทักษะของคุณอย่างต่อเนื่อง" },
                ].map((step, index) => (
                  <div key={index} className="text-center">
                    <div className="flex justify-center mb-4">{step.icon}</div>
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-12">
                <h3 className="text-2xl font-bold mb-4">รายละเอียดเพิ่มเติม</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>ใช้แผนการสอนที่สร้างโดย AI และปรับแต่งได้สำหรับนักเรียนแต่ละคน</li>
                  <li>เข้าถึงทรัพยากรการสอนที่หลากหลาย รวมถึงบทความ แบบฝึกหัด และเครื่องมือโต้ตอบ</li>
                  <li>ติดตามความก้าวหน้าของนักเรียนและให้ข้อเสนอแนะที่มีประสิทธิภาพ</li>
                  <li>เข้าร่วมโปรแกรมการพัฒนาวิชาชีพอย่างต่อเนื่อง</li>
                  <li>สร้างและจัดการเครือข่ายติวเตอร์ของคุณเองผ่านโครงสร้าง MLM ที่มีจริยธรรม</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* AI and Technology Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">เทคโนโลยี AI ของเรา</h2>
          <div className="max-w-3xl mx-auto">
            <p className="mb-4">
              ระบบ AI ของ Tutor Advantage ช่วยปฏิวัติวิธีการเรียนและการสอนภาษาอังกฤษ:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>สร้างบทความและเนื้อหาการเรียนรู้ที่ปรับให้เหมาะกับระดับ CEFR ของผู้เรียนแต่ละคน</li>
              <li>ใช้ระบบการอ่านแบบขยายที่มีบทความมากกว่า 10,000 บทความในทุกระดับ</li>
              <li>สร้างคำถามความเข้าใจและกิจกรรมฝึกภาษาที่หลากหลาย</li>
              <li>ปรับแต่งแผนการเรียนและบทเรียนให้เหมาะกับความต้องการของผู้เรียนแต่ละคน</li>
              <li>วิเคราะห์ความก้าวหน้าของผู้เรียนและให้ข้อเสนอแนะที่เป็นประโยชน์</li>
            </ul>
            <p>
              เทคโนโลยีของเราทำงานร่วมกับติวเตอร์ที่มีคุณภาพสูงเพื่อมอบประสบการณ์การเรียนรู้ที่มีประสิทธิภาพและน่าสนใจ
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-green-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">พร้อมที่จะเริ่มต้นการเดินทางกับ Tutor Advantage แล้วหรือยัง?</h2>
          <p className="mb-8">ไม่ว่าคุณจะเป็นนักเรียนที่ต้องการพัฒนาทักษะภาษาอังกฤษ หรือติวเตอร์ที่ต้องการสร้างอาชีพที่น่าตื่นเต้น เรามีทุกอย่างที่คุณต้องการ</p>
          <div className="flex justify-center space-x-4">
            <Button asChild size="lg">
              <Link href="/for-students">เริ่มต้นเรียน</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/for-tutors">สมัครเป็นติวเตอร์</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
