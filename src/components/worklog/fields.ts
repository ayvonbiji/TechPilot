import type { WorkLog } from "@/lib/types";

export const WORKLOG_FIELDS: { key: keyof WorkLog; label: string; hint: string }[] = [
  { key: "tasks_performed", label: "Tasks performed", hint: "What you worked on today." },
  { key: "problems_investigated", label: "Technical problems investigated", hint: "Described generally, without names or internal details." },
  { key: "solutions_outcomes", label: "Solutions or outcomes", hint: "What worked, what didn't, what's still open." },
  { key: "skills_learned", label: "Skills learned", hint: "Tools, commands, concepts." },
  { key: "challenges", label: "Challenges faced", hint: "What slowed you down." },
  { key: "follow_up_actions", label: "Follow-up actions", hint: "One per line. These appear in your reports." },
  { key: "reflections", label: "Personal reflections", hint: "Optional. Only you can see this." },
];
