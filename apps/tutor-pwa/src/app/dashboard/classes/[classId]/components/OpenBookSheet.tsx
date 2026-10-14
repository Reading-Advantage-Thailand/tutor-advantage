"use client";

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
  priceSatang,
  onPriceChange,
  creating,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: BookOption[];
  bookId: string;
  onBookIdChange: (value: string) => void;
  priceSatang: number;
  onPriceChange: (value: number) => void;
  creating: boolean;
  onSubmit: () => void;
}) {
  const grouped = groupBooksByProgram(books);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("tutorClass.lessons.openBookTitle")}
      description={t("tutorClass.lessons.openBookDescription")}
      dismissible={!creating}
      footer={
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" size="lg" className="md:h-9" onClick={() => onOpenChange(false)} disabled={creating}>
            {t("tutorClass.detail.cancel")}
          </Button>
          <Button size="lg" className="md:h-9" onClick={onSubmit} loading={creating} disabled={!bookId}>
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
          id="book-cycle-price"
          type="number"
          inputMode="numeric"
          label={t("tutorClass.lessons.priceLabel")}
          hint={`${t("tutorClass.lessons.priceHintPrefix")} ${formatSatang(priceSatang)}`}
          value={priceSatang}
          onChange={(event) => onPriceChange(Number(event.target.value))}
          endAddon={t("tutorClass.lessons.satangUnit")}
        />
      </div>
    </Sheet>
  );
}
