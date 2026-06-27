import type {
  ComplianceChecklistItem,
  ComplianceCategory,
  ComplianceDeviceType,
  ComplianceFrequency,
  ComplianceRecordValues,
} from "@/lib/types/compliance";

export function newComplianceItemId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyComplianceRecordValues(
  items: ComplianceChecklistItem[],
): ComplianceRecordValues {
  const values: ComplianceRecordValues = {};
  for (const item of items) {
    values[item.id] = {
      value:
        item.fieldType === "boolean"
          ? false
          : item.fieldType === "temperature" || item.fieldType === "number"
            ? null
            : "",
      withinLimits: null,
    };
  }
  return values;
}

export function evaluateComplianceRecordValues(
  items: ComplianceChecklistItem[],
  values: ComplianceRecordValues,
): { hasDeviation: boolean; normalized: ComplianceRecordValues } {
  const normalized: ComplianceRecordValues = { ...values };
  let hasDeviation = false;

  for (const item of items) {
    const entry = normalized[item.id];
    if (!entry) {
      if (item.required !== false) {
        hasDeviation = true;
      }
      continue;
    }

    if (item.fieldType === "temperature" || item.fieldType === "number") {
      const num =
        typeof entry.value === "number"
          ? entry.value
          : Number.parseFloat(String(entry.value ?? "").replace(",", "."));
      if (Number.isNaN(num)) {
        entry.withinLimits = item.required === false ? true : false;
        if (item.required !== false) hasDeviation = true;
        normalized[item.id] = entry;
        continue;
      }
      entry.value = num;
      let within = true;
      if (item.minValue != null && num < item.minValue) within = false;
      if (item.maxValue != null && num > item.maxValue) within = false;
      entry.withinLimits = within;
      if (!within) hasDeviation = true;
    } else if (item.fieldType === "boolean") {
      entry.withinLimits = entry.value === true;
      if (entry.value !== true && item.required !== false) hasDeviation = true;
    } else if (item.fieldType === "select") {
      const ok = entry.value === "OK" || entry.value === "ok";
      entry.withinLimits = ok;
      if (!ok && item.required !== false) hasDeviation = true;
    } else {
      entry.withinLimits = Boolean(String(entry.value ?? "").trim());
      if (!entry.withinLimits && item.required !== false) hasDeviation = true;
    }

    normalized[item.id] = entry;
  }

  return { hasDeviation, normalized };
}

export function defaultComplianceDeviceTargets(deviceType: ComplianceDeviceType): {
  targetMin: number | null;
  targetMax: number | null;
} {
  switch (deviceType) {
    case "freezer":
      return { targetMin: null, targetMax: -18 };
    case "fridge":
    case "cold_room":
      return { targetMin: null, targetMax: 7 };
    default:
      return { targetMin: null, targetMax: null };
  }
}

export function buildDefaultComplianceTemplates(
  deviceIds: string[],
): Array<{
  name: string;
  description: string;
  category: ComplianceCategory;
  frequency: ComplianceFrequency;
  showOnDisplay: boolean;
  items: ComplianceChecklistItem[];
}> {
  const fridgeDevices = deviceIds.slice(0, Math.max(1, deviceIds.length));
  const temperatureItems: ComplianceChecklistItem[] =
    fridgeDevices.length > 0
      ? fridgeDevices.map((deviceId, index) => ({
          id: newComplianceItemId(),
          label: `Gerät ${index + 1}`,
          fieldType: "temperature",
          deviceId,
          maxValue: index === 0 && deviceIds.length > 1 ? -18 : 7,
          required: true,
        }))
      : [
          {
            id: newComplianceItemId(),
            label: "Kühlschrank / Kühltruhe",
            fieldType: "temperature",
            maxValue: 7,
            required: true,
          },
          {
            id: newComplianceItemId(),
            label: "Tiefkühlgerät",
            fieldType: "temperature",
            maxValue: -18,
            required: true,
          },
        ];

  return [
    {
      name: "Kühl- & Tiefkühltemperaturen",
      description:
        "Tägliche Kontrolle aller Kühl- und Tiefkühleinrichtungen — mindestens einmal pro Tag.",
      category: "temperature",
      frequency: "daily",
      showOnDisplay: true,
      items: temperatureItems,
    },
    {
      name: "Reinigung Küche (Tagesplan)",
      description:
        "Standard-Reinigungsaufgaben für Küchenbereich und Arbeitsflächen.",
      category: "cleaning",
      frequency: "daily",
      showOnDisplay: true,
      items: [
        {
          id: newComplianceItemId(),
          label: "Arbeitsflächen gereinigt",
          fieldType: "boolean",
          required: true,
        },
        {
          id: newComplianceItemId(),
          label: "Fußboden Küche gereinigt",
          fieldType: "boolean",
          required: true,
        },
        {
          id: newComplianceItemId(),
          label: "Abfallbehälter geleert / gereinigt",
          fieldType: "boolean",
          required: true,
        },
      ],
    },
    {
      name: "Warmhalten / Ausgabe",
      description: "Heißhalte-Temperaturen bei der Speisenausgabe.",
      category: "hot_hold",
      frequency: "daily",
      showOnDisplay: true,
      items: [
        {
          id: newComplianceItemId(),
          label: "Ausgabe-Temperatur (°C)",
          fieldType: "temperature",
          minValue: 65,
          required: true,
        },
      ],
    },
    {
      name: "Kerntemperatur Garen",
      description:
        "Stichprobe bei Geflügel, Hackfleisch, Fisch — pro Charge oder Batch.",
      category: "cooking",
      frequency: "ad_hoc",
      showOnDisplay: false,
      items: [
        {
          id: newComplianceItemId(),
          label: "Gericht / Charge",
          fieldType: "text",
          required: true,
        },
        {
          id: newComplianceItemId(),
          label: "Kerntemperatur (°C)",
          fieldType: "temperature",
          minValue: 72,
          required: true,
        },
      ],
    },
  ];
}
