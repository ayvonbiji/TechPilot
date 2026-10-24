import type { TroubleshootingInput } from "@/lib/validation/schemas";

export interface KbTemplate {
  id: string;
  name: string;
  description: string;
  values: Partial<TroubleshootingInput>;
}

/**
 * Starting structures for documenting a problem from diagnosis to resolution.
 * They contain prompts only; replace them with what you actually observed.
 */
export const KB_TEMPLATES: KbTemplate[] = [
  {
    id: "blank",
    name: "Blank record",
    description: "Every section empty.",
    values: {},
  },
  {
    id: "general",
    name: "Structured diagnosis",
    description: "Prompts for any problem, following a standard troubleshooting method.",
    values: {
      symptoms: "- What the user sees:\n- When it started:\n- How many devices/users are affected:\n- Error message (exact text):",
      possible_causes: "- \n- \n- ",
      diagnostic_steps: "1. Reproduce the problem\n2. Check what changed recently (updates, installs, moves)\n3. Narrow down: one device or many? one app or all?\n4. ",
      verification_steps: "- Problem no longer reproduces\n- User confirms normal operation",
    },
  },
  {
    id: "network",
    name: "Network connectivity",
    description: "No internet, limited connectivity, or can't reach a resource.",
    values: {
      category: "Networking and TCP/IP",
      symptoms: "- Connection type (Wi-Fi / Ethernet):\n- Can reach local resources? Internet?\n- Error shown:",
      possible_causes: "- Physical layer (cable, port, adapter disabled)\n- No valid IP address (DHCP)\n- DNS resolution failing\n- Gateway or upstream issue",
      diagnostic_steps:
        "1. Check physical link and adapter status\n2. `ipconfig /all` — confirm a valid IP, gateway and DNS server\n3. `ping` the default gateway\n4. `ping` a public IP to test routing\n5. `nslookup` a hostname to test DNS",
      commands_used: "ipconfig /all\nping <gateway>\nnslookup <hostname>",
      verification_steps: "- Gateway and public hosts respond\n- Names resolve\n- User can open the resources they need",
    },
  },
  {
    id: "printer",
    name: "Printer issue",
    description: "Jobs stuck, printer offline, or poor print quality.",
    values: {
      category: "Printers and peripherals",
      symptoms: "- Printer model (generic):\n- Connection (USB / network):\n- What happens when printing:",
      possible_causes: "- Print spooler stuck\n- Driver missing or wrong version\n- Printer offline / wrong port\n- Hardware (paper, toner, jam)",
      diagnostic_steps:
        "1. Check the printer's own display/status page\n2. Check the print queue for stuck jobs\n3. Restart the Print Spooler service\n4. Print a test page from printer properties",
      commands_used: "Get-Printer\nGet-PrintJob -PrinterName \"<name>\"\nRestart-Service -Name Spooler",
      verification_steps: "- Test page prints\n- User's document prints correctly",
    },
  },
  {
    id: "slow",
    name: "Slow or unstable PC",
    description: "Performance problems, freezes or crashes.",
    values: {
      category: "Windows troubleshooting",
      symptoms: "- When it's slow (startup, specific app, always):\n- Recent changes:\n- Any crash or blue-screen codes:",
      possible_causes: "- High CPU/memory/disk usage\n- Startup programs\n- Corrupted system files\n- Failing disk or overheating",
      diagnostic_steps:
        "1. Task Manager: check CPU, memory and disk usage\n2. Review startup apps\n3. Event Viewer: System and Application logs around the time of the problem\n4. Run `sfc /scannow`, then DISM if needed",
      commands_used: "sfc /scannow\nDISM /Online /Cleanup-Image /RestoreHealth",
      verification_steps: "- Normal performance after restart\n- No new errors in Event Viewer",
    },
  },
  {
    id: "software",
    name: "Software installation",
    description: "An application won't install, update or open.",
    values: {
      category: "General IT support",
      symptoms: "- Application and version:\n- Step where it fails:\n- Error code/message:",
      possible_causes: "- Missing admin rights\n- Missing prerequisite (runtime, framework)\n- Insufficient disk space\n- Blocked by security software or policy",
      diagnostic_steps: "1. Note the exact error\n2. Check disk space and prerequisites\n3. Check installer logs\n4. Try installing with appropriate permissions",
      verification_steps: "- Application installs and opens\n- Core feature works",
    },
  },
  {
    id: "account",
    name: "Sign-in or account issue",
    description: "Can't sign in, locked out, or missing access (described generically).",
    values: {
      category: "Microsoft 365",
      symptoms: "- Where sign-in fails (Windows, Outlook, web):\n- Error shown:\n- Started after (password change, new device…):",
      possible_causes: "- Expired or changed password\n- Account locked\n- MFA problem\n- Cached credentials out of date",
      diagnostic_steps: "1. Confirm the exact error\n2. Check whether other services sign in\n3. Clear cached credentials if appropriate\n4. Escalate per your organisation's process",
      verification_steps: "- User signs in successfully\n- Access to required apps confirmed",
      lessons_learned: "Never record real usernames, passwords or account details here.",
    },
  },
];
