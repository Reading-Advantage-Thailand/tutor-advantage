"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgeCheckStep } from "../_components/AgeCheckStep";
import { CardFormStep } from "../_components/CardFormStep";
import { PaymentSkeleton } from "../_components/PaymentSkeleton";
import { PromptPayStep } from "../_components/PromptPayStep";
import { CardResultStep, RedirectingScreen, ResumingScreen, SuccessStep } from "../_components/ResultStep";
import { SelectMethodStep } from "../_components/SelectMethodStep";
import { usePaymentFlow, type PaymentFlowParams } from "../_components/usePaymentFlow";

/** Renders the step the flow is on; all state and API calls live in usePaymentFlow. */
function PaymentFlowScreen(params: PaymentFlowParams) {
  const flow = usePaymentFlow(params);
  const { actions } = flow;

  if (flow.redirectUri) return <RedirectingScreen authorizeUri={flow.redirectUri} />;
  if (flow.resuming) return <ResumingScreen />;

  switch (flow.step) {
    case "success":
      return (
        <SuccessStep
          classTitle={flow.display.name}
          tutor={flow.display.tutor}
          amountSatang={flow.amountSatang}
          method={flow.method}
        />
      );
    case "result":
      return (
        <CardResultStep
          status={flow.cardResult}
          failureMessage={flow.checkout?.failureMessage ?? null}
          loading={flow.loading}
          onCheckAgain={actions.checkCardResult}
          onRetryCard={actions.retryCard}
          onChangeMethod={actions.backToSelect}
        />
      );
    case "age-check":
      return (
        <AgeCheckStep
          dateOfBirth={flow.ageCheck.dateOfBirth}
          onDateOfBirthChange={flow.ageCheck.setDateOfBirth}
          needsGuardian={flow.ageCheck.needsGuardian}
          guardianName={flow.ageCheck.guardianName}
          onGuardianNameChange={flow.ageCheck.setGuardianName}
          guardianRelation={flow.ageCheck.guardianRelation}
          onGuardianRelationChange={flow.ageCheck.setGuardianRelation}
          canSubmit={flow.ageCheck.canSubmit}
          loading={flow.loading}
          onSubmit={actions.submitAgeCheck}
          onBack={actions.backToSelect}
        />
      );
    case "qr":
      return (
        <PromptPayStep
          amountSatang={flow.amountSatang}
          hasIntent={flow.paymentIntentId !== null}
          qrDataUri={flow.qr.dataUri}
          qrLoading={flow.qr.loading}
          expiresAt={flow.qr.expiresAt}
          expired={flow.qr.expired}
          failed={flow.qr.failed}
          polling={flow.qr.polling}
          ctaMode={flow.qr.ctaMode}
          onPrimary={flow.qr.ctaMode === "regenerate" ? actions.regenerateQr : actions.confirmPayment}
          onRetryQrImage={actions.retryQrImage}
          onBack={actions.backToSelect}
        />
      );
    case "card-form":
      return (
        <CardFormStep
          amountSatang={flow.amountSatang}
          card={flow.card}
          onNumberChange={flow.card.setNumber}
          onNameChange={flow.card.setName}
          onExpiryChange={flow.card.setExpiry}
          onCvvChange={flow.card.setCvv}
          loading={flow.loading}
          onSubmit={actions.confirmPayment}
          onBack={actions.backToSelect}
        />
      );
    default:
      return (
        <SelectMethodStep
          backHref={params.classId ? `/classes/${params.classId}` : "/classes"}
          classStatus={flow.classStatus}
          display={flow.display}
          onRetryClass={flow.retryClass}
          method={flow.method}
          onSelectMethod={actions.selectMethod}
          canProceed={flow.canProceed && !flow.loading}
          proceedLoading={flow.profileLoading && flow.classStatus === "ready"}
          onProceed={actions.proceed}
        />
      );
  }
}

function PaymentRoute() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get("classId") ?? "";
  const cycleId = searchParams.get("cycleId") ?? "";
  const referralToken = searchParams.get("referralToken");
  const returnedPaymentIntentId = searchParams.get("paymentIntentId");
  const missingTarget = !classId && !referralToken;

  // Nothing to pay for: back to the class list (client navigation, no app reload).
  useEffect(() => {
    if (missingTarget) router.replace("/classes");
  }, [missingTarget, router]);

  if (missingTarget) return <PaymentSkeleton />;

  // Keyed by the query so a new checkout (e.g. the enrollment-first redirect)
  // starts from fresh state, like the full reload it replaces.
  return (
    <PaymentFlowScreen
      key={searchParams.toString()}
      classId={classId}
      cycleId={cycleId}
      referralToken={referralToken}
      returnedPaymentIntentId={returnedPaymentIntentId}
    />
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentSkeleton />}>
      <PaymentRoute />
    </Suspense>
  );
}
