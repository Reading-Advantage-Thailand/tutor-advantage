"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { studentApi } from "@/lib/api";
import { useLiff } from "@/components/providers/LiffProvider";
import { AlertCircle, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { parseClassIdFromQrText } from "@/lib/paymentFlow";

interface ClassItem {
  id: string;
  name: string;
  status: string;
  seriesColor?: string;
  capacity: number;
  enrolled: number;
  tutor: string;
  tutorInitials: string;
  cefr: string;
  level: number;
  nextSession: string;
  price: number;
}

export default function ClassesPage() {
  const { liff, isReady } = useLiff();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ทั้งหมด");

  useEffect(() => {
    if (!isReady) return;
    let isMounted = true;

    const timer = setTimeout(() => {
      setLoading(true);
      studentApi
        .getAvailableClasses({
          q: searchQuery || undefined,
          cefr: activeFilter !== "ทั้งหมด" ? activeFilter : undefined,
        })
        .then((data) => {
          if (isMounted) {
            setClasses(data.classes || []);
            setError(null);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("Failed to fetch classes:", err);
            setError(err instanceof Error ? err.message : String(err));
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }, 400);

    return () => {
      clearTimeout(timer);
      isMounted = false;
    };
  }, [isReady, searchQuery, activeFilter]);

  const handleScanQr = async () => {
    if (!isReady || !liff) return;

    try {
      if (!liff.isInClient()) {
        toast.info("💡 การสแกน QR Code รองรับเฉพาะการใช้งานผ่านแอป LINE เท่านั้นครับ");
        return;
      }

      let scannedText = "";

      // Try modern scanCodeV2 first
      if (liff.scanCodeV2) {
        const result = await liff.scanCodeV2();
        scannedText = result.value || "";
      } else if ("scanCode" in liff) {
        // Fallback to old method
        const result = await (liff as { scanCode: () => Promise<{ value: string }> }).scanCode();
        scannedText = result.value || "";
      } else {
        toast.warning("⚠️ อุปกรณ์หรือเวอร์ชันของ LINE ไม่รองรับการสแกนในหน้าแอปนี้");
        return;
      }

      if (scannedText) {
        const classId = parseClassIdFromQrText(scannedText);
        if (classId) {
          window.location.href = `/enroll?classId=${classId}`;
        } else {
          toast.error("❌ รูปแบบ QR Code ไม่ถูกต้อง (ไม่พบข้อมูลคลาสเรียน)");
        }
      }
    } catch (err) {
      // Users might cancel scanning, usually safe to log
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log("QR Scan stopped:", errorMessage);
    }
  };

  const statusMap = {
    open: { label: "รับสมัคร", className: "status-active" },
    full: { label: "เต็มแล้ว", className: "status-full" },
    closed: { label: "ปิดรับ", className: "status-closed" },
  };

  return (
    <div>
      <div
        className="top-bar"
        style={{
          background: "var(--surface-card)",
          backdropFilter: "blur(12px)",
        }}
      >
        <h1
          style={{
            fontSize: "1.0625rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            flex: 1,
          }}
        >
          คลาสเรียน
        </h1>
      </div>

      <div
        style={{
          padding: "16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Search row */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--neutral-400)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 1,
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              id="input-search-classes"
              type="search"
              placeholder="ค้นหาคลาสหรือติวเตอร์..."
              className="input-field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 42,
                borderRadius: 16,
                height: 48,
                background: "var(--surface-card)",
                width: "100%",
              }}
            />
          </div>

          <button
            id="btn-scan-qr"
            onClick={handleScanQr}
            title="สแกน QR Code"
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              background: "var(--surface-card)",
              border: "1.5px solid var(--surface-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--brand-600)",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              flexShrink: 0,
            }}
          >
            <QrCode size={22} />
          </button>
        </div>

        {/* Filter chips */}
        <div
          className="scrollbar-hide"
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {["ทั้งหมด", "Origins A1", "Quest A2", "Adventure B1"].map(
            (label, i) => {
              const isActive = activeFilter === label;
              return (
                <button
                  key={i}
                  onClick={() => setActiveFilter(label)}
                  id={`chip-filter-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  style={{
                    padding: "8px 16px",
                    fontSize: "0.8125rem",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    borderRadius: "var(--radius-full)",
                    fontFamily: "inherit",
                    fontWeight: isActive ? 700 : 500,
                    transition: "all 0.2s ease",
                    background: isActive
                      ? "var(--brand-500)"
                      : "var(--surface-card)",
                    color: isActive ? "#fff" : "var(--text-secondary)",
                    border: isActive
                      ? "1.5px solid var(--brand-500)"
                      : "1.5px solid var(--surface-border)",
                    boxShadow: isActive
                      ? "0 2px 8px rgba(6,199,85,0.25)"
                      : "none",
                  }}
                >
                  {label}
                </button>
              );
            },
          )}
          {/* Filter chips container end */}
        </div>

        {loading && (
          <div
            className="flex flex-col items-center justify-center p-12 gap-2"
            style={{ minHeight: "50dvh" }}
          >
            <Loader2 className="animate-spin text-brand-500" />
            <p className="text-slate-400 text-sm">
              กำลังหาคลาสที่เหมาะกับคุณ...
            </p>
          </div>
        )}

        {error && (
          <div className="p-6 bg-red-50 rounded-2xl flex flex-col items-center gap-3 text-center">
            <AlertCircle className="text-red-500" />
            <p className="text-red-700 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-bold text-red-600 underline"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {!loading && !error && classes.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-500 font-medium">
              {classes.length === 0
                ? "ไม่พบคลาสที่เปิดรับสมัครในขณะนี้"
                : "ไม่พบผลลัพธ์ที่ตรงกับการค้นหา"}
            </p>
          </div>
        )}

        {/* Class cards */}
        <div
          className="stagger"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {!loading &&
            classes.map((cls) => {
              const status =
                statusMap[cls.status as keyof typeof statusMap] ||
                statusMap.open;
              const seriesColor = cls.seriesColor || "#06c755";
              const seatsLeft = cls.capacity - cls.enrolled;
              return (
                <Link
                  key={cls.id}
                  href={`/classes/${cls.id}`}
                  id={`class-card-${cls.id}`}
                  className="animate-slide-up glass-card"
                  style={{
                    textDecoration: "none",
                    display: "block",
                    overflow: "hidden",
                  }}
                >
                  {/* Left accent border */}
                  <div style={{ display: "flex" }}>
                    <div
                      style={{
                        width: 4,
                        background: seriesColor,
                        borderRadius: "4px 0 0 4px",
                        opacity: cls.status === "full" ? 0.4 : 1,
                      }}
                    />

                    <div style={{ padding: "16px", flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 10,
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h2
                            className="line-clamp-2"
                            style={{
                              fontSize: "0.9375rem",
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              lineHeight: 1.35,
                            }}
                          >
                            {cls.name}
                          </h2>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginTop: 5,
                            }}
                          >
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: seriesColor + "18",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.5625rem",
                                fontWeight: 800,
                                color: seriesColor,
                              }}
                            >
                              {cls.tutorInitials}
                            </div>
                            <span
                              style={{
                                fontSize: "0.8125rem",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {cls.tutor}
                            </span>
                          </div>
                        </div>
                        <div
                          className={`status-chip ${status.className}`}
                          style={{ flexShrink: 0, fontSize: "0.6875rem" }}
                        >
                          {status.label}
                        </div>
                      </div>

                      {/* Meta */}
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          marginBottom: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: seriesColor,
                            background: seriesColor + "12",
                            padding: "3px 8px",
                            borderRadius: 8,
                          }}
                        >
                          {cls.cefr || "A1"} · Lv.{cls.level || 1}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.75rem",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          📅 {cls.nextSession}
                        </span>
                      </div>

                      {/* Seats */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 14,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 5,
                            background: "var(--neutral-200)",
                            borderRadius: 10,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${(cls.enrolled / cls.capacity) * 100}%`,
                              background:
                                cls.status === "full"
                                  ? "var(--accent-red)"
                                  : seriesColor,
                              borderRadius: 10,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            color:
                              cls.status === "full"
                                ? "var(--accent-red)"
                                : "var(--text-tertiary)",
                            flexShrink: 0,
                          }}
                        >
                          {seatsLeft > 0 ? `${seatsLeft} ว่าง` : "เต็ม"}
                        </span>
                      </div>

                      {/* Price + CTA */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: "1.125rem",
                              fontWeight: 800,
                              color: "var(--text-primary)",
                            }}
                          >
                            ฿{cls.price.toLocaleString()}
                          </span>
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              color: "var(--text-tertiary)",
                              marginLeft: 4,
                            }}
                          >
                            / คอร์ส
                          </span>
                        </div>
                        <div
                          style={{
                            background:
                              cls.status === "open"
                                ? seriesColor
                                : "var(--neutral-200)",
                            color:
                              cls.status === "open"
                                ? "#fff"
                                : "var(--neutral-400)",
                            borderRadius: "var(--radius-full)",
                            padding: "8px 18px",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            pointerEvents:
                              cls.status === "full" ? "none" : "auto",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {cls.status === "open" ? "ดูรายละเอียด" : "เต็มแล้ว"}
                          {cls.status === "open" && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
