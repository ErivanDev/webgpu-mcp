import type React from "react";
import { DEFAULT_EXAMPLES, type Example } from "../constants/examples";

interface ExamplePromptsProps {
  examples?: Example[];
  onExampleClick: (messageText: string) => void;
}

const ExamplePrompts: React.FC<ExamplePromptsProps> = ({
  examples,
  onExampleClick,
}) => {
  // If examples are provided, use them. Otherwise, generate from enabled tools.
  let dynamicExamples = examples;
  if (!dynamicExamples) {
    // Try to get tools from props (if passed as examples)
    dynamicExamples = undefined;
  }
  // If still undefined, fallback to DEFAULT_EXAMPLES
  if (!dynamicExamples) {
    dynamicExamples = DEFAULT_EXAMPLES;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-300 mb-1">
          Try an example
        </h2>
        <p className="text-sm text-gray-500">Click one to get started</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full px-4">
        {dynamicExamples.map((example, index) => (
          <button
            key={index}
            onClick={() => onExampleClick(example.messageText)}
            className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left group cursor-pointer"
          >
            <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
              {example.icon}
            </span>
            <span className="text-sm text-gray-200 group-hover:text-white transition-colors">
              {example.displayText}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExamplePrompts;
