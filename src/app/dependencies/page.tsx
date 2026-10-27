import { Oracle } from "@/components/oracle";
export const dynamic = "force-dynamic";
export default function Dependencies() {
  return (
    <Oracle
      live={
        process.env.ENABLE_LLM === "true" &&
        !process.env.VERCEL &&
        Boolean(process.env.GLM_API_KEY)
      }
    />
  );
}
