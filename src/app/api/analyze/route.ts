import { handleAnalyzeRequest } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export const POST = (request: Request) => handleAnalyzeRequest(request);
