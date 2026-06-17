export function buildProfileContactConfirmationText(params: {
  firstName: string;
  restaurantName: string;
}): string {
  const name = params.firstName.trim() || "du";
  const restaurant = params.restaurantName.trim() || "uns";

  return `Hallo ${name},

vielen Dank für Deine Nachricht. Wir haben sie erhalten und melden uns bei Dir.

${restaurant}`;
}

export function buildProfileContactConfirmationEmailSubject(
  restaurantName: string,
): string {
  const restaurant = restaurantName.trim() || "Restaurant";
  return `Deine Nachricht bei ${restaurant}`;
}
