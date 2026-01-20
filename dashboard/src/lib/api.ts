const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchWithAuth(path: string, token: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function getMyMetrics(token: string) {
  return fetchWithAuth('/api/metrics/me', token);
}

export async function getLeaderboard(token: string, metric = 'claude_tokens') {
  return fetchWithAuth(`/api/metrics/leaderboard?metric=${metric}`, token);
}

export async function getActivity(token: string, days = 30) {
  return fetchWithAuth(`/api/metrics/activity?days=${days}`, token);
}
