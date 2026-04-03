export type OrderEmailLanguage = "de" | "en";
export type OrderEmailCompanyKey = "equinix_germany_gmbh" | "equinix_germany_enterprises_gmbh";

export type OrderEmailItem = {
  articleName: string;
  productName: string;
  productNumber: string;
  supplierProductNumber: string;
  quantity: number;
};

export type OrderEmailPayload = {
  orderNumber: string;
  items: OrderEmailItem[];
};

export const orderEmailCompanies: Record<
  OrderEmailCompanyKey,
  { label: string; lines: [string, string, string] }
> = {
  equinix_germany_gmbh: {
    label: "Equinix Germany GmbH",
    lines: ["Equinix Germany GmbH", "Rebstoeckerstr. 33", "60326, Frankfurt am Main"]
  },
  equinix_germany_enterprises_gmbh: {
    label: "Equinix (Germany) Enterprises GmbH",
    lines: ["Equinix (Germany) Enterprises GmbH", "Rebstoeckerstr. 33", "60326, Frankfurt am Main"]
  }
};

function formatSubjectDate(value: Date, language: OrderEmailLanguage) {
  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(value);
}

export function buildOrderEmail(
  order: OrderEmailPayload,
  options: {
    language: OrderEmailLanguage;
    company: OrderEmailCompanyKey;
    currentDate: Date;
  }
) {
  const { language, company, currentDate } = options;
  const companyAddress = orderEmailCompanies[company];
  const subjectDate = formatSubjectDate(currentDate, language);
  const subject = language === "de" ? `Angebots Anfrage - ${subjectDate}` : `Quote Request - ${subjectDate}`;
  const getDisplayProductNumber = (item: OrderEmailItem) => item.supplierProductNumber || item.productNumber || "-";

  const lines =
    language === "de"
      ? [
          "Sehr geehrte Damen und Herren,",
          "ich benoetige bitte ein Angebot ueber die folgenden Artikel.",
          "",
          "Artikel:",
          "",
          ...order.items.flatMap((item, index) => [
            `${index + 1}. ${item.productName || item.articleName}`,
            `   Produktnr.: ${getDisplayProductNumber(item)}`,
            `   Menge: ${item.quantity}`,
            ""
          ]),
          "Zu richten ist das Angebot bitte an die folgende Firmen Entitaet:",
          ...companyAddress.lines,
          "",
          "Mit freundlichen Gruessen."
        ]
      : [
          "Dear Sir or Madam,",
          "I kindly request a quotation for the following items.",
          "",
          "Items:",
          "",
          ...order.items.flatMap((item, index) => [
            `${index + 1}. ${item.productName || item.articleName}`,
            `   Product no.: ${getDisplayProductNumber(item)}`,
            `   Qty: ${item.quantity}`,
            ""
          ]),
          "Please address the quotation to the following company entity:",
          ...companyAddress.lines,
          "",
          "Kind regards."
        ];

  return {
    subject,
    body: lines.join("\n")
  };
}
