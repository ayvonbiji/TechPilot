import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { NewWorkspaceForm } from "@/components/settings/new-workspace-form";

export const metadata: Metadata = { title: "New workspace" };

export default async function NewWorkspacePage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New workspace"
        description="A separate space for client or team work. Your personal workspace and its data stay exactly as they are."
      />
      <NewWorkspaceForm />
    </div>
  );
}
