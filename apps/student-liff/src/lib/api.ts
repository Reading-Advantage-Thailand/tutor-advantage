import liff from "@line/liff";

// Use relative paths to take advantage of Next.js rewrites (proxy)
const LEARNING_API_BASE = '/api/learning';
const IDENTITY_API_BASE = '/api/identity';
const FINANCE_API_BASE = '/api/finance';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}, apiBase: string = LEARNING_API_BASE) {
  const isServer = typeof window === 'undefined';
  
  let defaultBaseUrl = 'http://localhost:3002/v1';
  if (apiBase === IDENTITY_API_BASE) defaultBaseUrl = 'http://localhost:3001/v1';
  if (apiBase === FINANCE_API_BASE) defaultBaseUrl = 'http://localhost:3003/v1';

  const baseUrl = isServer 
    ? defaultBaseUrl
    : apiBase;

  const url = `${baseUrl}${endpoint}`;
  
  if (!isServer) {
    console.log(`[studentApi] Requesting: ${url}`);
  }

  // 1. Try to get custom JWT from localStorage
  const token = !isServer ? localStorage.getItem('student_session_token') : null;

  // 2. Fallback to LIFF ID Token for authentication exchange if needed
  // Note: learning-service ONLY accepts custom JWT
  let idToken = null;
  try {
    idToken = !isServer ? liff.getIDToken() : null;
  } catch (e) {
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
      throw new Error(errorData.error?.message || `API Error ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    if (!isServer) {
      console.error(`[studentApi] Fetch failed for ${url}:`, err);
    }
    throw err;
  }
}

export const studentApi = {
  // Auth
  loginWithLine: async (idToken: string) => {
    const data = await fetchWithAuth('/auth/callback', {
      method: 'POST',
      body: JSON.stringify({ provider: 'line', code: idToken }),
    }, IDENTITY_API_BASE);
    
    if (data.sessionToken) {
      localStorage.setItem('student_session_token', data.sessionToken);
    }
    return data;
  },

  // Learning
  getDashboard: () => fetchWithAuth('/dashboard/summary'),
  getStudentProgress: () => fetchWithAuth('/student/progress'),
  getEnrolledClasses: () => fetchWithAuth('/classes'),
  getAvailableClasses: (params?: { q?: string; cefr?: string }) => {
    const qp = new URLSearchParams();
    if (params?.q) qp.append("q", params.q);
    if (params?.cefr) qp.append("cefr", params.cefr);
    const qs = qp.toString();
    return fetchWithAuth(`/classes/available${qs ? `?${qs}` : ""}`);
  },
  getClassDetails: (classId: string) => fetchWithAuth(`/classes/${classId}`),
  enrollClass: (classId: string) => fetchWithAuth('/enroll/direct', {
    method: 'POST',
    body: JSON.stringify({ classId }),
  }),
  enrollByReferral: (referralToken: string) => fetchWithAuth(`/enroll/${referralToken}`, {
    method: 'POST',
  }),

  // Lesson History
  getLessonHistory: () => fetchWithAuth('/lessons/history'),
  getLessonSessionDetails: (sessionId: string) => fetchWithAuth(`/lessons/history/${sessionId}`),

  // Consent
  submitGuardianConsent: (guardianName: string, relation: string) => fetchWithAuth('/guardian/consent', {
    method: 'POST',
    body: JSON.stringify({ guardianName, guardianContact: relation, consentGiven: true }),
  }, IDENTITY_API_BASE),

  // Finance
  getPaymentHistory: () => fetchWithAuth('/payments/history', {}, FINANCE_API_BASE),
  createPaymentIntent: (payload: { enrollmentId: string; amountSatang: number; method: 'promptpay' | 'card' }) => fetchWithAuth('/payments/intent', {
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
