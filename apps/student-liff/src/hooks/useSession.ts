export function useSession() {
  const user = {
    id: 'mock-user-id',
    name: 'Player',
    email: 'player@example.com',
    xp: 0,
    role: 'student',
    level: 1,
  };
  return {
    data: { user },
    user,
    status: 'authenticated' as const,
    update: async () => undefined,
  };
}
