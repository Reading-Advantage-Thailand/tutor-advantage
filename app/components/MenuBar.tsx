import Link from 'next/link';

const MenuBar = () => {
  return (
    <nav className="bg-gray-800 p-4">
      <ul className="flex space-x-4 justify-center">
        <li>
          <Link href="/" className="text-white hover:text-gray-300">หน้าหลัก</Link>
        </li>
        <li>
          <Link href="/for-students" className="text-white hover:text-gray-300">สำหรับนักเรียน</Link>
        </li>
        <li>
          <Link href="/for-tutors" className="text-white hover:text-gray-300">สำหรับติวเตอร์</Link>
        </li>
        <li>
          <Link href="/about" className="text-white hover:text-gray-300">เกี่ยวกับเรา</Link>
        </li>
        <li>
          <Link href="/how-it-works" className="text-white hover:text-gray-300">วิธีการทำงาน</Link>
        </li>
      </ul>
    </nav>
  );
};

export default MenuBar;
