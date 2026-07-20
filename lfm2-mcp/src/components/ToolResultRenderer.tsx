import React from "react";
import ResultBlock from "./ResultBlock";

interface ToolResultRendererProps {
  result: unknown;
  rendererCode?: string;
  input?: unknown;
}

const ToolResultRenderer: React.FC<ToolResultRendererProps> = ({ result, rendererCode, input }) => {
  if (!rendererCode) {
    return <ResultBlock result={result} />;
  }

  try {
    const exportMatch = rendererCode.match(/export\s+default\s+(.*)/s);
    if (!exportMatch) {
      throw new Error("Invalid renderer format - no export default found");
    }

    const componentCode = exportMatch[1].trim();
    const componentFunction = new Function(
      "React",
      "input",
      "output",
      `
      const { createElement: h, Fragment } = React;
      const JSXComponent = ${componentCode};
      return JSXComponent(input, output);
      `,
    );

    const element = componentFunction(React, input || {}, result);
    return element;
  } catch (error) {
    return (
      <ResultBlock
        error={error instanceof Error ? error.message : "Unknown error"}
        result={result}
      />
    );
  }
};
export default ToolResultRenderer;
