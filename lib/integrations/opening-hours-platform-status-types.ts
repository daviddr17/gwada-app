export type HoursPlatformSyncStatus =
  | "in_sync"
  | "out_of_sync"
  | "unavailable"
  | "not_applicable";

export type HoursPlatformSyncCheck = {
  status: HoursPlatformSyncStatus;
  message: string;
};

export type OpeningHoursPlatformStatusPayload = {
  ok: true;
  checkedAt: string;
  google: {
    connected: boolean;
    regular: HoursPlatformSyncCheck | null;
    kitchen: HoursPlatformSyncCheck | null;
    exceptions: HoursPlatformSyncCheck | null;
  };
  facebook: {
    connected: boolean;
    regular: HoursPlatformSyncCheck | null;
  };
};
