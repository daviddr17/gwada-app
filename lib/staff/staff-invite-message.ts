export function buildStaffInviteMessage(params: {
  staffName: string;
  restaurantName: string;
  inviteUrl: string;
}): string {
  const { staffName, restaurantName, inviteUrl } = params;
  return `Hallo${staffName ? ` ${staffName}` : ""},\n\n${restaurantName} lädt dich ein, dich bei gwada zu registrieren:\n${inviteUrl}\n\nDer Link ist 14 Tage gültig.`;
}
