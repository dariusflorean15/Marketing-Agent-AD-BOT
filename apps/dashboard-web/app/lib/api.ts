// Base URL of the API server.
// Local dev defaults to localhost:4000; in production set NEXT_PUBLIC_API_URL
// (e.g. your Railway URL) in the Vercel project's environment variables.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
