"use client";

import { useState, useEffect, useMemo } from "react";
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
  CalendarClock,
  Calendar as CalendarIcon,
  Ticket,
  List,
  LayoutGrid,
  MoreVertical,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  updateClassStatus,
  deleteClass,
  updateMeetingUrl,
  rescheduleClass,
  getClassArticles,
  createClassBookCycle,
  getBooks,
  devSeedClassAllProgress,
  applyCoupon,
} from "./../actions";
import {
  buildScheduleString,
  calculateTotalHours,
  CLASS_DAYS,
  CLASS_TIME_OPTIONS,
  getEndTimeOptions,
  MAX_CLASS_HOURS,
  toggleClassDay,
  WEEKLY_TEMPLATES,
  parseLocalDate,
} from "@/lib/tutorClassFlow";
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
import { cn } from "@/lib/utils";

export { ClassStatusToggle } from "./components/ClassStatusToggle";

export { ReferralLink } from "./components/ReferralLink";

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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

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
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 w-full">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
              <BookOpen className="h-5 w-5 text-emerald-600" />
              {t("tutorClass.detail.articleTitle")}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {t("tutorClass.detail.articleDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={`h-8 px-3 text-xs gap-1.5 ${viewMode === "list" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-4 w-4" />
                รายการ
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={`h-8 px-3 text-xs gap-1.5 ${viewMode === "grid" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
                คอลัมน์
              </Button>
            </div>
            <Dialog open={openBookDialogOpen} onOpenChange={setOpenBookDialogOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm" className="h-9 px-4 text-xs font-medium">
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
        
        <div className="mt-4 flex flex-col gap-2">
          <select
            value={selectedCycleId}
            onChange={(event) => setSelectedCycleId(event.target.value)}
            className="w-full md:w-[400px] h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-emerald-500"
          >
            {bookCycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                เล่ม {cycle.sequence}: {cycle.title}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="pb-6 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2 min-h-0 scrollbar-thin">
          {fetching ? (
            <div className="py-24 flex flex-col items-center justify-center text-center gap-2">
              <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
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
          ) : viewMode === "list" ? (
            <div className="w-full rounded-md border border-border/60 overflow-hidden bg-card">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/30 border-b border-border/60">
                  <tr>
                    <th className="px-4 py-3 font-medium w-12 text-center"></th>
                    <th className="px-4 py-3 font-medium w-24">บทที่</th>
                    <th className="px-4 py-3 font-medium">บทความ</th>
                    <th className="px-4 py-3 font-medium w-24 text-center">ระดับ</th>
                    <th className="px-4 py-3 font-medium w-32">ประเภท</th>
                    <th className="px-4 py-3 font-medium w-32">เวลาที่แนะนำ</th>
                    <th className="px-4 py-3 font-medium w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((article: any, idx: number) => (
                    <tr 
                      key={article.id}
                      onClick={() => setSelectedArticle(article.id)}
                      className={`border-b border-border/60 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${selectedArticle === article.id ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""} ${article.isCompleted ? "opacity-80" : ""}`}
                    >
                      <td className="px-4 py-4 text-center align-middle">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedArticle === article.id ? 'border-emerald-600 bg-emerald-600' : 'border-input bg-background'}`}>
                          {selectedArticle === article.id && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle whitespace-nowrap text-muted-foreground">
                        บทที่ {idx + 1}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-4">
                          {article.imageUrl && (
                            <div className="w-16 h-12 rounded bg-muted/40 overflow-hidden shrink-0 border border-border/50 relative">
                              <img 
                                src={article.imageUrl} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                loading="lazy"
                              />
                              {article.isCompleted && (
                                <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                </div>
                              )}
                            </div>
                          )}
                          <div className="min-w-0 flex flex-col justify-center">
                            <p className={`font-bold leading-snug truncate ${selectedArticle === article.id ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                              {article.title}
                            </p>
                            {article.summary && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {article.summary}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle text-center whitespace-nowrap">
                        {article.cefrLevel && (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                            CEFR {article.cefrLevel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-middle text-muted-foreground text-xs whitespace-nowrap">
                        {article.type || (idx % 2 === 0 ? "เนื้อเรื่อง" : "ชีวประวัติ")}
                      </td>
                      <td className="px-4 py-4 align-middle text-muted-foreground text-xs whitespace-nowrap">
                        {article.recommendedTime || "10 นาที"}
                      </td>
                      <td className="px-4 py-4 align-middle text-center">
                        <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-2">
              {articles.map((article: any, idx: number) => (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticle(article.id)}
                  className={`group border rounded-xl p-4 transition-all duration-300 relative overflow-hidden cursor-pointer flex flex-col h-full ${
                    selectedArticle === article.id
                      ? "border-emerald-600/50 bg-emerald-50/50 shadow-md ring-1 ring-emerald-600/20"
                      : "border-border/60 bg-card hover:bg-muted/40 hover:border-emerald-600/30 hover:shadow-sm"
                  } ${article.isCompleted ? "opacity-85 saturate-[0.9]" : ""}`}
                >
                  <div
                    className={`absolute top-0 bottom-0 left-0 w-1.5 transition-all duration-300 z-10 ${
                      selectedArticle === article.id
                        ? "bg-emerald-600"
                        : "bg-transparent group-hover:bg-emerald-600/40"
                    }`}
                  />
                  
                  {article.imageUrl && (
                    <div className="w-full h-36 rounded-lg bg-muted/40 overflow-hidden mb-4 relative shrink-0 border border-border/50 shadow-sm group-hover:shadow-md transition-shadow">
                      <img 
                        src={article.imageUrl} 
                        alt={article.title} 
                        className={`w-full h-full object-cover transition-transform duration-700 ease-out ${selectedArticle === article.id ? 'scale-105' : 'group-hover:scale-105'}`} 
                        loading="lazy"
                      />
                      {article.isCompleted && (
                        <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="bg-emerald-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t("tutorClass.detail.taught")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pl-2 flex flex-col flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border/40">
                        {t("tutorClass.detail.chapterPrefix")} {idx + 1}
                      </span>
                      {!article.imageUrl && article.isCompleted && (
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
                      className={`text-sm font-bold leading-snug transition-colors line-clamp-2 ${selectedArticle === article.id ? "text-emerald-700" : "text-foreground group-hover:text-emerald-700/80"}`}
                    >
                      {article.title}
                    </h3>
                    {article.summary && (
                      <p className="text-xs text-muted-foreground font-medium line-clamp-3 mt-2 leading-relaxed flex-1">
                        {article.summary}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 shrink-0 flex items-center justify-between border-t border-border/60 mt-2">
          <p className="text-sm font-medium text-emerald-700">
            แสดงเพิ่มเติม (ทั้งหมด {articles.length} บทความ)
          </p>
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-emerald-700">
              เลือกแล้ว {selectedArticle ? 1 : 0} บทความ
            </p>
            <Button
              className="gap-2 font-bold shadow-md transition-all duration-300 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!selectedArticle || loading || fetching}
              onClick={handleStartLesson}
            >
              {loading ? "กำลังสร้างห้องเรียน..." : "สร้างห้องเรียน & เริ่มสอน >"}
            </Button>
          </div>
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
  className,
}: {
  classId: string;
  initialUrl: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const handleCopy = () => {
    if (!initialUrl) return;
    navigator.clipboard.writeText(initialUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card
      className={cn(
        "h-full min-h-[220px] rounded-2xl border-border/60 bg-card/95 shadow-sm",
        className,
      )}
    >
      <CardContent className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex h-full flex-col">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <Video className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {t("tutorClass.detail.onlineRoom")}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground truncate flex-1">
                  {initialUrl || t("tutorClass.detail.missingMeetingUrl")}
                </p>
                {initialUrl && (
                  <button
                    onClick={handleCopy}
                    className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
                    title={copied ? t("tutorClass.detail.copied") : t("tutorClass.detail.copy")}
                  >
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-auto flex w-full flex-col gap-2 border-t border-border/50 pt-4">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full bg-background px-3 text-xs font-medium text-emerald-600 border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
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
                className="w-full"
              >
                <Button
                  id="btn-join-meeting"
                  size="sm"
                  className="h-9 w-full gap-2 font-medium"
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

export function CouponExtendButton({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleApply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      await applyCoupon(classId, code.trim());
      setOpen(false);
      setCode("");
      router.refresh();
    } catch (err: any) {
      setError(err.message || t("tutorClass.errors.coupon"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(""); }}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 w-full gap-2 bg-background text-xs font-medium text-emerald-600 border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
            <Ticket className="h-4 w-4" />
            ข้อมูลเพิ่มเติม
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("tutorClass.detail.couponTitle")}</DialogTitle>
          <DialogDescription>
            {t("tutorClass.detail.couponDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="extend-coupon">{t("tutorClass.detail.couponLabel")}</Label>
            <Input
              id="extend-coupon"
              placeholder={t("tutorClass.detail.couponPlaceholder")}
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(""); }}
              className="font-mono uppercase"
            />
            {error && (
              <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {error}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {t("tutorClass.detail.cancel")}
          </Button>
          <Button onClick={handleApply} disabled={loading || !code.trim()}>
            {loading ? t("tutorClass.detail.couponApplying") : t("tutorClass.detail.couponApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RescheduleClassButton({
  classId,
  className,
  currentSchedule,
  scheduleData,
  initialStartsAt,
  initialEndsAt,
  freeHours = 0,
}: {
  classId: string;
  className?: string;
  currentSchedule?: string;
  scheduleData?: any[];
  initialStartsAt?: string | null;
  initialEndsAt?: string | null;
  freeHours?: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const router = useRouter();

  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [dateTimes, setDateTimes] = useState<Record<string, { start: string; end: string }>>({});

  const [genStart, setGenStart] = useState("");

  const diffHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    return minutes > 0 ? minutes / 60 : 0;
  };

  const getPastSchedule = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pastD: Date[] = [];
    const pastT: Record<string, { start: string; end: string }> = {};
    if (scheduleData) {
      scheduleData.forEach(item => {
        const d = parseLocalDate(item.date);
        if (d < today) {
          pastD.push(d);
          pastT[item.date] = { start: item.start, end: item.end };
        }
      });
    }
    return { pastD, pastT };
  };

  const doGenerate = (startDateStr: string, tpl: typeof WEEKLY_TEMPLATES[0]) => {
    if (!startDateStr) return;
    const start = parseLocalDate(startDateStr);
    const { pastD, pastT } = getPastSchedule();

    const newDates: Date[] = [...pastD];
    const nextTimes: Record<string, { start: string; end: string }> = { ...pastT };
    
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);

    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    
    let accumulatedHours = 0;
    pastD.forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      const t = pastT[key];
      if (t) accumulatedHours += diffHours(t.start, t.end);
    });

    const maxHours = MAX_CLASS_HOURS + (freeHours || 0);
    while (accumulatedHours < maxHours) {
      const dayName = dayNames[cur.getDay()];
      if (tpl.days.includes(dayName)) {
        const d = new Date(cur);
        newDates.push(d);
        
        const templateHours = diffHours(tpl.startTime, tpl.endTime);
        const hoursNeeded = maxHours - accumulatedHours;
        
        if (hoursNeeded >= templateHours) {
          nextTimes[format(d, 'yyyy-MM-dd')] = { start: tpl.startTime, end: tpl.endTime };
          accumulatedHours += templateHours;
        } else {
          const [sh, sm] = tpl.startTime.split(":").map(Number);
          const totalMinutes = (sh * 60 + sm) + (hoursNeeded * 60);
          const eh = Math.floor(totalMinutes / 60);
          const em = totalMinutes % 60;
          const adjustedEndTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
          
          nextTimes[format(d, 'yyyy-MM-dd')] = { start: tpl.startTime, end: adjustedEndTime };
          accumulatedHours += hoursNeeded;
        }
      }
      cur.setDate(cur.getDate() + 1);
    }

    setSelectedDates(newDates);
    setDateTimes(nextTimes);
  };

  useEffect(() => {
    let startStr = "";
    if (initialStartsAt) {
      // initialStartsAt may be a full ISO timestamp or a yyyy-MM-dd string;
      // take the date portion and parse as a local date to avoid UTC shifts.
      startStr = format(parseLocalDate(String(initialStartsAt).slice(0, 10)), 'yyyy-MM-dd');
    } else {
      startStr = format(new Date(), 'yyyy-MM-dd');
    }
    setGenStart(startStr);

    if (scheduleData && scheduleData.length > 0) {
      const parsedDates = scheduleData.map(item => parseLocalDate(item.date));
      const parsedTimes: Record<string, { start: string; end: string }> = {};
      scheduleData.forEach(item => {
        parsedTimes[item.date] = { start: item.start, end: item.end };
      });
      setSelectedDates(parsedDates);
      setDateTimes(parsedTimes);
    } else if (selectedDates.length === 0) {
      // Automatically generate a default schedule so it isn't empty
      doGenerate(startStr, WEEKLY_TEMPLATES[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStartsAt, scheduleData]);

  const handleGenerate = (tpl: typeof WEEKLY_TEMPLATES[0]) => {
    doGenerate(genStart, tpl);
  };

  const totalHours = useMemo(() => {
    let sum = 0;
    selectedDates.forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      const times = dateTimes[key];
      if (times) sum += diffHours(times.start, times.end);
    });
    return Math.round(sum * 100) / 100;
  }, [selectedDates, dateTimes]);

  const scheduleDescription = useMemo(() => {
    if (selectedDates.length === 0) return "";
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    
    const firstDate = sorted[0];
    const lastDate = sorted[sorted.length - 1];
    
    const startStr = format(firstDate, 'd MMM yy', { locale: th });
    const endStr = format(lastDate, 'd MMM yy', { locale: th });
    
    if (sorted.length === 1) {
      const times = dateTimes[format(firstDate, 'yyyy-MM-dd')];
      return `${startStr} (${times?.start || ''}-${times?.end || ''})`;
    }
    
    return `${startStr} - ${endStr} (รวม ${sorted.length} วัน)`;
  }, [selectedDates, dateTimes]);

  const maxHours = MAX_CLASS_HOURS + (freeHours || 0);
  const overLimit = totalHours > maxHours;
  const hoursPct = Math.min(100, (totalHours / maxHours) * 100);

  const handleSave = async () => {
    if (!scheduleDescription) {
      setErrorText(t("tutorClass.newClass.scheduleRequired"));
      return;
    }
    if (overLimit) {
      setErrorText(t("tutorClass.newClass.hoursOverLimit"));
      return;
    }
    try {
      setLoading(true);
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      const finalStartsAt = sortedDates.length > 0 ? format(sortedDates[0], 'yyyy-MM-dd') : undefined;
      const finalEndsAt = sortedDates.length > 0 ? format(sortedDates[sortedDates.length - 1], 'yyyy-MM-dd') : undefined;
      
      const newScheduleData = sortedDates.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return {
          date: dateStr,
          start: dateTimes[dateStr]?.start || "",
          end: dateTimes[dateStr]?.end || "",
        };
      });

      await rescheduleClass(classId, {
        scheduleDescription,
        scheduleData: newScheduleData,
        startsAt: finalStartsAt,
        endsAt: finalEndsAt,
        totalHours,
      });
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      setErrorText(error.message || t("tutorClass.errors.reschedule"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 w-full gap-2 bg-background text-xs font-medium text-emerald-600 border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700">
            <CalendarClock className="h-4 w-4" />
            {t("tutorClass.detail.rescheduleButton")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{t("tutorClass.detail.rescheduleTitle")}</DialogTitle>
          <DialogDescription>{t("tutorClass.detail.rescheduleDescription")}</DialogDescription>
        </DialogHeader>

        {className && currentSchedule && (
          <div className="px-6 mb-2">
            <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
              <div className="text-sm">
                <span className="font-bold text-foreground">ข้อมูลคลาสเดิม ({className}): </span>
                <span className="text-muted-foreground">{currentSchedule}</span>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Calendar & Template */}
          <div className="space-y-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-3 mb-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">เพิ่มวันสอนแบบอัตโนมัติ (Template)</Label>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">เริ่มสอนตั้งแต่วันที่ (ระบบจะคำนวณวันให้จนครบ {MAX_CLASS_HOURS + (freeHours || 0)} ชม.)</Label>
                  <Input type="date" value={genStart} onChange={e => setGenStart(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">คลิกเทมเพลตเพื่อสร้างตารางเรียน</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKLY_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleGenerate(tpl)}
                      className="px-2.5 h-7 rounded-md text-[11px] font-semibold border border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all"
                    >
                      + {tpl.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { 
                      const { pastD, pastT } = getPastSchedule();
                      setSelectedDates(pastD); 
                      setDateTimes(pastT); 
                    }}
                    className="px-2.5 h-7 rounded-md text-[11px] font-semibold border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all ml-auto"
                  >
                    ล้างทั้งหมด
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">เลือกวันสอนบนปฏิทิน</Label>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">
                  {selectedDates.length > 0 ? `เลือกแล้ว ${selectedDates.length} วัน` : "ยังไม่ได้เลือกวัน"}
                </span>
              </div>
              <div className="w-full flex justify-center p-2 rounded-xl border bg-background shadow-sm overflow-x-auto">
                <Calendar
                  mode="multiple"
                  locale={th}
                  defaultMonth={selectedDates[0] || new Date()}
                  selected={selectedDates}
                  className="pointer-events-auto border-0 p-0"
                  classNames={{
                    day: "text-sm font-medium",
                    caption_label: "text-base font-bold"
                  }}
                  onSelect={(dates) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const { pastD, pastT } = getPastSchedule();
                    const newValidDates = (dates || []).filter(d => d >= today);
                    const mergedDates = [...pastD, ...newValidDates].sort((a,b) => a.getTime() - b.getTime());
                    
                    setSelectedDates(mergedDates);
                    setDateTimes(prev => {
                      const next = { ...pastT };
                      newValidDates.forEach(d => {
                        const key = format(d, 'yyyy-MM-dd');
                        next[key] = prev[key] || { start: '19:00', end: '21:00' };
                      });
                      return next;
                    });
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Date List & Summary */}
          <div className="space-y-4 flex flex-col h-full md:min-h-[400px]">
            {/* Total Hours Section */}
            <div className="space-y-1.5 pb-4 border-b border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("tutorClass.newClass.totalHoursLabel")}</span>
                <span className={`font-bold ${overLimit ? "text-destructive" : "text-foreground"}`}>
                  {totalHours} / {maxHours} {t("tutorClass.newClass.hoursUnit")}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${overLimit ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${hoursPct}%` }}
                />
              </div>
              {(freeHours || 0) > 0 && (
                <div className="flex flex-col gap-0.5 text-[11px] pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      {t("tutorClass.newClass.regularHoursLabel")}
                    </span>
                    <span className="font-semibold text-foreground tabular-nums">{MAX_CLASS_HOURS} {t("tutorClass.newClass.hoursUnit")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {t("tutorClass.newClass.couponHoursLabel")}
                    </span>
                    <span className="font-semibold text-emerald-600 tabular-nums">{freeHours} {t("tutorClass.newClass.hoursUnit")}</span>
                  </div>
                </div>
              )}
              {overLimit ? (
                <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t("tutorClass.newClass.hoursOverLimit")}
                </p>
              ) : null}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-[250px]">
              {selectedDates.length > 0 ? (
                <div className="space-y-3 h-full flex flex-col">
                  <Label>ตั้งเวลาสอนแต่ละวัน</Label>
                  <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                    {[...selectedDates].sort((a,b) => a.getTime() - b.getTime()).map(d => {
                      const key = format(d, 'yyyy-MM-dd');
                      const times = dateTimes[key] || { start: '19:00', end: '21:00' };
                      
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const isPast = d < today;

                      return (
                        <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                          <span className="text-xs font-semibold w-14 shrink-0 flex items-center gap-1">
                            {isPast && <CalendarClock className="h-3 w-3 text-muted-foreground" />}
                            {format(d, 'd MMM', { locale: th })}
                          </span>
                          <select
                            value={times.start}
                            disabled={isPast}
                            onChange={(e) => setDateTimes(prev => ({ ...prev, [key]: { ...prev[key], start: e.target.value } }))}
                            className={`flex-1 h-8 rounded-md border border-input bg-background px-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${isPast ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {CLASS_TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                          </select>
                          <span className="text-muted-foreground text-xs">-</span>
                          <select
                            value={times.end}
                            disabled={isPast}
                            onChange={(e) => setDateTimes(prev => ({ ...prev, [key]: { ...prev[key], end: e.target.value } }))}
                            className={`flex-1 h-8 rounded-md border border-input bg-background px-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${isPast ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {getEndTimeOptions(times.start).map((time) => <option key={time} value={time}>{time}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  <CalendarIcon className="h-10 w-10 opacity-20 mb-2" />
                  <p className="text-sm">โปรดเลือกวันที่ต้องการสอนบนปฏิทิน</p>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 shrink-0 mt-auto">
              {scheduleDescription ? (
                <>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {t("tutorClass.newClass.previewLabel")}
                  </p>
                  <p className="text-sm font-medium text-foreground">{scheduleDescription}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic">
                  {t("tutorClass.newClass.previewEmpty")}
                </p>
              )}
            </div>
            
            {errorText && <p className="text-xs text-destructive font-semibold">{errorText}</p>}
            <p className="text-[11px] text-muted-foreground">{t("tutorClass.detail.rescheduleNotifyNote")}</p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 bg-muted/30 border-t border-border mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {t("tutorClass.detail.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={loading || overLimit || selectedDates.length === 0}>
            {loading ? t("tutorClass.detail.saving") : t("tutorClass.detail.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
