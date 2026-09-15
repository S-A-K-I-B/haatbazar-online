import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

/**
 * A single shared socket for the whole tab. It authenticates using the
 * httpOnly cookie (withCredentials) — the server independently verifies
 * that cookie on every connection and every event; the client never sends
 * a userId it could forge.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function ackPromise<T = any>(
  emit: (ack: (res: { ok: true; data?: T } | { ok: false; error: string; message: string }) => void) => void
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    emit((res) => {
      if (res.ok) resolve(res.data);
      else reject(new Error(res.message));
    });
  });
}
