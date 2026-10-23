import { Globe, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const META = {
  private: { label: "Private", icon: Lock, tone: "neutral" as const, title: "Only the author can see this" },
  workspace: { label: "Team", icon: Users, tone: "accent" as const, title: "Technicians and admins in this workspace" },
  public: { label: "Public", icon: Globe, tone: "ok" as const, title: "Also visible to this workspace's customers in the portal" },
};

export function VisibilityBadge({ visibility }: { visibility: "private" | "workspace" | "public" }) {
  const m = META[visibility];
  const Icon = m.icon;
  return (
    <Badge tone={m.tone} title={m.title}>
      <Icon className="h-3 w-3" aria-hidden /> {m.label}
    </Badge>
  );
}
