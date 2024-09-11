import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { BookOpen, Users, Award, Heart } from 'lucide-react'

export const metadata = {
  title: 'เกี่ยวกับ Tutor Advantage - การปฏิวัติการเรียนภาษาอังกฤษ',
  description: 'เรียนรู้เกี่ยวกับพันธกิจ วิสัยทัศน์ และแนวทางของ Tutor Advantage ในการปฏิวัติการเรียนการสอนภาษาอังกฤษ',
}

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white" lang="th">
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
          เกี่ยวกับ Tutor Advantage
        </h1>
        <p className="text-xl mb-8">
          การปฏิวัติการเรียนการสอนภาษาอังกฤษด้วยเทคโนโลยี AI และการติวเตอร์ส่วนตัว
        </p>
      </section>

      {/* Mission and Vision Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">พันธกิจและวิสัยทัศน์ของเรา</h2>
            <p className="mb-4">
              <strong>พันธกิจ:</strong> ทำให้การศึกษาที่มีคุณภาพสูงสามารถเข้าถึงได้สำหรับเด็กไทยให้มากที่สุดเท่าที่จะเป็นไปได้
            </p>
            <p className="mb-4">
              <strong>วิสัยทัศน์:</strong> ขยายการเข้าถึงการศึกษาภาษาอังกฤษที่มีคุณภาพในประเทศไทยให้ครอบคลุมพื้นที่นอกเหนือจากเขตเมืองและชนชั้นกลางระดับบน ผ่านการผสมผสานระหว่างการเรียนรู้ที่เสริมด้วยเทคโนโลยีและการติวเตอร์แบบตัวต่อตัว
            </p>
          </div>
        </div>
      </section>

      {/* Our Approach Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">แนวทางของเรา</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <BookOpen className="w-12 h-12 text-blue-500" />, title: "การเรียนรู้ที่ขับเคลื่อนด้วย AI", description: "ใช้เทคโนโลยี AI เพื่อสร้างเนื้อหาที่ปรับให้เหมาะกับผู้เรียนแต่ละคน" },
              { icon: <Users className="w-12 h-12 text-green-500" />, title: "ติวเตอร์คุณภาพสูง", description: "จับคู่นักเรียนกับติวเตอร์ที่ผ่านการคัดเลือกและฝึกอบรมมาอย่างดี" },
              { icon: <Award className="w-12 h-12 text-yellow-500" />, title: "การพัฒนาอย่างต่อเนื่อง", description: "มุ่งมั่นในการพัฒนาคุณภาพการสอนและเครื่องมือการเรียนรู้อย่างต่อเนื่อง" },
              { icon: <Heart className="w-12 h-12 text-red-500" />, title: "จริยธรรมในการดำเนินธุรกิจ", description: "ยึดมั่นในหลักจริยธรรมและความโปร่งใสในทุกด้านของธุรกิจ" },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">เรื่องราวของเรา</h2>
            <p className="mb-4">
              Tutor Advantage เกิดขึ้นจากความตั้งใจที่จะแก้ปัญหาการเข้าถึงการศึกษาภาษาอังกฤษที่มีคุณภาพในประเทศไทย เราเห็นว่าการเรียนการสอนแบบดั้งเดิมยังไม่สามารถตอบสนองความต้องการของผู้เรียนในยุคดิจิทัลได้อย่างเต็มที่
            </p>
            <p className="mb-4">
              ด้วยการผสมผสานเทคโนโลยี AI กับการติวเตอร์แบบตัวต่อตัว เราได้สร้างระบบการเรียนรู้ที่ทั้งมีประสิทธิภาพและเข้าถึงได้ ในขณะเดียวกัน เราก็มุ่งมั่นที่จะสร้างโอกาสทางอาชีพที่ยั่งยืนสำหรับติวเตอร์ผ่านโมเดลธุรกิจ MLM ที่มีจริยธรรม
            </p>
            <p>
              วันนี้ เรายังคงมุ่งมั่นที่จะพัฒนาและขยายผลกระทบของเรา เพื่อให้การศึกษาภาษาอังกฤษที่มีคุณภาพสูงเป็นจริงสำหรับผู้เรียนทุกคนในประเทศไทย
            </p>
          </div>
        </div>
      </section>

      {/* Ethical Commitment Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">ความมุ่งมั่นด้านจริยธรรม</h2>
            <p className="mb-4">
              ที่ Tutor Advantage เราเชื่อว่าความสำเร็จทางธุรกิจและความรับผิดชอบทางจริยธรรมสามารถดำเนินไปด้วยกันได้ เรามุ่งมั่นที่จะ:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>รักษาความโปร่งใสในโครงสร้างค่าตอบแทนและโอกาสทางธุรกิจ</li>
              <li>ให้ความสำคัญกับคุณภาพการศึกษามากกว่าการเติบโตทางธุรกิจแบบรวดเร็ว</li>
              <li>สนับสนุนการพัฒนาอย่างยั่งยืนของทั้งนักเรียนและติวเตอร์</li>
              <li>ปฏิบัติตามกฎหมายและระเบียบข้อบังคับที่เกี่ยวข้องทั้งหมดอย่างเคร่งครัด</li>
            </ul>
            <p>
              เรามุ่งมั่นที่จะสร้างผลกระทบเชิงบวกต่อชุมชนของเราและอุตสาหกรรมการศึกษาในวงกว้าง
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-blue-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">ร่วมเป็นส่วนหนึ่งในการปฏิวัติการเรียนการสอนภาษาอังกฤษ</h2>
          <p className="mb-8">ไม่ว่าคุณจะเป็นนักเรียนที่ต้องการพัฒนาทักษะหรือติวเตอร์ที่ต้องการสร้างผลกระทบ Tutor Advantage มีที่สำหรับคุณ</p>
          <div className="flex justify-center space-x-4">
            <Button asChild size="lg">
              <Link href="/for-students">สำหรับนักเรียน</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/for-tutors">สำหรับติวเตอร์</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
