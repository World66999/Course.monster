import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders trusted-authored markdown (course descriptions, admin pages).
 * react-markdown never injects raw HTML, so embedded HTML in the source is
 * rendered inert as text — XSS-safe by construction.
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
          // A wide GFM table cannot shrink below its columns' min-content width,
          // so without this wrapper it pushed the entire page into horizontal
          // scroll on a phone. The wrapper scrolls instead of the document; the
          // paired CSS lives in globals.css under `.markdown .table-scroll`.
          // `tabIndex` makes the scroll region reachable by keyboard, which is
          // required for anyone who cannot swipe it.
          table: ({ children }) => (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Table">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
