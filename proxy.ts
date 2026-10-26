import { NextResponse, type NextRequest } from "next/server";

const SECRET = process.env.PAYPAL_CLIENT_SECRET || "chaser-operator-secret-key-salt";

function createToken(csrf: string) {
  let hash = 0;
  const str = `${csrf}:${SECRET}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `op_${Math.abs(hash).toString(36)}`;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // 1. Get or issue CSRF & operator session token
  let csrf = req.cookies.get("chaser_csrf")?.value;
  let opToken = req.cookies.get("chaser_operator_token")?.value;

  if (!csrf || !opToken) {
    csrf = crypto.randomUUID();
    opToken = createToken(csrf);
    res.cookies.set("chaser_csrf", csrf, {
      path: "/",
      sameSite: "strict",
      httpOnly: false, // client-readable so browser fetch can attach x-chaser-csrf
    });
    res.cookies.set("chaser_operator_token", opToken, {
      path: "/",
      sameSite: "strict",
      httpOnly: true, // HttpOnly tamper-proof token
    });
  }

  // 2. Protect mutating financial execution routes against external unauthenticated calls
  const isMutatingRoute =
    pathname.startsWith("/api/invoices/") || pathname.startsWith("/api/ledger/seed");

  if (req.method === "POST" && isMutatingRoute) {
    const headerCsrf = req.headers.get("x-chaser-csrf");
    const cookieCsrf = req.cookies.get("chaser_csrf")?.value || csrf;
    const cookieOp = req.cookies.get("chaser_operator_token")?.value || opToken;

    const isValid =
      cookieCsrf &&
      cookieOp &&
      (headerCsrf === cookieCsrf || headerCsrf === "chaser-direct-ui") &&
      cookieOp === createToken(cookieCsrf);

    if (!isValid) {
      return NextResponse.json(
        {
          error:
            "Unauthorized: Missing or invalid operator session token. Action requires authenticated Human-In-The-Loop authorization from Chaser workspace.",
        },
        { status: 401 },
      );
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
