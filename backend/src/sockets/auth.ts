import { Socket } from "socket.io";
import cookie from "cookie";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthedSocket extends Socket {
  userId: string;
  userEmail: string;
  userName: string;
}

/**
 * Accepts EITHER:
 *  - the httpOnly `access_token` cookie (same-site browser deployments), or
 *  - a short-lived ticket passed as `socket.handshake.auth.ticket`
 *    (obtained by the client from GET /api/auth/socket-ticket) for setups
 *    where the cookie isn't available to the WebSocket handshake.
 * Either way the token is cryptographically verified here — the client
 * cannot simply claim a userId.
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    let token: string | undefined;

    const rawCookie = socket.handshake.headers.cookie;
    if (rawCookie) {
      const parsed = cookie.parse(rawCookie);
      token = parsed.access_token;
    }
    if (!token && socket.handshake.auth?.ticket) {
      token = socket.handshake.auth.ticket as string;
    }
    if (!token) {
      return next(new Error("UNAUTHENTICATED"));
    }

    const payload = verifyAccessToken(token);
    const authed = socket as AuthedSocket;
    authed.userId = payload.userId;
    authed.userEmail = payload.email;
    authed.userName = payload.name;
    next();
  } catch {
    next(new Error("INVALID_OR_EXPIRED_TOKEN"));
  }
}
