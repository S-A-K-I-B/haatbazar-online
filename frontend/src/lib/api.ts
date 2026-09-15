const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
}

class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : undefined;
  if (!res.ok) {
    throw new ApiError(body?.error ?? "REQUEST_FAILED", body?.message ?? "একটি সমস্যা হয়েছে, আবার চেষ্টা করুন।");
  }
  return body as T;
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<{ user: ApiUser }>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request<{ user: ApiUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: ApiUser }>("/api/auth/me"),
  socketTicket: () => request<{ ticket: string }>("/api/auth/socket-ticket"),

  createGame: (tokenId: string, mode: "standard" | "quick", maxRounds: number) =>
    request<{ roomCode: string; state: any }>("/api/games", { method: "POST", body: JSON.stringify({ tokenId, mode, maxRounds }) }),
  joinGame: (roomCode: string, tokenId: string) =>
    request<{ state: any }>("/api/games/join", { method: "POST", body: JSON.stringify({ roomCode, tokenId }) }),
  getGame: (roomCode: string) => request<{ state: any }>(`/api/games/${roomCode}`),
  startGame: (roomCode: string) => request<{ ok: true }>(`/api/games/${roomCode}/start`, { method: "POST" }),
  leaveGame: (roomCode: string) => request<{ ok: true }>(`/api/games/${roomCode}/leave`, { method: "POST" }),
  boardContent: () => request<any>("/api/games/content/board"),
};

export { ApiError, API_URL };
