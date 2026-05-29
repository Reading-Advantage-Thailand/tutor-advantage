import liff from "@line/liff";

const LEARNING_API_BASE = '/api/learning';
const IDENTITY_API_BASE = '/api/identity';
const FINANCE_API_BASE = '/api/finance';

function getSessionToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )student-session=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}, apiBase: string = LEARNING_API_BASE) {
  const isServer = typeof window === 'undefined';

  let defaultBaseUrl = 'http://localhost:3002/v1';
  if (apiBase === IDENTITY_API_BASE) defaultBaseUrl = 'http://localhost:3001/v1';
  if (apiBase === FINANCE_API_BASE) defaultBaseUrl = 'http://localhost:3003/v1';

  const baseUrl = isServer ? defaultBaseUrl : apiBase;
  const url = `${baseUrl}${endpoint}`;

  if (!isServer && process.env.NODE_ENV !== "production") {
    console.log(`[studentApi] Requesting: ${url}`);
  }

  // Read session token from cookie instead of localStorage
  const token = !isServer ? getSessionToken() : null;

  try {
    if (!isServer) {
      liff.getIDToken();
    }
  } catch {
    // Ignore initialization race conditions
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[studentApi] Error ${response.status}:`, errorData);
      throw new Error((errorData as { error?: { message?: string } }).error?.message || `API Error ${response.status}`);
    }

    return await response.json();
  } catch (err: unknown) {
    if (!isServer) {
      console.error(`[studentApi] Fetch failed for ${url}:`, err);
      try {
        fetch("/api/debug/client-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage: "fetchWithAuth",
            url,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
            origin: window.location.origin,
            userAgent: navigator.userAgent,
            isInLine: navigator.userAgent.toLowerCase().includes(" line/"),
            hasToken: !!token,
            timestamp: new Date().toISOString(),
          }),
        })?.catch(() => {});
      } catch { /* debug report is best-effort */ }
    }
    throw err;
  }
}

export const studentApi = {
  // Learning
  getDashboard: (params?: { historyFrom?: string; historyTo?: string }) => {
    const qp = new URLSearchParams();
    if (params?.historyFrom) qp.append("historyFrom", params.historyFrom);
    if (params?.historyTo) qp.append("historyTo", params.historyTo);
    const qs = qp.toString();
    return fetchWithAuth(`/dashboard/summary${qs ? `?${qs}` : ""}`);
  },
  getStudentProgress: (classId?: string) => {
    const qs = classId ? `?classId=${encodeURIComponent(classId)}` : "";
    return fetchWithAuth(`/student/progress${qs}`);
  },
  getStudentArticle: (articleId: string) => fetchWithAuth(`/student/articles/${articleId}`),
  generateShareLink: (classId?: string) => fetchWithAuth('/student/share-link', {
    method: 'POST',
    body: JSON.stringify(classId ? { classId } : {}),
  }),
  getEnrolledClasses: () => fetchWithAuth('/classes'),
  getAvailableClasses: (params?: { q?: string; cefr?: string }) => {
    const qp = new URLSearchParams();
    if (params?.q) qp.append("q", params.q);
    if (params?.cefr) qp.append("cefr", params.cefr);
    const qs = qp.toString();
    return fetchWithAuth(`/classes/available${qs ? `?${qs}` : ""}`);
  },
  getClassDetails: (classId: string) => fetchWithAuth(`/classes/${classId}`),
  getClassArticles: (classId: string, cycleId?: string) => {
    const qs = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : "";
    return fetchWithAuth(`/classes/${classId}/articles${qs}`);
  },
  prepareClassBookCycleAccess: (classId: string, cycleId: string) => fetchWithAuth(`/classes/${classId}/book-cycles/${cycleId}/access`, {
    method: 'POST',
  }),
  getClassReview: (classId: string) => fetchWithAuth(`/classes/${classId}/review`),
  submitClassReview: (classId: string, payload: { rating: number; comment?: string }) => fetchWithAuth(`/classes/${classId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  enrollClass: (classId: string) => fetchWithAuth('/enroll/direct', {
    method: 'POST',
    body: JSON.stringify({ classId }),
  }),
  enrollByReferral: (referralToken: string) => fetchWithAuth(`/enroll/${referralToken}`, {
    method: 'POST',
  }),
  getReferralDetails: (referralToken: string) => fetchWithAuth(`/enroll/${referralToken}/details`),

  // Lesson History
  getLessonHistory: () => fetchWithAuth('/lessons/history'),
  getLessonSessionDetails: (sessionId: string) => fetchWithAuth(`/lessons/history/${sessionId}`),

  // Consent
  checkGuardianConsent: () => fetchWithAuth('/guardian/consent', {}, IDENTITY_API_BASE),
  submitGuardianConsent: (guardianName: string, relation: string) => fetchWithAuth('/guardian/consent', {
    method: 'POST',
    body: JSON.stringify({ guardianName, guardianContact: relation, consentGiven: true }),
  }, IDENTITY_API_BASE),

  // Finance
  getPaymentHistory: () => fetchWithAuth('/payments/history', {}, FINANCE_API_BASE),
  getPaymentConfig: () => fetchWithAuth('/payments/config', {}, FINANCE_API_BASE),
  getPaymentStatus: (paymentIntentId: string) => fetchWithAuth(`/payments/${paymentIntentId}/status`, {}, FINANCE_API_BASE),
  getPaymentQrCode: (paymentIntentId: string) => fetchWithAuth(`/payments/${paymentIntentId}/qr-code`, {}, FINANCE_API_BASE),
  createPaymentIntent: (payload: {
    enrollmentId: string;
    enrollmentPackageId?: string;
    amountSatang: number;
    method: 'promptpay' | 'card';
    omiseToken?: string;
    returnUri?: string;
  }) => fetchWithAuth('/payments/intent', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, FINANCE_API_BASE),
  confirmMockPayment: (paymentIntentId: string) => fetchWithAuth('/payments/confirm-mock', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId }),
  }, FINANCE_API_BASE),

  // Settings
  getSettings: () => fetchWithAuth('/users/me/settings', {}, IDENTITY_API_BASE),
  updateSettings: (settings: object) => fetchWithAuth('/users/me/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  }, IDENTITY_API_BASE),

  // Chat
  getConversations: () => fetchWithAuth('/chat/conversations'),
  getConversationMessages: (conversationId: string) => fetchWithAuth(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, content: string) => fetchWithAuth(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),
  initiateChat: (payload: { classId?: string, type: 'DIRECT' | 'GROUP', targetUserId?: string }) => fetchWithAuth('/chat/initiate', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};
