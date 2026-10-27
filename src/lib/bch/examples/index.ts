import recurring from "./recurring-payment.report.json";
import p2sh from "./p2sh-covenant.report.json";
import token from "./token-vault.report.json";
// Only input source is passed to the client; every consultation recompiles.
export const contractExamples = [
  {
    id: "recurring",
    title: "Recurring payment",
    subtitle: "Timelock watch",
    file: recurring.contract.file,
    source: recurring.contract.source,
  },
  {
    id: "p2sh",
    title: "P2SH covenant",
    subtitle: "Repeated outputs",
    file: p2sh.contract.file,
    source: p2sh.contract.source,
  },
  {
    id: "token",
    title: "Token vault",
    subtitle: "Commitment bounds",
    file: token.contract.file,
    source: token.contract.source,
  },
];
