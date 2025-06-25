import React from "react"
import Link from "next/link"

import { siteConfig } from "@/config/site"

function NavBar() {
  const navItems = ["ราคา", "คุณสมบัติ", "ผลิตภัณฑ์", "เกี่ยวกับเรา"]
  return (
    <nav className="max-w-screen-xl mx-auto px-8 py-8 h-32 flex items-center justify-between text-white relative">
      <div className="w-40 h-12 flex items-center justify-center overflow-hidden font-bold">
        {siteConfig.name}
      </div>
      <div className="hidden lg:flex gap-16 font-medium text-sm tracking-[0.02em] leading-6">
        {navItems.map((item) => (
          <a
            key={item}
            href={`#${item.toLowerCase()}`}
            className="hover:text-gray-300"
          >
            {item}
          </a>
        ))}
      </div>
      <Link
        href="/login"
        className="text-white px-6 py-3 rounded-md bg-[rgba(240,240,245,0.2)] text-sm font-medium tracking-wide"
      >
        เข้าสู่ระบบ
      </Link>
    </nav>
  )
}

export default NavBar
