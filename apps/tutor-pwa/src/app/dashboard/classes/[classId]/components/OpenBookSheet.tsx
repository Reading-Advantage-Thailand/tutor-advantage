"use client";

import { useRef, useState } from "react";
import { Sheet, SelectField, TextField } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import { groupBooksByProgram, type BookOption } from "../../components/book-options";

/** Form sheet to open the next book (book cycle) in this class. */
export function OpenBookSheet({
  open,
  onOpenChange,
  books,
  bookId,
  onBookIdChange,
  priceBaht,
  priceSatang,
  onPriceBahtChange,
  creating,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: BookOption[];
  bookId: string;
  onBookIdChange: (value: string) => void;
  /** The price as the tutor typed it, in baht. */
  priceBaht: string;
  /** The parsed price in integer satang (what is sent), or null when the text is not a valid price. */
  priceSatang: number | null;
  onPriceBahtChange: (value: string) => void;
  creating: boolean;
  onSubmit: () => void;
}) {
  const grouped = groupBooksByProgram(books);
  const priceRef = useRef<HTMLInputElement>(null);
  // The price error shows only after the field is left or a submit is tried;
  // editing the price or closing the sheet hides it again until the next one.
  const [showPriceError, setShowPriceError] = useState(false);
  const handleOpenChange = (next: boolean) => {
    if (!next) setShowPriceError(false);
    onOpenChange(next);
  };
  const handleSubmit = () => {
    if (priceSatang === null) {
      setShowPriceError(true);
      priceRef.current?.focus();
      return;
    }
    onSubmit();
  };
  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      title={t("tutorClass.lessons.openBookTitle")}
      description={t("tutorClass.lessons.openBookDescription")}
      dismissible={!creating}
      footer={
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="outline" size="lg" className="md:h-10 md:px-4" onClick={() => handleOpenChange(false)} disabled={creating}>
            {t("tutorClass.detail.cancel")}
          </Button>
          <Button size="lg" className="md:h-10 md:px-4" onClick={handleSubmit} loading={creating} disabled={!bookId}>
            {creating ? t("tutorClass.lessons.openingBook") : t("tutorClass.lessons.openBookSubmit")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          id="book-cycle-book"
          label={t("tutorClass.lessons.bookLabel")}
          value={bookId}
          placeholder={t("tutorClass.newClass.selectBook")}
          disabled={creating}
          onChange={(event) => onBookIdChange(event.target.value)}
        >
          {grouped.reading.length > 0 && (
            <optgroup label="Reading Advantage">
              {grouped.reading.map((book) => (
                <option key={book.bookId} value={book.bookId}>
                  {book.title || book.bookCode}
                </option>
              ))}
            </optgroup>
          )}
          {grouped.primary.length > 0 && (
            <optgroup label="Primary Advantage">
              {grouped.primary.map((book) => (
                <option key={book.bookId} value={book.bookId}>
                  {book.title || book.bookCode}
                </option>
              ))}
            </optgroup>
          )}
        </SelectField>
        <TextField
          ref={priceRef}
          id="book-cycle-price"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          label={t("tutorClass.lessons.priceLabel")}
          // One message line at all times (the amount, else the allowed range,
          // else the error), so the sheet does not jump while the tutor types.
          hint={
            priceSatang !== null
              ? `${t("tutorClass.lessons.priceHintPrefix")} ${formatSatang(priceSatang)}`
              : t("tutorClass.lessons.priceRangeHint")
          }
          error={showPriceError && priceSatang === null ? t("tutorClass.lessons.priceInvalid") : undefined}
          value={priceBaht}
          // Keeps showing the amount being sent while the request is in flight.
          readOnly={creating}
          onChange={(event) => {
            setShowPriceError(false);
            onPriceBahtChange(event.target.value);
          }}
          onBlur={() => setShowPriceError(true)}
          // The label already says "(บาท)": the unit is decoration for sighted users.
          endAddon={<span aria-hidden="true">{t("tutorClass.lessons.priceUnit")}</span>}
        />
      </div>
    </Sheet>
  );
}
