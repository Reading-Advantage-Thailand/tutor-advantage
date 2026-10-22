# Student service requests — policy version 2026-10-22

Owner: คุณแจง / support@reading-advantage.com / LINE OA https://lin.ee/5LRn0YM.
Public wording lives in `apps/student-liff/src/lib/content/legal.ts`; update its version and date when changing policy.

## Cancellation and refund requests

1. Record a case reference, request date, class, payment reference, amount, payment method and reason. Do not request passwords, OTPs, CVV or full card numbers.
2. Verify the requester against the account, enrollment and successful payment. Check whether the company was unable to open the advertised class. Changing one's mind after payment does not qualify under this policy; statutory rights remain applicable. Escalate disputed or exceptional cases to the responsible manager rather than promising a refund.
3. Notify the customer of the decision. Approved provider-failure cases receive the full package amount. Confirm the planned processing date; do not promise a bank posting date.
4. Card: authorized finance staff initiate the refund in the Omise dashboard against the original charge. Save its reference and reconcile the resulting refund event. Card posting is subject to the issuer.
5. PromptPay: Omise does not issue this refund. Finance staff verify the original payer and bank account privately, obtain internal approval, and transfer the refund manually. Record transfer proof and reconcile the payment/enrollment with finance operations; a transfer alone does not change application payment status.
6. Record decision, approver, amount, processing reference, communication and completion date. Never share another learner's information.

## Workbook delivery

One package includes one physical workbook. Dispatch the class shipment to the registered tutor so the tutor can distribute books in the first session. If a student reports a missing book, verify the class and shipment, coordinate with the tutor/fulfillment team, and tell the student the revised handover date. Record delivery confirmation; do not invent tracking or delivery dates.

## Privacy, access and account-closure requests

1. Open a restricted support case recording the requested action and account reference. Verify control of the account with the authenticated service or existing contact channel. Collect only additional identification necessary to resolve ambiguity; never request login secrets.
2. Establish which class, profile, learning records and derived AI summaries relate to this learner. Include service logs/files where applicable. Avoid disclosing another student's or tutor's private data.
3. For access/correction, prepare the relevant data or correction for the requester. For closure/deletion, first identify records still needed for active services, disputes or legal obligations. Record the reason for each exception.
4. Accounting records are retained for at least five years from the accounting closing date for the relevant period, and longer where a legal hold applies. Verify the accounting period with finance. Do not cascade-delete or alter receipts, ledger entries, payment events or settlement evidence.
5. Have authorized service/database operators review the affected records and dependencies before deleting or anonymizing unnecessary profile and learning information. This release adds no automatic purge, account-delete API or retention scheduler. Revoking access is not evidence that data has been deleted.
6. Record the operator, action, affected data categories, date and remaining exceptions; notify the requester of the result. Keep the case restricted and review any retained exceptions when their purpose ends. Do not promise immediate deletion from provider backups or systems outside our control.

## Release evidence

Verify `/`, `/courses`, a real public course, `/terms` and `/privacy` without a session. Verify enrollment/payment still requires LINE authentication. Capture checkout using a local/test session and test payment configuration, clearly label test screenshots, and never create a real charge for evidence. Preserve production screenshots separately from test evidence.
