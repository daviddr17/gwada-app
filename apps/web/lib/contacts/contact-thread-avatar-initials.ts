import {
  displayPersonInitials,
  displayRestaurantInitials,
} from "@/lib/display/display-avatar-utils";

export function contactThreadAvatarInitials(params: {
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const first = params.firstName?.trim() ?? "";
  const last = params.lastName?.trim() ?? "";
  if (first || last) {
    return displayPersonInitials(first, last);
  }
  return displayRestaurantInitials(params.displayName);
}
