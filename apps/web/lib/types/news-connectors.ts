import type { NewsPlatform } from "@/lib/constants/news-platforms";

export type NewsConnectorCapabilitiesPublic = {
  canReadFeed: boolean;
  canCreatePost: boolean;
  canUpdatePost: boolean;
  canDeletePost: boolean;
  canReadInsights: boolean;
  supportsNativeScheduling: boolean;
  supportsVideo: boolean;
  maxMediaCount: number;
};

export type NewsConnectorPublicInfo = {
  key: NewsPlatform;
  displayName: string;
  connected: boolean;
  capabilities: NewsConnectorCapabilitiesPublic;
  externalEditBaseUrl: string | null;
};
