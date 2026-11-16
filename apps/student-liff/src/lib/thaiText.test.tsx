import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { businessContact } from "./businessContact";
import { checkoutPolicy } from "./content/legal";
import { keepThaiWords, thaiCopy } from "./thaiText";

const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);
const keep = (text: string) => `<span class="whitespace-nowrap">${text}</span>`;

describe("keepThaiWords", () => {
  it("keeps a run ICU mis-segments whole, longest entry first", () => {
    // ICU splits "แล้วก|ดล|อง": the whole run must be one no-wrap unit.
    expect(html(keepThaiWords("เช็กอินเทอร์เน็ต แล้วกดลองใหม่อีกครั้งนะ"))).toBe(
      '<span class="whitespace-nowrap">เช็ก</span><span class="whitespace-nowrap">อินเทอร์เน็ต</span> ' +
        '<span class="whitespace-nowrap">แล้วกดลอง</span>ใหม่<span class="whitespace-nowrap">อีกครั้ง</span>นะ',
    );
    expect(html(keepThaiWords("แชทกลุ่มของคลาส"))).toBe('<span class="whitespace-nowrap">แชทกลุ่ม</span>ของคลาส');
  });

  it("keeps compound words whole", () => {
    expect(html(keepThaiWords("ตอนนี้เรียนสดกับคุณครู"))).toBe(
      '<span class="whitespace-nowrap">ตอนนี้</span><span class="whitespace-nowrap">เรียนสด</span>กับ' +
        '<span class="whitespace-nowrap">คุณครู</span>',
    );
  });

  it("keeps a number with its unit, across a plain or a no-break space", () => {
    expect(html(keepThaiWords("ภายใน 3–7 วันทำการ หรือ 14 วันหลังชำระเงิน"))).toBe(
      `ภายใน ${keep("3–7 วันทำการ")} หรือ ${keep("14 วัน")}หลัง${keep("ชำระเงิน")}`,
    );
    // thaiCopy() glues the short last word first: the pattern still has to match.
    expect(html(thaiCopy("ส่งภายใน 7 วัน"))).toBe(`ส่งภายใน ${keep("7 วัน")}`);
    expect(html(thaiCopy("เป้าหมายถัดไป · ⭐ รางวัล Milestone บทที่ 5"))).toBe(
      `เป้าหมาย${keep("ถัดไป")} · ⭐ รางวัล ${keep("Milestone บทที่ 5")}`,
    );
    expect(html(keepThaiWords("ทำบทที่ 4 ให้เสร็จก่อนนะ"))).toBe(`ทำ${keep("บทที่ 4")} ให้เสร็จก่อนนะ`);
  });

  it("keeps a time range and a day count in brackets whole", () => {
    expect(html(keepThaiWords("28 ก.ย. 26 - 12 ต.ค. 26 (รวม 11 วัน) เวลา 18:00-20:00 น."))).toBe(
      `28 ก.ย. 26 - 12 ต.ค. 26 ${keep("(รวม 11 วัน)")} ${keep("เวลา 18:00-20:00 น.")}`,
    );
    // Without the label the range alone stays whole, with or without spaces round the dash.
    expect(html(keepThaiWords("ทุกวันเสาร์ 9:00 - 10:30"))).toBe(`ทุกวันเสาร์ ${keep("9:00 - 10:30")}`);
  });

  it("reads a dot or a bracket in an entry as that character", () => {
    expect(html(keepThaiWords("ดาวน์โหลดไฟล์ปฏิทิน (.ics)"))).toBe(`ดาวน์โหลด${keep("ไฟล์ปฏิทิน (.ics)")}`);
    expect(keepThaiWords("ไฟล์ปฏิทิน (xics)")).toBe("ไฟล์ปฏิทิน (xics)");
    expect(html(keepThaiWords("เขียนถึง support@reading-advantage.com"))).toBe(
      `เขียนถึง ${keep("support@reading-advantage.com")}`,
    );
    expect(keepThaiWords("support@reading-advantageXcom")).toBe("support@reading-advantageXcom");
  });

  it("takes the longer entry when two start at the same letter", () => {
    // "ไม่ได้" alone would leave "รับ" free to drop to the next line.
    expect(html(keepThaiWords("หากไม่ได้รับหนังสือ"))).toBe(`หาก${keep("ไม่ได้รับ")}หนังสือ`);
    expect(html(keepThaiWords("ยังแนบไฟล์ไม่ได้"))).toBe(`ยัง${keep("แนบไฟล์ไม่ได้")}`);
    expect(html(keepThaiWords("เห็นพัฒนาการของตัวเอง"))).toBe(`เห็นพัฒนาการ${keep("ของตัวเอง")}`);
    expect(html(keepThaiWords("ยอดชำระต่อผู้เรียนต่อแพ็กเกจ"))).toBe(`ยอดชำระ${keep("ต่อผู้เรียน")}${keep("ต่อแพ็กเกจ")}`);
    expect(html(keepThaiWords("กลับช่องทางเดิมที่ใช้ชำระ"))).toBe(`กลับ${keep("ช่องทางเดิม")}${keep("ที่ใช้ชำระ")}`);
  });

  it("keeps the helper verb จะ and a conjunction with the word after them", () => {
    expect(html(keepThaiWords("บริษัทจะตรวจสอบและแจ้งผล"))).toBe(`บริษัท${keep("จะตรวจสอบ")}และแจ้งผล`);
    expect(html(keepThaiWords("แล้วบทนี้จะเปิดให้เรียน"))).toBe(`แล้วบทนี้${keep("จะเปิดให้เรียน")}`);
    expect(html(keepThaiWords("เลข CVV หรือเลขบัตรเต็ม"))).toBe(`${keep("เลข CVV")} ${keep("หรือเลขบัตร")}เต็ม`);
  });

  it("keeps a button name with the verb that points at it", () => {
    expect(html(keepThaiWords('ไม่ต้องกังวลนะ ลองกด "ลองอีกครั้ง" ดูได้เลย'))).toBe(
      `ไม่ต้องกังวลนะ ${keep("ลองกด &quot;ลองอีกครั้ง&quot;")} ดู${keep("ได้เลย")}`,
    );
    expect(html(keepThaiWords("เปิดแอปธนาคาร แล้วเลือก “สแกน”"))).toBe(
      `เปิด${keep("แอปธนาคาร")} ${keep("แล้วเลือก “สแกน”")}`,
    );
  });

  it("keeps the PromptPay how-to and the method description breaking at the phrase", () => {
    // Was "สแกน QR ด้วยแอป / ธนาคาร" in the 140px method card on a 320px screen.
    expect(html(keepThaiWords("สแกน QR ด้วยแอปธนาคาร"))).toBe(`สแกน QR ${keep("ด้วยแอปธนาคาร")}`);
    expect(html(keepThaiWords("กด “บันทึกรูป QR” เก็บไว้ในเครื่อง"))).toBe(
      `กด “บันทึกรูป QR” ${keep("เก็บไว้ในเครื่อง")}`,
    );
    // Was "... แล้วยืนยันการ / จ่ายเงิน" and "... ระบบจะเช็ก / ให้เอง" at 360.
    expect(html(keepThaiWords("เลือกรูป QR จากอัลบั้ม แล้วยืนยันการจ่ายเงิน"))).toBe(
      `เลือกรูป QR จากอัลบั้ม ${keep("แล้วยืนยันการจ่ายเงิน")}`,
    );
    expect(html(keepThaiWords("จ่ายเสร็จแล้วกลับมาที่หน้านี้ ระบบจะเช็กให้เอง"))).toBe(
      `จ่ายเสร็จ${keep("แล้วกลับ")}มาที่หน้านี้ ${keep("ระบบจะเช็กให้เอง")}`,
    );
    expect(html(keepThaiWords("มีอีกเครื่อง? ใช้แอปธนาคารสแกน QR บนจอนี้ได้เลย"))).toBe(
      `มีอีกเครื่อง? ใช้${keep("แอปธนาคาร")}สแกน QR บนจอนี้${keep("ได้เลย")}`,
    );
    // The prefix การ stays on its word.
    expect(html(keepThaiWords("การจ่ายเงินไม่สำเร็จ"))).toBe(`${keep("การจ่ายเงิน")}${keep("ไม่สำเร็จ")}`);
    expect(html(keepThaiWords("จ่ายเงินเรียบร้อยแล้ว"))).toBe(`${keep("จ่ายเงิน")}เรียบร้อยแล้ว`);
  });

  it("keeps หน้าคลาสเรียน whole, which หน้าคลาส alone would cut before เรียน", () => {
    expect(html(keepThaiWords("กลับไปหน้าคลาสเรียน"))).toBe(`กลับไป${keep("หน้าคลาสเรียน")}`);
    expect(html(keepThaiWords("ดูยอดจริงได้ในหน้าคลาสและตรวจสอบ"))).toBe(
      `${keep("ดูยอดจริง")}ได้ใน${keep("หน้าคลาส")}และ${keep("ตรวจสอบ")}`,
    );
    // enroll.fallbackBannerDesc: was "... ในหน้าคลาส / เรียน ..." at 390 and a last line of "ครูนะ" at 320.
    expect(
      html(thaiCopy("ตอนนี้สมัครคลาสนี้ไม่ได้ ลองดูคลาสอื่นในหน้าคลาสเรียน หรือขอลิงก์ใหม่จากครูนะ")),
    ).toBe(
      `${keep("ตอนนี้")}สมัครคลาสนี้${keep("ไม่ได้")} ลองดูคลาสอื่น${keep("ในหน้าคลาสเรียน")} ${keep("หรือขอลิงก์ใหม่จากครูนะ")}`,
    );
    // payment.promptpay.failedDescription: no line ends on "หรือ".
    expect(html(thaiCopy("กด “สร้าง QR ใหม่” เพื่อลองอีกครั้ง หรือติดต่อทีมงาน"))).toBe(
      `กด “สร้าง QR ใหม่” เพื่อลอง${keep("อีกครั้ง")} ${keep("หรือติดต่อทีมงาน")}`,
    );
    // payment.card.createCardTokenFailed (a toast): at 320 a line ended on "และ" before "CVV อีกครั้งนะ".
    expect(html(thaiCopy("ข้อมูลบัตรไม่ถูกต้อง ลองเช็กเลขบัตร วันหมดอายุ และ CVV อีกครั้งนะ"))).toBe(
      `ข้อมูลบัตรไม่${keep("ถูกต้อง")} ลอง${keep("เช็ก")}${keep("เลขบัตร")} ${keep("วันหมดอายุ")} ${keep("และ CVV อีกครั้งนะ")}`,
    );
  });

  it("keeps names and each part of the company address whole", () => {
    expect(html(keepThaiWords("Reading Advantage และ Primary Advantage ผ่าน Student LIFF Portal"))).toBe(
      `${keep("Reading Advantage")} และ ${keep("Primary Advantage")} ผ่าน ${keep("Student LIFF Portal")}`,
    );
    expect(html(keepThaiWords(businessContact.address))).toBe(
      `322/132 ${keep("หมู่ที่ 20")} ${keep("ตำบลบ้านเป็ด")} ${keep("อำเภอเมืองขอนแก่น")} ${keep("จังหวัดขอนแก่น 40000")}`,
    );
  });

  it("keeps the payment terms readable and complete", () => {
    expect(html(keepThaiWords("บริษัทสงวนสิทธิ์ไม่รับยกเลิกคำสั่งซื้อทุกกรณี"))).toBe(
      `บริษัท${keep("สงวนสิทธิ์")}${keep("ไม่รับ")}ยกเลิก${keep("คำสั่งซื้อ")}${keep("ทุกกรณี")}`,
    );
    for (const text of Object.values(checkoutPolicy)) {
      const rendered = html(keepThaiWords(text)).replace(/<[^>]+>/g, "");
      expect(rendered).toBe(text);
    }
  });
});

describe("thaiCopy", () => {
  it("returns non-string content unchanged", () => {
    const node = <b>ตอนนี้</b>;
    expect(thaiCopy(node)).toBe(node);
    expect(thaiCopy(undefined)).toBeUndefined();
  });

  it("glues a short last word and the repeat mark ๆ to the word before", () => {
    expect(thaiCopy("คุยกับเพื่อน ๆ ในคลาส A1")).toBe("คุยกับเพื่อน ๆ ในคลาส A1");
  });

  it("keeps every character of the text", () => {
    const text = "การสมัครเรียนยังไม่เสร็จ ชำระเงินแล้วเข้าห้องเรียนได้เลย";
    const rendered = html(thaiCopy(text)).replace(/<[^>]+>/g, "");
    expect(rendered).toBe(text);
  });
});
