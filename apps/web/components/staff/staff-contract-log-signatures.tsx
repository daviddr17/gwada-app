"use client";

import type { StaffContractLogDetails } from "@/lib/types/staff";

function signatureImageUrl(params: {
  restaurantId: string;
  contractId: string;
  role: "employer" | "employee";
  storagePath?: string | null;
}): string {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    contractId: params.contractId,
    role: params.role,
  });
  if (params.storagePath?.trim()) {
    q.set("storagePath", params.storagePath.trim());
  }
  return `/api/staff/contracts/signature-image?${q.toString()}`;
}

type StaffContractLogSignaturesProps = {
  restaurantId: string;
  contractId: string;
  details: StaffContractLogDetails;
};

export function StaffContractLogSignatures({
  restaurantId,
  contractId,
  details,
}: StaffContractLogSignaturesProps) {
  const employer = details.signatureEmployer;
  const employee = details.signatureEmployee;

  if (!employer?.signature_storage_path && !employee?.signature_storage_path) {
    return null;
  }

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {employer?.signature_storage_path ? (
        <div className="rounded-lg border border-border/30 bg-background p-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Arbeitgeber
          </p>
          <p className="text-xs text-muted-foreground">{employer.signer_name}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureImageUrl({
              restaurantId,
              contractId,
              role: "employer",
              storagePath: employer.signature_storage_path,
            })}
            alt={`Unterschrift ${employer.signer_name}`}
            className="mt-1 h-12 w-full object-contain object-left"
          />
        </div>
      ) : null}
      {employee?.signature_storage_path ? (
        <div className="rounded-lg border border-border/30 bg-background p-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Arbeitnehmer
          </p>
          <p className="text-xs text-muted-foreground">{employee.signer_name}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureImageUrl({
              restaurantId,
              contractId,
              role: "employee",
              storagePath: employee.signature_storage_path,
            })}
            alt={`Unterschrift ${employee.signer_name}`}
            className="mt-1 h-12 w-full object-contain object-left"
          />
        </div>
      ) : null}
    </div>
  );
}
