"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  CreditCard,
  QrCode,
  Clock,
  CheckCircle2,
  AlertCircle,
  ReceiptText,
  Calendar,
} from "lucide-react";
import { useLiff } from "@/components/providers/LiffProvider";
import { studentApi } from "@/lib/api";

interface PaymentRecord {
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  method: string;
  status: string;
  providerRef: string | null;
  createdAt: string;
  enrollment: {
    enrollmentId: string;
    status: string;
    class: {
      title: string;
      book: {
        title: string;
        bookCode: string;
      };
    };
  } | null;
}

export default function PaymentHistoryPage() {
  const { profile, isReady } = useLiff();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (isReady && profile) {
      const fetchHistory = async () => {
        try {
          setLoading(true);

          // Wait for session token to appear (consistent pattern from dashboard)
          let token = localStorage.getItem("student_session_token");
          let retries = 0;
          while (!token && retries < 10 && isMounted) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            token = localStorage.getItem("student_session_token");
            retries++;
          }

          if (!token && isMounted) {
            throw new Error("ไม่สามารถสร้างเซสชันได้ กรุณาลองใหม่อีกครั้ง");
          }

          if (!isMounted) return;

          const response = await studentApi.getPaymentHistory();
          if (isMounted) {
            setPayments(response.payments || []);
          }
        } catch (err) {
          console.error("Failed to fetch payment history:", err);
          if (isMounted) {
            setError(
              "ไม่สามารถดึงข้อมูลประวัติการชำระเงินได้ กรุณาลองใหม่อีกครั้ง",
            );
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchHistory();
    }

    return () => {
      isMounted = false;
    };
  }, [isReady, profile]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
              background: "rgba(16, 185, 129, 0.1)",
              color: "rgb(16, 185, 129)",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={12} /> สำเร็จ
          </div>
        );
      case "PENDING":
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
              background: "rgba(245, 158, 11, 0.1)",
              color: "rgb(245, 158, 11)",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            <Clock size={12} /> รอชำระ
          </div>
        );
      case "FAILED":
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
              background: "rgba(239, 68, 68, 0.1)",
              color: "rgb(239, 68, 68)",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            <AlertCircle size={12} /> ล้มเหลว
          </div>
        );
      default:
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
              background: "var(--neutral-100)",
              color: "var(--text-tertiary)",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            {status}
          </div>
        );
    }
  };

  const getMethodIcon = (method: string) => {
    if (method.toUpperCase() === "PROMPTPAY") {
      return <QrCode size={16} style={{ color: "var(--text-tertiary)" }} />;
    }
    return <CreditCard size={16} style={{ color: "var(--text-tertiary)" }} />;
  };

  return (
    <div
      className="page-shell"
      style={{ background: "var(--surface-bg)", minHeight: "100dvh" }}
    >
      <div
        className="top-bar"
        style={{
          background: "var(--surface-card)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link
          href="/profile"
          style={{
            background: "var(--neutral-100)",
            border: "none",
            borderRadius: 12,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={18} />
        </Link>
        <h1
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            flex: 1,
            textAlign: "center",
            marginRight: 36,
          }}
        >
          ประวัติการชำระเงิน
        </h1>
      </div>

      <div
        style={{
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {!isReady || loading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 0",
              gap: 16,
            }}
          >
            <div
              className="animate-spin"
              style={{
                width: 32,
                height: 32,
                border: "3px solid var(--neutral-200)",
                borderTopColor: "var(--brand-500)",
                borderRadius: "50%",
              }}
            />
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              กำลังโหลดประวัติ...
            </p>
          </div>
        ) : error ? (
          <div
            className="glass-card"
            style={{
              padding: "24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
              }}
            >
              <AlertCircle size={24} />
            </div>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: 8 }}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                background: "var(--neutral-100)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                color: "var(--neutral-400)",
              }}
            >
              <ReceiptText size={32} />
            </div>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              ยังไม่มีประวัติการชำระเงิน
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-tertiary)",
                lineHeight: 1.6,
                maxWidth: 240,
              }}
            >
              เมื่อคุณซื้อคอร์สเรียน ประวัติการชำระเงินทั้งหมดจะแสดงที่นี่
            </p>
            <Link
              href="/classes"
              className="btn btn-primary"
              style={{ marginTop: 24, borderRadius: 12 }}
            >
              ดูคอร์สเรียนที่น่าสนใจ
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {payments.map((payment) => (
              <div
                key={payment.paymentIntentId}
                className="glass-card animate-slide-up"
                style={{
                  padding: 0,
                  overflow: "hidden",
                  border: "1px solid var(--surface-border)",
                  transition: "transform 0.2s",
                  animationDuration: "0.4s",
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "var(--surface-card)",
                    borderBottom: "1px dashed var(--surface-border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <Calendar size={14} />
                    {formatDate(payment.createdAt)}
                  </div>
                  {getStatusBadge(payment.status)}
                </div>

                {/* Body Row */}
                <div style={{ padding: "16px" }}>
                  <div style={{ marginBottom: 12 }}>
                    <h4
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginBottom: 2,
                      }}
                    >
                      {payment.enrollment?.class?.title || "ไม่ได้ระบุชื่อคลาส"}
                    </h4>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {payment.enrollment?.class?.book?.title
                        ? `${payment.enrollment.class.book.bookCode}: ${payment.enrollment.class.book.title}`
                        : "รายจ่ายอื่นๆ"}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: "0.75rem",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {getMethodIcon(payment.method)}
                        <span>
                          {payment.method.toUpperCase() === "PROMPTPAY"
                            ? "PromptPay"
                            : "Card"}
                        </span>
                      </div>
                      {payment.providerRef && (
                        <div
                          style={{
                            fontSize: "0.625rem",
                            color: "var(--text-tertiary)",
                            fontFamily: "monospace",
                          }}
                        >
                          Ref: {payment.providerRef.slice(0, 12)}...
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "1.125rem",
                          fontWeight: 800,
                          color: "var(--text-primary)",
                        }}
                      >
                        ฿
                        {(payment.amountMinor / 100).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <p
              style={{
                textAlign: "center",
                fontSize: "0.75rem",
                color: "var(--text-tertiary)",
                marginTop: 12,
                paddingBottom: 20,
              }}
            >
              สิ้นสุดรายการประวัติ
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
