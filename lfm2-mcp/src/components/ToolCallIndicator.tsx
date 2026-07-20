import type React from "react";
import { extractToolCallContent } from "../utils";

const ToolCallIndicator: React.FC<{
  content: string;
  isRunning: boolean;
  hasError: boolean;
}> = ({ content, isRunning, hasError }) => (
  <div
    className={`transition-all duration-500 ease-in-out rounded-lg p-4 ${
      isRunning
        ? "bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50"
        : hasError
          ? "bg-gradient-to-r from-red-900/30 to-rose-900/30 border border-red-600/50"
          : "bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-600/50"
    }`}
  >
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0">
        <div className="relative w-6 h-6">
          {/* Spinner for running */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
              isRunning ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="w-6 h-6 bg-green-400/0 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>

          {/* Cross for error */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
              hasError ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="w-6 h-6 bg-red-400/100 rounded-full flex items-center justify-center transition-colors duration-500 ease-in-out">
              <span className="text-xs text-gray-900 font-bold">✗</span>
            </div>
          </div>

          {/* Tick for success */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
              !isRunning && !hasError
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="w-6 h-6 bg-green-400/100 rounded-full flex items-center justify-center transition-colors duration-500 ease-in-out">
              <span className="text-xs text-gray-900 font-bold">✓</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex items-center space-x-2 mb-2">
          <span
            className={`font-semibold text-sm transition-colors duration-500 ease-in-out ${
              isRunning
                ? "text-yellow-400"
                : hasError
                  ? "text-red-400"
                  : "text-green-400"
            }`}
          >
            🔧 Tool Call
          </span>
          {isRunning && (
            <span className="text-yellow-300 text-xs animate-pulse">
              Running...
            </span>
          )}
        </div>
        <div className="bg-gray-800/50 rounded p-2 mb-2">
          <code className="text-xs text-gray-300 font-mono break-all">
            {extractToolCallContent(content) ?? "..."}
          </code>
        </div>
        <p
          className={`text-xs transition-colors duration-500 ease-in-out ${
            isRunning
              ? "text-yellow-200"
              : hasError
                ? "text-red-200"
                : "text-green-200"
          }`}
        >
          {isRunning
            ? "Executing tool call..."
            : hasError
              ? "Tool call failed"
              : "Tool call completed"}
        </p>
      </div>
    </div>
  </div>
);
export default ToolCallIndicator;
