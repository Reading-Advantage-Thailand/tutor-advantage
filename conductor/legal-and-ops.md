# Legal, Tax, & Operational Logistics

Product Context: Tutor Advantage B2C Pivot  
Date: 2026-02-24  
Scope: Thailand Operations, Taxation, and Fulfillment

---

## 1. Taxation & Financial Compliance

Operating a service-based MLM and processing direct student payments in Thailand requires strict adherence to Revenue Department (RD) regulations.

### 1.1 Value Added Tax (VAT) on Sales
- **Policy:** The company is the merchant of record. All course packages sold to parents/students are subject to a **7% VAT**.
- **Implementation:** The 3,000 THB price point must clearly state whether it is VAT inclusive or exclusive at checkout. The system must automatically generate and issue a tax invoice/receipt to the parent upon successful PromptPay or card settlement.

### 1.2 Withholding Tax (WHT) on Commissions
- **Policy:** Tutors act as independent contractors/agents. The company is legally required to deduct a **3% Withholding Tax (WHT)** from all commission payouts (direct and upline residuals).
- **Implementation:** 
  - The MLM Settlement Engine calculates the gross commission.
  - The system automatically deducts 3% WHT from the gross amount.
  - The net amount is transferred to the tutor's registered bank account.
  - The system must automatically generate a digital **Pay Slip** and a **50 Tawi (Withholding Tax Certificate)** for each tutor every month, accessible via their PWA dashboard.

---

## 2. Physical Logistics & Fulfillment

### 2.1 Workbook Distribution
- **Policy:** One class package equals one physical workbook. The company handles fulfillment, but ships in bulk to the class owner, not individual students.
- **Workflow:**
  1. Parent successfully pays via the LINE LIFF app.
  2. The system increments the "Books Owed" counter for that specific class.
  3. Once a class reaches its start threshold (e.g., 1 week before start date or when marked "Full"), the fulfillment system triggers a shipping order.
  4. The company ships the required number of books directly to the **Tutor's registered shipping address**.
  5. The Tutor distributes the books to the students at the first session.

---

## 3. Platform Stickiness & IP Protection

To prevent "Platform Leakage" (tutors taking students offline after the first course to avoid platform fees), Tutor Advantage leverages its existing B2B technology stack as a lock-in mechanism.

### 3.1 Unreplicable Value
The Tutor PWA and Student LIFF app provide features a freelance tutor cannot replicate:
- Interactive, app-based homework.
- Automated grading and instant feedback.
- Official, verifiable completion certificates.
- Gamified student progression and leaderboards.
- AI-assisted teaching recommendations and student performance analytics.

By making the digital experience indispensable to the parent's perception of value, the tutor is forced to keep the transaction on-platform.

---

## 4. Class Abandonment & The "Rescue Auction"

### 4.1 Volume Adjustment vs. Complex Clawbacks
- **Policy:** To avoid mathematically complex clawbacks across multiple upline tiers when a class is disrupted, financial penalties are handled via immediate negative adjustments to the offending tutor's *current* or *future* sales volume, rather than historical recalculations.

### 4.2 The Class Reassignment Auction
- **Scenario:** A tutor abandons a class mid-course, or is removed due to quality complaints.
- **Solution:** Instead of issuing mass refunds, the system triggers a localized "Rescue Auction."
- **Mechanism:**
  1. The system identifies active, highly-rated tutors within the same geographic area or willing to teach online.
  2. The abandoned class (with its remaining hours and students) is posted to an internal auction board.
  3. Tutors submit a "Low Bid" – stating the minimum flat fee they require to take over the remaining classes.
  4. The lowest qualified bid wins the class.
- **Incentive:** The winning tutor accepts a lower immediate payout in exchange for acquiring 5+ new students, gaining their future retention, and potentially bringing them into their own MLM network for subsequent courses.

---

## 5. Customer Support & Dispute Resolution

### 5.1 Clear Lines of Support
- **Policy:** Tutors are educators and recruiters, not IT support. 
- **Implementation:** The company's existing full-time help-desk assumes Tier 1 support for all technical, payment, and fulfillment issues.
- **Access:** The Student LINE LIFF portal and the Tutor PWA must feature a prominent "Help / Contact Support" button that routes directly to the company's customer service LINE OA or ticketing system. Tutors are explicitly instructed to route all payment and app issues to corporate support.
