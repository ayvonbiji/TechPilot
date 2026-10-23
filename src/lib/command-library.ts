/**
 * Reference notes for common Windows support commands.
 * These are documentation only: the app never runs commands.
 * Example addresses use public, documentation-safe values (example.com, public DNS).
 */
export interface CommandNote {
  title: string;
  tags: string[];
  content: string;
}

export const COMMAND_LIBRARY: CommandNote[] = [
  {
    title: "ipconfig: view and refresh IP configuration",
    tags: ["windows", "networking", "tcpip", "dhcp", "dns"],
    content: `## Purpose
Shows the IP configuration of every network adapter, and can renew a DHCP lease or clear the DNS resolver cache. Usually the first command for any connectivity problem.

## Examples
\`\`\`
ipconfig
\`\`\`
IPv4 address, subnet mask and default gateway per adapter.

\`\`\`
ipconfig /all
\`\`\`
Full detail: MAC address, DHCP enabled, DHCP server, lease times, DNS servers.

\`\`\`
ipconfig /release
ipconfig /renew
\`\`\`
Drop and request a new DHCP lease.

\`\`\`
ipconfig /flushdns
\`\`\`
Clear cached DNS lookups (use after a DNS record changes).

## Reading the output
- An address starting **169.254.x.x** (APIPA) means the PC did not get a lease from a DHCP server.
- No default gateway means the PC can't leave its local network.

## Precautions
- \`/release\` disconnects the adapter. **Never run it over a remote session** — you will lose the connection.
- Don't paste real \`ipconfig /all\` output from a work device into notes; it contains internal addresses and hardware IDs.`,
  },
  {
    title: "ping: test reachability",
    tags: ["windows", "networking", "icmp"],
    content: `## Purpose
Sends ICMP echo requests to check whether a host responds and how long round trips take.

## Examples
\`\`\`
ping example.com
\`\`\`
Four echo requests (Windows default).

\`\`\`
ping -n 10 example.com
\`\`\`
Send 10 requests.

\`\`\`
ping -t example.com
\`\`\`
Ping continuously until you press **Ctrl+C** — useful for watching an intermittent drop.

\`\`\`
ping -4 example.com
\`\`\`
Force IPv4.

## A useful sequence
1. Ping \`127.0.0.1\` — the local TCP/IP stack works.
2. Ping the default gateway (from \`ipconfig\`) — the local network works.
3. Ping a public IP such as \`1.1.1.1\` — routing to the internet works.
4. Ping a name such as \`example.com\` — DNS works too.

## Precautions
- Many firewalls block ICMP. **No reply does not prove a host is down.**
- \`-t\` runs forever; remember to stop it.`,
  },
  {
    title: "tracert: trace the route to a host",
    tags: ["windows", "networking", "routing"],
    content: `## Purpose
Lists each router (hop) between your PC and a destination, showing where delay or loss begins.

## Examples
\`\`\`
tracert example.com
\`\`\`

\`\`\`
tracert -d example.com
\`\`\`
Skip reverse DNS lookups — much faster.

\`\`\`
tracert -h 15 example.com
\`\`\`
Stop after 15 hops (default is 30).

## Reading the output
- Each line is a hop with three timing samples.
- \`* * *\` on a single middle hop is often normal: some routers don't answer trace probes but still forward traffic.
- Timeouts from one hop **onwards** suggest the problem is at or after that point.

## Precautions
- Results show public routers only after your gateway; internal hops reveal network layout, so don't share work traces outside your team.
- \`pathping\` combines tracert with loss statistics but takes several minutes.`,
  },
  {
    title: "nslookup: query DNS",
    tags: ["windows", "networking", "dns"],
    content: `## Purpose
Asks a DNS server to resolve a name, so you can tell whether a problem is DNS or something else.

## Examples
\`\`\`
nslookup example.com
\`\`\`
Resolve using the PC's configured DNS server.

\`\`\`
nslookup example.com 1.1.1.1
\`\`\`
Ask a specific public DNS server instead — compare the answers.

\`\`\`
nslookup -type=mx example.com
\`\`\`
Look up mail exchanger records.

## Reading the output
- "Non-authoritative answer" is normal: the answer came from a cache.
- If a name fails on your DNS server but resolves on a public one, suspect the internal DNS server or its forwarders.

## Precautions
- nslookup talks to DNS servers directly and **ignores the hosts file and the Windows DNS cache**. In PowerShell, \`Resolve-DnsName\` follows the normal Windows resolution path.`,
  },
  {
    title: "netstat: list connections and listening ports",
    tags: ["windows", "networking", "ports", "security"],
    content: `## Purpose
Shows active TCP connections, listening ports and which process owns them.

## Examples
\`\`\`
netstat -an
\`\`\`
All connections and listening ports, numeric (no name lookups).

\`\`\`
netstat -ano
\`\`\`
Add the owning process ID (PID). Match the PID in Task Manager's **Details** tab.

\`\`\`
netstat -ano | findstr :443
\`\`\`
Filter for one port.

\`\`\`
netstat -r
\`\`\`
Show the routing table (same as \`route print\`).

## Reading the output
- **LISTENING**: a service is waiting for connections on that port.
- **ESTABLISHED**: an active connection.

## Precautions
- \`netstat -b\` (show program names) requires an **elevated** prompt.
- Output includes real addresses — don't store work output in personal notes.
- PowerShell alternative: \`Get-NetTCPConnection -State Listen\`.`,
  },
  {
    title: "sfc /scannow: repair Windows system files",
    tags: ["windows", "repair", "system-files"],
    content: `## Purpose
System File Checker scans protected Windows system files and replaces corrupted ones with cached copies.

## Examples
\`\`\`
sfc /scannow
\`\`\`
Scan and repair. Run from **Command Prompt or PowerShell as administrator**.

\`\`\`
sfc /verifyonly
\`\`\`
Scan without repairing.

## Results
- "did not find any integrity violations" — files are fine.
- "found corrupt files and successfully repaired them" — restart and re-test.
- "found corrupt files but was unable to fix some of them" — run **DISM /RestoreHealth**, restart, then run \`sfc /scannow\` again.
- Details are logged in \`%windir%\\Logs\\CBS\\CBS.log\`.

## Precautions
- Needs administrator rights; can take 10–20 minutes.
- Don't close the window or shut down during the scan.
- Follow your organisation's change process before repairing a managed device.`,
  },
  {
    title: "DISM: repair the Windows component store",
    tags: ["windows", "repair", "dism"],
    content: `## Purpose
Deployment Image Servicing and Management checks and repairs the Windows component store, which \`sfc\` relies on for good file copies.

## Examples (elevated prompt)
\`\`\`
DISM /Online /Cleanup-Image /CheckHealth
\`\`\`
Quick check for recorded corruption. Makes no changes.

\`\`\`
DISM /Online /Cleanup-Image /ScanHealth
\`\`\`
Deeper scan. Makes no changes; takes longer.

\`\`\`
DISM /Online /Cleanup-Image /RestoreHealth
\`\`\`
Repair corruption, downloading good files from Windows Update.

## Typical order
1. \`/CheckHealth\` → 2. \`/ScanHealth\` → 3. \`/RestoreHealth\` → 4. restart → 5. \`sfc /scannow\`.

## Precautions
- Requires administrator rights and can take a long time; progress may pause at around 20% or 60% — that's normal.
- \`/RestoreHealth\` needs access to Windows Update or a repair source (\`/Source\`) — managed devices may use internal update servers.
- Log: \`%windir%\\Logs\\DISM\\dism.log\`.`,
  },
  {
    title: "PowerShell basics for support work",
    tags: ["powershell", "windows", "scripting"],
    content: `## Purpose
PowerShell works with objects rather than text, so results can be filtered, sorted and exported. These are safe, read-mostly starting points.

## Finding your way
\`\`\`powershell
Get-Help Get-Service -Examples
Get-Command -Noun *Net*
\`\`\`

## System information
\`\`\`powershell
Get-ComputerInfo | Select-Object OsName, OsVersion, CsName
Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace
\`\`\`

## Services and processes
\`\`\`powershell
Get-Service | Where-Object Status -eq 'Stopped'
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10
Restart-Service -Name Spooler   # needs an elevated session
\`\`\`

## Networking
\`\`\`powershell
Get-NetIPConfiguration
Test-Connection example.com -Count 4
Test-NetConnection example.com -Port 443
Resolve-DnsName example.com
\`\`\`

## Event logs
\`\`\`powershell
Get-WinEvent -LogName System -MaxEvents 20
Get-WinEvent -FilterHashtable @{ LogName = 'Application'; Level = 2 } -MaxEvents 20   # errors only
\`\`\`

## Precautions
- Add \`-WhatIf\` to commands that change things (\`Stop-Service\`, \`Remove-Item\`) to preview the effect.
- Never run scripts copied from untrusted sources; read them first.
- Don't change the execution policy on managed devices without approval.`,
  },
];
