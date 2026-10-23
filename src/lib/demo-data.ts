import { addDays, startOfLocalDay } from "./dates";

/**
 * Fictional demonstration data. Every row is inserted with is_demo = true, shown with a
 * "Demo" badge, and removed in one click from Settings. No real companies, people,
 * credentials or private addresses appear here.
 */
export function buildDemoData(today: string, tz: string) {
  const at = (daysAgo: number, hour = 15) =>
    new Date(startOfLocalDay(addDays(today, -daysAgo), tz).getTime() + hour * 3600_000).toISOString();

  const tasks = [
    { title: "Troubleshoot a Windows connectivity issue", description: "Practice lab: laptop shows 'No internet' on Wi-Fi. Work through IP, gateway and DNS checks.", category: "Troubleshooting", priority: "high", status: "in_progress", due_date: today },
    { title: "Learn DHCP and DNS troubleshooting", description: "Cover the DORA process, APIPA addresses, and how to test name resolution.", category: "Learning", priority: "high", status: "pending", due_date: addDays(today, 2) },
    { title: "Practise printer installation", description: "Install a network printer by IP in a test VM, then remove and reinstall the driver.", category: "Practice lab", priority: "medium", status: "pending", due_date: addDays(today, 4) },
    { title: "Review Windows Event Viewer", description: "Find System and Application errors and learn to filter by event ID and level.", category: "Learning", priority: "medium", status: "completed", due_date: addDays(today, -1), completed_at: at(1), completion_notes: "Built a custom view for critical and error events; practised filtering the System log." },
    { title: "Document a hardware maintenance procedure", description: "Write a checklist for cleaning and inspecting a desktop PC safely.", category: "Documentation", priority: "low", status: "pending", due_date: addDays(today, -2) },
    { title: "Set up a home lab virtual machine", description: "Create a Windows evaluation VM for practising support tasks.", category: "Practice lab", priority: "medium", status: "completed", due_date: addDays(today, -3), completed_at: at(3), completion_notes: "VM running with a snapshot taken before any changes." },
    { title: "Read about the OSI model", description: "Relate each layer to a real troubleshooting step.", category: "Networking", priority: "low", status: "completed", due_date: addDays(today, -5), completed_at: at(5), completion_notes: "Made a one-page summary mapping layers to tools (cable tester, ipconfig, ping, nslookup)." },
  ];

  const records = [
    {
      title: "Laptop connects to Wi-Fi but has no internet",
      category: "TCP/IP, DNS and DHCP",
      status: "resolved",
      symptoms: "- Wi-Fi icon shows connected, browser can't load pages\n- Started after the laptop woke from sleep",
      possible_causes: "- Adapter didn't renew its DHCP lease after sleep\n- DNS cache holding stale entries",
      diagnostic_steps: "1. `ipconfig /all` showed a 169.254.x.x address (APIPA): no DHCP lease\n2. Other devices on the same Wi-Fi worked, so the network was fine",
      commands_used: "ipconfig /all\nipconfig /release\nipconfig /renew\nipconfig /flushdns",
      solution: "Released and renewed the DHCP lease, then flushed the DNS cache. Disabled 'Allow the computer to turn off this device to save power' on the Wi-Fi adapter.",
      verification_steps: "- Valid address and gateway shown in ipconfig\n- Pinged the gateway and example.com successfully\n- Slept and woke the laptop: connection stayed up",
      lessons_learned: "An APIPA address points straight at DHCP. Check power-management settings on adapters after sleep issues.",
      tags: ["dhcp", "wifi", "apipa"],
      created_at: at(2, 11),
    },
    {
      title: "Print jobs stuck in the queue",
      category: "Printers and scanners",
      status: "resolved",
      symptoms: "- Documents show 'Printing' but nothing comes out\n- New jobs pile up behind the first one",
      possible_causes: "- Corrupted job blocking the spooler\n- Printer offline",
      diagnostic_steps: "1. Printer display showed Ready\n2. Queue had one job in error state\n3. Couldn't cancel it from the queue window",
      commands_used: "Get-PrintJob -PrinterName \"Lab Printer\"\nRestart-Service -Name Spooler",
      solution: "Restarted the Print Spooler service (elevated PowerShell) which cleared the stuck job.",
      verification_steps: "- Queue empty\n- Test page printed",
      lessons_learned: "Check the device first, then the queue, then the spooler.",
      tags: ["spooler", "printing"],
      created_at: at(4, 10),
    },
    {
      title: "Slow startup on a lab PC",
      category: "Windows troubleshooting",
      status: "investigating",
      symptoms: "- Takes several minutes to reach a usable desktop\n- Disk at 100% in Task Manager after sign-in",
      possible_causes: "- Too many startup apps\n- Pending updates\n- Failing disk",
      diagnostic_steps: "1. Disabled non-essential startup apps\n2. Event Viewer: checking for disk warnings",
      commands_used: "sfc /scannow",
      solution: "",
      verification_steps: "",
      lessons_learned: "",
      tags: ["performance", "startup"],
      created_at: at(0, 9),
    },
  ];

  const notes = [
    {
      title: "My troubleshooting method",
      category: "Procedures",
      tags: ["method"],
      is_favorite: true,
      content:
        "1. **Identify** the problem: ask questions, reproduce it\n2. **Theory** of probable cause: start simple\n3. **Test** the theory\n4. **Plan** and implement the fix\n5. **Verify** full functionality\n6. **Document** findings, actions and outcomes\n\n> Change one thing at a time.",
    },
    {
      title: "Useful Windows shortcuts for support",
      category: "Windows",
      tags: ["shortcuts"],
      is_favorite: false,
      content: "- `Win + R`, then `eventvwr.msc`: Event Viewer\n- `Win + R`, then `devmgmt.msc`: Device Manager\n- `Win + R`, then `services.msc`: Services\n- `Ctrl + Shift + Esc`: Task Manager",
    },
  ];

  const logs = [
    {
      log_date: addDays(today, -1),
      tasks_performed: "Reviewed Event Viewer logs in the practice VM\nRead about DHCP lease renewal",
      problems_investigated: "Why a test laptop got an APIPA address after sleep",
      solutions_outcomes: "Renewing the lease fixed it; adapter power saving was the root cause",
      skills_learned: "Filtering Event Viewer by level and event ID\nReading ipconfig /all output",
      challenges: "Telling normal warnings apart from real problems in Event Viewer",
      follow_up_actions: "Write up the APIPA fix in the knowledge base\nPractise DNS troubleshooting with nslookup",
      reflections: "Starting from the network layer up made the problem quick to find.",
    },
    {
      log_date: addDays(today, -3),
      tasks_performed: "Built a Windows evaluation VM for practice",
      problems_investigated: "",
      solutions_outcomes: "VM ready, snapshot taken",
      skills_learned: "Hyper-V basics: creating a VM and taking checkpoints",
      challenges: "",
      follow_up_actions: "Install a network printer in the VM",
      reflections: "",
    },
    {
      log_date: addDays(today, -4),
      tasks_performed: "Practised clearing a stuck print queue",
      problems_investigated: "Print jobs stuck in the queue on the lab printer",
      solutions_outcomes: "Restarting the Print Spooler service cleared it",
      skills_learned: "Get-PrintJob and Restart-Service in PowerShell",
      challenges: "Remembering to open PowerShell as administrator",
      follow_up_actions: "",
      reflections: "",
    },
  ];

  const skills = [
    { name: "PC hardware components", kind: "skill", category: "Computer hardware", current_level: 3, target_level: 4, status: "practising", notes: "Comfortable identifying and replacing RAM and storage.", resources: "", completed_on: null },
    { name: "Windows 10/11 troubleshooting", kind: "skill", category: "Windows desktop support", current_level: 2, target_level: 4, status: "learning", notes: "Event Viewer, Task Manager, safe mode.", resources: "", completed_on: null },
    { name: "TCP/IP and subnetting", kind: "skill", category: "Networking fundamentals", current_level: 2, target_level: 4, status: "learning", notes: "Can read ipconfig output; practising subnet maths.", resources: "", completed_on: null },
    { name: "DNS and DHCP", kind: "skill", category: "Networking fundamentals", current_level: 3, target_level: 4, status: "practising", notes: "", resources: "", completed_on: null },
    { name: "OSI model", kind: "skill", category: "Networking fundamentals", current_level: 3, target_level: 3, status: "completed", notes: "Can map each layer to troubleshooting tools.", resources: "", completed_on: addDays(today, -5) },
    { name: "Active Directory users and groups", kind: "skill", category: "Active Directory and Group Policy", current_level: 1, target_level: 3, status: "not_started", notes: "", resources: "", completed_on: null },
    { name: "PowerShell basics", kind: "skill", category: "Windows desktop support", current_level: 2, target_level: 3, status: "learning", notes: "Get-Service, Get-Process, Test-NetConnection.", resources: "", completed_on: null },
    { name: "Writing clear ticket updates", kind: "skill", category: "IT documentation and communication", current_level: 2, target_level: 4, status: "practising", notes: "", resources: "", completed_on: null },
    { name: "CompTIA A+", kind: "certification", category: "Computer hardware", current_level: 1, target_level: 5, status: "learning", notes: "Studying for Core 1.", resources: "", completed_on: null },
  ];

  return { tasks, records, notes, logs, skills };
}
