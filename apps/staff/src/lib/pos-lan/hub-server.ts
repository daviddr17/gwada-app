import {
  POS_LAN_HEADER_PROTOCOL,
  POS_LAN_HUB_PORT,
  POS_LAN_PATHS,
  POS_LAN_PROTOCOL_VERSION,
  jsonHttpResponse,
  serializeHttpResponse,
  tryParseHttpRequest,
  type PosLanHealthResponse,
  type PosLanHubSnapshot,
  type PosLanHttpRequest,
  type PosLanHttpResponse,
} from "@gwada/pos-lan";

export type PosHubServerHandle = {
  port: number;
  stop: () => Promise<void>;
};

type HubServerDeps = {
  getHealth: () => PosLanHealthResponse | null;
  getSnapshot: () => Promise<PosLanHubSnapshot | null>;
  port?: number;
};

type TcpSocketModule = {
  createServer: (
    callback: (socket: TcpSocketConn) => void,
  ) => TcpSocketServer;
};

type TcpSocketServer = {
  listen: (
    options: { port: number; host: string; reuseAddress?: boolean },
    callback?: () => void,
  ) => void;
  close: (callback?: () => void) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

type TcpSocketConn = {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  write: (data: string | Uint8Array) => void;
  destroy: () => void;
};

function handleRequest(
  req: PosLanHttpRequest,
  deps: HubServerDeps,
): Promise<PosLanHttpResponse> {
  if (req.method === "OPTIONS") {
    return Promise.resolve({ status: 204, body: "" });
  }

  if (req.method !== "GET") {
    return Promise.resolve(
      jsonHttpResponse(405, { error: "method_not_allowed" }),
    );
  }

  if (req.path === POS_LAN_PATHS.health) {
    const health = deps.getHealth();
    if (!health) {
      return Promise.resolve(
        jsonHttpResponse(503, { error: "hub_not_ready" }),
      );
    }
    return Promise.resolve(
      jsonHttpResponse(200, health, {
        [POS_LAN_HEADER_PROTOCOL]: String(POS_LAN_PROTOCOL_VERSION),
      }),
    );
  }

  if (req.path === POS_LAN_PATHS.snapshot) {
    return deps.getSnapshot().then((snapshot) => {
      if (!snapshot) {
        return jsonHttpResponse(503, { error: "hub_not_ready" });
      }
      return jsonHttpResponse(200, snapshot, {
        [POS_LAN_HEADER_PROTOCOL]: String(POS_LAN_PROTOCOL_VERSION),
      });
    });
  }

  return Promise.resolve(jsonHttpResponse(404, { error: "not_found" }));
}

/**
 * Startet den lokalen HTTP-Server der iPad-Kasse.
 * Benötigt `react-native-tcp-socket` (Dev-Build / TestFlight).
 */
export async function startPosHubServer(
  deps: HubServerDeps,
): Promise<PosHubServerHandle> {
  let TcpSocket: TcpSocketModule;
  try {
    TcpSocket = require("react-native-tcp-socket") as TcpSocketModule;
  } catch {
    throw new Error(
      "Lokaler Kassen-Server benötigt einen Dev-Build (react-native-tcp-socket).",
    );
  }

  const port = deps.port ?? POS_LAN_HUB_PORT;

  const server = TcpSocket.createServer((socket) => {
    let buffer = "";

    socket.on("data", (chunk: unknown) => {
      if (typeof chunk === "string") {
        buffer += chunk;
      } else if (chunk instanceof Uint8Array) {
        buffer += new TextDecoder().decode(chunk);
      } else {
        buffer += String(chunk);
      }

      const parsed = tryParseHttpRequest(buffer);
      if (!parsed) return;

      buffer = buffer.slice(parsed.consumed);

      void handleRequest(parsed.request, deps)
        .then((response) => {
          socket.write(serializeHttpResponse(response));
          socket.destroy();
        })
        .catch(() => {
          socket.write(
            serializeHttpResponse(
              jsonHttpResponse(500, { error: "hub_internal_error" }),
            ),
          );
          socket.destroy();
        });
    });

    socket.on("error", () => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (err: unknown) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    server.on("error", onError);
    try {
      server.listen({ port, host: "0.0.0.0", reuseAddress: true }, () => {
        resolve();
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });

  return {
    port,
    stop: () =>
      new Promise((resolve) => {
        try {
          server.close(() => resolve());
        } catch {
          resolve();
        }
      }),
  };
}
