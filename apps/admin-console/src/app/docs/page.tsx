"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  FileText,
  MessageSquare,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { adminDocsCopy, t } from "@/lib/i18n";

const sectionIcons = [Zap, ShieldCheck, FileText] as const;

export default function DocsPage() {
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  const activeDoc = useMemo(
    () => {
      for (const section of adminDocsCopy.sections) {
        const item = section.items.find((doc) => doc.id === openDocId);
        if (item) {
          return item;
        }
      }

      return null;
    },
    [openDocId],
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">
            {t("docs.title")}
          </h2>
          <p className="text-muted-foreground font-medium">
            {t("docs.description")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {adminDocsCopy.sections.map((section, sectionIndex) => {
          const Icon = sectionIcons[sectionIndex] ?? FileText;

          return (
            <Card
              key={section.title}
              className="border-none shadow-sm rounded-3xl overflow-hidden bg-card transition-all hover:shadow-md"
            >
              <CardHeader className="pb-4">
                <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-2xl text-brand-600 dark:text-brand-400 w-fit mb-2">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold">
                  {section.title}
                </CardTitle>
                <CardDescription className="font-medium text-sm leading-relaxed">
                  {section.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => setOpenDocId(item.id)}
                        className="w-full group flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="text-sm font-semibold text-foreground/80 group-hover:text-brand-600 transition-colors">
                          {item.name}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-600 transition-all group-hover:translate-x-1" />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-none shadow-lg rounded-3xl p-8 bg-gradient-to-r from-brand-600 to-brand-800 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-2xl font-black mb-2">{t("docs.helpTitle")}</h3>
          <p className="text-brand-100 font-medium mb-6">
            {t("docs.helpDescription")}
          </p>
          <Button
            variant="secondary"
            className="rounded-xl font-bold bg-white text-brand-900 hover:bg-brand-50 px-8 h-12"
            asChild
          >
            <Link href="https://lin.ee/R7Dccj9" target="_blank">
              <MessageSquare className="h-5 w-5 mr-2" />
              {t("docs.support")}
            </Link>
          </Button>
        </div>
        <BookOpen className="absolute -right-8 -bottom-8 h-48 w-48 text-white/10 -rotate-12" />
      </Card>

      <Sheet open={!!openDocId} onOpenChange={(open) => !open && setOpenDocId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {activeDoc && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-black leading-tight text-brand-700 dark:text-brand-400">
                  {activeDoc.title}
                </SheetTitle>
                <SheetDescription className="font-medium text-xs uppercase tracking-widest">
                  {t("docs.adminGuide")}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-2 text-sm leading-relaxed text-foreground/90">
                {activeDoc.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
