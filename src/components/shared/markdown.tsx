import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

/**
 * Renders user Markdown safely: raw HTML is not rendered (react-markdown's default),
 * links open in a new tab, and every code block gets a copy button.
 * Code is display-only — nothing here executes commands.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-note", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
          pre: ({ children }) => {
            const code = textOf(children).replace(/\n$/, "");
            return (
              <div className="group relative">
                <pre className="overflow-x-auto rounded-lg bg-code-bg px-4 py-3 pr-12 font-mono text-[13px] leading-relaxed text-code-fg">
                  {children}
                </pre>
                <CopyButton
                  text={code}
                  label="Copy code"
                  className="absolute right-2 top-2 bg-white/10 text-code-fg hover:bg-white/20"
                />
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
