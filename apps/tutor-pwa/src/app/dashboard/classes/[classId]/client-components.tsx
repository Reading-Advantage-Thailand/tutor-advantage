"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import {
  Trash2,
  QrCode,
  Copy,
  CheckCircle2,
  BookOpen,
  ChevronDown,
  Sparkles,
  ChevronRight,
  Video,
  ExternalLink,
  FlaskConical,
  Users2,
  Loader2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  updateClassStatus,
  deleteClass,
  updateMeetingUrl,
  getClassArticles,
  createClassBookCycle,
  getBooks,
  devSeedClassAllProgress,
} from "./../actions";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function ClassStatusToggle({
  classId,
  initialStatus,
}: {
  classId: string;
  initialStatus: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (status: "open" | "full" | "closed") => {
    if (status === initialStatus || loading) return;
    setLoading(true);
    try {
      await updateClassStatus(classId, status);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statusMap = {
    open: {
      label: t("tutorClass.classes.statusOpen"),
      className:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    full: {
      label: t("tutorClass.classes.statusFull"),
      className:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    closed: {
      label: t("tutorClass.classes.statusClosed"),
      className: "bg-muted text-muted-foreground border-border",
    },
  } as Record<string, { label: string; className: string }>;

  const currentStatus = statusMap[initialStatus] || statusMap["closed"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading}
        className={`flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border transition-opacity ${currentStatus.className} ${loading ? "opacity-50" : ""}`}
      >
        {currentStatus.label}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleStatusChange("open")}>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {t("tutorClass.classes.statusOpen")}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("full")}>
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {t("tutorClass.classes.statusFull")}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("closed")}>
          <span className="text-muted-foreground font-medium">{t("tutorClass.classes.statusClosed")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReferralLink({ referralLink }: { referralLink: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            {t("tutorClass.detail.referralTitle")}
          </div>

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  {t("tutorClass.detail.showQr")}
                </Button>
              }
            />
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{t("tutorClass.detail.qrTitle")}</DialogTitle>
                <DialogDescription>
                  {t("tutorClass.detail.qrDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center p-4 space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-border/50">
                  <QRCodeSVG
                    value={referralLink}
                    size={220}
                    level="M"
                    includeMargin={true}
                  />
                </div>
                <div className="w-full flex">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? t("tutorClass.detail.copied") : t("tutorClass.detail.copy")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={referralLink}
            className="flex-1 h-9 rounded-lg border border-input bg-muted px-3 text-xs text-foreground font-mono"
          />
          <button
            onClick={handleCopy}
            id="btn-copy-referral"
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-input hover:bg-muted transition-colors"
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("tutorClass.detail.referralHelp")}
        </p>
      </CardContent>
    </Card>
  );
}

export function ArticleSelector({
  classId,
  bookCycles = [],
}: {
  classId: string;
  bookCycles?: Array<{
    id: string;
    bookId: string;
    sequence: number;
    title: string;
    status: string;
    packagePriceSatang: number;
  }>;
}) {
  type BookOption = {
    bookId: string;
    bookCode?: string;
    title?: string;
  };
  type ToastState = {
    type: "success" | "warning" | "error";
    title: string;
    message: string;
  };

  const router = useRouter();
  const initialCycleId = bookCycles.find((cycle) => cycle.status === "open")?.id || bookCycles[0]?.id || "";
  const [selectedCycleId, setSelectedCycleId] = useState(initialCycleId);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<BookOption[]>([]);
  const [newBookId, setNewBookId] = useState("");
  const [newBookPrice, setNewBookPrice] = useState(250000);
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [openBookDialogOpen, setOpenBookDialogOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (nextToast: ToastState) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 4500);
  };

  const getBookLabel = (book?: BookOption) =>
    book ? `${book.title || "Untitled book"}${book.bookCode ? ` (${book.bookCode})` : ""}` : "the selected book";

  const validateNewBookSelection = () => {
    const selectedBookIndex = books.findIndex((book) => book.bookId === newBookId);
    const selectedBook = books[selectedBookIndex];

    if (!selectedBook) {
      return {
        type: "error" as const,
        title: "Book not found",
        message: "Refresh the page and select a book from the list again.",
      };
    }

    if (bookCycles.some((cycle) => cycle.bookId === newBookId)) {
      return {
        type: "warning" as const,
        title: "Book already open",
        message: `${getBookLabel(selectedBook)} is already open for this class.`,
      };
    }

    const openedBookIndexes = bookCycles
      .map((cycle) => books.findIndex((book) => book.bookId === cycle.bookId))
      .filter((index) => index >= 0);
    const highestOpenedBookIndex =
      openedBookIndexes.length > 0 ? Math.max(...openedBookIndexes) : -1;

    if (selectedBookIndex < highestOpenedBookIndex) {
      return {
        type: "warning" as const,
        title: "Book is below current progress",
        message: `This class has already opened a later book than ${getBookLabel(selectedBook)}.`,
      };
    }

    if (selectedBookIndex > highestOpenedBookIndex + 1) {
      const nextBook = books[highestOpenedBookIndex + 1];
      return {
        type: "warning" as const,
        title: "Cannot skip books",
        message: `Open ${getBookLabel(nextBook)} before opening ${getBookLabel(selectedBook)}.`,
      };
    }

    return null;
  };

  useEffect(() => {
    async function loadArticles() {
      try {
        setFetching(true);
        const data = await getClassArticles(classId, selectedCycleId || undefined);
        setArticles(data.articles || []);
        if (data.articles && data.articles.length > 0) {
          setSelectedArticle(data.articles[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setError(t("tutorClass.detail.articleLoadFailed"));
      } finally {
        setFetching(false);
      }
    }
    loadArticles();
  }, [classId, selectedCycleId]);

  useEffect(() => {
    getBooks()
      .then((data) => setBooks(data.books || []))
      .catch((err) => console.error("Could not fetch books", err));
  }, []);

  const handleStartLesson = () => {
    if (!selectedArticle) return;
    setLoading(true);
    const selectedCycle = bookCycles.find((cycle) => cycle.id === selectedCycleId);
    const params = new URLSearchParams({ articleId: selectedArticle });
    if (selectedCycleId) params.set("cycleId", selectedCycleId);
    if (selectedCycle?.bookId) params.set("bookId", selectedCycle.bookId);
    router.push(`/lesson/${classId}/interactive?${params.toString()}`);
  };

  const handleCreateCycle = async () => {
    if (!newBookId) return;
    const validationToast = validateNewBookSelection();
    if (validationToast) {
      showToast(validationToast);
      return;
    }

    setCreatingCycle(true);
    try {
      const result = await createClassBookCycle(classId, {
        bookId: newBookId,
        packagePriceSatang: newBookPrice,
      });
      setSelectedCycleId(result.cycle.id);
      setOpenBookDialogOpen(false);
      showToast({
        type: "success",
        title: "Book opened",
        message: `${result.cycle.title || "The selected book"} is now open for this class.`,
      });
      router.refresh();
    } catch (error: any) {
      showToast({
        type: "error",
        title: "Could not open book",
        message: error.message || "Could not open the selected book",
      });
    } finally {
      setCreatingCycle(false);
    }
  };

  const toastIcon =
    toast?.type === "success" ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
    ) : toast?.type === "warning" ? (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
    ) : (
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
    );

  return (
    <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/5 min-h-[400px] max-h-[80vh] overflow-hidden shadow-sm flex flex-col">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg"
        >
          {toastIcon}
          <div className="min-w-0">
            <p className="font-semibold">{toast.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{toast.message}</p>
          </div>
        </div>
      )}
      <CardHeader className="pb-4 shrink-0">
        <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen className="h-4.5 w-4.5" />
          </span>
          {t("tutorClass.detail.articleTitle")}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {t("tutorClass.detail.articleDescription")}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              value={selectedCycleId}
              onChange={(event) => setSelectedCycleId(event.target.value)}
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {bookCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  เล่ม {cycle.sequence}: {cycle.title}
                </option>
              ))}
            </select>
            <Dialog open={openBookDialogOpen} onOpenChange={setOpenBookDialogOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm" className="h-10 shrink-0">
                    เปิดเล่มใหม่
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>เปิดเล่มใหม่ในคลาสนี้</DialogTitle>
                  <DialogDescription>
                    นักเรียนเดิมจะยังอยู่ในคลาส แต่ต้องชำระเพิ่มเพื่อเข้า live lesson ของเล่มใหม่
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="book-cycle-book">หนังสือ</Label>
                    <select
                      id="book-cycle-book"
                      value={newBookId}
                      onChange={(event) => setNewBookId(event.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    >
                      <option value="">เลือกหนังสือ</option>
                      {books.map((book) => (
                        <option key={book.bookId} value={book.bookId}>
                          {book.title} ({book.bookCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="book-cycle-price">ราคา (สตางค์)</Label>
                    <Input
                      id="book-cycle-price"
                      type="number"
                      value={newBookPrice}
                      onChange={(event) => setNewBookPrice(Number(event.target.value))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateCycle} disabled={!newBookId || creatingCycle}>
                    {creatingCycle ? "กำลังเปิด..." : "เปิดเล่ม"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-6 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0 scrollbar-thin">
          {fetching ? (
            <div className="py-24 flex flex-col items-center justify-center text-center gap-2">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              <p className="text-xs text-muted-foreground font-medium">
                {t("tutorClass.detail.articleLoading")}
              </p>
            </div>
          ) : error ? (
            <div className="py-24 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-xs text-destructive font-medium">{error}</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-xs text-muted-foreground font-medium">
                {t("tutorClass.detail.articleEmpty")}
              </p>
            </div>
          ) : (
            articles.map((article, idx) => (
              <div
                key={article.id}
                onClick={() => setSelectedArticle(article.id)}
                className={`group border rounded-xl p-3.5 transition-all duration-300 relative overflow-hidden cursor-pointer ${
                  selectedArticle === article.id
                    ? "border-primary/40 bg-primary/[0.03] shadow-md ring-1 ring-primary/20"
                    : "border-border/50 bg-background hover:bg-muted/30 hover:border-border"
                } ${article.isCompleted ? "opacity-80 saturate-[0.85]" : ""}`}
              >
                <div
                  className={`absolute top-0 bottom-0 left-0 w-1.5 transition-all duration-300 ${
                    selectedArticle === article.id
                      ? "bg-primary"
                      : "bg-transparent group-hover:bg-muted"
                  }`}
                />
                <div className="pl-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border/40">
                      {t("tutorClass.detail.chapterPrefix")} {idx + 1}
                    </span>
                    {article.isCompleted && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                        {t("tutorClass.detail.taught")}
                      </span>
                    )}
                    {article.cefrLevel && (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                        CEFR {article.cefrLevel}
                      </span>
                    )}
                  </div>
                  <h3
                    className={`text-sm font-bold mt-1 transition-colors ${selectedArticle === article.id ? "text-primary" : "text-foreground"}`}
                  >
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="text-xs text-muted-foreground font-normal line-clamp-2 mt-1.5 leading-relaxed">
                      {article.summary}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 shrink-0">
          <Button
            className="w-full gap-2 font-bold shadow-md transition-all duration-300 py-5"
            disabled={!selectedArticle || loading || fetching}
            onClick={handleStartLesson}
          >
            {loading ? t("tutorClass.detail.creatingRoom") : t("tutorClass.detail.createRoom")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function triggerCancelICS(classId: string, className: string) {
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const content = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tutor Advantage//TH",
    "CALSCALE:GREGORIAN", "METHOD:CANCEL",
    "BEGIN:VEVENT",
    `UID:${classId}@ta.th`, `DTSTAMP:${dtstamp}`,
    `SUMMARY:${className}`, "STATUS:CANCELLED",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `cancel-${className.replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function DeleteClassButton({ classId, className }: { classId: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteClass(classId);
      // Auto-remove from phone calendar after deletion
      if (className) triggerCancelICS(classId, className);
      setOpen(false);
      router.push("/dashboard/classes");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert(error.message || t("tutorClass.detail.deleteFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 gap-1.5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              {t("tutorClass.detail.devOnly")}
            </span>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t("tutorClass.detail.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("tutorClass.detail.deleteDescription1")}
            {t("tutorClass.detail.deleteDescription2")}
            {t("tutorClass.detail.deleteDescription3")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("tutorClass.detail.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? t("tutorClass.detail.deleting") : t("tutorClass.detail.confirmDelete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MeetingUrlEditor({
  classId,
  initialUrl,
}: {
  classId: string;
  initialUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateMeetingUrl(classId, url);
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      alert(error.message || t("tutorClass.detail.updateMeetingFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">
                {t("tutorClass.detail.onlineRoom")}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {initialUrl || t("tutorClass.detail.missingMeetingUrl")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 px-3 text-xs bg-background font-medium"
                  >
                    {t("tutorClass.detail.editLink")}
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("tutorClass.detail.editMeetingTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("tutorClass.detail.editMeetingDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">{t("tutorClass.detail.meetingUrlLabel")}</Label>
                    <Input
                      id="url"
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                  >
                    {t("tutorClass.detail.cancel")}
                  </Button>
                  <Button onClick={handleUpdate} disabled={loading || !url}>
                    {loading ? t("tutorClass.detail.saving") : t("tutorClass.detail.save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {initialUrl && (
              <a
                href={initialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  id="btn-join-meeting"
                  size="sm"
                  className="w-full h-10 gap-2 shrink-0 font-medium"
                >
                  {t("tutorClass.detail.enterRoom")} <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeatureLessonButton({
  classId,
  articleId,
}: {
  classId: string;
  articleId: string;
}) {
  const router = useRouter();

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          {t("tutorClass.detail.lessonFeatureTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t("tutorClass.detail.interactiveDescription")}
        </p>
        <Button
          className="w-full gap-2 font-bold"
          onClick={() =>
            router.push(`/lesson/${classId}/interactive?articleId=${articleId}`)
          }
        >
          {t("tutorClass.detail.startTeaching")}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function StudentAvatars({
  enrolledStudents,
}: {
  enrolledStudents: any[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="flex flex-wrap gap-3">
      {enrolledStudents.map((s: any, idx: number) => (
        <div
          key={idx}
          className="relative flex flex-col items-center"
          onMouseEnter={() => setHoveredIdx(idx)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Avatar with paid checkmark */}
          <div className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/15 flex items-center justify-center text-sm font-bold text-primary uppercase border-2 border-border/50 hover:border-primary/50 transition-all duration-300 relative cursor-pointer shadow-sm">
            {s.avatarUrl ? (
              <img src={s.avatarUrl} alt={s.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              s.name[0] || "?"
            )}
            {s.paid && (
              <div className="absolute -bottom-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-emerald-500 shadow-sm">
                <svg
                  className="h-3 w-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Premium Hover Tooltip using React state */}
          {hoveredIdx === idx && (
            <div className="absolute bottom-full mb-2.5 flex flex-col items-center z-50 pointer-events-none animate-in fade-in zoom-in duration-150">
              <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-xl text-center text-xs w-44 backdrop-blur-md">
                <p className="font-bold text-popover-foreground text-sm truncate">
                  {s.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t("tutorClass.detail.enrolledAtPrefix")} {s.enrolled}
                </p>
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 flex items-center justify-center gap-1 ${s.paid ? "text-emerald-500" : "text-orange-500"}`}
                >
                  {s.paid ? t("tutorClass.detail.paid") : t("tutorClass.detail.unpaid")}
                </p>
              </div>
              {/* Small Tooltip Triangle */}
              <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45 -mt-1 shadow-sm" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── DEV ONLY ─────────────────────────────────────────────────────────────────
// DevClassSimulator: appears only in development. Completes all lessons for
// every enrolled student in one click — useful for testing the upclass flow.

type SeedResult = {
  className: string;
  bookTitle: string;
  studentsProcessed: number;
  articlesTotal: number;
  sessionsCreated: number;
  skipped: number;
};

export function DevClassSimulator({ classId }: { classId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await devSeedClassAllProgress(classId);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <FlaskConical className="h-4 w-4" />
          DEV — Simulate Class Completion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Seeds FINISHED sessions for <strong>all enrolled students</strong> across every article in this book.
          Use this to set up an &quot;upclass&quot; test scenario.
        </p>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSeed}
          disabled={loading}
          className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/40"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Users2 className="h-4 w-4" />
          )}
          {loading ? "Seeding…" : "Complete all lessons for all students"}
        </Button>

        {result && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-xs space-y-1">
            <p className="font-semibold text-green-700 dark:text-green-400">✓ Done — {result.className}</p>
            <p className="text-muted-foreground">Book: {result.bookTitle}</p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{result.studentsProcessed}</p>
                <p className="text-muted-foreground">students</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{result.sessionsCreated}</p>
                <p className="text-muted-foreground">sessions created</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{result.skipped}</p>
                <p className="text-muted-foreground">skipped</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 p-3 text-xs text-red-700 dark:text-red-400">
            ✗ {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
