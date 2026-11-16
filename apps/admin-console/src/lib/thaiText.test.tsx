import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { adjustments } from "../locales/th/adjustments";
import { api } from "../locales/th/api";
import { audit } from "../locales/th/audit";
import { classes } from "../locales/th/classes";
import { confirm } from "../locales/th/confirm";
import { coupons } from "../locales/th/coupons";
import { dashboard } from "../locales/th/dashboard";
import { dev } from "../locales/th/dev";
import { discountCodes } from "../locales/th/discountCodes";
import { docs } from "../locales/th/docs";
import { adminDocsCopy } from "../locales/th/docsCopy";
import { fraud } from "../locales/th/fraud";
import { layout } from "../locales/th/layout";
import { login } from "../locales/th/login";
import { operations } from "../locales/th/operations";
import { reconciliation } from "../locales/th/reconciliation";
import { roles } from "../locales/th/roles";
import { settlements } from "../locales/th/settlements";
import { shell } from "../locales/th/shell";
import { tickets } from "../locales/th/tickets";
import { unauthorized } from "../locales/th/unauthorized";
import { userDetail } from "../locales/th/userDetail";
import { userHeader } from "../locales/th/userHeader";
import { users } from "../locales/th/users";
import { voice } from "../locales/th/voice";
import { NBSP, formatThaiDateTime, formatTimeRange } from "./format";
import { keepThaiWords, thaiCopy } from "./thaiText";

const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);
const keep = (text: string) => `<span class="whitespace-nowrap">${text}</span>`;
/** The text a screen reader or a search gets: the markup without its tags. */
const plain = (node: ReactNode) => html(node).replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** Every string in a locale object, however deep. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** Every Thai string the console ships, all namespaces. */
const ALL_COPY = [
  adjustments,
  api,
  audit,
  classes,
  confirm,
  coupons,
  dashboard,
  dev,
  discountCodes,
  docs,
  adminDocsCopy,
  fraud,
  layout,
  login,
  operations,
  reconciliation,
  roles,
  settlements,
  shell,
  tickets,
  unauthorized,
  userDetail,
  userHeader,
  users,
  voice,
].flatMap(strings);

describe("keepThaiWords", () => {
  it("returns text without a listed word as the same string", () => {
    expect(keepThaiWords("คูปอง")).toBe("คูปอง");
    expect(keepThaiWords("")).toBe("");
  });

  it("keeps a word ICU mis-segments whole", () => {
    // Was "จะบัน / ทึก" and "ค่าคอมมิช / ชัน".
    expect(html(keepThaiWords("ระบบจะบันทึกค่าคอมมิชชัน"))).toBe(`ระบบจะ${keep("บันทึก")}${keep("ค่าคอมมิชชัน")}`);
    expect(html(keepThaiWords("เช็กชื่อผ่านอินเทอร์เน็ต"))).toBe(`${keep("เช็กชื่อ")}ผ่าน${keep("อินเทอร์เน็ต")}`);
    // Was "ก / ระ / ทำ", "แด / ช / บอร์ด", "ดึงส / ถานะ", "มากกว่าย / อด", "พรี / วิว", "อัป / โหลด".
    expect(html(keepThaiWords("ผู้ใช้กระทำในแดชบอร์ด"))).toBe(`${keep("ผู้ใช้")}${keep("กระทำ")}ใน${keep("แดชบอร์ด")}`);
    expect(html(keepThaiWords("ดึงสถานะจาก Omise แล้วพบว่ามากกว่ายอดที่ตั้งไว้"))).toBe(
      `${keep("ดึงสถานะ")}จาก Omise แล้วพบว่า${keep("มากกว่ายอด")}ที่ตั้งไว้`,
    );
    expect(html(keepThaiWords("ดูพรีวิวก่อนอัปโหลด"))).toBe(`ดู${keep("พรีวิว")}ก่อน${keep("อัปโหลด")}`);
  });

  it("keeps compound words whole", () => {
    // Was "ย้อน / หลัง", "ตรวจ / สอบ", "ประวัติ / กิจกรรม", "ที่ / อยู่".
    expect(html(keepThaiWords("แก้ไขย้อนหลังไม่ได้ ใช้ตรวจสอบย้อนหลัง"))).toBe(
      `แก้ไข${keep("ย้อนหลัง")}${keep("ไม่ได้")} ใช้${keep("ตรวจสอบ")}${keep("ย้อนหลัง")}`,
    );
    expect(html(keepThaiWords("ส่งออกประวัติกิจกรรม"))).toBe(`${keep("ส่งออก")}${keep("ประวัติกิจกรรม")}`);
    expect(html(keepThaiWords("ที่อยู่สำหรับส่งเอกสาร"))).toBe(`${keep("ที่อยู่")}สำหรับ${keep("ส่งเอกสาร")}`);
    expect(html(keepThaiWords("สำเนาบัตรประชาชน"))).toBe(`สำเนา${keep("บัตรประชาชน")}`);
    // Split on 360–412px screens: "ตรวจยอด / รวม", "และภาพ / รวมระบบ", "รวม / ถึงผู้ใช้", "พฤติกรรมน่า / สงสัย",
    // "ตอบครั้ง / แรก", "คูปองใช้ได้ครั้ง / เดียว", "ตรวจจำนวน / เงิน", "(ไม่มีราย / ได้)", "ยอดเรียก / เก็บจริง".
    expect(html(keepThaiWords("ตรวจยอดรวมและภาพรวมระบบ รวมถึงผู้ใช้"))).toBe(
      `ตรวจ${keep("ยอดรวม")}และ${keep("ภาพรวม")}ระบบ ${keep("รวมถึง")}${keep("ผู้ใช้")}`,
    );
    expect(html(keepThaiWords("พฤติกรรมน่าสงสัย"))).toBe(`พฤติกรรม${keep("น่าสงสัย")}`);
    expect(html(keepThaiWords("ตอบครั้งแรกที่ใกล้ที่สุด"))).toBe(`ตอบ${keep("ครั้งแรก")}ที่ใกล้ที่สุด`);
    expect(html(keepThaiWords("คูปองใช้ได้ครั้งเดียว"))).toBe(`คูปองใช้ได้${keep("ครั้งเดียว")}`);
    expect(html(keepThaiWords("ตรวจจำนวนเงินและเหตุผล"))).toBe(`ตรวจ${keep("จำนวนเงิน")}และเหตุผล`);
    expect(html(keepThaiWords("(ไม่มีรายได้)"))).toBe(`(ไม่มี${keep("รายได้")})`);
    expect(html(keepThaiWords("ยอดเรียกเก็บจริง"))).toBe(`${keep("ยอดเรียกเก็บ")}จริง`);
    expect(html(keepThaiWords("รายการลงเรียนที่เป็น ACTIVE"))).toBe(`${keep("รายการ")}${keep("ลงเรียน")}ที่เป็น ACTIVE`);
    expect(html(keepThaiWords("เบอร์โทรศัพท์"))).toBe(keep("เบอร์โทรศัพท์"));
    expect(html(keepThaiWords("ชื่อ อีเมล เบอร์โทร รูปโปรไฟล์"))).toBe(`ชื่อ อีเมล ${keep("เบอร์โทร")} รูปโปรไฟล์`);
  });

  it("keeps the work-queue titles and stat labels breaking between their words", () => {
    // 75px queue title and 71px stat label on a 320px screen: was "รอบจ่ายรอ / อนุมัติ",
    // "ความเสี่ยงและ / ทุจริต", "ยืนยันตัว / ตน", "ปรับปรุง / ยอด", "ยอดโอนรอ / อนุมัติ".
    expect(html(keepThaiWords("รอบจ่ายรออนุมัติ"))).toBe(`${keep("รอบจ่าย")}${keep("รออนุมัติ")}`);
    expect(html(keepThaiWords("ความเสี่ยงและทุจริต"))).toBe(`${keep("ความเสี่ยง")}${keep("และทุจริต")}`);
    expect(html(keepThaiWords("ยืนยันตัวตน"))).toBe(keep("ยืนยันตัวตน"));
    expect(html(keepThaiWords("รายการผิดปกติ"))).toBe(`${keep("รายการ")}${keep("ผิดปกติ")}`);
    expect(html(keepThaiWords("ปรับปรุงยอด"))).toBe(keep("ปรับปรุงยอด"));
    expect(html(keepThaiWords("ยอดโอนรออนุมัติ"))).toBe(`${keep("ยอดโอน")}${keep("รออนุมัติ")}`);
    // Stat labels on 360–412px screens: was "ยอดสุทธิที่ต้อง / จ่าย", "รายการที่ต้อง / ติดตาม",
    // "ไม่มีสรุปผลหลัง / ฝึก". Each run is narrower than the 71px label of a 320px screen.
    expect(html(keepThaiWords("ยอดสุทธิที่ต้องจ่าย"))).toBe(`${keep("ยอดสุทธิ")}ที่${keep("ต้องจ่าย")}`);
    expect(html(keepThaiWords("รายการที่ต้องติดตาม"))).toBe(`${keep("รายการ")}ที่${keep("ต้องติดตาม")}`);
    expect(html(keepThaiWords("ไม่มีสรุปผลหลังฝึก"))).toBe(`ไม่มีสรุปผล${keep("หลังฝึก")}`);
    expect(html(keepThaiWords("รอตรวจสอบเอกสาร"))).toBe(`${keep("รอตรวจสอบ")}เอกสาร`);
    expect(html(keepThaiWords("ฉบับร่าง / ตีกลับ"))).toBe(`${keep("ฉบับร่าง")} / ${keep("ตีกลับ")}`);
  });

  it("keeps the admin, payout-account and personal-data terms whole", () => {
    // docsCopy: was "ผู้ / ดูแล", "สมุด / บัญชีธนาคาร", "บัญชีรับ / เงินใน Omise", "ข้อมูล / ส่วนบุคคล".
    expect(html(keepThaiWords("ต้องได้รับการอนุมัติจากผู้ดูแลอีกคน"))).toBe(
      `ต้อง${keep("ได้รับ")}${keep("การอนุมัติ")}จาก${keep("ผู้ดูแล")}${keep("อีกคน")}`,
    );
    expect(html(keepThaiWords("ครูอัปโหลดบัตรประชาชน สมุดบัญชีธนาคาร และข้อมูลภาษี"))).toBe(
      `ครู${keep("อัปโหลด")}${keep("บัตรประชาชน")} ${keep("สมุดบัญชีธนาคาร")} และข้อมูลภาษี`,
    );
    // Was "ระบบจะ / สร้างบัญชีรับเงิน" at 360px.
    expect(html(keepThaiWords("เมื่ออนุมัติสมุดบัญชี ระบบจะสร้างบัญชีรับเงินใน Omise ให้อัตโนมัติ"))).toBe(
      `เมื่ออนุมัติ${keep("สมุดบัญชี")} ระบบ${keep("จะสร้าง")}${keep("บัญชีรับเงิน")}ใน Omise ให้อัตโนมัติ`,
    );
    expect(html(keepThaiWords("เปิดดูข้อมูลส่วนบุคคล"))).toBe(`เปิดดู${keep("ข้อมูลส่วนบุคคล")}`);
    // settlements.payeeCount (71px stat label), settlements.colEligibility.
    expect(html(keepThaiWords("จำนวนผู้รับเงิน"))).toBe(`จำนวน${keep("ผู้รับเงิน")}`);
    expect(html(keepThaiWords("สิทธิ์รับเงิน"))).toBe(`สิทธิ์${keep("รับเงิน")}`);
  });

  it("keeps การ on the admin nouns it forms", () => {
    // Was "การ / เรียกใช้งาน", "และการ / เชื่อมต่อ LINE/Google", "การรับ / เงินของผู้ใช้".
    expect(html(keepThaiWords("ข้อจำกัดการเรียกใช้งาน (Rate Limiting)"))).toBe(
      `${keep("ข้อจำกัด")}${keep("การเรียกใช้งาน")} (Rate Limiting)`,
    );
    expect(html(keepThaiWords("ที่อยู่ และการเชื่อมต่อ LINE/Google"))).toBe(`${keep("ที่อยู่")} และ${keep("การเชื่อมต่อ")} LINE/Google`);
    // voice.disconnects is a 71px stat label: the run is 62px there.
    expect(html(keepThaiWords("การเชื่อมต่อหลุด"))).toBe(`${keep("การเชื่อมต่อ")}หลุด`);
    expect(html(keepThaiWords("จะปิดการเข้าสู่ระบบและการรับเงินของผู้ใช้ทันที"))).toBe(
      `${keep("จะปิด")}${keep("การเข้าสู่ระบบ")}และ${keep("การรับเงิน")}ของ${keep("ผู้ใช้")}${keep("ทันที")}`,
    );
    // Split on 360–375px screens: "ไม่ยืนยันการ / ชำระ", "และการ / อนุมัติจะถูกบันทึก".
    expect(html(keepThaiWords("ไม่ยืนยันการชำระ"))).toBe(`ไม่ยืนยัน${keep("การชำระ")}`);
    expect(html(keepThaiWords("และการอนุมัติจะถูกบันทึก"))).toBe(`และ${keep("การอนุมัติ")}${keep("จะถูกบันทึก")}`);
    expect(html(keepThaiWords("การตรวจสอบและการดำเนินการ"))).toBe(`${keep("การตรวจสอบ")}และ${keep("การดำเนินการ")}`);
    expect(html(keepThaiWords("ความผิดปกติและผู้แจ้ง"))).toBe(`${keep("ความผิดปกติ")}และ${keep("ผู้แจ้ง")}`);
  });

  it("does not start a การ entry inside a word that ends in การ", () => {
    // Was "ต้อง[การอนุมัติ]", "จัด[การปรับปรุงยอด]", "กระบวน[การลบข้อมูล]": one unbreakable piece each.
    expect(html(keepThaiWords("คุณต้องการอนุมัติการปรับปรุงยอดนี้หรือไม่?"))).toBe(
      `คุณ${keep("ต้องการ")}อนุมัติ${keep("การปรับปรุงยอด")}นี้${keep("หรือไม่?")}`,
    );
    expect(html(keepThaiWords("จัดการปรับปรุงยอด"))).toBe(`${keep("จัดการ")}${keep("ปรับปรุงยอด")}`);
    expect(html(keepThaiWords("เริ่มกระบวนการลบข้อมูล"))).toBe(`เริ่ม${keep("กระบวนการ")}${keep("ลบข้อมูล")}`);
    // "รายการ" is listed too, so "รายการชำระเงิน" is not read as "ราย" + "การชำระเงิน".
    expect(html(keepThaiWords("รายการชำระเงิน"))).toBe(`${keep("รายการ")}${keep("ชำระเงิน")}`);
  });

  it("keeps the role name ผู้ตรวจสอบการเงิน as two runs, each narrower than a stat label", () => {
    expect(html(keepThaiWords("ผู้ตรวจสอบการเงินที่ใช้งานอยู่"))).toBe(
      `${keep("ผู้ตรวจสอบ")}${keep("การเงิน")}ที่${keep("ใช้งานอยู่")}`,
    );
    expect(html(keepThaiWords("ผู้ดูแลระบบที่ใช้งานอยู่"))).toBe(`${keep("ผู้ดูแลระบบ")}ที่${keep("ใช้งานอยู่")}`);
  });

  it("keeps a negation or a helper verb with its verb", () => {
    expect(html(keepThaiWords("ผู้ใช้จะเข้าระบบไม่ได้ทันทีจนกว่าจะเปิดใช้งานอีกครั้ง"))).toBe(
      `${keep("ผู้ใช้")}จะเข้าระบบ${keep("ไม่ได้")}${keep("ทันที")}จนกว่าจะ${keep("เปิดใช้งานอีกครั้ง")}`,
    );
    expect(html(keepThaiWords("ประมวลผล webhook ไม่สำเร็จ"))).toBe(`ประมวลผล webhook ${keep("ไม่สำเร็จ")}`);
    expect(html(keepThaiWords("รอบที่ยังไม่อนุมัติต้องคำนวณใหม่"))).toBe(`รอบที่${keep("ยังไม่อนุมัติ")}${keep("ต้องคำนวณใหม่")}`);
    expect(html(keepThaiWords("ระบบจะปฏิเสธและจะลบข้อมูล"))).toBe(`ระบบ${keep("จะปฏิเสธ")}และ${keep("จะลบ")}ข้อมูล`);
    // unauthorized.body and userDetail.approveHint: was "หน้านี้เปิด / ได้เฉพาะ" and "ส่งมา / แล้วและรอตรวจ".
    expect(html(keepThaiWords("หน้านี้เปิดได้เฉพาะผู้ดูแลระบบ"))).toBe(`${keep("หน้านี้")}${keep("เปิดได้")}เฉพาะ${keep("ผู้ดูแลระบบ")}`);
    expect(html(keepThaiWords("รายการที่ครูส่งมาแล้วและรอตรวจ"))).toBe(`${keep("รายการ")}ที่ครู${keep("ส่งมาแล้ว")}และ${keep("รอตรวจ")}`);
    // Split on 360–375px screens: "จะหาย / ไป", "จะไม่ / แตะตาราง", "เคยถูก / เรียกเงินคืน", "และถูก / รวม",
    // "รอ / ไว้", "วิกฤตต้อง / ตรวจสอบโดยเร็ว", "การลงเรียนไม่ / เปลี่ยน".
    expect(html(keepThaiWords("ข้อมูลทั้งหมดจะหายไป"))).toBe(`ข้อมูลทั้งหมด${keep("จะหายไป")}`);
    expect(html(keepThaiWords("จะไม่แตะตารางเหล่านี้"))).toBe(`${keep("จะไม่แตะ")}ตารางเหล่านี้`);
    expect(html(keepThaiWords("บัตรที่เคยถูกเรียกเงินคืน"))).toBe(`บัตรที่เคย${keep("ถูกเรียกเงินคืน")}`);
    expect(html(keepThaiWords("และถูกรวมเมื่อคำนวณ"))).toBe(`และ${keep("ถูกรวม")}เมื่อคำนวณ`);
    expect(html(keepThaiWords("ให้เจ้าหน้าที่รอไว้"))).toBe(`ให้${keep("เจ้าหน้าที่")}${keep("รอไว้")}`);
    expect(html(keepThaiWords("วิกฤตต้องตรวจสอบโดยเร็ว"))).toBe(`วิกฤต${keep("ต้องตรวจสอบโดยเร็ว")}`);
    expect(html(keepThaiWords("การชำระเงินและการลงเรียนไม่เปลี่ยน"))).toBe(
      `${keep("การชำระเงิน")}และ${keep("การลงเรียน")}${keep("ไม่เปลี่ยน")}`,
    );
  });

  it("takes the longer entry when two start at the same letter", () => {
    expect(html(keepThaiWords("เพื่อบันทึกในประวัติกิจกรรม"))).toBe(`เพื่อ${keep("บันทึกในประวัติกิจกรรม")}`);
    expect(html(keepThaiWords("รอบจ่ายเงินครูเดือนนี้"))).toBe(`${keep("รอบจ่ายเงินครู")}เดือนนี้`);
    expect(html(keepThaiWords("การโอนเงินไม่สำเร็จ"))).toBe(`${keep("การโอนเงิน")}${keep("ไม่สำเร็จ")}`);
    expect(html(keepThaiWords("การโอนรายครู"))).toBe(`${keep("การโอน")}${keep("รายครู")}`);
    expect(html(keepThaiWords("กรุณาเข้าสู่ระบบใหม่อีกครั้ง"))).toBe(`กรุณา${keep("เข้าสู่ระบบใหม่อีกครั้ง")}`);
    expect(html(keepThaiWords("ผู้ตรวจอีกคนอนุมัติแล้ว"))).toBe(`${keep("ผู้ตรวจ")}${keep("อีกคนอนุมัติแล้ว")}`);
    expect(html(keepThaiWords("ยืนยันการลบข้อมูลใช่หรือไม่?"))).toBe(`ยืนยัน${keep("การลบข้อมูล")}${keep("ใช่หรือไม่?")}`);
    // "ผู้ดูแล" alone is listed too: the role name still stays one run.
    expect(html(keepThaiWords("สิทธิ์ผู้ดูแลของผู้ดูแลระบบ"))).toBe(`สิทธิ์${keep("ผู้ดูแล")}ของ${keep("ผู้ดูแลระบบ")}`);
  });

  it("takes the entry that starts first, so a phrase is not cut by a word inside it", () => {
    // "ถูกบันทึก" starts before "บันทึกในประวัติกิจกรรม": the rest still keeps "ประวัติกิจกรรม" whole.
    expect(html(keepThaiWords("และถูกบันทึกในประวัติกิจกรรม"))).toBe(`และ${keep("ถูกบันทึก")}ใน${keep("ประวัติกิจกรรม")}`);
    // A number with its unit starts at the number, before the listed word "รายการ".
    expect(html(keepThaiWords("ระงับ 0 รายการ"))).toBe(`ระงับ ${keep("0 รายการ")}`);
    // "ลบข้อมูล" starts before "ข้อมูลส่วนบุคคล": both halves stay whole.
    expect(html(keepThaiWords("ลบข้อมูลส่วนบุคคล"))).toBe(`${keep("ลบข้อมูล")}${keep("ส่วนบุคคล")}`);
  });

  it("does not let an entry take the first half of the listed word after it", () => {
    // "ในรอบ" took "รอบ" and left "จ่ายเงิน" outside: "ในรอบ / จ่ายเงิน". Alone it still keeps "นี้".
    expect(html(keepThaiWords("ในรอบจ่ายเงินเดือนนี้"))).toBe(`ใน${keep("รอบจ่ายเงิน")}เดือนนี้`);
    expect(html(keepThaiWords("รายการในรอบนี้และรอบจ่ายเงินถัดไป"))).toBe(
      `${keep("รายการ")}${keep("ในรอบนี้")}และ${keep("รอบจ่ายเงิน")}${keep("ถัดไป")}`,
    );
    expect(html(keepThaiWords("ในรอบเดือนตุลาคม"))).toBe(`${keep("ในรอบ")}เดือนตุลาคม`);
    // "ไม่ได้รับเงิน" must leave "เงินโอนอัตโนมัติ" whole.
    expect(html(keepThaiWords("ครูจะไม่ได้รับเงินในรอบที่ถูกระงับ"))).toBe(
      `ครูจะ${keep("ไม่ได้รับเงิน")}${keep("ในรอบ")}ที่${keep("ถูกระงับ")}`,
    );
    expect(html(keepThaiWords("ไม่ได้รับเงินโอนอัตโนมัติ"))).toBe(`${keep("ไม่ได้รับ")}${keep("เงินโอนอัตโนมัติ")}`);
    // A count before "รอบจ่ายเงิน" does not take "รอบ" as its unit.
    expect(html(keepThaiWords("ทุก 3 รอบจ่ายเงิน"))).toBe(`ทุก 3 ${keep("รอบจ่ายเงิน")}`);
  });

  it("keeps a button, filter or status name inside its quotation marks", () => {
    expect(html(keepThaiWords("กด “คำนวณใหม่” แล้วเลือก “ทุกรายการ”"))).toBe(
      `กด ${keep("“คำนวณใหม่”")} แล้วเลือก ${keep("“ทุกรายการ”")}`,
    );
    // Was "“ยกเลิกฉบับ / ร่าง”" at 412px.
    expect(html(keepThaiWords("กด “ยกเลิกฉบับร่าง” หรือ “ตรวจสอบกับ Omise”"))).toBe(
      `กด ${keep("“ยกเลิกฉบับร่าง”")} หรือ ${keep("“ตรวจสอบกับ Omise”")}`,
    );
    // The longest name in the copy still fits the rule.
    expect(html(keepThaiWords("ทุกครั้งที่กด “ตรวจสอบการชำระเงิน” ระบบจะดึงสถานะ"))).toBe(
      `ทุกครั้งที่กด ${keep("“ตรวจสอบการชำระเงิน”")} ระบบจะ${keep("ดึงสถานะ")}`,
    );
    // A longer quotation wraps as usual: only its listed words are kept.
    expect(html(keepThaiWords("ปุ่ม “ดูประวัติทั้งหมดของรายการนี้” อยู่ด้านล่าง"))).toBe(
      `ปุ่ม “ดูประวัติทั้งหมดของ${keep("รายการ")}นี้” อยู่${keep("ด้านล่าง")}`,
    );
  });

  it("keeps a closing question with its question mark", () => {
    expect(html(keepThaiWords("ต้องการยกเลิกรอบนี้ใช่หรือไม่?"))).toBe(`${keep("ต้องการ")}ยกเลิก${keep("รอบนี้")}${keep("ใช่หรือไม่?")}`);
    // Without the question mark it is ordinary text.
    expect(html(keepThaiWords("ตรวจสอบแล้วหรือไม่"))).toBe(`${keep("ตรวจสอบ")}แล้วหรือไม่`);
  });

  it("keeps a number with its unit, across a plain or a no-break space", () => {
    expect(html(keepThaiWords("จากเคสเปิดทั้งหมด 2 เคส"))).toBe(`จากเคสเปิดทั้งหมด ${keep("2 เคส")}`);
    expect(html(keepThaiWords(`ยอดรวม 30,000${NBSP}บาท`))).toBe(`${keep("ยอดรวม")} ${keep(`30,000${NBSP}บาท`)}`);
    expect(html(keepThaiWords("ภายใน 3–7 วันทำการ"))).toBe(`ภายใน ${keep("3–7 วันทำการ")}`);
    // A range keeps both numbers: was "1– / 1,000 ชั่วโมง".
    expect(html(keepThaiWords("1–1,000 ชั่วโมง"))).toBe(keep("1–1,000 ชั่วโมง"));
    expect(html(keepThaiWords("ไม่เกิน 30 วินาที หรือ 2 ชั่วโมง"))).toBe(`${keep("ไม่เกิน")} ${keep("30 วินาที")} หรือ ${keep("2 ชั่วโมง")}`);
    expect(html(keepThaiWords("ทั้งหมด 12 ราย และ 3 รอบ"))).toBe(`ทั้งหมด ${keep("12 ราย")} และ ${keep("3 รอบ")}`);
    expect(html(keepThaiWords("ชื่อไม่เกิน 100 ตัวอักษร"))).toBe(`ชื่อ${keep("ไม่เกิน")} ${keep("100 ตัวอักษร")}`);
    expect(html(keepThaiWords("และรอตรวจ 3 รายการ"))).toBe(`และ${keep("รอตรวจ")} ${keep("3 รายการ")}`);
    // userDetail.cardTrustOff: was "90 / วันแรก", "ไม่ / เกิน", "30,000 / บาท", "PromptPay / ไม่จำกัด".
    expect(html(keepThaiWords("ปกติ · ครูใหม่ (90 วันแรก) รับบัตรได้ไม่เกิน 30,000 บาท ต่อ 30 วัน ส่วน PromptPay ไม่จำกัด"))).toBe(
      `ปกติ · ครูใหม่ (${keep("90 วันแรก")}) รับบัตรได้${keep("ไม่เกิน")} ${keep("30,000 บาท")} ต่อ ${keep("30 วัน")} ส่วน ${keep("PromptPay ไม่จำกัด")}`,
    );
    // adjustments.amountHint: was "เช่น / 1,500.00".
    expect(html(keepThaiWords("ทศนิยมได้ไม่เกิน 2 ตำแหน่ง ใส่จุลภาคได้ เช่น 1,500.00"))).toBe(
      `ทศนิยมได้${keep("ไม่เกิน")} ${keep("2 ตำแหน่ง")} ใส่จุลภาคได้ ${keep("เช่น 1,500.00")}`,
    );
    // discountCodes.quantityHint: was "1 / คน" and "คนละ / โค้ด".
    expect(html(keepThaiWords("แต่ละโค้ดใช้ได้ 1 คน ส่งให้นักเรียนคนละโค้ด เพื่อกันการส่งต่อโค้ด"))).toBe(
      `แต่ละโค้ดใช้ได้ ${keep("1 คน")} ส่งให้นักเรียน${keep("คนละโค้ด")} เพื่อกัน${keep("การส่งต่อโค้ด")}`,
    );
  });

  it("keeps a labelled number or amount whole", () => {
    expect(html(keepThaiWords("ราคาเหลือ ฿0 หลังใช้โค้ด"))).toBe(`${keep("ราคาเหลือ ฿0")} หลัง${keep("ใช้โค้ด")}`);
    expect(html(keepThaiWords("จะเหลือ ฿1,200"))).toBe(`จะ${keep("เหลือ ฿1,200")}`);
    expect(html(keepThaiWords("อัปเดตทุก 1 นาที"))).toBe(`อัปเดต${keep("ทุก 1 นาที")}`);
    // roles.ruleLastAdmin: was "อย่างน้อย 1 / คนเสมอ".
    expect(html(keepThaiWords("ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คนเสมอ"))).toBe(
      `ต้องมี${keep("ผู้ดูแลระบบ")}ที่${keep("ใช้งานอยู่")}${keep("อย่างน้อย 1 คนเสมอ")}`,
    );
    expect(html(keepThaiWords("ระบบออกใบ 50 ทวิ ให้ครู"))).toBe(`ระบบ${keep("ออกใบ 50 ทวิ")} ให้ครู`);
    expect(html(keepThaiWords("ภาษีหัก ณ ที่จ่าย"))).toBe(`ภาษีหัก ${keep("ณ ที่จ่าย")}`);
  });

  it("keeps a date and a time whole", () => {
    // settlements.cronNote: was "ทุก / วันที่ 1" and "เวลา / 00:00 น.".
    expect(html(keepThaiWords("ให้อัตโนมัติทุกวันที่ 1 เวลา 00:00 น. (เวลาไทย)"))).toBe(
      `ให้อัตโนมัติ${keep("ทุกวันที่ 1")} ${keep("เวลา 00:00 น.")} (${keep("เวลาไทย")})`,
    );
    expect(html(keepThaiWords("รอบจ่ายเงินครู (ตุลาคม 2569)"))).toBe(`${keep("รอบจ่ายเงินครู")} (${keep("ตุลาคม 2569")})`);
    expect(html(keepThaiWords("รอตั้งแต่ 4 มี.ค."))).toBe(`รอตั้งแต่ ${keep("4 มี.ค.")}`);
    expect(html(keepThaiWords("เมื่อ 16 ต.ค. 2569"))).toBe(`เมื่อ ${keep("16 ต.ค. 2569")}`);
    // A month or a date written with hyphens: was "2026- / 11".
    expect(html(keepThaiWords("ช่วง 2026-11 ถึง 2026-11-30"))).toBe(`ช่วง ${keep("2026-11")} ถึง ${keep("2026-11-30")}`);
    // What formatThaiDateTime() and formatTimeRange() return (a no-break space before "น.").
    const at = new Date("2026-10-02T07:30:00Z");
    const dateTime = formatThaiDateTime(at);
    expect(html(keepThaiWords(dateTime))).toBe(`${keep("2 ต.ค. 2569")} ${keep(`14:30${NBSP}น.`)}`);
    const range = formatTimeRange(at, new Date("2026-10-02T09:00:00Z"));
    expect(html(keepThaiWords(range))).toBe(keep(`14:30–16:00${NBSP}น.`));
  });

  it("reads a dot in an entry as a dot", () => {
    expect(keepThaiWords("รอตั้งแต่ 4 มีxคx")).toBe("รอตั้งแต่ 4 มีxคx");
    expect(html(keepThaiWords("เวลา 00:00 นx"))).toBe(`${keep("เวลา 00:00")} นx`);
  });

  it("keeps the repeat mark with its word without changing the text", () => {
    expect(html(keepThaiWords("อื่น ๆ"))).toBe(keep("อื่น ๆ"));
    expect(html(keepThaiWords("บริการต่าง ๆ ในระบบ"))).toBe(`บริการ${keep("ต่าง ๆ")} ในระบบ`);
  });

  it("keeps names and mixed Thai-Latin runs whole", () => {
    expect(html(keepThaiWords("คุณยกเลิกการเข้าสู่ระบบกับ Google"))).toBe(`คุณยกเลิก${keep("การเข้าสู่ระบบ")}${keep("กับ Google")}`);
    expect(html(keepThaiWords("Reading Advantage และ Primary Advantage"))).toBe(
      `${keep("Reading Advantage")} และ ${keep("Primary Advantage")}`,
    );
    // Was "(Maker– / Checker)"; the settlements copy writes it with a hyphen.
    expect(html(keepThaiWords("ผู้ตรวจสอบเป็นคนละคน (Maker–Checker)"))).toBe(`${keep("ผู้ตรวจสอบ")}เป็นคนละคน (${keep("Maker–Checker")})`);
    expect(html(keepThaiWords("โดยระบบ Maker-Checker"))).toBe(`โดยระบบ ${keep("Maker-Checker")}`);
  });

  it("never changes a character, so an accessible name stays the same", () => {
    expect(ALL_COPY.length).toBeGreaterThan(1500);
    for (const text of ALL_COPY) expect(plain(keepThaiWords(text))).toBe(text);
  });

  it("never starts or ends a run inside a syllable", () => {
    // A run that ends before a vowel or tone mark, or starts after a leading vowel, would let the line break
    // inside a syllable: "[การใช้]้", "เ[รียกเก็บ]".
    const after = /^[ะ-ฺๅ็-๎]/;
    const lead = /[เ-ไ]$/;
    for (const text of ALL_COPY) {
      const parts = html(keepThaiWords(text)).split(/<span class="whitespace-nowrap">|<\/span>/);
      for (let i = 1; i < parts.length; i++) {
        expect(after.test(parts[i] ?? ""), `${text} | ${parts[i - 1]} | ${parts[i]}`).toBe(false);
        expect(lead.test(parts[i - 1] ?? ""), `${text} | ${parts[i - 1]} | ${parts[i]}`).toBe(false);
      }
    }
  });
});

describe("thaiCopy", () => {
  it("returns non-string content unchanged", () => {
    const node = <b>ตอนนี้</b>;
    expect(thaiCopy(node)).toBe(node);
    expect(thaiCopy(undefined)).toBeUndefined();
    expect(thaiCopy(null)).toBeNull();
    expect(thaiCopy(12)).toBe(12);
  });

  it("glues the repeat mark ๆ to the word it repeats", () => {
    expect(thaiCopy("ของเพื่อน ๆ ในคลาสนี้")).toBe(`ของเพื่อน${NBSP}ๆ ในคลาสนี้`);
    // A listed word keeps its mark across the no-break space too.
    expect(html(thaiCopy("บริการต่าง ๆ ในระบบ"))).toBe(`บริการ${keep(`ต่าง${NBSP}ๆ`)} ในระบบ`);
  });

  it("glues a short last word to the one before it", () => {
    expect(thaiCopy("ส่งให้ครู A1")).toBe(`ส่งให้ครู${NBSP}A1`);
    // The number pattern still matches after the unit was glued.
    expect(html(thaiCopy("จากเคสเปิดทั้งหมด 2 เคส"))).toBe(`จากเคสเปิดทั้งหมด ${keep(`2${NBSP}เคส`)}`);
    expect(html(thaiCopy("แต่ละโค้ดใช้ได้ 1 คน"))).toBe(`แต่ละโค้ดใช้ได้ ${keep(`1${NBSP}คน`)}`);
    // A longer last word is left alone.
    expect(html(thaiCopy("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"))).toBe(`เซสชัน${keep("หมดอายุ")} กรุณา${keep("เข้าสู่ระบบใหม่")}`);
  });

  it("keeps a closing phrase whole, so a paragraph does not end on one short word", () => {
    // roles.pageDescription, audit.pageDescription, users.pageDescription.
    expect(html(thaiCopy("กำหนดผู้ดูแลระบบและผู้ตรวจสอบการเงิน ทุกการเปลี่ยนแปลงต้องระบุเหตุผล"))).toBe(
      `กำหนด${keep("ผู้ดูแลระบบ")}และ${keep("ผู้ตรวจสอบ")}${keep("การเงิน")} ${keep("ทุกการเปลี่ยนแปลง")}ต้องระบุเหตุผล`,
    );
    expect(html(thaiCopy("ใช้ตรวจสอบย้อนหลังและสอบทานการอนุมัติ"))).toBe(
      `ใช้${keep("ตรวจสอบ")}${keep("ย้อนหลัง")}${keep("และสอบทานการอนุมัติ")}`,
    );
    expect(html(thaiCopy("ตรวจเอกสารยืนยันตัวตน และจัดการบัญชี"))).toBe(`ตรวจเอกสาร${keep("ยืนยันตัวตน")} ${keep("และจัดการบัญชี")}`);
    // settlements.confirmCancelBody: was "... ใหม่ได้ภาย / หลัง".
    expect(html(thaiCopy("รอบจะเปลี่ยนเป็น “ตีกลับ” และคำนวณใหม่ได้ภายหลัง"))).toBe(
      `รอบจะเปลี่ยนเป็น ${keep("“ตีกลับ”")} และ${keep("คำนวณใหม่")}${keep("ได้ภายหลัง")}`,
    );
    // docsCopy: was "... แก้ไขหรือลบ / ไม่ได้".
    expect(html(thaiCopy("บันทึกเหล่านี้แก้ไขหรือลบไม่ได้"))).toBe(`${keep("บันทึก")}เหล่านี้แก้ไข${keep("หรือลบไม่ได้")}`);
  });

  it("changes nothing but plain spaces into no-break spaces", () => {
    for (const text of ALL_COPY) expect(plain(thaiCopy(text)).replaceAll(NBSP, " ")).toBe(text.replaceAll(NBSP, " "));
  });
});
