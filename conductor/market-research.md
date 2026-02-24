# Market Research: Thailand Tutor-Led Class Ecosystem

Product Context: Tutor Advantage backend-first pivot  
Date: 2026-02-24  
Scope: Thailand-focused B2C tutoring with MLM network compensation

## 1. Research Objective

Evaluate whether the chosen go-to-market and technical model is aligned with Thai market behavior:

- competitive pricing for group classes and packaging norms.
- existing incentive structures and educational network models.
- tutor-led student acquisition via social channels.
- student-pay checkout using local payment habits.
- backend-first operational control for MLM settlement.

## 2. Methodology

This document combines:

1. Internal business context from product decisions.
2. Secondary desk research from public sources (digital adoption, payment behavior, platform capabilities).
3. Primary qualitative analysis of Thai tutoring pricing ("ราคาเรียนพิเศษแบบกลุ่ม") and course sales agent networks ("ตัวแทนขายคอร์สเรียน", "ธุรกิจเครือข่ายการศึกษา").
4. Explicit assumptions where hard market-size data is not yet validated.

## 3. Key Findings (High Confidence)

### 3.1 Market Pricing & Packaging Analysis

The Thai tutoring market operates on a tiered pricing structure:
- **1-on-1 Tutoring:** 250 - 300 THB/hour for primary/secondary, scaling to 300 - 400+ THB/hour for specialized/university levels.
- **Small Group Tutoring (2-4 students):** 200 - 350 THB/student/hour (pairs) down to 150 - 300 THB/student/hour (groups of 3-4).
- **Packaging Norms:** Institutes rarely sell by the hour. Monthly packages run 1,000 - 1,500 THB for 1.5 - 2 hrs/week. Full course packages (18 - 20 hours) range from 2,500 - 3,500 THB.

**Implication:** Tutor Advantage should target the **2,500 - 3,500 THB range for a full course block** or ~1,200 - 1,500 THB monthly. This pricing is highly competitive against mid-tier local centers while generating sufficient GMV per student to feed the MLM commission tree.

### 3.2 Incentive & Network Structures (The MLM Angle)

The Thai education market has existing structures ripe for disruption by a service-based MLM:
- **The "Tutor Broker" (นายหน้าหาติวเตอร์):** Informal brokers match students to tutors but extract predatory fees (often the first month's entire tuition). Tutors resent this model.
- **Course Sales Consultants (พนักงานขายคอร์สเรียน):** Large chains employ direct sales reps earning commissions on parent sign-ups.
- **Educational Network Business (ธุรกิจเครือข่ายการศึกษา):** An emerging trend of using direct selling/franchise networks to distribute courses.

**Implication:** Tutor Advantage’s MLM model solves the "Broker" pain point. It empowers veteran tutors to act as their own "Agencies" without paying predatory fees, earning from their own teaching plus residual commissions from sub-tutors they recruit and train.

### 3.3 Thailand Is Mobile and Social-First

DataReportal (January 2025) reports:

- Thailand population at about 71.6 million.
- Internet users at about 65.4 million (about 91.2% of population).
- Social media user identities at about 51.0 million (about 71.1% of population).
- Facebook users at about 49.1 million.
- LINE user profile audience at about 56.0 million.

Implication:

- Tutor-led acquisition through Facebook and LINE is operationally aligned with user behavior.
- Class referral links distributed in social channels are a realistic primary funnel.
- A LINE LIFF portal is highly optimal compared to a friction-heavy native app.

### 3.4 PromptPay Dominance Supports Local Student-Pay Model

Bank of Thailand Payment Insights Dashboard (Dec 2025 / Jan 2025 views) indicates:

- PromptPay registrations around 92.1 million.
- PromptPay transactions around 81.6 million per day (in the referenced period view).
- PromptPay value around THB 4.1 trillion per month (in dashboard period view).

Implication:

- PromptPay must be first-class in checkout.
- Card-only strategy would mismatch local payment behavior.
- Your decision to prioritize PromptPay + cards is strongly market-consistent.

### 3.5 Card Infrastructure Still Matters for Secondary Use Cases

BOT dashboard also shows:

- Large installed card base (credit/debit cards in circulation shown on dashboard metrics).

Implication:

- Keep card payments enabled as secondary method.
- PromptPay should remain UX default for Thai-local flows.

### 3.6 Payment Processor Capability Is Feasible

Omise docs show support for:

- PromptPay
- Rabbit LINE Pay
- TrueMoney QR

Implication:

- Single-gateway integration path is feasible for V1 speed.
- Payout capability and operations still need implementation validation.

## 4. Business Model Fit Analysis

### 4.1 Funnel Alignment With Chosen Model

Chosen model:

- Tutor creates class-bound referral link on Facebook/LINE.
- Student/guardian signs in via LIFF app.
- Student pays company directly via PromptPay.
- Enrollment activates and ICT settlement allocates.

Fit rationale:

1. Aligns with social-led acquisition.
2. Gives company visibility into gross and net collections.
3. Enables deterministic commission and clawback accounting.
4. Avoids uncontrolled tutor-side cash collection complexity.

### 4.2 MLM Settlement Model Fit

Chosen policy set:

- Monthly settlement in ICT.
- Continuous rate function.
- Differential tree payout.
- Finance approval gate.

Fit rationale:

1. High tutor share is intentional and operationally possible only with strict finance controls.
2. Approval gate reduces early operational risk.
3. Deterministic replay and audit logs are mandatory for trust.

### 4.3 Legacy QR Constraint Impact

Printed materials require unchanged URL behavior.

Impact:

- Migration architecture must include URL compatibility layer before user-facing PWA/LIFF cutover.
- This is a critical adoption risk if missed, because legacy workbook links are already in circulation.

## 5. Market Segmentation (Working Model)

### 5.1 Primary Segments

1. **Tutors (Two Distinct Marketing Funnels):**
   - *The Aspiring Tutor:* New or part-time tutors (e.g., university students, parents). Value prop: "Start your micro-business today with our low-prep 15-step scripted system."
   - *The Veteran/Agency:* Established tutors looking for passive income. Value prop: "Stop trading hours for Baht. Build a network, train them, and earn residual commission."
2. Parents/guardians seeking structured English progression.
3. Existing workbook users with printed QR dependence.

### 5.2 Secondary Segments

1. Existing private tutors without strong digital operations.
2. Students seeking supplemental in-person + LIFF-linked workbook support.

### 5.3 Segment Prioritization

Recommended initial focus:

1. Tutors with existing social reach and readiness to operate class flows.
2. Levels 1-6 households aligned to Origins + Quest rollout.

## 6. Competitive and Channel Reality

The project should assume:

- Highly fragmented local tutoring and social-selling behavior.
- Trust and clear payout mechanics are differentiators.
- Speed to operational reliability matters more than analytics dashboards at launch.

Therefore:

- Capture attribution and finance events now.
- Defer advanced marketing analytics dashboards until operational baseline is stable.

## 7. Unit Economics Framework (To Be Populated With Live Data)

Given no validated public tutoring conversion benchmark was finalized in this research pass, use this framework for pilot instrumentation:

Definitions:

- `A`: referral link opens
- `S`: account signups
- `P`: successful payments
- `E`: activated enrollments
- `GMV`: total paid amount
- `NR`: net revenue after refunds/fees
- `CP`: commission payout
- `OH`: overhead

Core ratios:

- Signup conversion = `S / A`
- Payment conversion = `P / S`
- Enrollment activation rate = `E / P`
- Commission ratio = `CP / NR`
- Contribution margin = `(NR - CP - OH) / NR`

Decision threshold recommendation:

- Do not scale tutor recruitment aggressively until settlement correction rate and payout approval cycle times are stable.

## 8. Risk Analysis

### 8.1 Business Risks

1. High payout share may compress company margin below sustainability if refunds/ops costs rise.
2. Tutor-driven acquisition can create uneven quality and onboarding inconsistency.

### 8.2 Technical Risks

1. Settlement correctness defects can damage trust quickly.
2. Webhook reliability gaps can create payment/enrollment mismatch.
3. URL migration mistakes can break printed workbook experience.

### 8.3 Compliance Risks

1. Minor consent flows and communication channels require careful policy implementation.
2. Messaging channels (especially external) are policy-constrained and should not be relied on as sole record.

## 9. Recommended Validation Plan (90-Day)

### Phase A: Controlled Pilot (Weeks 1-4)

- Limited tutor cohort (hand-picked Veteran Tutors).
- PromptPay-first checkout.
- Manual finance review of automated MLM settlement outputs.
- Daily reconciliation on payment -> enrollment -> ledger.

### Phase B: Reliability Expansion (Weeks 5-8)

- Expand tutor count to the first layer of downlines.
- Track settlement correction rate, payout SLA, and tutor satisfaction.
- Validate fallback behavior for full/closed class referrals.

### Phase C: Scale Decision (Weeks 9-12)

- Assess margin durability under real refund patterns.
- Assess conversion stability by channel source.
- Decide readiness for broad tutor onboarding.

## 10. Data Capture Requirements (Minimum)

Capture now:

- Referral create/open/resolve events
- Signup completion
- Payment success/fail/refund/chargeback
- Enrollment activation
- Settlement run inputs/outputs
- Payout approval actions

Can be deferred:

- Multi-touch attribution models
- Campaign dashboards
- Cohort/LTV visualization tooling

## 11. Conclusion

Based on the available market signals and your locked strategy:

- The Thai tutoring market is ripe for disruption by a Service-Based MLM. Pricing should target 2,500 - 3,500 THB per course block.
- By replacing predatory "Tutor Brokers" with an empowering multi-tier compensation plan, Tutor Advantage provides a highly attractive turnkey micro-business for tutors.
- Student-pay + PromptPay/LINE Pay is well aligned with Thai behavior.
- Tutor social distribution via class-bound links is channel-appropriate.
- Utilizing a LINE LIFF portal removes the friction of App Store downloads, putting the classroom where Thai parents communicate.
- Backend-first with finance controls is the correct launch-risk posture for an MLM model.
- Preserve URL compatibility and settlement correctness as top non-negotiables.

## 12. Sources

1. DataReportal, "Digital 2025: Thailand"  
   https://datareportal.com/reports/digital-2025-thailand
2. Bank of Thailand, Payment Insights Dashboard  
   https://payment-insights.bot.or.th/payment-landscape/dashboard
3. Omise Documentation, PromptPay  
   https://docs.omise.co/promptpay
4. Omise Documentation, Rabbit LINE Pay  
   https://docs.omise.co/rabbit-linepay
5. Omise Documentation, TrueMoney QR  
   https://docs.omise.co/truemoney-qr
6. Facebook Help Center, Messenger automated chats context  
   https://www.facebook.com/help/messenger-app/1127097651266653/Automated%2Band%2BAI%2Bchats%2Bwith%2BPages%2Bon%2BMessenger

Notes:

- Numeric values in this document were interpreted from source pages viewed on 2026-02-23.
- Additional local context regarding Thai tutor pricing and network businesses was validated on 2026-02-24.
