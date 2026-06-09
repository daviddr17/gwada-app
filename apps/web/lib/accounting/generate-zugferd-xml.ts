import "server-only";

import type { AccountingPdfRenderContext } from "@/lib/accounting/accounting-document-design";
import type {
  AccountingInvoiceRow,
  AccountingLineItem,
  AccountingQuotationRow,
  AccountingRecipientSnapshot,
  AccountingTotals,
} from "@/lib/types/accounting";

type SalesDocumentRow = AccountingInvoiceRow | AccountingQuotationRow;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function formatDateYmd(isoDate: string): string {
  return isoDate.slice(0, 10);
}

/** Minimales EN16931-CII-XML (Comfort) für Gwada-Rechnungen/Angebote. */
export function generateGwadaZugferdXml(
  row: SalesDocumentRow,
  kind: "invoice" | "quotation",
  company: AccountingPdfRenderContext["company"],
): Buffer {
  const recipient = row.recipient_snapshot as AccountingRecipientSnapshot;
  const totals = row.totals as AccountingTotals;
  const lines = (row.line_items ?? []) as AccountingLineItem[];
  const docNumber = row.voucher_number ?? row.id.slice(0, 8);
  const typeCode = kind === "invoice" ? "380" : "330";
  const docLabel = kind === "invoice" ? "Rechnung" : "Angebot";

  const sellerLines = [
    `<ram:Name>${escapeXml(company.name)}</ram:Name>`,
    ...company.lines.map(
      (line) =>
        `<ram:LineOne>${escapeXml(line)}</ram:LineOne>`,
    ),
  ].join("");

  const buyerLines = [
    `<ram:Name>${escapeXml(recipient.name ?? "Empfänger")}</ram:Name>`,
    recipient.street
      ? `<ram:LineOne>${escapeXml(recipient.street)}</ram:LineOne>`
      : "",
    recipient.city || recipient.zip
      ? `<ram:CityName>${escapeXml([recipient.zip, recipient.city].filter(Boolean).join(" "))}</ram:CityName>`
      : "",
    recipient.countryCode
      ? `<ram:CountryID>${escapeXml(recipient.countryCode)}</ram:CountryID>`
      : "",
  ].join("");

  const lineItemsXml = lines
    .filter((l) => l.type !== "text" || l.name.trim())
    .map((line, index) => {
      const net = line.lineAmount;
      const tax = net * (line.taxRatePercent / 100);
      return `
      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>
          <ram:LineID>${index + 1}</ram:LineID>
        </ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:Name>${escapeXml(line.name)}</ram:Name>
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:NetPriceProductTradePrice>
            <ram:ChargeAmount>${formatAmount(line.unitPrice)}</ram:ChargeAmount>
          </ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="C62">${line.quantity}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>S</ram:CategoryCode>
            <ram:RateApplicablePercent>${line.taxRatePercent}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount>${formatAmount(net)}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(docNumber)}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDateYmd(row.voucher_date).replace(/-/g, "")}</udt:DateTimeString>
    </ram:IssueDateTime>
    <ram:IncludedNote>
      <ram:Content>${escapeXml(docLabel)}</ram:Content>
    </ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    ${lineItemsXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>${sellerLines}</ram:SellerTradeParty>
      <ram:BuyerTradeParty>${buyerLines}</ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${escapeXml(row.currency)}</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatAmount(totals.totalNet ?? 0)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${formatAmount(totals.totalNet ?? 0)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${escapeXml(row.currency)}">${formatAmount(totals.totalTax ?? 0)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatAmount(totals.totalGross ?? 0)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${formatAmount(totals.totalGross ?? 0)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return Buffer.from(xml.trim(), "utf-8");
}

export function zugferdXmlFilename(
  row: SalesDocumentRow,
  kind: "invoice" | "quotation",
): string {
  const prefix = kind === "invoice" ? "Rechnung" : "Angebot";
  const number = row.voucher_number ?? row.id.slice(0, 8);
  return `${prefix}-${number}.xml`;
}
