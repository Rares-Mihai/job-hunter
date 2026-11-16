import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Every sign-in request (starting the GitHub redirect, the callback from
// GitHub, reading the session) is answered by the auth library here.
const handler = (request: Request) => getAuth().handler(request);

export const { GET, POST } = toNextJsHandler(handler);
