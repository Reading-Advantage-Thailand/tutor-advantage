import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { CheckCircle, BookOpen, Star, Trophy } from 'lucide-react'
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"

export const metadata = {
  title: 'Tutor Advantage - สำหรับนักเรียน',
  description: 'เรียนภาษาอังกฤษด้วยระบบ AI และติวเตอร์ส่วนตัว ออกแบบมาเพื่อนักเรียนโดยเฉพาะ',
}

export default function ForStudents() {
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
          ยกระดับทักษะภาษาอังกฤษของคุณด้วย AI และติวเตอร์ส่วนตัว
        </h1>
        <p className="text-xl mb-8">
          เรียนรู้แบบเข้าใจง่าย เร็วขึ้น และมีประสิทธิภาพมากขึ้นด้วย Tutor Advantage
        </p>
        <Button asChild size="lg">
          <Link href="/sign-up">เริ่มต้นฟรีวันนี้</Link>
        </Button>
      </section>

      {/* Key Benefits Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">ทำไมนักเรียนถึงชอบ Tutor Advantage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <BookOpen className="w-12 h-12 text-blue-500" />, title: "เนื้อหาที่ปรับตามระดับ", description: "AI ของเราสร้างบทเรียนที่เหมาะกับระดับความสามารถของคุณ" },
              { icon: <Star className="w-12 h-12 text-yellow-500" />, title: "ติวเตอร์คุณภาพสูง", description: "เรียนกับติวเตอร์ที่ผ่านการคัดเลือกและฝึกอบรมมาอย่างดี" },
              { icon: <CheckCircle className="w-12 h-12 text-green-500" />, title: "ความยืดหยุ่นสูง", description: "เรียนได้ทุกที่ ทุกเวลา ตามตารางของคุณ" },
              { icon: <Trophy className="w-12 h-12 text-purple-500" />, title: "ติดตามความก้าวหน้า", description: "ดูพัฒนาการของคุณแบบเรียลไทม์และรับข้อเสนอแนะที่เป็นประโยชน์" },
            ].map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">{benefit.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                <p>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">วิธีการเรียนกับ Tutor Advantage</h2>
          <div className="flex flex-col md:flex-row justify-between items-start">
            {[
              { step: "ทำแบบทดสอบวัดระดับ", description: "เริ่มต้นด้วยการทำแบบทดสอบเพื่อประเมินระดับภาษาอังกฤษของคุณ" },
              { step: "รับแผนการเรียนส่วนตัว", description: "AI ของเราจะสร้างแผนการเรียนที่เหมาะสมกับระดับและเป้าหมายของคุณ" },
              { step: "จับคู่กับติวเตอร์", description: "เลือกติวเตอร์ที่เหมาะกับสไตล์การเรียนของคุณ" },
              { step: "เริ่มเรียนและพัฒนา", description: "เรียนรู้ผ่านบทเรียนที่หลากหลายและติดตามความก้าวหน้าของคุณ" },
            ].map((item, index) => (
              <div key={index} className="text-center mb-8 md:mb-0 flex-1">
                <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.step}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Lesson Plan */}
      <section className="bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">ตัวอย่างแผนการเรียน</h2>
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
            <h3 className="text-2xl font-semibold mb-4">บทเรียน 55 นาที</h3>
            <ul className="space-y-2">
              <li>• อุ่นเครื่องและทบทวนความรู้เดิม (3 นาที)</li>
              <li>• ฟังผู้อื่นอ่าน (5 นาที)</li>
              <li>• อ่านด้วยตนเอง (7 นาที)</li>
              <li>• ฝึกฝนคำศัพท์ (10 นาที)</li>
              <li>• ฟังผู้อื่นอ่านอีกครั้ง (5 นาที)</li>
              <li>• อ่านให้ผู้อื่นฟัง (8 นาที)</li>
              <li>• ฝึกเขียนและพูด (12 นาที)</li>
              <li>• อ่านเพิ่มเติม (4 นาที)</li>
              <li>• สรุปบทเรียน (1 นาที)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">คำถามที่พบบ่อย</h2>
          <Accordion type="single" collapsible className="w-full max-w-2xl mx-auto">
            <AccordionItem value="item-1">
              <AccordionTrigger>Tutor Advantage เหมาะกับระดับภาษาอังกฤษแบบไหน?</AccordionTrigger>
              <AccordionContent>
                Tutor Advantage เหมาะสำหรับผู้เรียนทุกระดับ ตั้งแต่ระดับเริ่มต้น (A1) ไปจนถึงระดับสูง (C2) ระบบ AI ของเราจะปรับเนื้อหาให้เหมาะกับระดับของคุณโดยเฉพาะ
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>ฉันจะเรียนได้บ่อยแค่ไหน?</AccordionTrigger>
              <AccordionContent>
                คุณสามารถกำหนดความถี่ในการเรียนได้ตามต้องการ ไม่ว่าจะเป็นทุกวัน สัปดาห์ละครั้ง หรือตามตารางที่คุณสะดวก ระบบของเราจะปรับให้เข้ากับตารางของคุณ
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>มีการรับประกันผลการเรียนหรือไม่?</AccordionTrigger>
              <AccordionContent>
                เราไม่สามารถรับประกันผลลัพธ์ที่เฉพาะเจาะจงได้ เนื่องจากความก้าวหน้าขึ้นอยู่กับหลายปัจจัย อย่างไรก็ตาม นักเรียนส่วนใหญ่ของเราเห็นการพัฒนาที่มีนัยสำคัญในทักษะภาษาอังกฤษของพวกเขาเมื่อทำตามแผนการเรียนอย่างสม่ำเสมอ
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-blue-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">พร้อมที่จะยกระดับภาษาอังกฤษของคุณแล้วหรือยัง?</h2>
          <p className="mb-8">เริ่มต้นการเดินทางสู่ความเชี่ยวชาญภาษาอังกฤษของคุณวันนี้ ด้วย Tutor Advantage</p>
          <Button asChild size="lg">
            <Link href="/sign-up">ลงทะเบียนฟรี</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
