import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeCodeForToken } from "../services/oauth";
import { secureStorage } from "../utils/storage";
import type { MCPServerConfig } from "../types/mcp";
import { STORAGE_KEYS, DEFAULTS } from "../config/constants";

interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  [key: string]: string | number | undefined;
}

interface OAuthCallbackProps {
  serverUrl: string;
  onSuccess?: (tokens: OAuthTokens) => void;
  onError?: (error: Error) => void;
}

const OAuthCallback: React.FC<OAuthCallbackProps> = ({
  serverUrl,
  onSuccess,
  onError,
}) => {
  const [status, setStatus] = useState<string>("Authorizing...");
  const navigate = useNavigate(); // Add this hook

    useEffect(() => {
    // Parse parameters from URL search params (OAuth providers send code in query string)
    const parseHashParams = () => {
      return new URLSearchParams(window.location.search);
    };

    const params = parseHashParams();
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    // Verify state parameter for CSRF protection
    const savedState = localStorage.getItem('oauth_state');
    if (state !== savedState) {
      setStatus("Invalid state parameter. Possible CSRF attack.");
      if (onError) onError(new Error("Invalid state parameter"));
      return;
    }

    // Check for OAuth errors
    if (error) {
      const errorDescription = params.get("error_description") || error;
      setStatus(`OAuth error: ${errorDescription}`);
      if (onError) onError(new Error(errorDescription));
      return;
    }

    // Always persist MCP server URL for robustness
    localStorage.setItem(STORAGE_KEYS.OAUTH_MCP_SERVER_URL, serverUrl);
    
    if (code) {
      exchangeCodeForToken({
        serverUrl,
        code,
        redirectUri: window.location.origin + "/#" + DEFAULTS.OAUTH_REDIRECT_PATH, // Add hash
      })
        .then(async (tokens) => {
          await secureStorage.setItem(STORAGE_KEYS.OAUTH_ACCESS_TOKEN, tokens.access_token);
          
          // Add MCP server to MCPClientService for UI
          const mcpServerUrl = localStorage.getItem(STORAGE_KEYS.OAUTH_MCP_SERVER_URL);
          if (mcpServerUrl) {
            const serverName =
              localStorage.getItem(STORAGE_KEYS.MCP_SERVER_NAME) || mcpServerUrl;
            const serverTransport = 
              (localStorage.getItem(STORAGE_KEYS.MCP_SERVER_TRANSPORT) as MCPServerConfig['transport']) || DEFAULTS.MCP_TRANSPORT;
            
            const serverConfig = {
              id: `server_${Date.now()}`,
              name: serverName,
              url: mcpServerUrl,
              enabled: true,
              transport: serverTransport,
              auth: {
                type: "bearer" as const,
                token: tokens.access_token,
              },
            };
            
            let servers: MCPServerConfig[] = [];
            try {
              const stored = localStorage.getItem(STORAGE_KEYS.MCP_SERVERS);
              if (stored) servers = JSON.parse(stored);
            } catch {}
            
            const exists = servers.some((s: MCPServerConfig) => s.url === mcpServerUrl);
            if (!exists) {
              servers.push(serverConfig);
              localStorage.setItem(STORAGE_KEYS.MCP_SERVERS, JSON.stringify(servers));
            }
            
            // Clear temp values
            localStorage.removeItem(STORAGE_KEYS.MCP_SERVER_NAME);
            localStorage.removeItem(STORAGE_KEYS.MCP_SERVER_TRANSPORT);
            localStorage.removeItem(STORAGE_KEYS.OAUTH_MCP_SERVER_URL);
          }
          
          // Clear OAuth state
          localStorage.removeItem('oauth_state');
          
          setStatus("Authorization successful! Redirecting...");
          if (onSuccess) onSuccess(tokens);
          
          // Use React Router navigation instead of window.location.replace
          setTimeout(() => {
            navigate("/", { replace: true });
          }, 1000);
        })
        .catch((err) => {
          setStatus("OAuth token exchange failed: " + err.message);
          if (onError) onError(err);
          // Clear OAuth state on error
          localStorage.removeItem('oauth_state');
        });
    } else {
      setStatus("Missing authorization code in callback URL.");
      if (onError) onError(new Error("Missing authorization code"));
    }
  }, [serverUrl, onSuccess, onError, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>{status}</p>
      </div>
    </div>
  );
};

export default OAuthCallback;