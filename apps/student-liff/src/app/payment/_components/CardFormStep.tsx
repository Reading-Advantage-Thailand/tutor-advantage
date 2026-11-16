"use client";

import { CreditCard, Lock } from "lucide-react";
import { AppBar, BottomActionBar, IconTile, Notice, Screen, TextField } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import { hasAllCardFields, type CardFields } from "@/lib/paymentFlow";
import { AmountCard } from "./AmountCard";
import { PaymentStepCaption } from "./PaymentStepCaption";
import { PaymentPolicyNotice } from "@/components/legal/PaymentPolicyNotice";

export interface CardFormStepProps {
  amountSatang: number | null;
  card: CardFields;
  onNumberChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onExpiryChange: (value: string) => void;
  onCvvChange: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

const FORM_ID = "payment-card-form";

/** Card details → Omise token → pay (3DS may follow). Fields stay in memory only. */
export function CardFormStep({
  amountSatang,
  card,
  onNumberChange,
  onNameChange,
  onExpiryChange,
  onCvvChange,
  loading,
  onSubmit,
  onBack,
}: CardFormStepProps) {
  const complete = hasAllCardFields(card);
  const payLabel =
    amountSatang === null
      ? t("payment.card.payPrefix")
      : `${t("payment.card.payPrefix")} ${formatSatang(amountSatang)}`;

  return (
    <Screen>
      <AppBar title={t("payment.card.title")} onBack={onBack} />
      <PaymentStepCaption step={2} />
      <form
        id={FORM_ID}
        className="flex flex-col gap-5 px-4 pt-4 pb-6"
        autoComplete="on"
        onSubmit={(event) => {
          event.preventDefault();
          if (complete && !loading) onSubmit();
        }}
      >
        <AmountCard label={t("payment.card.amount")} amountSatang={amountSatang} layout="row" />

        {/* One grouped card: labels above every field, autocomplete attributes for the wallet. */}
        <section
          aria-labelledby="payment-card-fields-title"
          className="flex flex-col gap-4 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-3.5">
            <IconTile icon={CreditCard} tone="amber" size="sm" />
            <div className="min-w-0">
              <h2 id="payment-card-fields-title" className="t-title-s text-fg">
                {t("payment.methods.card")}
              </h2>
              <p className="text-[13px] leading-[1.6] text-fg-muted">{t("payment.select.cardSub")}</p>
            </div>
          </div>
          <TextField
            id="input-card-number"
            label={t("payment.card.numberLabel")}
            type="tel"
            inputMode="numeric"
            placeholder={t("payment.card.numberPlaceholder")}
            value={card.number}
            onChange={(event) => onNumberChange(event.target.value)}
            autoComplete="cc-number"
            enterKeyHint="next"
            inputClassName="tabular-nums"
          />
          <TextField
            id="input-card-name"
            label={t("payment.card.nameLabel")}
            type="text"
            placeholder={t("payment.card.namePlaceholder")}
            value={card.name}
            onChange={(event) => onNameChange(event.target.value)}
            autoComplete="cc-name"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="input-card-expiry"
              label={t("payment.card.expiryLabel")}
              type="tel"
              inputMode="numeric"
              placeholder={t("payment.card.expiryPlaceholder")}
              value={card.expiry}
              onChange={(event) => onExpiryChange(event.target.value)}
              autoComplete="cc-exp"
              maxLength={5}
              enterKeyHint="next"
              inputClassName="tabular-nums"
            />
            <TextField
              id="input-card-cvv"
              label={t("payment.card.cvvLabel")}
              hint={t("payment.card.cvvHint")}
              type="tel"
              inputMode="numeric"
              placeholder={t("payment.card.cvvPlaceholder")}
              value={card.cvv}
              onChange={(event) => onCvvChange(event.target.value)}
              autoComplete="cc-csc"
              maxLength={4}
              enterKeyHint="done"
              inputClassName="tabular-nums"
            />
          </div>
        </section>

        <Notice
          tone="info"
          icon={Lock}
          title={t("payment.card.securityTitle")}
          description={t("payment.card.securityDescription")}
        />
        <PaymentPolicyNotice />
      </form>

      <BottomActionBar>
        <Button
          id="btn-confirm-card"
          type="submit"
          form={FORM_ID}
          variant="brand"
          size="cta-lg"
          className="flex-1"
          disabled={!complete}
          loading={loading}
        >
          {loading ? t("payment.card.processing") : payLabel}
        </Button>
      </BottomActionBar>
    </Screen>
  );
}
