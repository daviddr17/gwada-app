import type { EmployeeRole } from "@/lib/types/employee-role";

export type SuperadminUserMembership = {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  role: EmployeeRole | string;
  isActive: boolean;
  hiredAt: string | null;
};

export type SuperadminUserProfileDetail = {
  profileId: string;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  nickname: string | null;
  phone: string | null;
  locale: string | null;
  birthDate: string | null;
  addressLine1: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastSignInAt: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
  isPlatformSuperadmin: boolean;
  avatarUrl: string | null;
  coverUrl: string | null;
  memberships: SuperadminUserMembership[];
};

export type SuperadminRestaurantTeamMember = {
  profileId: string;
  displayName: string;
  email: string | null;
  role: EmployeeRole | string;
  isActive: boolean;
};

export type SuperadminRestaurantProfileDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  socialHandle: string | null;
  timezone: string;
  isPublished: boolean;
  brandAccentHex: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  vatNumber: string | null;
  legalName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  ownerProfileId: string | null;
  ownerEmail: string | null;
  ownerDisplayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  planId: string;
  planStatus: string;
  planSource: string;
  planInterval: string;
  hasPosAddon: boolean;
  team: SuperadminRestaurantTeamMember[];
  employeeCount: number;
};
