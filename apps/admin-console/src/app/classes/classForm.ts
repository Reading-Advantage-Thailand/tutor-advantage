/**
 * Pure helpers for /classes (classes listed and created by admins for tutors):
 * API shapes, the "create a class for a tutor" form validation and book labels.
 * Relative imports only so vitest (whose "@" alias points elsewhere) can test it.
 */
import { parseBahtToSatang } from "../adjustments/money";

export const EMAIL_MAX = 254;
export const DISPLAY_NAME_MAX = 100;
export const TITLE_MAX = 120;
export const CAPACITY_MAX = 100;
export const PRICE_MAX_SATANG = 1_000_000;
/** Same defaults as a class a tutor opens (3,000 THB, 30 seats). */
export const DEFAULT_PRICE_BAHT = "3,000";
export const DEFAULT_CAPACITY = "30";

export interface AdminClassTutor {
  userId: string;
  displayName: string | null;
  email: string | null;
  /** No Google sign-in yet: the account was created by an admin and waits for the tutor. */
  pendingRegistration: boolean;
}

/** GET /v1/admin/classes item (learning-service). */
export interface AdminClass {
  classId: string;
  title: string;
  /** Raw class status (OPEN | FULL | CLOSED…): render with the "classStatus" domain. */
  status: string;
  isDemo: boolean;
  bookId: string;
  bookCode: string | null;
  bookTitle: string | null;
  packagePriceSatang: number;
  capacity: number;
  enrolledCount: number;
  activeStudents: number;
  scheduleDescription: string | null;
  /** The tutor still has to set the schedule and meeting link. */
  setupRequired: boolean;
  setupRequiredAt: string | null;
  createdAt: string;
  tutor: AdminClassTutor | null;
}

export interface AdminClassPage {
  items: AdminClass[];
  total: number;
  page: number;
  pageSize: number;
}

/** POST /v1/admin/classes → 201. */
export interface CreatedClass {
  class: AdminClass;
  tutor: AdminClassTutor & { created: boolean };
}

/** GET /v1/books item (learning-service). */
export interface BookOption {
  bookId: string;
  bookCode?: string | null;
  title?: string | null;
}

/** Link from a class row to the discount code sheet with that class preselected. */
export function discountCodeCreateHref(classId: string): string {
  return `/discount-codes?create=1&classId=${encodeURIComponent(classId)}`;
}

export function isPrimaryBook(book: BookOption): boolean {
  return String(book.bookCode ?? "").startsWith("Primary ");
}

/**
 * Picker label: the book code, plus the title when it says something more.
 * Primary titles carry a CEFR suffix ("Primary Origins 2 (A1)") that is dropped.
 */
export function bookLabel(book: BookOption): string {
  const code = (book.bookCode ?? "").trim();
  const title = (book.title ?? "").replace(/\s*\([A-C]\d\)$/i, "").trim();
  if (!code) return title || book.bookId;
  return title && title !== code ? `${code} · ${title}` : code;
}

/** Splits the catalogue into the two programmes, as the tutor app does. */
export function groupBooksByProgram<T extends BookOption>(books: readonly T[]): { reading: T[]; primary: T[] } {
  return {
    reading: books.filter((book) => !isPrimaryBook(book)),
    primary: books.filter((book) => isPrimaryBook(book)),
  };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateClassFormValues {
  tutorEmail: string;
  tutorDisplayName: string;
  title: string;
  bookId: string;
  /** Baht as typed ("3,000"). */
  price: string;
  capacity: string;
}

export type CreateClassFormErrors = Partial<Record<keyof CreateClassFormValues, string>>;

export interface CreateClassFormMessages {
  emailInvalid: string;
  displayNameInvalid: string;
  titleInvalid: string;
  bookRequired: string;
  priceInvalid: string;
  capacityInvalid: string;
}

export interface CreateClassBody {
  tutorEmail: string;
  tutorDisplayName: string;
  title: string;
  bookId: string;
  capacity: number;
  packagePriceSatang: number;
}

export const EMPTY_CLASS_FORM: CreateClassFormValues = {
  tutorEmail: "",
  tutorDisplayName: "",
  title: "",
  bookId: "",
  price: DEFAULT_PRICE_BAHT,
  capacity: DEFAULT_CAPACITY,
};

/**
 * Validates the form with the same limits as POST /v1/admin/classes. Returns
 * errors (empty object = valid) and, when valid, the API body (email lower-cased).
 */
export function validateCreateClassForm(
  values: CreateClassFormValues,
  messages: CreateClassFormMessages,
): { errors: CreateClassFormErrors; body: CreateClassBody | null } {
  const errors: CreateClassFormErrors = {};

  const tutorEmail = normalizeEmail(values.tutorEmail);
  if (!EMAIL_RE.test(tutorEmail) || tutorEmail.length > EMAIL_MAX) errors.tutorEmail = messages.emailInvalid;

  const tutorDisplayName = values.tutorDisplayName.trim();
  if (!tutorDisplayName || tutorDisplayName.length > DISPLAY_NAME_MAX) errors.tutorDisplayName = messages.displayNameInvalid;

  const title = values.title.trim();
  if (!title || title.length > TITLE_MAX) errors.title = messages.titleInvalid;

  if (!values.bookId) errors.bookId = messages.bookRequired;

  const packagePriceSatang = parseBahtToSatang(values.price);
  if (packagePriceSatang === null || packagePriceSatang > PRICE_MAX_SATANG) errors.price = messages.priceInvalid;

  const rawCapacity = values.capacity.trim();
  const capacity = Number(rawCapacity);
  if (!/^\d+$/.test(rawCapacity) || capacity < 1 || capacity > CAPACITY_MAX) errors.capacity = messages.capacityInvalid;

  if (Object.keys(errors).length || packagePriceSatang === null) return { errors, body: null };
  return {
    errors,
    body: { tutorEmail, tutorDisplayName, title, bookId: values.bookId, capacity, packagePriceSatang },
  };
}
