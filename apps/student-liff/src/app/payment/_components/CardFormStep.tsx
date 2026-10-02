"use client";

import { Lock } from "lucide-react";
import { AppBar, BottomActionBar, Notice, Screen, TextField } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import { hasAllCardFields, type CardFields } from "@/lib/paymentFlow";
import { AmountCard } from "./AmountCard";

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
      <form
        id={FORM_ID}
        className="flex flex-col gap-5 px-4 pt-3 pb-6"
        autoComplete="on"
        onSubmit={(event) => {
          event.preventDefault();
          if (complete && !loading) onSubmit();
        }}
      >
        <AmountCard label={t("payment.card.amount")} amountSatang={amountSatang} layout="row" />

        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
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
            />
          </div>
        </div>

        <Notice
          tone="info"
          icon={Lock}
          title={t("payment.card.securityTitle")}
          description={t("payment.card.securityDescription")}
        />
      </form>

      <BottomActionBar>
        <Button
          id="btn-confirm-card"
          type="submit"
          form={FORM_ID}
          variant="brand"
          size="cta"
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
