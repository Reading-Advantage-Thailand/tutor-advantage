export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">ไม่พบหน้านี้</h2>
      <p className="text-gray-600 mb-8">ขออภัย เราไม่พบหน้าที่คุณกำลังมองหา</p>
      <a
        href="/dashboard"
        className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
      >
        กลับไปหน้า Dashboard
      </a>
    </div>
  );
}
