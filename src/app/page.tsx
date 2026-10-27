import { ContractDoctor } from "@/components/contract-doctor";
import { contractExamples } from "@/lib/bch/examples";
export default function Home() {
  return (
    <ContractDoctor
      examples={contractExamples}
      feeAddress={process.env.NEXT_PUBLIC_SEAL_FEE_ADDRESS || undefined}
    />
  );
}
