import {
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
  startAuthorization,
  exchangeAuthorization,
  registerClient,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  AuthorizationServerMetadata,
  OAuthClientInformationMixed,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { secureStorage } from "../utils/storage";
import { MCP_CLIENT_CONFIG, STORAGE_KEYS, DEFAULTS } from "../config/constants";

type OAuthMetadataOverrides = AuthorizationServerMetadata & {
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  scopes?: string[];
};

// Utility to fetch .well-known/modelcontextprotocol for OAuth endpoints
export async function discoverOAuthEndpoints(serverUrl: string) {
  // ...existing code...
  let resourceMetadata, authMetadata, authorizationServerUrl;
  try {
    resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl);
    if (resourceMetadata?.authorization_servers?.length) {
      authorizationServerUrl = resourceMetadata.authorization_servers[0];
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // Fallback to direct metadata discovery if protected resource fails
    authMetadata = await discoverAuthorizationServerMetadata(serverUrl);
    authorizationServerUrl = authMetadata?.issuer || serverUrl;
  }

  if (!authorizationServerUrl) {
    throw new Error("No authorization server found for this MCP server");
  }

  // Discover authorization server metadata if not already done
  if (!authMetadata) {
    authMetadata = await discoverAuthorizationServerMetadata(
      authorizationServerUrl
    );
  }

  if (
    !authMetadata ||
    !authMetadata.authorization_endpoint ||
    !authMetadata.token_endpoint
  ) {
    throw new Error("Missing OAuth endpoints in authorization server metadata");
  }

  const metadataOverrides = authMetadata as OAuthMetadataOverrides;
  const redirectUri =
    metadataOverrides.redirect_uri ||
    window.location.origin + "/#" + DEFAULTS.OAUTH_REDIRECT_PATH;
  let clientInformation: OAuthClientInformationMixed | undefined;
  const persistedClientId = localStorage.getItem(STORAGE_KEYS.OAUTH_CLIENT_ID);
  const persistedClientSecret = await secureStorage.getItem(
    STORAGE_KEYS.OAUTH_CLIENT_SECRET
  );

  if (persistedClientId) {
    clientInformation = {
      client_id: persistedClientId,
      ...(persistedClientSecret
        ? { client_secret: persistedClientSecret }
        : {}),
    };
  } else if (metadataOverrides.client_id) {
    clientInformation = {
      client_id: metadataOverrides.client_id,
      ...(metadataOverrides.client_secret
        ? { client_secret: metadataOverrides.client_secret }
        : {}),
    };
  }

  // If client credentials are missing, register client dynamically
  if (!clientInformation?.client_id && authMetadata.registration_endpoint) {
    // Determine token endpoint auth method
    let tokenEndpointAuthMethod = "none";
    if (
      authMetadata.token_endpoint_auth_methods_supported?.includes(
        "client_secret_post"
      )
    ) {
      tokenEndpointAuthMethod = "client_secret_post";
    } else if (
      authMetadata.token_endpoint_auth_methods_supported?.includes(
        "client_secret_basic"
      )
    ) {
      tokenEndpointAuthMethod = "client_secret_basic";
    }
    const clientMetadata = {
      redirect_uris: [redirectUri],
      client_name: MCP_CLIENT_CONFIG.NAME,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: tokenEndpointAuthMethod,
    };
    const clientInfo = await registerClient(authorizationServerUrl, {
      metadata: authMetadata,
      clientMetadata,
    });
    clientInformation = clientInfo;
    // Persist client credentials for later use
    localStorage.setItem(STORAGE_KEYS.OAUTH_CLIENT_ID, clientInfo.client_id);
    if (clientInfo.client_secret) {
      await secureStorage.setItem(STORAGE_KEYS.OAUTH_CLIENT_SECRET, clientInfo.client_secret);
    }
  }
  if (!clientInformation?.client_id) {
    throw new Error(
      "Missing client_id and registration not supported by authorization server"
    );
  }

  // Step 3: Validate resource
  const resource = resourceMetadata?.resource
    ? new URL(resourceMetadata.resource)
    : undefined;

  // Persist endpoints, metadata, and MCP server URL for callback use
  localStorage.setItem(
    STORAGE_KEYS.OAUTH_AUTHORIZATION_ENDPOINT,
    authMetadata.authorization_endpoint
  );
  localStorage.setItem(STORAGE_KEYS.OAUTH_TOKEN_ENDPOINT, authMetadata.token_endpoint);
  localStorage.setItem(
    STORAGE_KEYS.OAUTH_REDIRECT_URI,
    redirectUri
  );
  localStorage.setItem(STORAGE_KEYS.OAUTH_MCP_SERVER_URL, serverUrl);
  localStorage.setItem(
    STORAGE_KEYS.OAUTH_AUTHORIZATION_SERVER_METADATA,
    JSON.stringify(authMetadata)
  );
  if (resource) {
    localStorage.setItem(STORAGE_KEYS.OAUTH_RESOURCE, resource.toString());
  }
  return {
    authorizationEndpoint: authMetadata.authorization_endpoint,
    tokenEndpoint: authMetadata.token_endpoint,
    clientId: clientInformation.client_id,
    clientSecret: clientInformation.client_secret,
    scopes:
      metadataOverrides.scopes ||
      authMetadata.scopes_supported ||
      resourceMetadata?.scopes_supported ||
      [],
    redirectUri,
    resource,
  };
}

// Start OAuth flow: redirect user to authorization endpoint
export async function startOAuthFlow({
  authorizationEndpoint,
  clientId,
  redirectUri,
  scopes,
  resource,
}: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  resource?: URL;
}) {
  // Use Proof Key for Code Exchange (PKCE) and SDK to build the authorization URL
  // Use persisted client_id if available
  const persistedClientId = localStorage.getItem(STORAGE_KEYS.OAUTH_CLIENT_ID) || clientId;
  const clientInformation = { client_id: persistedClientId };
  // Retrieve metadata from localStorage if available
  let metadata;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.OAUTH_AUTHORIZATION_SERVER_METADATA);
    if (stored) metadata = JSON.parse(stored);
  } catch {
    console.warn("Failed to parse stored OAuth metadata, using defaults");
  }
  // Always pass resource from localStorage if not provided
  let resourceParam = resource;
  if (!resourceParam) {
    const resourceStr = localStorage.getItem(STORAGE_KEYS.OAUTH_RESOURCE);
    if (resourceStr) resourceParam = new URL(resourceStr);
  }
  const { authorizationUrl, codeVerifier } = await startAuthorization(
    authorizationEndpoint,
    {
      metadata,
      clientInformation,
      redirectUrl: redirectUri,
      scope: scopes?.join(" ") || undefined,
      resource: resourceParam,
    }
  );
  // Save codeVerifier in localStorage for later token exchange
  localStorage.setItem(STORAGE_KEYS.OAUTH_CODE_VERIFIER, codeVerifier);
  window.location.href = authorizationUrl.toString();
}

// Exchange code for token using MCP SDK
export async function exchangeCodeForToken({
  code,
  redirectUri,
}: {
  serverUrl?: string;
  code: string;
  redirectUri: string;
}) {
  // Use only persisted credentials and endpoints for token exchange
  const tokenEndpoint = localStorage.getItem(STORAGE_KEYS.OAUTH_TOKEN_ENDPOINT);
  const redirectUriPersisted = localStorage.getItem(STORAGE_KEYS.OAUTH_REDIRECT_URI);
  const resourceStr = localStorage.getItem(STORAGE_KEYS.OAUTH_RESOURCE);
  const persistedClientId = localStorage.getItem(STORAGE_KEYS.OAUTH_CLIENT_ID);
  const persistedClientSecret = await secureStorage.getItem(STORAGE_KEYS.OAUTH_CLIENT_SECRET);
  const codeVerifier = localStorage.getItem(STORAGE_KEYS.OAUTH_CODE_VERIFIER);
  if (!persistedClientId || !tokenEndpoint || !codeVerifier)
    throw new Error(
      "Missing OAuth client credentials or endpoints for token exchange"
    );
  const clientInformation: { client_id: string; client_secret?: string } = { client_id: persistedClientId };
  if (persistedClientSecret) {
    clientInformation.client_secret = persistedClientSecret;
  }
  // Retrieve metadata from localStorage if available
  let metadata;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.OAUTH_AUTHORIZATION_SERVER_METADATA);
    if (stored) metadata = JSON.parse(stored);
  } catch {
    console.warn("Failed to parse stored OAuth metadata, using defaults");
  }
  // Use SDK to exchange code for tokens
  const tokens = await exchangeAuthorization(tokenEndpoint, {
    metadata,
    clientInformation,
    authorizationCode: code,
    codeVerifier,
    redirectUri: redirectUriPersisted || redirectUri,
    resource: resourceStr ? new URL(resourceStr) : undefined,
  });
  // Persist access token in localStorage and sync to mcp-servers
  if (tokens && tokens.access_token) {
    await secureStorage.setItem(STORAGE_KEYS.OAUTH_ACCESS_TOKEN, tokens.access_token);
    try {
      const serversStr = localStorage.getItem(STORAGE_KEYS.MCP_SERVERS);
      if (serversStr) {
        const servers = JSON.parse(serversStr);
        for (const server of servers) {
          if (
            server.auth &&
            (server.auth.type === "bearer" || server.auth.type === "oauth")
          ) {
            server.auth.token = tokens.access_token;
          }
        }
        localStorage.setItem(STORAGE_KEYS.MCP_SERVERS, JSON.stringify(servers));
      }
    } catch (err) {
      console.warn("Failed to sync token to mcp-servers:", err);
    }
  }
  return tokens;
}
