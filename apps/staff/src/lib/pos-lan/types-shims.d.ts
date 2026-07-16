declare module "expo-zeroconf" {
  export type ZeroconfService = {
    name?: string;
    host?: string;
    addresses?: string[];
    port?: number;
    txt?: Record<string, string>;
  };

  export function scan(
    type: string,
    opts?: { timeoutMs?: number },
  ): Promise<ZeroconfService[]>;

  export function publishService(opts: {
    name: string;
    type: string;
    port: number;
    txt?: Record<string, string>;
  }): Promise<{ unpublish: () => void }>;
}

declare module "react-native-tcp-socket" {
  type Socket = {
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    write: (data: string | Uint8Array) => void;
    destroy: () => void;
  };

  type Server = {
    listen: (
      options: { port: number; host: string; reuseAddress?: boolean },
      callback?: () => void,
    ) => void;
    close: (callback?: () => void) => void;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
  };

  const TcpSocket: {
    createServer: (callback: (socket: Socket) => void) => Server;
  };

  export default TcpSocket;
}
