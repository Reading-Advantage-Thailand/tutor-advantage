import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, TrendingUp, Target, Zap, Star, Users } from "lucide-react";
import { cookies } from "next/headers";

async function getPerformanceData() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) return null;

  try {
    const res = await fetch("http://localhost:3002/v1/tutors/performance", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { tags: ['performance'] }
    });
    
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default async function PerformancePage() {
  const data = await getPerformanceData();

  // Mapping string icon names to Lucide components safely
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconMap: Record<string, any> = {
    "Star": Star,
    "Zap": Zap,
    "TrendingUp": TrendingUp,
    "Award": Award,
    "Target": Target,
    "Users": Users
  };

  const badges = data?.badges?.unlocked || [];
  const nextGoal = data?.badges?.nextGoal;
  const metrics = data?.metrics;

  const NextGoalIcon = nextGoal ? (IconMap[nextGoal.icon] || Award) : Award;

  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          ผลงานและเหรียญรางวัล <Award className="h-6 w-6 text-primary" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ติดตามพัฒนาการของนักเรียนเพื่อรับโบนัสและเหรียญตราพิเศษ
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Badges & Gamification */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500 auto-animate-pulse" />
              เกียรติยศและโบนัส (Gamification)
            </CardTitle>
            <CardDescription className="text-xs">
              สะสมเหรียญตราเพื่อปลดล็อคโบนัสเครือข่ายพิเศษ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {badges.length === 0 && (
              <div className="py-6 text-center border rounded-xl border-dashed">
                <p className="text-muted-foreground text-sm">ยังไม่มีเหรียญตรา</p>
              </div>
            )}
            {badges.map((badge: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const Icon = IconMap[badge.icon] || Award;
              // Ensure color classes use template literals or safe classes.
              // Since the API returns exact tailwind classes like "text-amber-500 bg-amber-500/10", we use them directly.
              const classes = badge.color.split(' ');
              const textClass = classes.find((c: string) => c.startsWith('text-')) || "text-foreground";
              const bgClass = classes.find((c: string) => c.startsWith('bg-')) || "bg-muted";

              return (
                <div key={badge.id} className="flex items-center gap-4 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/50 transition-colors">
                  <div className={`w-12 h-12 rounded-full ${bgClass} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-6 w-6 ${textClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground">{badge.label}</h3>
                    <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0 text-right">
                    ปลดล็อคเมื่อ<br/>{new Date(badge.unlockedAt).toLocaleDateString("th-TH")}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Student Benchmarks */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              คุณภาพการสอน (Benchmarks)
            </CardTitle>
            <CardDescription className="text-xs">
              ภาพรวมคะแนนประเมินของนักเรียนแต่ละระดับชั้น
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!metrics ? (
              <div className="py-6 text-center border rounded-xl border-dashed">
                <p className="text-muted-foreground text-sm">ไม่มีข้อมูลคุณภาพการสอน</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/50 bg-muted/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground">เกณฑ์มาตรฐานนักเรียน</span>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {metrics.studentBenchmark?.level || "ดี"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    เรตติ้งเฉลี่ย {metrics.engagement?.rating || "N/A"}
                  </div>
                  <div className="flex items-center gap-3">
                    <span>คะแนนเฉลี่ย: <strong className="text-foreground">{metrics.studentBenchmark?.current || 0}%</strong></span>
                    <span className="flex items-center text-emerald-500 font-medium">
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                      เป้าหมาย {metrics.studentBenchmark?.target || 0}%
                    </span>
                  </div>
                </div>
                
                {/* Progress bar visual */}
                <div className="w-full bg-border/50 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, Math.max(0, metrics.studentBenchmark?.current || 0))}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Gamification Call to Action */}
      {nextGoal && (
        <Card className="bg-primary/5 text-primary border-primary/20 p-1">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                 <NextGoalIcon className="h-6 w-6 text-primary" />
               </div>
               <div>
                 <h3 className="font-semibold text-base">เป้าหมายถัดไป: {nextGoal.label}</h3>
                 <p className="text-sm opacity-80 mt-0.5">
                   {nextGoal.description} (ความคืบหน้า {nextGoal.progress}%)
                 </p>
               </div>
            </div>
            <Button variant="default" className="w-full sm:w-auto shrink-0 shadow-sm">
              ดูรายละเอียด
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
