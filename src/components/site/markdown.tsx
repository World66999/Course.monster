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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
