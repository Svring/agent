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
      p: ({ node, ...props }) => (
        <p
          {...props}
          className="break-words rounded w-auto"
        />
      ),
      // Add back a pre component renderer for styling code blocks
      pre: ({ node, ...props }) => (
        <pre
          {...props}
          // Style for code block container: background, padding, rounded corners, overflow
          className="bg-muted p-2 rounded my-1 text-sm text-muted-foreground overflow-x-auto w-full max-w-full"
        />
      ),
      code: ({ node, inline, className, children, ...props }: CodeComponentProps) => {
        const match = /language-(\w+)/.exec(className || '');
        // Language is not used for styling now, but kept for potential future use
        const language = match ? match[1] : 'plaintext';

        return !inline ? (
          // Render code blocks with a simple <code> tag inside the <pre>
          // Styling is handled by the <pre> component above
          <code {...props} className={`language-${language} font-mono`}>
            {children}
          </code>
        ) : (
          // Keep simplified styling for inline code
          <code {...props} className={`${className || ''} bg-muted/50 px-1 rounded text-sm font-mono`}>
            {children}
          </code>
        );
      }
    };

    return (
      // Remove overflow-hidden here, handled by pre now
      <div className="text-sm w-full">
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