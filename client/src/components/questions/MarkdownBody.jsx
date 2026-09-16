import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import './markdown.css';

function CodeBlock({ children }) {
  const codeRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState('');
  const codeElement = Children.toArray(children).find(isValidElement);
  const language = /language-([^\s]+)/.exec(codeElement?.props.className || '')?.[1];

  useEffect(() => {
    if (copyStatus !== 'copied') return;
    const timeout = setTimeout(() => setCopyStatus(''), 2000);
    return () => clearTimeout(timeout);
  }, [copyStatus]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeRef.current.textContent);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <div className="my-4 min-w-0 overflow-hidden rounded border border-border bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs text-ink-muted">
        <span className="min-w-0 truncate font-mono">{language || 'Code'}</span>
        <button type="button" onClick={copyCode} className="shrink-0 rounded px-2 py-1 font-medium text-accent hover:bg-accent/10">
          {copyStatus === 'copied' ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <pre ref={codeRef} tabIndex={0} aria-label={`${language || 'Plain text'} code block`} className="overflow-x-auto p-4">
        {children}
      </pre>
      <span role="status" className="sr-only">{copyStatus === 'copied' ? 'Code copied to clipboard.' : ''}</span>
      {copyStatus === 'failed' && (
        <p role="status" className="px-4 pb-3 text-xs text-danger">Could not copy. Select the code and copy it manually.</p>
      )}
    </div>
  );
}

const components = {
  pre: CodeBlock,
  // The question title is the page's only h1.
  h1: 'h2',
};
const rehypePlugins = [[rehypeHighlight, { detect: false }]];

export default function MarkdownBody({ body }) {
  return (
    <div className="question-markdown min-w-0 text-sm leading-7 text-ink">
      {/* Keep raw HTML disabled and retain react-markdown's safe URL transform. */}
      <Markdown skipHtml rehypePlugins={rehypePlugins} components={components}>
        {body || ''}
      </Markdown>
    </div>
  );
}
