import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

type ActivityContentProps = {
  kind: "user-message" | "assistant-update" | "system-note" | "file-activity";
  text: string;
};

const markdownComponents: Components = {
  code({ children, className, node: _node }) {
    const match = /language-([^\s]+)/.exec(className ?? "");
    const code = String(children).replace(/\n$/, "");

    if (match) {
      return (
        <SyntaxHighlighter
          PreTag="div"
          className="activity-code-block"
          language={match[1]}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderRadius: "14px",
            padding: "14px 16px",
          }}
        >
          {code}
        </SyntaxHighlighter>
      );
    }

    return (
      <code className={className}>
        {children}
      </code>
    );
  },
};

export default function ActivityContent({ kind, text }: ActivityContentProps) {
  if (kind === "system-note") {
    return <pre className="activity-plain activity-plain--system">{text}</pre>;
  }

  if (kind === "file-activity") {
    return <p className="activity-plain">{text}</p>;
  }

  return (
    <div className="activity-markdown">
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
