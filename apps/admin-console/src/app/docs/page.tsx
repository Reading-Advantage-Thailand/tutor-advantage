import { 
  BookOpen, 
  ChevronRight, 
  FileText, 
  ShieldCheck, 
  Zap, 
  MessageSquare, 
  Scale, 
  ArrowLeft 
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DOCS_SECTIONS = [
  {
    title: "Operational Procedures",
    description: "Standard workflows for settlements, adjustments, and exceptions.",
    icon: Zap,
    items: [
      { name: "Settlement Approval Workflow", href: "#" },
      { name: "Handling Payout Exceptions", href: "#" },
      { name: "Manual Adjustment Guidelines", href: "#" },
    ]
  },
  {
    title: "Compliance & Risk",
    description: "Guidelines for fraud detection and user verification.",
    icon: ShieldCheck,
    items: [
      { name: "Fraud Flagging Criteria", href: "#" },
      { name: "Identity Verification Process", href: "#" },
      { name: "Data Privacy Policy (Internal)", href: "#" },
    ]
  },
  {
    title: "System Architecture",
    description: "Technical overview of the Tutor Advantage ecosystem.",
    icon: FileText,
    items: [
      { name: "Service Dependencies", href: "#" },
      { name: "API Rate Limiting", href: "#" },
      { name: "Database Schema Overview", href: "#" },
    ]
  }
];

export default function DocsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">Internal Documentation</h2>
          <p className="text-muted-foreground font-medium">Knowledge base for Tutor Advantage administrators.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {DOCS_SECTIONS.map((section) => (
          <Card key={section.title} className="border-none shadow-sm rounded-3xl overflow-hidden bg-card transition-all hover:shadow-md">
            <CardHeader className="pb-4">
              <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-2xl text-brand-600 dark:text-brand-400 w-fit mb-2">
                <section.icon className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">{section.title}</CardTitle>
              <CardDescription className="font-medium text-sm leading-relaxed">
                {section.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <Link 
                      href={item.href} 
                      className="group flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-semibold text-foreground/80 group-hover:text-brand-600 transition-colors">
                        {item.name}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-600 transition-all group-hover:translate-x-1" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-lg rounded-3xl p-8 bg-gradient-to-r from-brand-600 to-brand-800 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-2xl font-black mb-2">Still need help?</h3>
          <p className="text-brand-100 font-medium mb-6">
            If you can&apos;t find what you&apos;re looking for, please contact our support team directly via LINE.
          </p>
          <Button variant="secondary" className="rounded-xl font-bold bg-white text-brand-900 hover:bg-brand-50 px-8 h-12" asChild>
            <Link href="https://lin.ee/zqTz6feg" target="_blank">
              <MessageSquare className="h-5 w-5 mr-2" />
              Contact Support
            </Link>
          </Button>
        </div>
        <BookOpen className="absolute -right-8 -bottom-8 h-48 w-48 text-white/10 -rotate-12" />
      </Card>
    </div>
  );
}
