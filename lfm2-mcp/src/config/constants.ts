/**
 * Application configuration constants
 */

// MCP Client Configuration
export const MCP_CLIENT_CONFIG = {
  NAME: "LFM2-WebGPU",
  VERSION: "1.0.0",
  TEST_CLIENT_NAME: "LFM2-WebGPU-Test",
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  MCP_SERVERS: "mcp-servers",
  OAUTH_CLIENT_ID: "oauth_client_id",
  OAUTH_CLIENT_SECRET: "oauth_client_secret",
  OAUTH_AUTHORIZATION_ENDPOINT: "oauth_authorization_endpoint",
  OAUTH_TOKEN_ENDPOINT: "oauth_token_endpoint",
  OAUTH_REDIRECT_URI: "oauth_redirect_uri",
  OAUTH_RESOURCE: "oauth_resource",
  OAUTH_ACCESS_TOKEN: "oauth_access_token",
  OAUTH_CODE_VERIFIER: "oauth_code_verifier",
  OAUTH_MCP_SERVER_URL: "oauth_mcp_server_url",
  OAUTH_AUTHORIZATION_SERVER_METADATA: "oauth_authorization_server_metadata",
  MCP_SERVER_NAME: "mcp_server_name",
  MCP_SERVER_TRANSPORT: "mcp_server_transport",
} as const;

// Default Values
export const DEFAULTS = {
  MCP_TRANSPORT: "streamable-http" as const,
  OAUTH_REDIRECT_PATH: "/oauth/callback",
  NOTIFICATION_TIMEOUT: 3000,
  OAUTH_ERROR_TIMEOUT: 5000,
} as const;