import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-7 text-foreground/90 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:font-heading [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-semibold [&_hr]:border-border [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:whitespace-pre-wrap [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-muted/40 [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted/50 [&_th]:p-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {linkChildren}
            </a>
          ),
          img: ({ src, alt }) =>
            typeof src === "string" ? (
              <a href={src} target="_blank" rel="noreferrer">
                {alt || "Ouvrir l’image jointe"}
              </a>
            ) : (
              <span>{alt || "Image jointe indisponible"}</span>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
