import React, { useEffect, useState } from "react";
import { discoverOAuthEndpoints, startOAuthFlow } from "../services/oauth";
import { Plus, Server, Wifi, WifiOff, Trash2, TestTube } from "lucide-react";
import { useMCP } from "../hooks/useMCP";
import type { MCPServerConfig } from "../types/mcp";
import { STORAGE_KEYS, DEFAULTS } from "../config/constants";

interface MCPServerManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MCPServerManager: React.FC<MCPServerManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    mcpState,
    addServer,
    removeServer,
    connectToServer,
    disconnectFromServer,
    testConnection,
  } = useMCP();
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(
    null
  );
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [newServer, setNewServer] = useState<Omit<MCPServerConfig, "id">>({
    name: "",
    url: "",
    enabled: true,
    transport: "streamable-http",
    auth: {
      type: "bearer",
    },
  });

  useEffect(() => {
    const initializeDefaultServer = async () => {
      if (Object.keys(mcpState.servers).length > 0) return;

      const defaultServer: MCPServerConfig = {
        id: "default-server",
        name: "Default MCP Server",
        url: "http://localhost:8765/mcp",
        enabled: true,
        transport: "streamable-http",
        auth: {
          type: "bearer",
          token: "",
        },
      };

      try {
        await addServer(defaultServer);
      } catch (err) {
        console.error("Erro ao adicionar servidor padrão:", err);
      }
    };

    initializeDefaultServer();
  }, [mcpState.servers, addServer]);

  if (!isOpen) return null;

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.url) return;

    const serverConfig: MCPServerConfig = {
      ...newServer,
      id: `server_${Date.now()}`,
    };

    // Persist name and transport for OAuth flow
    localStorage.setItem(STORAGE_KEYS.MCP_SERVER_NAME, newServer.name);
    localStorage.setItem(
      STORAGE_KEYS.MCP_SERVER_TRANSPORT,
      newServer.transport
    );

    try {
      await addServer(serverConfig);
      setNewServer({
        name: "",
        url: "",
        enabled: true,
        transport: "streamable-http",
        auth: {
          type: "bearer",
        },
      });
      setShowAddForm(false);
    } catch (error) {
      setNotification({
        message: `Failed to add server: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        type: "error",
      });
      setTimeout(() => setNotification(null), DEFAULTS.OAUTH_ERROR_TIMEOUT);
    }
  };

  const handleTestConnection = async (config: MCPServerConfig) => {
    setTestingConnection(config.id);
    try {
      const success = await testConnection(config);
      if (success) {
        setNotification({
          message: "Connection test successful!",
          type: "success",
        });
      } else {
        setNotification({
          message: "Connection test failed. Please check your configuration.",
          type: "error",
        });
      }
    } catch (error) {
      setNotification({
        message: `Connection test failed: ${error}`,
        type: "error",
      });
    } finally {
      setTestingConnection(null);
      // Auto-hide notification after 3 seconds
      setTimeout(() => setNotification(null), DEFAULTS.NOTIFICATION_TIMEOUT);
    }
  };

  const handleToggleConnection = async (
    serverId: string,
    isConnected: boolean
  ) => {
    try {
      if (isConnected) {
        await disconnectFromServer(serverId);
      } else {
        await connectToServer(serverId);
      }
    } catch (error) {
      setNotification({
        message: `Failed to toggle connection: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        type: "error",
      });
      setTimeout(() => setNotification(null), DEFAULTS.OAUTH_ERROR_TIMEOUT);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Server className="text-blue-400" />
            MCP Server Manager
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* Add Server Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={16} />
            Add MCP Server
          </button>
        </div>

        {/* Add Server Form */}
        {showAddForm && (
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Add New MCP Server
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Server Name
                </label>
                <input
                  type="text"
                  value={newServer.name}
                  onChange={(e) =>
                    setNewServer({ ...newServer, name: e.target.value })
                  }
                  className="w-full bg-gray-600 text-white rounded px-3 py-2"
                  placeholder="My MCP Server"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Server URL
                </label>
                <input
                  type="url"
                  value={newServer.url}
                  onChange={(e) =>
                    setNewServer({ ...newServer, url: e.target.value })
                  }
                  className="w-full bg-gray-600 text-white rounded px-3 py-2"
                  placeholder="http://localhost:3000/mcp"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Transport
                </label>
                <select
                  value={newServer.transport}
                  onChange={(e) =>
                    setNewServer({
                      ...newServer,
                      transport: e.target.value as MCPServerConfig["transport"],
                    })
                  }
                  className="w-full bg-gray-600 text-white rounded px-3 py-2"
                >
                  <option value="streamable-http">Streamable HTTP</option>
                  <option value="sse">Server-Sent Events</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Authentication
                </label>
                <select
                  value={newServer.auth?.type || "none"}
                  onChange={(e) => {
                    const authType = e.target.value;
                    if (authType === "none") {
                      setNewServer({ ...newServer, auth: undefined });
                    } else {
                      setNewServer({
                        ...newServer,
                        auth: {
                          type: authType as "bearer" | "basic" | "oauth",
                          ...(authType === "bearer" ? { token: "" } : {}),
                          ...(authType === "basic"
                            ? { username: "", password: "" }
                            : {}),
                          ...(authType === "oauth" ? { token: "" } : {}),
                        },
                      });
                    }
                  }}
                  className="w-full bg-gray-600 text-white rounded px-3 py-2"
                >
                  <option value="none">No Authentication</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="oauth">OAuth Token</option>
                </select>
              </div>

              {/* Auth-specific fields */}
              {newServer.auth?.type === "bearer" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Bearer Token
                  </label>
                  <input
                    type="password"
                    value={newServer.auth.token || ""}
                    onChange={(e) =>
                      setNewServer({
                        ...newServer,
                        auth: { ...newServer.auth!, token: e.target.value },
                      })
                    }
                    className="w-full bg-gray-600 text-white rounded px-3 py-2"
                    placeholder="your-bearer-token"
                  />
                </div>
              )}

              {newServer.auth?.type === "basic" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={newServer.auth.username || ""}
                      onChange={(e) =>
                        setNewServer({
                          ...newServer,
                          auth: {
                            ...newServer.auth!,
                            username: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-gray-600 text-white rounded px-3 py-2"
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={newServer.auth.password || ""}
                      onChange={(e) =>
                        setNewServer({
                          ...newServer,
                          auth: {
                            ...newServer.auth!,
                            password: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-gray-600 text-white rounded px-3 py-2"
                      placeholder="password"
                    />
                  </div>
                </>
              )}

              {newServer.auth?.type === "oauth" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    OAuth Authorization
                  </label>
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-2"
                    type="button"
                    onClick={async () => {
                      try {
                        // Persist name and transport for OAuthCallback
                        localStorage.setItem(
                          STORAGE_KEYS.MCP_SERVER_NAME,
                          newServer.name
                        );
                        localStorage.setItem(
                          STORAGE_KEYS.MCP_SERVER_TRANSPORT,
                          newServer.transport
                        );
                        const endpoints = await discoverOAuthEndpoints(
                          newServer.url
                        );

                        if (!endpoints.clientId || !endpoints.redirectUri) {
                          throw new Error(
                            "Missing required OAuth configuration (clientId or redirectUri)"
                          );
                        }

                        startOAuthFlow({
                          authorizationEndpoint:
                            endpoints.authorizationEndpoint,
                          clientId: endpoints.clientId as string,
                          redirectUri: endpoints.redirectUri as string,
                          scopes: (endpoints.scopes || []) as string[],
                        });
                      } catch (err) {
                        setNotification({
                          message:
                            "OAuth discovery failed: " +
                            (err instanceof Error ? err.message : String(err)),
                          type: "error",
                        });
                        setTimeout(
                          () => setNotification(null),
                          DEFAULTS.OAUTH_ERROR_TIMEOUT
                        );
                      }
                    }}
                  >
                    Connect with OAuth
                  </button>
                  <p className="text-xs text-gray-400">
                    You will be redirected to authorize this app with the MCP
                    server.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={newServer.enabled}
                  onChange={(e) =>
                    setNewServer({ ...newServer, enabled: e.target.checked })
                  }
                  className="rounded"
                />
                <label htmlFor="enabled" className="text-sm text-gray-300">
                  Auto-connect when added
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddServer}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Add Server
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Server List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">
            Configured Servers
          </h3>

          {Object.values(mcpState.servers).length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              No MCP servers configured. Add one to get started!
            </div>
          ) : (
            Object.values(mcpState.servers).map((connection) => (
              <div
                key={connection.config.id}
                className="bg-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        connection.isConnected ? "bg-green-400" : "bg-red-400"
                      }`}
                    />
                    <div>
                      <h4 className="text-white font-medium">
                        {connection.config.name}
                      </h4>
                      <p className="text-gray-400 text-sm">
                        {connection.config.url}
                      </p>
                      <p className="text-gray-500 text-xs">
                        Transport: {connection.config.transport}
                        {connection.config.auth &&
                          ` • Auth: ${connection.config.auth.type}`}
                        {connection.isConnected &&
                          ` • ${connection.tools.length} tools available`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Test Connection */}
                    <button
                      onClick={() => handleTestConnection(connection.config)}
                      disabled={testingConnection === connection.config.id}
                      className="p-2 text-yellow-400 hover:text-yellow-300 disabled:opacity-50"
                      title="Test Connection"
                    >
                      <TestTube size={16} />
                    </button>

                    {/* Connect/Disconnect */}
                    <button
                      onClick={() =>
                        handleToggleConnection(
                          connection.config.id,
                          connection.isConnected
                        )
                      }
                      className={`p-2 ${
                        connection.isConnected
                          ? "text-green-400 hover:text-green-300"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                      title={connection.isConnected ? "Disconnect" : "Connect"}
                    >
                      {connection.isConnected ? (
                        <Wifi size={16} />
                      ) : (
                        <WifiOff size={16} />
                      )}
                    </button>

                    {/* Remove Server */}
                    <button
                      onClick={() => removeServer(connection.config.id)}
                      className="p-2 text-red-400 hover:text-red-300"
                      title="Remove Server"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {connection.lastError && (
                  <div className="mt-2 text-red-400 text-sm">
                    Error: {connection.lastError}
                  </div>
                )}

                {connection.isConnected && connection.tools.length > 0 && (
                  <div className="mt-3">
                    <details className="text-sm">
                      <summary className="text-gray-300 cursor-pointer">
                        Available Tools ({connection.tools.length})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {connection.tools.map((tool) => (
                          <div key={tool.name} className="text-gray-400 pl-4">
                            • {tool.name} -{" "}
                            {tool.description || "No description"}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {mcpState.error && (
          <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-lg text-red-200">
            <strong>Error:</strong> {mcpState.error}
          </div>
        )}

        {notification && (
          <div
            className={`mt-4 p-4 border rounded-lg ${
              notification.type === "success"
                ? "bg-green-900 border-green-700 text-green-200"
                : "bg-red-900 border-red-700 text-red-200"
            }`}
          >
            {notification.message}
          </div>
        )}
      </div>
    </div>
  );
};
