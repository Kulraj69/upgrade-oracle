import { readJson } from "@/lib/http";
import { InputError } from "@/lib/errors";
import { compileContract } from "@/lib/bch/compiler";
import { createDoctorReport, validateContractInput } from "@/lib/bch/doctor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json(
      { error: "Please send application/json." },
      { status: 415, headers },
    );
  try {
    const { source, file } = validateContractInput(await readJson(request));
    const compilation = await compileContract(source);
    return Response.json(createDoctorReport(source, file, compilation), {
      headers,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof InputError
            ? error.message
            : "The contract could not be examined.",
      },
      { status: error instanceof InputError ? error.status : 500, headers },
    );
  }
}
