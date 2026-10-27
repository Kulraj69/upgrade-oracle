import type { AnalyzeInput } from "@/lib/types";
// Live input presets only. No recorded BCH dependency analyses are shipped.
export const bchDependencyExamples: {
  id: string;
  title: string;
  subtitle: string;
  input: AnalyzeInput;
}[] = [
  {
    id: "cashscript",
    title: "CashScript",
    subtitle: "0.11 → 0.14",
    input: {
      bumps: [{ name: "cashscript", from: "0.11.0", to: "0.14.0" }],
      files: [
        {
          path: "src/contract.ts",
          content:
            "import { Contract, TransactionBuilder, SignatureTemplate, HashType } from 'cashscript';\n\nexport function signer(key) {\n  const template = new SignatureTemplate(key);\n  return { hashType: template.getHashType(), pubkey: template.getPublicKey() };\n}\n",
        },
      ],
    },
  },
  {
    id: "libauth",
    title: "libauth",
    subtitle: "2.1 → 3.0",
    input: {
      bumps: [{ name: "@bitauth/libauth", from: "2.1.0", to: "3.0.0" }],
      files: [
        {
          path: "src/address.ts",
          content:
            "import { lockingBytecodeToCashAddress, decodeCashAddress } from '@bitauth/libauth';\n\nexport const addressFor = (bytecode) => lockingBytecodeToCashAddress(bytecode, 'bchtest');\n",
        },
      ],
    },
  },
  {
    id: "mainnet-js",
    title: "mainnet-js",
    subtitle: "2.0 → latest",
    input: {
      bumps: [{ name: "mainnet-js", from: "2.0.0", to: "latest" }],
      files: [
        {
          path: "src/wallet.ts",
          content:
            "import { TestNetWallet } from 'mainnet-js';\n\nexport async function checkBalance(wallet) {\n  return wallet.getBalance();\n}\n",
        },
      ],
    },
  },
];
