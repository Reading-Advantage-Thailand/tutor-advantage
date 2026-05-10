import liff from "@line/liff";

// Use relative paths to take advantage of Next.js rewrites (proxy)
const LEARNING_API_BASE = '/api/learning';
const IDENTITY_API_BASE = '/api/identity';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}, apiBase: string = LEARNING_API_BASE) {
  const isServer = typeof window === 'undefined';
  
  const baseUrl = isServer 
    ? (apiBase === IDENTITY_API_BASE ? 'http://localhost:3001/v1' : 'http://localhost:3002/v1')
    : apiBase;

  const url = `${baseUrl}${endpoint}`;
  
  if (!isServer) {
    console.log(`[studentApi] Requesting: ${url}`);
  }

  // 1. Try to get custom JWT from localStorage
  let token = !isServer ? localStorage.getItem('student_session_token') : null;

  // 2. Fallback to LIFF ID Token for authentication exchange if needed
  // Note: learning-service ONLY accepts custom JWT
  const idToken = !isServer ? liff.getIDToken() : null;

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
  getAvailableClasses: () => fetchWithAuth('/classes/available'),
  getClassDetails: (classId: string) => fetchWithAuth(`/classes/${classId}`),
  enrollClass: (classId: string) => fetchWithAuth('/enroll/direct', {
    method: 'POST',
    body: JSON.stringify({ classId }),
  }),

  // Lesson History
  getLessonHistory: () => fetchWithAuth('/lessons/history'),
  getLessonSessionDetails: (sessionId: string) => fetchWithAuth(`/lessons/history/${sessionId}`),

  // Consent
  submitGuardianConsent: (guardianName: string, relation: string) => fetchWithAuth('/guardian/consent', {
    method: 'POST',
    body: JSON.stringify({ guardianName, guardianContact: relation, consentGiven: true }),
  }, IDENTITY_API_BASE),
};
