import { useState, useEffect, useCallback } from 'react';
import { MCPClientService } from '../services/mcpClient';
import type { MCPServerConfig, MCPClientState, ExtendedTool } from '../types/mcp';
import type { Tool as OriginalTool } from '../components/ToolItem';

// Singleton instance
let mcpClientInstance: MCPClientService | null = null;

const getMCPClient = (): MCPClientService => {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClientService();
  }
  return mcpClientInstance;
};

export const useMCP = () => {
  const [mcpState, setMCPState] = useState<MCPClientState>({
    servers: {},
    isLoading: false,
    error: undefined
  });

  const mcpClient = getMCPClient();

  // Subscribe to MCP state changes
  useEffect(() => {
    const handleStateChange = (state: MCPClientState) => {
      setMCPState(state);
    };

    mcpClient.addStateListener(handleStateChange);

    // Get initial state
    setMCPState(mcpClient.getState());

    return () => {
      mcpClient.removeStateListener(handleStateChange);
    };
  }, [mcpClient]);

  // Add a new MCP server
  const addServer = useCallback(async (config: MCPServerConfig): Promise<void> => {
    return mcpClient.addServer(config);
  }, [mcpClient]);

  // Remove an MCP server
  const removeServer = useCallback(async (serverId: string): Promise<void> => {
    return mcpClient.removeServer(serverId);
  }, [mcpClient]);

  // Connect to a server
  const connectToServer = useCallback(async (serverId: string): Promise<void> => {
    return mcpClient.connectToServer(serverId);
  }, [mcpClient]);

  // Disconnect from a server
  const disconnectFromServer = useCallback(async (serverId: string): Promise<void> => {
    return mcpClient.disconnectFromServer(serverId);
  }, [mcpClient]);

  // Test connection to a server
  const testConnection = useCallback(async (config: MCPServerConfig): Promise<boolean> => {
    return mcpClient.testConnection(config);
  }, [mcpClient]);

  // Call a tool on an MCP server
  const callMCPTool = useCallback(async (serverId: string, toolName: string, args: Record<string, unknown>) => {
    return mcpClient.callTool(serverId, toolName, args);
  }, [mcpClient]);

  // Get all available MCP tools
  const getMCPTools = useCallback((): ExtendedTool[] => {
    const mcpTools: ExtendedTool[] = [];

    Object.entries(mcpState.servers).forEach(([serverId, connection]) => {
      if (connection.isConnected && connection.config.enabled) {
        connection.tools.forEach((mcpTool) => {
          mcpTools.push({
            id: `${serverId}:${mcpTool.name}`,
            name: mcpTool.name,
            enabled: true,
            isCollapsed: false,
            mcpServerId: serverId,
            mcpTool: mcpTool,
            isRemote: true
          });
        });
      }
    });

    return mcpTools;
  }, [mcpState.servers]);

  // Convert MCP tools to the format expected by the existing tool system
  const getMCPToolsAsOriginalTools = useCallback((): OriginalTool[] => {
    const mcpTools: OriginalTool[] = [];
    let globalId = Date.now(); // Use timestamp to force tool refresh

    Object.entries(mcpState.servers).forEach(([serverId, connection]) => {
      if (connection.isConnected && connection.config.enabled) {
        connection.tools.forEach((mcpTool) => {
          // Convert tool name to valid JavaScript identifier
          const jsToolName = mcpTool.name.replace(/[-\s]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

          // Create a JavaScript function that calls the MCP tool
          const safeDescription = (mcpTool.description || `MCP tool from ${connection.config.name}`).replace(/[`${}\\]/g, '');
          const serverName = connection.config.name;
          const safeParams = Object.entries(mcpTool.inputSchema.properties || {}).map(([name, prop]) => {
            const p = prop as { type?: string; description?: string };
            const safeType = (p.type || 'any').replace(/[`${}\\]/g, '');
            const safeDesc = (p.description || '').replace(/[`${}\\]/g, '');
            return `@param {${safeType}} ${name} - ${safeDesc}`;
          }).join('\n * ');
          
          const code = `/**
 * ${safeDescription}
 * ${safeParams}
 * @returns {Promise<any>} Tool execution result
 */
export async function ${jsToolName}(${Object.keys(mcpTool.inputSchema.properties || {}).join(', ')}) {
  // This is an MCP tool - execution is handled by the MCP client
  return { mcpServerId: "${serverId}", toolName: ${JSON.stringify(mcpTool.name)}, arguments: arguments };
}

export default (input, output) =>
  React.createElement(
    "div",
    { className: "bg-blue-50 border border-blue-200 rounded-lg p-4" },
    React.createElement(
      "div",
      { className: "flex items-center mb-2" },
      React.createElement(
        "div",
        {
          className:
            "w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3",
        },
        "🌐",
      ),
      React.createElement(
        "h3",
        { className: "text-blue-900 font-semibold" },
"${mcpTool.name} (MCP)"
      ),
    ),
    React.createElement(
      "div",
      { className: "text-sm space-y-1" },
      React.createElement(
        "p",
        { className: "text-blue-700 font-medium" },
        "Server: " + ${JSON.stringify(serverName)}
      ),
      React.createElement(
        "p",
        { className: "text-blue-700 font-medium" },
        "Input: " + JSON.stringify(input)
      ),
      React.createElement(
        "div",
        { className: "mt-3" },
        React.createElement(
          "h4",
          { className: "text-blue-800 font-medium mb-2" },
          "Result:"
        ),
        React.createElement(
          "pre",
          { 
            className: "text-gray-800 text-xs bg-gray-50 p-3 rounded border overflow-x-auto max-w-full",
            style: { whiteSpace: "pre-wrap", wordBreak: "break-word" }
          },
          (() => {
            // Try to parse and format JSON content from text fields
            if (output && output.content && Array.isArray(output.content)) {
              const textContent = output.content.find(item => item.type === 'text' && item.text);
              if (textContent && textContent.text) {
                try {
                  const parsed = JSON.parse(textContent.text);
                  return JSON.stringify(parsed, null, 2);
                } catch {
                  // If not JSON, return the original text
                  return textContent.text;
                }
              }
            }
            // Fallback to original output
            return JSON.stringify(output, null, 2);
          })()
        )
      ),
    ),
  );`;

          mcpTools.push({
            id: globalId++,
            name: jsToolName, // Use JavaScript-safe name for function calls
            code: code,
            enabled: true,
            isCollapsed: false
          });
        });
      }
    });

    return mcpTools;
  }, [mcpState.servers]);

  // Connect to all enabled servers
  const connectAll = useCallback(async (): Promise<void> => {
    return mcpClient.connectAll();
  }, [mcpClient]);

  // Disconnect from all servers
  const disconnectAll = useCallback(async (): Promise<void> => {
    return mcpClient.disconnectAll();
  }, [mcpClient]);

  return {
    mcpState,
    addServer,
    removeServer,
    connectToServer,
    disconnectFromServer,
    testConnection,
    callMCPTool,
    getMCPTools,
    getMCPToolsAsOriginalTools,
    connectAll,
    disconnectAll
  };
};
