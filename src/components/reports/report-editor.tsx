"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { CopyButton } from "@/components/shared/copy-button";
import { Markdown } from "@/components/shared/markdown";
import { cn } from "@/lib/utils";

/**
 * Editable draft of a generated report. Edits stay in this browser tab (they're your words,
 * not saved data); "Reset" restores the version generated from the database.
 */
export function ReportEditor({ generated, fileBase, csvHref }: { generated: string; fileBase: string; csvHref: string }) {
  const [text, setText] = useState(generated);
  const [tab, setTab] = useState<"preview" | "edit">("preview");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setText(generated), [generated]);
  const edited = text !== generated;

  function download() {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel className="print-area">
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div role="tablist" aria-label="Report view" className="flex gap-1">
          {(["preview", "edit"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium capitalize", tab === t ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground")}
            >
              {t}
            </button>
          ))}
          {edited && <span className="self-center pl-2 text-[12px] text-warn">Edited</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {edited && (
            <Button variant="ghost" size="sm" onClick={() => setText(generated)}>
              <RotateCcw /> Reset
            </Button>
          )}
          <CopyButton text={text} label="Copy" showLabel className="h-8 border border-border-strong bg-surface px-3 text-[13px] text-foreground hover:bg-surface-2" />
          <Button variant="secondary" size="sm" onClick={download}><Download /> .md</Button>
          <Button asChild variant="secondary" size="sm"><a href={csvHref}><FileSpreadsheet /> Tasks CSV</a></Button>
          <Button variant="secondary" size="sm" onClick={() => { setTab("preview"); setTimeout(() => window.print(), 50); }}><Printer /> Print</Button>
        </div>
      </div>
      {tab === "edit" ? (
        <div className="p-3">
          <Textarea aria-label="Report text" value={text} onChange={(e) => setText(e.target.value)} rows={28} className="border-0 font-mono text-[13px] focus-visible:ring-0" />
        </div>
      ) : (
        <div className="px-6 py-5 sm:px-8">
          <Markdown>{text}</Markdown>
        </div>
      )}
    </Panel>
  );
}
