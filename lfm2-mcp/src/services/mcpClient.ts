import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { MCP_SERVERS } from "../tools/mcp_servers";
import type {
  MCPServerConfig,
  MCPServerConnection,
  MCPClientState,
  MCPToolResult,
} from "../types/mcp.js";
import { MCP_CLIENT_CONFIG, STORAGE_KEYS } from "../config/constants";

export class MCPClientService {
  private clients: Map<string, Client> = new Map();
  private connections: Map<string, MCPServerConnection> = new Map();
  private listeners: Array<(state: MCPClientState) => void> = [];

  constructor() {
    // Load saved server configurations from localStorage
    this.loadServerConfigs();

    // If no servers are present, load initial list from MCP_SERVERS (imported)
    if (this.connections.size === 0) {
      MCP_SERVERS.forEach((config) => {
        this.addServer(config);
      });
    }
  }

  // Add state change listener
  addStateListener(listener: (state: MCPClientState) => void) {
    this.listeners.push(listener);
  }

  // Remove state change listener
  removeStateListener(listener: (state: MCPClientState) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Notify all listeners of state changes
  private notifyStateChange() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  // Get current MCP client state
  getState(): MCPClientState {
    const servers: Record<string, MCPServerConnection> = {};
    for (const [id, connection] of this.connections) {
      servers[id] = connection;
    }

    return {
      servers,
      isLoading: false,
      error: undefined,
    };
  }

  // Load server configurations from localStorage
  private loadServerConfigs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MCP_SERVERS);
      if (stored) {
        const configs: MCPServerConfig[] = JSON.parse(stored);
        configs.forEach((config) => {
          const connection: MCPServerConnection = {
            config,
            isConnected: false,
            tools: [],
            lastError: undefined,
            lastConnected: undefined,
          };
          this.connections.set(config.id, connection);
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Silently handle missing or corrupted config
    }
  }

  // Save server configurations to localStorage
  private saveServerConfigs() {
    try {
      const configs = Array.from(this.connections.values()).map(
        (conn) => conn.config
      );
      localStorage.setItem(STORAGE_KEYS.MCP_SERVERS, JSON.stringify(configs));
    } catch (error) {
      // Handle storage errors gracefully
      throw new Error(
        `Failed to save server configuration: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Add a new MCP server
  async addServer(config: MCPServerConfig): Promise<void> {
    const connection: MCPServerConnection = {
      config,
      isConnected: false,
      tools: [],
      lastError: undefined,
      lastConnected: undefined,
    };

    this.connections.set(config.id, connection);
    this.saveServerConfigs();
    this.notifyStateChange();

    // Auto-connect if enabled
    if (config.enabled) {
      await this.connectToServer(config.id);
    }
  }

  // Remove an MCP server
  async removeServer(serverId: string): Promise<void> {
    // Disconnect first if connected
    await this.disconnectFromServer(serverId);

    // Remove from our maps
    this.connections.delete(serverId);
    this.clients.delete(serverId);

    this.saveServerConfigs();
    this.notifyStateChange();
  }

  // Connect to an MCP server
  async connectToServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (connection.isConnected) {
      return; // Already connected
    }

    try {
      // Create client
      const client = new Client(
        {
          name: MCP_CLIENT_CONFIG.NAME,
          version: MCP_CLIENT_CONFIG.VERSION,
        },
        {
          capabilities: {},
        }
      );

      // Create transport based on config
      let transport;
      const url = new URL(connection.config.url);

      // Prepare headers for authentication
      const headers: Record<string, string> = {};
      if (connection.config.auth) {
        switch (connection.config.auth.type) {
          case "bearer":
            if (connection.config.auth.token) {
              headers[
                "Authorization"
              ] = `Bearer ${connection.config.auth.token}`;
            }
            break;
          case "basic":
            if (
              connection.config.auth.username &&
              connection.config.auth.password
            ) {
              const credentials = btoa(
                `${connection.config.auth.username}:${connection.config.auth.password}`
              );
              headers["Authorization"] = `Basic ${credentials}`;
            }
            break;
          case "oauth":
            if (connection.config.auth.token) {
              headers[
                "Authorization"
              ] = `Bearer ${connection.config.auth.token}`;
            }
            break;
        }
      }

      switch (connection.config.transport) {
        case "streamable-http":
          transport = new StreamableHTTPClientTransport(url, {
            requestInit:
              Object.keys(headers).length > 0 ? { headers } : undefined,
          });
          break;

        case "sse":
          transport = new SSEClientTransport(url, {
            requestInit:
              Object.keys(headers).length > 0 ? { headers } : undefined,
          });
          break;

        default:
          throw new Error(
            `Unsupported transport: ${connection.config.transport}`
          );
      }

      // Set up error handling
      client.onerror = (error) => {
        connection.lastError = error.message;
        connection.isConnected = false;
        this.notifyStateChange();
      };

      // Connect to the server
      await client.connect(transport);

      // List available tools
      const toolsResult = await client.listTools();

      // Update connection state
      connection.isConnected = true;
      connection.tools = toolsResult.tools;
      connection.lastError = undefined;
      connection.lastConnected = new Date();

      // Store client reference
      this.clients.set(serverId, client);

      this.notifyStateChange();
    } catch (error) {
      connection.isConnected = false;
      connection.lastError =
        error instanceof Error ? error.message : "Connection failed";
      this.notifyStateChange();
      throw error;
    }
  }

  // Disconnect from an MCP server
  async disconnectFromServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    const connection = this.connections.get(serverId);

    if (client) {
      try {
        await client.close();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Handle disconnect error silently
      }
      this.clients.delete(serverId);
    }

    if (connection) {
      connection.isConnected = false;
      connection.tools = [];
      this.notifyStateChange();
    }
  }

  // Get all tools from all connected servers
  getAllTools(): Tool[] {
    const allTools: Tool[] = [];

    for (const connection of this.connections.values()) {
      if (connection.isConnected && connection.config.enabled) {
        allTools.push(...connection.tools);
      }
    }

    return allTools;
  }

  // Call a tool on an MCP server
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const client = this.clients.get(serverId);
    const connection = this.connections.get(serverId);

    if (!client || !connection?.isConnected) {
      throw new Error(`Not connected to server ${serverId}`);
    }

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });

      return {
        content: Array.isArray(result.content) ? result.content : [],
        isError: Boolean(result.isError),
      };
    } catch (error) {
      throw new Error(
        `Tool execution failed (${toolName}): ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Test connection to a server without saving it
  async testConnection(config: MCPServerConfig): Promise<boolean> {
    try {
      const client = new Client(
        {
          name: MCP_CLIENT_CONFIG.TEST_CLIENT_NAME,
          version: MCP_CLIENT_CONFIG.VERSION,
        },
        {
          capabilities: {},
        }
      );

      let transport;
      const url = new URL(config.url);

      switch (config.transport) {
        case "streamable-http":
          transport = new StreamableHTTPClientTransport(url);
          break;

        case "sse":
          transport = new SSEClientTransport(url);
          break;

        default:
          throw new Error(`Unsupported transport: ${config.transport}`);
      }

      await client.connect(transport);
      await client.close();
      return true;
    } catch (error) {
      throw new Error(
        `Connection test failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Connect to all enabled servers
  async connectAll(): Promise<void> {
    const promises = Array.from(this.connections.entries())
      .filter(
        ([, connection]) => connection.config.enabled && !connection.isConnected
      )
      .map(([serverId]) =>
        this.connectToServer(serverId).catch(() => {
          // Handle auto-connection error silently
        })
      );

    await Promise.all(promises);
  }

  // Disconnect from all servers
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map((serverId) =>
      this.disconnectFromServer(serverId)
    );

    await Promise.all(promises);
  }
}
