import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { TrendingUp, Users, BookOpen, Award } from 'lucide-react'
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"

export const metadata = {
  title: 'Tutor Advantage - สำหรับติวเตอร์',
  description: 'เติบโตในอาชีพติวเตอร์ด้วยระบบ AI และโครงสร้าง MLM ที่มีจริยธรรม',
}

export default function ForTutors() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 to-white" lang="th">
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
          พัฒนาอาชีพติวเตอร์ของคุณด้วย Tutor Advantage
        </h1>
        <p className="text-xl mb-8">
          เข้าร่วมกับเราในการปฏิวัติการสอนภาษาอังกฤษด้วยเทคโนโลยี AI และโอกาสในการเติบโตที่ไม่มีขีดจำกัด
        </p>
        <Button asChild size="lg">
          <Link href="/tutor-sign-up">สมัครเป็นติวเตอร์</Link>
        </Button>
      </section>

      {/* Key Benefits Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">ทำไมติวเตอร์ถึงเลือก Tutor Advantage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <TrendingUp className="w-12 h-12 text-green-500" />, title: "รายได้ที่เติบโต", description: "โครงสร้าง MLM ที่มีจริยธรรมช่วยให้คุณสร้างรายได้ที่เพิ่มขึ้นตามเครือข่ายของคุณ" },
              { icon: <Users className="w-12 h-12 text-blue-500" />, title: "สร้างเครือข่าย", description: "สร้างและพัฒนาทีมติวเตอร์ของคุณเองเพื่อขยายธุรกิจ" },
              { icon: <BookOpen className="w-12 h-12 text-purple-500" />, title: "เครื่องมือ AI ทันสมัย", description: "ใช้เทคโนโลยี AI ของเราเพื่อสร้างเนื้อหาการสอนที่มีคุณภาพสูง" },
              { icon: <Award className="w-12 h-12 text-yellow-500" />, title: "การพัฒนาวิชาชีพ", description: "เข้าถึงโปรแกรมการฝึกอบรมและการพัฒนาทักษะอย่างต่อเนื่อง" },
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

      {/* MLM Structure Section */}
      <section className="py-20 bg-gray-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">โครงสร้าง MLM ที่มีจริยธรรม</h2>
          <div className="max-w-3xl mx-auto">
            <p className="mb-6">ที่ Tutor Advantage เราเชื่อในการสร้างโอกาสที่ยุติธรรมและโปร่งใสสำหรับติวเตอร์ทุกคน:</p>
            <ul className="list-disc pl-6 space-y-4">
              <li>ไม่มีการเพิ่มปริมาณการขายอย่างไม่เป็นธรรม เนื่องจากเราเน้นที่การให้บริการคุณภาพสูง</li>
              <li>ผลตอบแทนจากการรับสมัครติวเตอร์ใหม่อยู่ในระดับที่เหมาะสม เพื่อไม่ให้เกิดการชักชวนที่ก้าวร้าว</li>
              <li>ความแตกต่างของอัตราค่าตอบแทนระหว่างติวเตอร์ระดับสูงสุดและระดับเริ่มต้นอยู่ที่ 20% เท่านั้น (70% vs 50%)</li>
              <li>บริษัทเก็บไว้ประมาณ 30% สำหรับค่าดำเนินการ เทคโนโลยี และค่าใช้จ่ายอื่นๆ</li>
            </ul>
          </div>
        </div>
      </section>

      {/* How to Join Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">วิธีการเข้าร่วมเป็นติวเตอร์</h2>
          <div className="flex flex-col md:flex-row justify-between items-start">
            {[
              { step: "สมัคร", description: "กรอกแบบฟอร์มสมัครออนไลน์และส่งประวัติของคุณ" },
              { step: "สัมภาษณ์", description: "ผ่านการสัมภาษณ์และการประเมินทักษะการสอน" },
              { step: "ฝึกอบรม", description: "เข้าร่วมโปรแกรมการฝึกอบรมเข้มข้นของเรา" },
              { step: "เริ่มสอน", description: "เริ่มต้นการสอนและสร้างเครือข่ายของคุณ" },
            ].map((item, index) => (
              <div key={index} className="text-center mb-8 md:mb-0 flex-1">
                <div className="w-16 h-16 bg-purple-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.step}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">คำถามที่พบบ่อย</h2>
          <Accordion type="single" collapsible className="w-full max-w-2xl mx-auto">
            <AccordionItem value="item-1">
              <AccordionTrigger>ฉันจำเป็นต้องมีประสบการณ์การสอนมาก่อนหรือไม่?</AccordionTrigger>
              <AccordionContent>
                แม้ว่าประสบการณ์การสอนจะเป็นข้อได้เปรียบ แต่ไม่ใช่ข้อบังคับ เรามองหาผู้ที่มีความรู้ภาษาอังกฤษที่แข็งแกร่ง มีทักษะการสื่อสารที่ดี และมีใจรักในการสอน เราจะจัดการฝึกอบรมที่จำเป็นให้กับติวเตอร์ทุกคน
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>ฉันจะได้รับการสนับสนุนอะไรบ้างในฐานะติวเตอร์?</AccordionTrigger>
              <AccordionContent>
                คุณจะได้รับการฝึกอบรมเริ่มต้นอย่างครอบคลุม การพัฒนาวิชาชีพอย่างต่อเนื่อง เครื่องมือการสอนที่ขับเคลื่อนด้วย AI การสนับสนุนด้านเทคนิค และโอกาสในการสร้างเครือข่าย นอกจากนี้ คุณจะได้รับการจับคู่กับเมนเตอร์ที่มีประสบการณ์เพื่อแนะนำคุณตลอดการเดินทางในฐานะติวเตอร์
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>ฉันสามารถกำหนดตารางสอนของตัวเองได้หรือไม่?</AccordionTrigger>
              <AccordionContent>
                ได้ คุณมีความยืดหยุ่นในการกำหนดชั่วโมงการสอนของคุณเอง อย่างไรก็ตาม เราขอแนะนำให้คุณรักษาตารางที่สม่ำเสมอเพื่อสร้างความสัมพันธ์ที่ดีกับนักเรียนและสร้างธุรกิจของคุณ
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-purple-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">พร้อมที่จะเริ่มต้นการเดินทางสู่การเป็นติวเตอร์ที่ประสบความสำเร็จ?</h2>
          <p className="mb-8">เข้าร่วมกับ Tutor Advantage วันนี้และปลดล็อกศักยภาพในการสอนของคุณ</p>
          <Button asChild size="lg">
            <Link href="/tutor-sign-up">สมัครเป็นติวเตอร์</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
