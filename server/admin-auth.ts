type AdminRequest = {
  hostname: string;
  socket: { remoteAddress?: string };
  headers: { [key: string]: unknown };
};

export function isAdminRequest(req: AdminRequest) {
  const localHost = req.hostname === "localhost" || req.hostname === "127.0.0.1";
  const remote = req.socket.remoteAddress;
  const localConnection = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  const origin = req.headers.origin;
  let localOrigin = origin === undefined;
  if (typeof origin === "string") {
    try {
      const url = new URL(origin);
      localOrigin = (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
        (url.protocol === "http:" || url.protocol === "https:");
    } catch {
      localOrigin = false;
    }
  }
  if (process.env.NODE_ENV === "development" && localHost && localConnection &&
    localOrigin && req.headers["sec-fetch-site"] !== "cross-site") return true;

  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  return req.headers["x-admin-password"] === adminPassword;
}
