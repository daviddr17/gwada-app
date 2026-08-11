export type PermissionUnlockPayload = {
  id: string;
  permissionKeys: string[];
  permissionLabels: string[];
  positionName: string | null;
  grantedAt: string;
};
