import type React from "react";

interface ResultBlockProps {
  error?: string;
  result?: unknown;
}

const ResultBlock: React.FC<ResultBlockProps> = ({
  error,
  result,
}) => (
  <div
    className={
      error
        ? "bg-red-900 border border-red-600 rounded p-3"
        : "bg-gray-700 border border-gray-600 rounded p-3"
    }
  >
    {error ? <p className="text-red-300 text-sm">Error: {error}</p> : null}
    <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-auto mt-2">
      {result !== undefined && result !== null 
        ? (typeof result === "object" ? JSON.stringify(result, null, 2) : String(result))
        : "No result"}
    </pre>
  </div>
);

export default ResultBlock;
