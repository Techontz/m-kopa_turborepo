import type { ReactNode } from "react";

import "@/styles/customers.css";

/** Customer module segment: loads the module's stylesheet (register wizard, lists, profile, face scanner). */
export default function CustomersLayout({ children }: { children: ReactNode }) {
  return children;
}
