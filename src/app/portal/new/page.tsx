import type { Metadata } from "next";
import { PortalTicketForm } from "./portal-ticket-form";

export const metadata: Metadata = { title: "New request" };

export default function PortalNewPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[1.6rem] font-semibold leading-tight">New support request</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Describe the problem and the support team will be notified.</p>
      <PortalTicketForm />
    </div>
  );
}
