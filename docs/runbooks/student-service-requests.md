# Student service requests — policy version 2026-10-30

Owner: คุณแจง / support@reading-advantage.com / LINE OA https://lin.ee/5LRn0YM.
Public wording lives in `apps/student-liff/src/lib/content/legal.ts`; update its version and date when changing policy, and update this runbook to match. The time limits below are commitments in the public policy; escalate before a limit is missed.

**Case record:** cases are now opened and recorded in the admin console **คำร้อง** queue (`/support/tickets`), whether the student opened the ticket in the app or you open it on their behalf after a LINE OA or email contact. The case reference in every step below is the ticket number (`#123`); quote it to the student, finance and the tutor, and keep decisions, approvers and processing references as internal notes on that ticket. The queue's first-response deadline (3 business days for refunds, 2 for everything else) covers only the first reply; the later limits below still apply. See `support-tickets.md`.

## Cancellation and refund requests

Students can cancel before payment by leaving checkout. After payment the company does not accept cancellations, except when it cannot open the class as scheduled; that case is refunded in full under the steps below.

1. Record a case reference, request date, class, payment reference, amount, payment method and reason. Do not request passwords, OTPs, CVV or full card numbers.
2. Verify the requester against the account, enrollment and successful payment. Check whether the company was unable to open the advertised class. Changing one's mind after payment does not qualify under this policy; statutory rights remain applicable. Escalate disputed or exceptional cases to the responsible manager rather than promising a refund.
3. Notify the customer of the decision within 3 business days of receiving the class name, payment reference and proof of payment. Approved provider-failure cases receive the full package amount, always to the original payment channel. Confirm the planned processing date; do not promise a bank posting date.
4. Card: within 7 business days of approval, authorized finance staff initiate the refund in the Omise dashboard against the original charge (same card). Save its reference and reconcile the resulting refund event. Card posting is subject to the issuer.
5. PromptPay: Omise does not issue this refund. Ask privately for the bank account used to pay, check that the account name matches the payer, obtain internal approval, and transfer the refund to that account within 7 business days of approval. The company pays the transfer fee; do not deduct it. Record transfer proof and reconcile the payment/enrollment with finance operations; a transfer alone does not change application payment status.
6. Record decision, approver, amount, processing reference, communication and completion date. Never share another learner's information.

## Book returns

Books are not returned for change of mind. If a student receives a damaged, wrong or incomplete book and reports it with a photo within 7 days of receiving it, replace it through the tutor within 7 business days. The company pays return shipping and shipping for the replacement; the student pays nothing. Record the report date, photo, replacement dispatch and handover.

## Workbook delivery

One package includes one physical workbook. Reading and exercise access opens as soon as payment is confirmed; the book follows separately.

1. Dispatch the class shipment to the registered tutor (transit about 3–7 business days) so the tutor can distribute books in the first session.
2. If payment arrives less than 7 business days before the first session, or after the class has started, the student receives the book at a later session within 14 days of payment.
3. If a student reports a missing or late book, verify the class and shipment and coordinate with the tutor/fulfillment team. Tell the student the revised handover date within 2 business days of the report, and deliver the book within 7 business days of the report at no extra cost.

Record delivery confirmation; do not invent tracking numbers, and do not give a date you cannot meet within these limits.

## Privacy, access and account-closure requests

1. Open a restricted support case recording the requested action and account reference. Verify control of the account with the authenticated service or existing contact channel. Collect only additional identification necessary to resolve ambiguity; never request login secrets.
2. Establish which class, profile, learning records and derived AI summaries relate to this learner. Include service logs/files where applicable. Avoid disclosing another student's or tutor's private data.
3. For access/correction, prepare the relevant data or correction for the requester. For closure/deletion, first identify records still needed for active services, disputes or legal obligations. Record the reason for each exception.
4. Accounting records are retained for at least five years from the accounting closing date for the relevant period, and longer where a legal hold applies. Verify the accounting period with finance. Do not cascade-delete or alter receipts, ledger entries, payment events or settlement evidence.
5. Have authorized service/database operators review the affected records and dependencies before deleting or anonymizing unnecessary profile and learning information. This release adds no automatic purge, account-delete API or retention scheduler. Revoking access is not evidence that data has been deleted.
6. Record the operator, action, affected data categories, date and remaining exceptions; notify the requester of the result. Keep the case restricted and review any retained exceptions when their purpose ends. Do not promise immediate deletion from provider backups or systems outside our control.

## Release evidence

Verify `/`, `/courses`, a real public course, `/terms` and `/privacy` without a session. Verify enrollment/payment still requires LINE authentication. Capture checkout using a local/test session and test payment configuration, clearly label test screenshots, and never create a real charge for evidence. Preserve production screenshots separately from test evidence.
