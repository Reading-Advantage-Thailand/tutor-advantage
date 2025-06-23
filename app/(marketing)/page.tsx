export const metadata = {
  title: "Tutor Advantage",
  description: "Tutor Advantage",
}

export default async function MarketingPage() {
  return (
    <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
      <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl lg:text-7xl">
          <span>
            เตรียมพร้อมสำหรับการเริ่มต้นใหม่
          </span>
          <span className="block bg-gradient-to-r from-blue-500 to-teal-400 bg-clip-text text-transparent">
            Tutor Advantage
          </span>
        </h1>
      </div>
    </section>
  )
}
