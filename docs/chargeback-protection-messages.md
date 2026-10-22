# Ready-to-send messages (chargeback protection, 2026-10-22)

Edit names/dates before sending.

---

## 1. Announcement to tutors (Thai)

**เรื่อง: ปรับรอบการจ่ายค่าคอมมิชชัน เพื่อความปลอดภัยของรายได้ทุกคน**

สวัสดีครับคุณครูทุกท่าน

เพื่อป้องกันการทุจริตจากการชำระเงินแล้วเรียกเงินคืนกับธนาคารภายหลัง ซึ่งจะกระทบรายได้ของครูทุกคนในเครือข่าย ตั้งแต่วันที่ [วันที่เริ่ม] เราปรับรอบการจ่ายค่าคอมมิชชันดังนี้

- **นักเรียนชำระผ่าน PromptPay:** ค่าคอมมิชชันจ่ายในรอบปิดยอดแรกหลังชำระครบ 7 วัน
- **นักเรียนชำระด้วยบัตรเครดิต/เดบิต:** ค่าคอมมิชชันจ่ายในรอบปิดยอดแรกหลังชำระครบ 60 วัน (ช่วงที่ธนาคารยังรับเรื่องเรียกเงินคืนได้)
- ยอด "ประมาณการเดือนนี้" ในแอปคือยอดขายของเดือนนี้ เงินจริงจะเข้าตามรอบข้างต้น ดูคำอธิบายได้ที่หน้า "รายได้ของฉัน"
- ครูใหม่ในช่วง 90 วันแรก รับชำระด้วยบัตรได้ไม่เกิน 30,000 บาทต่อ 30 วัน ส่วน PromptPay ไม่จำกัด ครูที่มีนักเรียนประจำอยู่แล้วแจ้งทีมงานเพื่อขอยกเว้นได้
- ถ้ารายการถูกคืนเงินหรือถูกเรียกเงินคืนหลังจากจ่ายค่าคอมมิชชันไปแล้ว ระบบจะหักคืนจากรายได้รอบถัดไป

**คำแนะนำ:** ให้นักเรียนชำระผ่าน PromptPay จะได้รับค่าคอมมิชชันเร็วที่สุด

ขอบคุณที่ช่วยกันดูแลให้ระบบปลอดภัยสำหรับทุกคนครับ
ทีม Tutor Advantage

---

## 2. Announcement to tutors (English)

**Subject: Commission payout timing update — protecting everyone's income**

Dear tutors,

To protect the network from payment fraud (paying and later reversing the charge
with the bank), from [start date] commission is paid as follows:

- **PromptPay payments:** in the first monthly payout after 7 days.
- **Card payments:** in the first monthly payout after 60 days (the period in
  which banks still accept chargebacks).
- "This month's estimate" in the app shows this month's sales; the money
  arrives on the schedule above (see the "My earnings" page).
- New tutors (first 90 days) can accept up to 30,000 THB of card payments per
  30 days; PromptPay is unlimited. Established tutors can ask us for an exemption.
- If a payment is refunded or charged back after its commission was paid, the
  commission is deducted from the next payout.

**Tip:** ask students to pay with PromptPay to receive your commission fastest.

Thank you,
The Tutor Advantage team

---

## 3. Email to Omise support (English)

**To:** support@omise.co (or your Omise account manager)
**Subject:** Request: enforce 3-D Secure for all card charges + webhook events — [Merchant name / account email]

Hello Omise team,

We are [company name] (Omise account: [account email], live mode). We are about
to start accepting card payments and would like to reduce chargeback risk.

1. Please **enable and enforce 3-D Secure (and passkey, if available) for all
   card charges** on our account, with no frictionless bypass for our use case
   if possible. Please confirm whether liability shift applies to
   3DS-authenticated charges for fraud-related disputes.
2. Please confirm our webhook endpoint `https://[finance service URL]/v1/payments/webhook`
   receives these events: `charge.complete`, `charge.update`, `refund.create`,
   `dispute.create`, `dispute.update`, `dispute.accept`, `dispute.close`.
3. Are there additional fraud-screening options (velocity rules, BIN/country
   restrictions, risk scoring) available for our account?
4. What is the dispute fee and the typical response deadline for submitting
   evidence on a dispute?

Thank you,
[Name], [Role]
[Company], [Phone]

---

## 4. อีเมลถึง Omise (ฉบับภาษาไทย)

**เรื่อง:** ขอเปิดใช้ 3-D Secure บังคับทุกรายการบัตร และตรวจสอบการตั้งค่า webhook — [ชื่อร้านค้า / อีเมลบัญชี]

เรียนทีมงาน Omise

บริษัท [ชื่อบริษัท] (บัญชี Omise: [อีเมลบัญชี], live mode) กำลังจะเริ่มรับชำระด้วยบัตร และต้องการลดความเสี่ยงจากการเรียกเงินคืน จึงขอความช่วยเหลือดังนี้

1. ขอ**เปิดและบังคับใช้ 3-D Secure (และ passkey ถ้ามี) กับทุกรายการบัตร** และขอยืนยันว่ารายการที่ผ่าน 3DS ได้รับการโอนความรับผิดชอบ (liability shift) ในกรณีข้อโต้แย้งเรื่องการทุจริตหรือไม่
2. ขอยืนยันว่า webhook `https://[URL ของ finance service]/v1/payments/webhook` ได้รับ event: `charge.complete`, `charge.update`, `refund.create`, `dispute.create`, `dispute.update`, `dispute.accept`, `dispute.close`
3. มีเครื่องมือคัดกรองการทุจริตเพิ่มเติม (เช่น จำกัดความถี่, จำกัดประเทศ/BIN, คะแนนความเสี่ยง) ที่เปิดให้บัญชีเราได้หรือไม่
4. ค่าธรรมเนียมข้อโต้แย้ง และระยะเวลาส่งหลักฐานโต้แย้งเป็นเท่าไร

ขอบคุณครับ
[ชื่อ], [ตำแหน่ง]
[บริษัท], [เบอร์โทร]
