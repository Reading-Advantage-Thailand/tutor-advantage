import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { CheckCircle, Users, BookOpen, Rocket } from 'lucide-react'
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white" lang="th">
      <header className="p-5 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tutor Advantage</h1>
        <nav>
          <Button asChild>
            <Link href="/login">เข้าสู่ระบบ</Link>
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold mb-6">
          ปฏิวัติการเรียนภาษาอังกฤษของคุณ
        </h2>
        <p className="text-xl mb-8">
          ใช้พลังของ AI และการติวเตอร์ส่วนตัวเพื่อเร่งความสามารถภาษาอังกฤษของคุณ
        </p>
        <div className="flex justify-center space-x-4">
          <Button asChild size="lg">
            <Link href="/for-students">ฉันเป็นนักเรียน</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/for-tutors">ฉันเป็นติวเตอร์</Link>
          </Button>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">ทำไมต้องเลือก Tutor Advantage?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Rocket className="w-12 h-12 text-blue-500" />, title: "การเรียนรู้ด้วย AI", description: "ระบบ AI สร้างเนื้อหาที่เหมาะสมกับระดับของคุณ" },
              { icon: <Users className="w-12 h-12 text-green-500" />, title: "ติวเตอร์ผู้เชี่ยวชาญ", description: "ติวเตอร์ที่ผ่านการคัดเลือกและฝึกอบรมอย่างดี" },
              { icon: <BookOpen className="w-12 h-12 text-purple-500" />, title: "หลักสูตรส่วนบุคคล", description: "แผนการเรียนที่ปรับให้เหมาะกับเป้าหมายของคุณ" },
              { icon: <CheckCircle className="w-12 h-12 text-red-500" />, title: "ตารางเรียนที่ยืดหยุ่น", description: "เรียนได้ตามเวลาที่สะดวกของคุณ" },
            ].map((feature, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">{feature.icon}</div>
                <h4 className="text-xl font-semibold mb-2">{feature.title}</h4>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">วิธีการทำงาน</h3>
          <div className="flex flex-col md:flex-row justify-between items-center">
            {[
              "ทำแบบทดสอบวัดระดับ",
              "จับคู่กับติวเตอร์",
              "เริ่มบทเรียนส่วนตัว",
              "ติดตามความก้าวหน้า"
            ].map((step, index) => (
              <div key={index} className="text-center mb-8 md:mb-0">
                <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                  {index + 1}
                </div>
                <p className="text-lg font-semibold">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">เสียงจากผู้ใช้ของเรา</h3>
          <Carousel className="w-full max-w-xs mx-auto">
            <CarouselContent>
              {[
                { name: "สมชาย", role: "นักเรียน", quote: "Tutor Advantage ช่วยให้ผมพัฒนาภาษาอังกฤษได้เร็วกว่าที่เคย" },
                { name: "สมหญิง", role: "ติวเตอร์", quote: "ฉันรักการสอนกับ Tutor Advantage เพราะมีเครื่องมือที่ยอดเยี่ยม" },
                { name: "สมศรี", role: "ผู้ปกครอง", quote: "ลูกของฉันชอบเรียนกับ Tutor Advantage มาก ผลการเรียนดีขึ้นอย่างเห็นได้ชัด" },
              ].map((testimonial, index) => (
                <CarouselItem key={index}>
                  <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                    <p className="mb-4">"{testimonial.quote}"</p>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">คำถามที่พบบ่อย</h3>
          <Accordion type="single" collapsible className="w-full max-w-2xl mx-auto">
            <AccordionItem value="item-1">
              <AccordionTrigger>Tutor Advantage แตกต่างจากแพลตฟอร์มอื่นอย่างไร?</AccordionTrigger>
              <AccordionContent>
                Tutor Advantage ผสมผสานเทคโนโลยี AI กับการสอนแบบตัวต่อตัว ทำให้การเรียนมีประสิทธิภาพและเหมาะสมกับผู้เรียนแต่ละคนมากที่สุด
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>ฉันจะเริ่มต้นใช้งานได้อย่างไร?</AccordionTrigger>
              <AccordionContent>
                เพียงลงทะเบียน ทำแบบทดสอบวัดระดับ และเลือกติวเตอร์ที่เหมาะกับคุณ จากนั้นคุณก็พร้อมที่จะเริ่มเรียนได้ทันที
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>ติวเตอร์ของ Tutor Advantage มีคุณสมบัติอย่างไร?</AccordionTrigger>
              <AccordionContent>
                ติวเตอร์ทุกคนผ่านการคัดเลือกอย่างเข้มงวดและได้รับการฝึกอบรมในการใช้เครื่องมือ AI ของเรา พวกเขามีประสบการณ์การสอนและความเชี่ยวชาญในภาษาอังกฤษ
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-blue-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-6">พร้อมที่จะเริ่มต้นการเรียนรู้แบบใหม่แล้วหรือยัง?</h3>
          <p className="mb-8">เริ่มต้นการเดินทางสู่ความเชี่ยวชาญภาษาอังกฤษของคุณวันนี้</p>
          <Button asChild size="lg">
            <Link href="/sign-up">สมัครเรียนฟรี</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
