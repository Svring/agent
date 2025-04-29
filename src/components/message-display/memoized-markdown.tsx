import { marked } from 'marked';
import { memo, useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';

// Helper type for component props, adjust if needed based on ReactMarkdown version
type CodeComponentProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  inline?: boolean;
  node?: any; // Keep node for potential use, though often destructured away
  className?: string;
  children?: React.ReactNode;
};

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map(token => token.raw);
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    // Define components object with type safety
    const components: Components = {
      pre: ({ node, ...props }) => (
        <pre
          {...props}
          className="whitespace-pre-wrap break-words bg-muted p-2 rounded text-muted-foreground my-1"
        />
      ),
      code: ({ node, inline, className, children, ...props }: CodeComponentProps) => {
        // Type assertion for props if necessary, or ensure CodeComponentProps matches expected props
        const match = /language-(\w+)/.exec(className || '');
        // Render inline code differently from code blocks if needed
        return !inline ? (
          // For block code (often within <pre>), apply specific styles or rely on <pre> styling
          <code {...props} className={className}>
            {children}
          </code>
        ) : (
          // For inline code, apply wrapping styles
          <code {...props} className={`${className || ''} whitespace-pre-wrap break-words bg-muted/50 px-1 rounded`}>
            {children}
          </code>
        );
      }
    };

    return (
      <div className="text-sm">
        <ReactMarkdown components={components}>
          {content}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) return false;
    return true;
  },
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return blocks.map((block, index) => (
      <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
    ));
  },
);

MemoizedMarkdown.displayName = 'MemoizedMarkdown';