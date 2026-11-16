import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NBSP } from "./format";
import { t, th, tutorLegalCopy } from "./i18n";
import { bilingualCopy, keepThaiWords, thaiCopy, thaiLabel } from "./thaiText";

const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);
const keep = (text: string) => `<span class="whitespace-nowrap">${text}</span>`;
const block = (inner: string) => `<span class="inline-block max-w-full">${inner}</span>`;
/** The text content of the rendered node, as a browser or a screen reader gets it. */
const plain = (node: ReactNode) =>
  html(node)
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const spaces = (text: string) => text.replaceAll(NBSP, " ");

/** Every string of the tutor dictionary and of the legal pages. */
function allCopy(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => allCopy(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => allCopy(item, out));
  return out;
}
const TUTOR_COPY = [...allCopy(th), ...allCopy(tutorLegalCopy)];

describe("keepThaiWords: the list ported from the student app", () => {
  it("keeps a run ICU mis-segments whole, longest entry first", () => {
    // ICU splits "แล้วก|ดล|อง": the whole run must be one no-wrap unit.
    expect(html(keepThaiWords("เช็กอินเทอร์เน็ต แล้วกดลองใหม่อีกครั้งนะ"))).toBe(
      `${keep("เช็ก")}${keep("อินเทอร์เน็ต")} ${keep("แล้วกดลอง")}ใหม่${keep("อีกครั้ง")}นะ`,
    );
    expect(html(keepThaiWords("แชทกลุ่มของคลาส"))).toBe(`${keep("แชทกลุ่ม")}${keep("ของคลาส")}`);
  });

  it("keeps compound words whole", () => {
    expect(html(keepThaiWords("ตอนนี้เรียนสดกับคุณครู"))).toBe(`${keep("ตอนนี้")}${keep("เรียนสด")}กับ${keep("คุณครู")}`);
  });

  it("keeps a number with its unit, across a plain or a no-break space", () => {
    expect(html(keepThaiWords("ภายใน 3–7 วันทำการ หรือ 14 วันหลังชำระเงิน"))).toBe(
      `ภายใน ${keep("3–7 วันทำการ")} หรือ ${keep("14 วัน")}หลัง${keep("ชำระเงิน")}`,
    );
    // thaiCopy() glues the short last word first: the pattern still has to match.
    expect(html(thaiCopy("ส่งภายใน 7 วัน"))).toBe(`ส่งภายใน ${keep(`7${NBSP}วัน`)}`);
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
    expect(keepThaiWords("support@reading-advantageXcom")).toBe("support@reading-advantageXcom");
  });

  it("takes the longer entry when two start at the same letter", () => {
    // "ไม่ได้" alone would leave "รับ" free to drop to the next line.
    expect(html(keepThaiWords("หากไม่ได้รับหนังสือ"))).toBe(`หาก${keep("ไม่ได้รับ")}หนังสือ`);
    expect(html(keepThaiWords("ยังแนบไฟล์ไม่ได้"))).toBe(`ยัง${keep("แนบไฟล์ไม่ได้")}`);
    expect(html(keepThaiWords("กลับไปหน้าคลาสเรียน"))).toBe(`กลับไป${keep("หน้าคลาสเรียน")}`);
  });

  it("keeps a button name with the verb that points at it", () => {
    expect(html(keepThaiWords('ไม่ต้องกังวลนะ ลองกด "ลองอีกครั้ง" ดูได้เลย'))).toBe(
      `ไม่ต้องกังวลนะ ${keep("ลองกด &quot;ลองอีกครั้ง&quot;")} ดู${keep("ได้เลย")}`,
    );
  });
});

describe("keepThaiWords: tutor copy", () => {
  it("keeps the words ICU cuts mid-syllable", () => {
    // Was "เช็ / กชื่อ", "คลา / วด์" and "คอมมิช / ชัน" on the attendance and legal pages.
    expect(html(keepThaiWords("ระบบจะบันทึกคาบนี้เมื่อคุณเช็กชื่อและกดบันทึก"))).toBe(
      `ระบบจะบันทึกคาบนี้เมื่อคุณ${keep("เช็กชื่อ")}และกดบันทึก`,
    );
    expect(html(keepThaiWords("ผู้ให้บริการคลาวด์"))).toBe(`ผู้ให้บริการ${keep("คลาวด์")}`);
    // A loan word and a compound ICU has no entry for: was "สีคอน / เฟตตี" and "ลิงก์ผู้ / แนะนำ".
    expect(html(keepThaiWords("สีคอนเฟตตีบนแคนวาส"))).toBe(`สี${keep("คอนเฟตตี")}บนแคนวาส`);
    expect(html(keepThaiWords("ไม่มีผู้แนะนำ"))).toBe(`ไม่มี${keep("ผู้แนะนำ")}`);
    expect(html(keepThaiWords("ดูคอมมิชชันและโบนัสได้อย่างโปร่งใส"))).toBe(
      `ดู${keep("คอมมิชชัน")}และโบนัสได้${keep("อย่างโปร่งใส")}`,
    );
  });

  it("takes the longer tutor entry when two start at the same letter", () => {
    expect(html(keepThaiWords("เรทคอมมิชชันของคุณ"))).toBe(`${keep("เรทคอมมิชชัน")}${keep("ของคุณ")}`);
    expect(html(keepThaiWords("รับค่าคอมมิชชันเร็วขึ้น"))).toBe(`รับ${keep("ค่าคอมมิชชันเร็วขึ้น")}`);
    expect(html(keepThaiWords("โบนัสเครือข่ายพิเศษ"))).toBe(keep("โบนัสเครือข่ายพิเศษ"));
    expect(html(keepThaiWords("โบนัสเครือข่าย และเครือข่ายของคุณ"))).toBe(
      `${keep("โบนัสเครือข่าย")} และ${keep("เครือข่าย")}${keep("ของคุณ")}`,
    );
    expect(html(keepThaiWords("เข้าเรียนสดของเล่มใหม่"))).toBe(`${keep("เข้าเรียนสด")}ของ${keep("เล่มใหม่")}`);
    expect(html(keepThaiWords("นักเรียนเข้าเรียนฟรีผ่านลิงก์"))).toBe(`นักเรียน${keep("เข้าเรียนฟรี")}ผ่านลิงก์`);
    expect(html(keepThaiWords("กดเข้าเรียนได้"))).toBe(`กด${keep("เข้าเรียน")}ได้`);
    // A closing phrase takes the word before it, so the last line is not "ได้ทันที" or "บัตรประชาชน" alone.
    expect(html(keepThaiWords("หรือสร้างห้องเรียนได้ทันที"))).toBe(`หรือ${keep("สร้างห้องเรียนได้ทันที")}`);
    expect(html(keepThaiWords("กดสร้างห้องเรียน"))).toBe(`กด${keep("สร้างห้องเรียน")}`);
    expect(html(keepThaiWords("แนบบัตรประชาชน"))).toBe(`แนบ${keep("บัตรประชาชน")}`);
    // The passive marker and the nominaliser stay with their verb: was "ถูก / เข้ารหัส" and "การ / อ่านรูป".
    expect(html(keepThaiWords("เลขพาสปอร์ตถูกเข้ารหัส"))).toBe(`${keep("เลขพาสปอร์ต")}${keep("ถูกเข้ารหัส")}`);
    // "ไม่ได้รับ" alone would leave "อนุญาต" free; "ไม่ได้" alone would leave "ยืนยัน" free.
    expect(html(keepThaiWords("โดยไม่ได้รับอนุญาต"))).toBe(`โดย${keep("ไม่ได้รับอนุญาต")}`);
    expect(html(keepThaiWords("นี้ยังไม่ได้ยืนยัน"))).toBe(`นี้${keep("ยังไม่ได้ยืนยัน")}`);
    // "หรือเลขบัตร" (student list) alone would leave "เต็ม" free.
    expect(html(keepThaiWords("รหัส CVV หรือเลขบัตรเต็ม ทีมงาน"))).toBe(
      `${keep("รหัส CVV")} ${keep("หรือเลขบัตรเต็ม")} ${keep("ทีมงาน")}`,
    );
  });

  it("keeps the login page copy whole", () => {
    expect(html(thaiCopy(t("app.loginHeroLead")))).toBe(
      `${keep("จัดการคลาส")} ติดตามรายได้ และดูแล${keep("เครือข่าย")}${keep("ของคุณ")}${keep("ได้ในที่เดียว")}`,
    );
    expect(html(thaiCopy(t("app.loginTrustSecure")))).toBe(
      `${keep("ข้อมูลของคุณ")}ปลอดภัย ${keep("เข้าสู่ระบบ")}ผ่าน${keep("บัญชี Google")}`,
    );
    expect(html(thaiCopy(t("app.loginBenefitLessons")))).toBe(
      `${keep("เข้าถึง")}แผน${keep("การสอน")} ${keep("18 ขั้นตอน")}${keep("ที่พร้อมใช้")}`,
    );
  });

  it("keeps the closing phrase of each login error whole", () => {
    expect(html(thaiCopy(t("app.loginErrorNotTutor")))).toBe(
      `บัญชีนี้ยัง${keep("ไม่ได้")}${keep("ลงทะเบียน")}เป็นครู กรุณา${keep("เข้าสู่ระบบ")}ด้วยอีเมลที่แจ้งกับ${keep("ทีมงาน")} ${keep("หรือติดต่อแอดมิน")}`,
    );
    expect(html(thaiCopy(t("app.loginErrorSuspended")))).toBe(
      `บัญชีนี้ถูกระงับการ${keep("ใช้งาน")} กรุณา${keep("ติดต่อแอดมิน")}`,
    );
    expect(html(thaiCopy(t("app.loginErrorServer")))).toBe(`ระบบขัดข้องชั่วคราว กรุณา${keep("ลองใหม่อีกครั้ง")}`);
    expect(html(thaiCopy(t("app.loginErrorFacebook")))).toContain(keep("กรุณาใช้ Google"));
    expect(html(thaiCopy(t("app.loginErrorEmailNotVerified")))).toContain(
      `${keep("บัญชี Google")} นี้${keep("ยังไม่ได้ยืนยัน")}`,
    );
  });

  it("keeps each listed word of the copy it was added for", () => {
    const cases: Array<[string, string[]]> = [
      [tutorLegalCopy.privacy.intro, ["Tutor Advantage", "ให้ความสำคัญ", "ครูผู้สอน"]],
      [t("app.legalContactBody"), ["ทีมงาน", "Tutor Advantage", "LINE Official"]],
      [t("app.notFoundBody"), ["ถูกต้อง", "ถูกย้ายแล้ว"]],
      [t("dashboardHome.unlockHint"), ["การสอน", "เรทคอมมิชชัน", "ที่สูงขึ้น"]],
      [t("dashboardHome.noNextClassHint"), ["คาบถัดไป", "จะแสดงที่นี่"]],
      [t("dashboardPerformance.remainingSuffix"), ["เรทคอมมิชชัน", "ที่สูงขึ้น!"]],
      [t("dashboardPerformance.pageDescription"), ["คำตอบ", "สรุปย้อนหลัง"]],
      [t("dashboardEarnings.pageDescription"), ["การสอน", "โบนัสเครือข่าย", "ประวัติการจ่ายเงิน"]],
      [t("dashboardEarnings.projectionWHTNote"), ["หัก ณ ที่จ่าย 3%", "เมื่อปิดรอบจ่ายเงิน"]],
      [t("dashboardEarnings.projectionWHTNoteNonResident"), ["หัก ณ ที่จ่าย 15%", "เมื่อปิดรอบจ่ายเงิน"]],
      [t("dashboardEarnings.historyDescription"), ["รอบจ่ายเงิน"]],
      [t("dashboardNetwork.pageDescription"), ["ผลตอบแทนเครือข่าย"]],
      [t("dashboardNetwork.inviteLinkHint"), ["เข้าร่วม", "ทีมของคุณ"]],
      [t("dashboardNetwork.volumeDescription"), ["เมื่อปิดรอบ"]],
      [t("dashboardSettings.subtitle"), ["ความเป็นส่วนตัว", "บัญชีรับเงิน"]],
      [t("dashboardSettings.payoutUnverified"), ["ยืนยันตัวตน", "บัญชีรับเงิน"]],
      [t("dashboardSettings.themeHint"), ["การตั้งค่าของเครื่อง"]],
      [t("dashboardSettings.verifySectionDescription"), ["แต่ละรายการแยกกัน"]],
      [t("dashboardSettings.addressHint"), ["ใบ 50 ทวิ", "รหัสไปรษณีย์"]],
      [t("dashboardSettings.taxInfoHint"), ["ใบ 50 ทวิ", "กรอกตามบัตรประชาชน"]],
      [t("dashboardSettings.kycPrivacyBody"), ["ตรวจสอบ", "ที่เปิดดูได้"]],
      [t("dashboardSettings.fileDropHint"), ["ลากไฟล์มาวาง"]],
      [t("dashboardSettings.privacyNoticeBody"), ["รูปหน้าพาสปอร์ต", "ถูกเข้ารหัส", "การอ่านรูป"]],
      [t("dashboardEarnings.holdNoticeBody"), ["ค่าคอมมิชชัน", "ค่าคอมมิชชันเร็วขึ้น"]],
      [t("dashboardSupport.emptyDescription"), ["การจ่ายเงิน", "การใช้งานแอป", "ส่งคำร้อง", "ทีมงาน", "ได้เลย"]],
      [t("dashboardSupport.classHint"), ["คลาสใดคลาสหนึ่ง"]],
      [t("dashboardSupport.privacyBody"), ["รหัส OTP", "รหัส CVV", "หรือเลขบัตรเต็ม", "แนบไฟล์ไม่ได้", "ในตอนนี้"]],
      [t("dashboardChat.subtitle"), ["ผู้ปกครอง", "เพื่อความปลอดภัย)"]],
      [t("dashboardSchedule.calendarSyncDescription"), ["Google Calendar", "ก่อนสอน 30 นาที"]],
      [t("demo.createHint"), ["ของหนังสือ", "เข้าเรียนฟรี"]],
      [t("demo.howLine1"), ["เลือกหนังสือได้เอง", "บทเรียนแรกของหนังสือ"]],
      [t("demo.howLine2"), ["เข้าเรียนฟรี", "ที่ครูส่งให้", "ไม่ต้องจ่ายเงิน"]],
      [t("demo.howLine3"), ["24 ชม.", "หลังสร้าง", "จะถูกบันทึกปกติ"]],
      [`${t("verification.missingPrefix")} ${t("verification.bankBook")}`, ["สมุดบัญชีธนาคาร"]],
      [t("lesson.selectLessonStepDescription"), ["ที่จะสอนในวันนี้"]],
      [t("lesson.preflow.hub.selectDescription"), ["เลือกบทที่จะสอน"]],
      [t("lesson.preflow.prepare.explorePoint2"), ["ในบทเรียน"]],
      [t("lesson.interactive.pairTutorTip3"), ["2-3 นาที", "อีกฝ่ายพูดบ้าง"]],
      [t("tutorClass.lessons.description"), ["สร้างห้องเรียนได้ทันที"]],
      [t("tutorClass.voice.description"), ["หรือบทสนทนา"]],
      [t("tutorClass.newClass.meetingUrlHelp"), ["เข้าเรียน", "ที่ชำระเงินแล้ว"]],
      [t("lesson.shareClassLinkDescription"), ["QR Code", "ในห้องเรียน"]],
      [t("lesson.teachDescription"), ["ของบทเรียน", "18 ขั้นตอน (4 คาบ)"]],
      [t("lesson.preflow.prepare.guidedPoint1"), ["ของบทเรียน"]],
      [t("tutorClass.newClass.couponHelp"), ["ให้นักเรียน —", "จะไม่เก็บค่าเรียน"]],
      [t("tutorClass.dev.simulatorTitle"), ["ทั้งเล่ม"]],
      [t("tutorClass.dev.simulatorDescription"), ["การเลื่อนเล่ม"]],
      [t("dashboardSettings.privacyDescription"), ["ข้อมูลส่วนบุคคลของคุณ"]],
      [t("dashboardSchedule.weekEmptyDescription"), ["ที่กำหนดไว้"]],
      [t("lesson.live.lobbyConfirmDescription"), ["ในบทเรียนนี้", "เริ่มสอนใหม่", "ที่ขั้น 1"]],
      [t("lesson.live.removeConfirmDescription"), ["ของนักเรียน", "คนอื่นรอ", "อีกครั้ง", "ได้เอง"]],
      [t("lesson.live.gameIdleHelp"), ["ด้านล่าง", "จะเห็น", "รายการ", "ที่อยากเล่น"]],
    ];
    for (const [text, phrases] of cases) {
      const rendered = html(keepThaiWords(text));
      for (const phrase of phrases) expect(rendered, `${phrase} in ${text}`).toContain(keep(phrase));
    }
  });

  it("keeps the phrases of the legal pages whole", () => {
    // Each was a split or a one-word last line on /privacy or /terms at 320: "เลขประจำ / ตัวผู้เสียภาษี",
    // "ให้บุคคล / ภายนอก", "ที่เข้า / รหัส", "ที่มี / ลิขสิทธิ์", "แพลตฟอร์ม / ของเรา", "หรือ / ล้าสมัย";
    // a line does not end with the linking word either ("ที่ / เข้ารหัส", "ถือ / เป็นการยอมรับ", "ที่ / ระบุ",
    // "ที่ / ผิดปกติ", "อย่าง / ต่อเนื่อง") and a list item does not end on one word ("เพื่อเชิญ / นักเรียน",
    // "และเป็น / ปัจจุบัน", "ลิงก์ผู้ / แนะนำ", "เลขประจำตัวผู้เสียภาษี / หากมี").
    const legal = allCopy(tutorLegalCopy);
    const phrases = [
      "เลขประจำตัวผู้เสียภาษีหากมี",
      "บุคคลภายนอก",
      "ข้อมูลส่วนบุคคลของคุณ",
      "ข้อมูลของคุณ",
      "ข้อมูลบัญชี",
      "หรือล้าสมัย",
      "ที่เข้ารหัส",
      "แพลตฟอร์มของเรา",
      "สื่อประกอบการสอน",
      "ลิงก์แนะนำของคุณ",
      "ตามวัตถุประสงค์ที่กำหนด",
      "ที่มีลิขสิทธิ์",
      "เสียชื่อเสียง",
      "ถือเป็นการยอมรับ",
      "ที่ระบุ",
      "ที่ผิดปกติ",
      "อย่างต่อเนื่อง",
      "เพื่อเชิญนักเรียน",
      "และเป็นปัจจุบัน",
      "ลิงก์ผู้แนะนำ",
    ];
    for (const phrase of phrases) {
      const texts = legal.filter((text) => text.includes(phrase));
      expect(texts.length, phrase).toBeGreaterThan(0);
      for (const text of texts) expect(html(thaiCopy(text)), `${phrase} in ${text}`).toContain(keep(phrase));
    }
  });

  it("keeps a number with its unit or label", () => {
    // tutorClass.schedule.autoHelpPrefix + hours: was "... จนครบ / 22 ชม." at 320.
    expect(html(thaiCopy(`${t("tutorClass.schedule.autoHelpPrefix")} 22 ชม.`))).toContain(
      `ให้${keep(`จนครบ 22${NBSP}ชม.`)}`,
    );
    expect(html(keepThaiWords("ห้องหมดอายุอัตโนมัติใน 24 ชม. หลังสร้าง"))).toBe(
      `ห้อง${keep("หมดอายุ")}อัตโนมัติใน ${keep("24 ชม.")} ${keep("หลังสร้าง")}`,
    );
    expect(html(keepThaiWords("จ่ายในรอบปิดยอดแรกหลังพ้น 14 วัน ส่วน PromptPay หลังพ้น 3 วัน"))).toBe(
      `จ่ายใน${keep("รอบปิดยอดแรก")}${keep("หลังพ้น 14 วัน")} ส่วน PromptPay ${keep("หลังพ้น 3 วัน")}`,
    );
    expect(html(keepThaiWords("แอดมินเห็นเฉพาะ 4 ตัวท้าย"))).toBe(`${keep("แอดมิน")}เห็นเฉพาะ ${keep("4 ตัวท้าย")}`);
    expect(html(keepThaiWords("ให้เวลาคุยคู่ละ 2-3 นาที แล้วสลับ"))).toBe(`ให้เวลาคุยคู่ละ ${keep("2-3 นาที")} แล้วสลับ`);
    expect(html(keepThaiWords("กลับไปสอนต่อที่เฟส 7"))).toBe(`กลับไปสอนต่อ${keep("ที่เฟส 7")}`);
    // The step count keeps the lesson count in brackets after it; each also stays whole on its own.
    expect(html(keepThaiWords("แผนการสอน 18 ขั้นตอน (4 คาบ)"))).toBe(`แผน${keep("การสอน")} ${keep("18 ขั้นตอน (4 คาบ)")}`);
    expect(html(keepThaiWords("รวม 15 ขั้นตอน ใน (4 คาบ)"))).toBe(`รวม ${keep("15 ขั้นตอน")} ใน ${keep("(4 คาบ)")}`);
    // The count beside the presenter's "ประโยคหลัก" heading: the dot, the number and the unit stay together.
    expect(html(thaiLabel(`· 5 ${t("lesson.interactive.keySentenceCountSuffix")}`))).toBe(
      `${keep("· 5 ประโยค")}ที่มี${keep("คำศัพท์ประกอบ")}`,
    );
    // A dash stays with the word before it, so no line starts with "—".
    expect(html(keepThaiWords(t("tutorClass.newClass.couponHelp")))).toContain(keep("ให้นักเรียน —"));
    // The network part of the wallet sub-line stays whole, also when the last amount is glued.
    expect(html(thaiCopy("คอมมิชชัน 50% จากยอดส่วนตัว ฿5,000 + โบนัสเครือข่าย ฿375"))).toContain(
      keep("+ โบนัสเครือข่าย ฿375"),
    );
    expect(html(thaiCopy("คอมมิชชัน 50% จากยอดส่วนตัว ฿0 + โบนัสเครือข่าย ฿0"))).toContain(
      keep(`+ โบนัสเครือข่าย${NBSP}฿0`),
    );
  });

  it("keeps the figure of a badge with its comparison word and unit", () => {
    expect(html(keepThaiWords("ตอบกลับนักเรียนเฉลี่ยไม่เกิน 15 นาที"))).toBe(
      `${keep("ตอบกลับ")}นักเรียนเฉลี่ย${keep("ไม่เกิน 15 นาที")}`,
    );
    expect(html(keepThaiWords("สร้าง Interactive Session เกิน 10 ครั้ง"))).toBe(
      `สร้าง Interactive Session ${keep("เกิน 10 ครั้ง")}`,
    );
    expect(html(keepThaiWords("ผลตอบคำถามของนักเรียนเฉลี่ยเกิน 80%"))).toBe(
      `ผลตอบคำถาม${keep("ของนักเรียน")}เฉลี่ย${keep("เกิน 80%")}`,
    );
    // thaiCopy() glues the short figure first: the pattern still has to match.
    expect(html(thaiCopy("เรตติ้งเฉลี่ยสูงกว่า 4.8"))).toBe(`เรตติ้งเฉลี่ย${keep(`สูงกว่า${NBSP}4.8`)}`);
    expect(html(keepThaiWords("ชั่วโมงสอนทะลุเป้า"))).toBe(`ชั่วโมงสอน${keep("ทะลุเป้า")}`);
  });

  it("keeps an English term in brackets and a mixed Thai-Latin run whole", () => {
    expect(html(keepThaiWords("เขียนแบบมีโครง (Guided Writing)"))).toBe(`เขียนแบบมีโครง ${keep("(Guided Writing)")}`);
    expect(html(keepThaiWords("ถามคำถามภาษา (Language Questions)"))).toBe(
      `ถามคำถามภาษา ${keep("(Language Questions)")}`,
    );
    expect(html(keepThaiWords("สร้างคลาสและรับ Referral Link"))).toBe(`สร้างคลาสและรับ ${keep("Referral Link")}`);
    expect(html(keepThaiWords("ให้เข้าใหม่ด้วย Class ID เดิม"))).toBe(`ให้เข้าใหม่ด้วย ${keep("Class ID เดิม")}`);
    expect(html(keepThaiWords("ถามคำถาม pre-reading สร้าง curiosity"))).toBe(
      `ถามคำถาม pre-reading ${keep("สร้าง curiosity")}`,
    );
  });

  it("keeps every character of every tutor string", () => {
    for (const text of TUTOR_COPY) {
      expect(plain(keepThaiWords(text))).toBe(text);
    }
  });
});

describe("thaiCopy", () => {
  it("returns non-string content unchanged", () => {
    const node = <b>ตอนนี้</b>;
    expect(thaiCopy(node)).toBe(node);
    expect(thaiCopy(undefined)).toBeUndefined();
    expect(thaiCopy(null)).toBeNull();
  });

  it("glues a short last word and the repeat mark ๆ to the word before", () => {
    expect(thaiCopy("คุยกับเพื่อน ๆ ในคลาส A1")).toBe(`คุยกับเพื่อน${NBSP}ๆ ในคลาส${NBSP}A1`);
  });

  it("changes nothing in tutor copy but a space into a no-break space", () => {
    for (const text of TUTOR_COPY) {
      expect(spaces(plain(thaiCopy(text)))).toBe(spaces(text));
    }
  });
});

describe("thaiLabel", () => {
  it("keeps listed words whole and adds no no-break space", () => {
    // thaiCopy() would glue "A1"; a label keeps its text as written.
    expect(thaiLabel("ระดับ A1")).toBe("ระดับ A1");
    expect(html(thaiLabel(t("tutorClass.detailView.progressTitle")))).toBe(`ความคืบหน้า${keep("ของคลาส")}`);
    expect(html(thaiLabel(t("lesson.interactive.studentsLeftTitle")))).toBe(`นักเรียน${keep("ออกจากห้อง")}หมดแล้ว`);
    expect(html(thaiLabel(t("lesson.live.rosterReadyTitle")))).toBe(`ความพร้อม${keep("ของนักเรียน")}`);
    expect(html(thaiLabel(t("lesson.interactive.fillBlankPrefix")))).toBe(`เติมคำใน${keep("ช่องว่าง:")}`);
  });

  it("returns non-string content unchanged", () => {
    const node = <b>ชื่อคลาส</b>;
    expect(thaiLabel(node)).toBe(node);
    expect(thaiLabel(undefined)).toBeUndefined();
  });

  it("leaves the text content of every tutor string exactly as written", () => {
    for (const text of TUTOR_COPY) {
      expect(plain(thaiLabel(text))).toBe(text);
    }
  });
});

describe("bilingualCopy", () => {
  it("puts each language of a Thai · English line in its own block, the dot leading the English one", () => {
    expect(html(bilingualCopy(t("dashboardSettings.passportTaxInfoHint")))).toBe(
      `${block(`กรอกตาม${keep("หนังสือเดินทาง")}`)} ${block(`· As shown on ${keep("your passport")}`)}`,
    );
    // The English half ends on two words together ("accounts only."), never on one.
    expect(html(bilingualCopy(t("dashboardSettings.bankNameMustMatchId")))).toContain(
      block(`· Account name must match your ID. Thai bank ${keep("accounts only.")}`),
    );
    expect(html(bilingualCopy(t("dashboardSettings.teachingFromThailandHint")))).toContain(keep("work permit"));
  });

  it("puts an English gloss in brackets in its own block", () => {
    expect(html(bilingualCopy(t("dashboardSettings.passportNameLabel"), { label: true }))).toBe(
      `ชื่อ-นามสกุลตาม${keep("หนังสือเดินทาง")} ${block(`(Full name as ${keep("on passport)")}`)}`,
    );
    expect(html(bilingualCopy(t("dashboardSettings.teachingLocationLabel"), { label: true }))).toBe(
      `คุณสอนจากที่ใด ${block(`(Where do you ${keep("teach from?)")}`)}`,
    );
    // A one-word gloss has nothing to keep together.
    expect(html(bilingualCopy("สัญชาติ (Nationality)", { label: true }))).toBe(`สัญชาติ ${block("(Nationality)")}`);
  });

  it("leaves Thai or numeric brackets in the Thai text", () => {
    expect(html(bilingualCopy("ใบรับรอง (50 ทวิ) ของปีนี้"))).toBe(`ใบรับรอง (50 ทวิ) ของปีนี้`);
    expect(html(bilingualCopy("ผู้รับเงิน (ผู้ไม่มีถิ่นที่อยู่)"))).not.toContain("inline-block");
  });

  it("keeps listed names whole inside the English half", () => {
    expect(html(bilingualCopy(t("dashboardSettings.scanTitle")))).toContain(
      block(`· ${keep("Auto-fill")} from ${keep("passport photo")}`),
    );
    expect(html(bilingualCopy(t("dashboardSettings.scanDisclosure")))).toContain(keep("Google Gemini"));
  });

  it("returns non-string content unchanged", () => {
    const node = <b>Passport</b>;
    expect(bilingualCopy(node)).toBe(node);
    expect(bilingualCopy(undefined)).toBeUndefined();
  });

  it("as a label, leaves the text content of every tutor string exactly as written", () => {
    for (const text of TUTOR_COPY) {
      expect(plain(bilingualCopy(text, { label: true }))).toBe(text);
    }
  });

  it("as copy, changes nothing but a space into a no-break space", () => {
    for (const text of TUTOR_COPY) {
      expect(spaces(plain(bilingualCopy(text)))).toBe(spaces(text));
    }
  });
});
