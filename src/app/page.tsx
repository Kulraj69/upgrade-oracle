import { Oracle } from "@/components/oracle";

export const dynamic = "force-dynamic";
export default function Home() {
  return <Oracle live={Boolean(process.env.GLM_API_KEY)} />;
}
