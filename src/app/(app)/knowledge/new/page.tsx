import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RecordForm } from "@/components/knowledge/record-form";

export const metadata: Metadata = { title: "New troubleshooting record" };

export default function NewRecordPage() {
  return (
    <>
      <Link href="/knowledge" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Knowledge base
      </Link>
      <PageHeader title="New troubleshooting record" description="Pick a template on the right to get a head start." />
      <RecordForm />
    </>
  );
}
