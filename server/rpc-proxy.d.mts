export interface RpcProxyResponse {
  status: number;
  body: {
    jsonrpc: "2.0";
    id: number;
    result?: unknown;
    error?: { code?: number; message?: string };
  };
}

export function handleRpcRequest(method: unknown, params: unknown[], id?: unknown): Promise<RpcProxyResponse>;

/** GraphQL envelope — data present on success, errors on failure */
export interface GraphqlProxyResponse {
  status: number;
  body: {
    data?: unknown;
    errors?: { message?: string }[];
  };
}

export function handleGraphqlRequest(rawBody: string): Promise<GraphqlProxyResponse>;

export function handleQuoteRequest(rawBody: string): Promise<GraphqlProxyResponse>;

export interface ServerConfig {
  network: string;
  rpcProvider: string;
  serviceFeeAddress: string;
  serviceFeeConfigured: boolean;
  /** package ids flagged by the server-loaded spam registry */
  spamList: string[];
}

export function handleConfigRequest(): Promise<{ status: number; body: ServerConfig }>;

export function getServerConfig(): ServerConfig;
