import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

// Renders an AI research report written in Markdown (headings, lists, tables, links).
// Inline HTML the model sometimes emits (like <br> inside table cells) is allowed,
// but sanitized so the report can't inject scripts or unsafe markup.

// gpt-oss leaves internal citation markers such as 【0†content】 or 【3†L10-L12】.
const cleanReport = (text) => text.replace(/【[^】]*】/g, '').replace(/[ \t]+\n/g, '\n');

const components = {
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
  // Wide tables scroll sideways instead of stretching the layout.
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

const MarkdownReport = ({ content, fallback = 'No report generated.', className = '' }) => {
  if (!content) {
    return <p className="text-slate-400 italic">{fallback}</p>;
  }

  return (
    <div
      className={`prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-blue-600 prose-table:text-sm prose-th:bg-slate-100 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={components}
      >
        {cleanReport(content)}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownReport;
