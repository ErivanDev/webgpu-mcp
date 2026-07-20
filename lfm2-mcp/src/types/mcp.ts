import type { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  transport: "sse" | "streamable-http";
  auth?: {
    type: "bearer" | "basic" | "oauth";
    token?: string;
    username?: string;
    password?: string;
  };
}

export interface MCPServerConnection {
  config: MCPServerConfig;
  isConnected: boolean;
  tools: MCPTool[];
  lastError?: string;
  lastConnected?: Date;
}

// Extended Tool interface to support both local and MCP tools
export interface ExtendedTool {
  id: number | string;
  name: string;
  enabled: boolean;
  isCollapsed?: boolean;

  // Local tool properties
  code?: string;
  renderer?: string;

  // MCP tool properties
  mcpServerId?: string;
  mcpTool?: MCPTool;
  isRemote?: boolean;
}

// MCP Tool execution result
export interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// MCP Client state
export interface MCPClientState {
  servers: Record<string, MCPServerConnection>;
  isLoading: boolean;
  error?: string;
}
