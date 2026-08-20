export type RestaurantBillingInvoiceDto = {
  id: string;
  number: string | null;
  status: string;
  billingReason: string | null;
  currency: string;
  amountDue: number;
  amountPaid: number;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  createdAt: string;
};
