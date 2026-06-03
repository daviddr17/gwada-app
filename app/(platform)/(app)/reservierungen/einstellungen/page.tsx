import { ReservationSettingsForm } from "@/components/reservations/reservation-settings-form";
import { ReviewRequestSettingsCard } from "@/components/reservations/review-request-settings-card";

export default function ReservierungenEinstellungenPage() {
  return (
    <div className="space-y-6 pb-4">
      <ReservationSettingsForm />
      <ReviewRequestSettingsCard />
    </div>
  );
}
