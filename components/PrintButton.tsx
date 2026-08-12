"use client";

import { Button } from "@/components/ui/Button";

/**
 * Printing is the one browser API the QR poster needs, so it's isolated here to
 * keep the poster page itself a Server Component.
 */
export function PrintButton({ children }: { children: React.ReactNode }) {
  return (
    <Button
      variant="secondary"
      className="print:hidden"
      onClick={() => window.print()}
    >
      {children}
    </Button>
  );
}
