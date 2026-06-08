import Papa from "papaparse";
import yaml from "js-yaml";

const DEFAULT_MESSAGES = {
  csvParseError: ({ row, message }) => `CSV parse error on row ${row}: ${message}`,
  yamlExpectedList: "YAML should contain a list of records.",
  unsupportedFormat: (format) => `Unsupported format: ${format}`
};

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getValueByAliases(record, aliases) {
  const normalized = Object.entries(record || {}).reduce((acc, [k, v]) => {
    acc[normalizeKey(k)] = v;
    return acc;
  }, {});

  for (const alias of aliases) {
    const value = normalized[normalizeKey(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

export function mapRawRecord(rawRecord) {
  return {
    bronapplicatie: getValueByAliases(rawRecord, [
      "Bronapplicatie",
      "Source",
      "Source Application",
      "From"
    ]),
    doelapplicatie: getValueByAliases(rawRecord, [
      "Doelapplicatie",
      "Target",
      "Target Application",
      "To"
    ]),
    bronHosting: getValueByAliases(rawRecord, [
      "bronHosting",
      "Brontype",
      "Bron type",
      "bronapplicatie Saas of on premises",
      "Bronapplicatie Saas/on premises",
      "Source type",
      "Source SaaS/On premises",
      "Source hosting"
    ]),
    bronOpmerking: getValueByAliases(rawRecord, [
      "Bronopmerking",
      "Bron opmerking",
      "Source comment",
      "Source remark",
      "Source notes"
    ]),
    doelHosting: getValueByAliases(rawRecord, [
      "doelHosting",
      "Doeltype",
      "Doel type",
      "Doelapplicatie Saas/on premises",
      "doelapplicatie Saas of on premises",
      "Target type",
      "Target SaaS/On premises",
      "Target hosting"
    ]),
    doelOpmerking: getValueByAliases(rawRecord, [
      "Doelopmerking",
      "Doel opmerking",
      "Target comment",
      "Target remark",
      "Target notes"
    ]),
    koppelingSoort: getValueByAliases(rawRecord, [
      "Koppelingsoort",
      "Soort koppeling",
      "Type",
      "Connection type",
      "Integration type"
    ]),
    integratieOplossing: getValueByAliases(rawRecord, [
      "Integration solution",
      "Integratie oplossing",
      "Integratieoplossing",
      "Integration platform",
      "Middleware"
    ])
  };
}

export function parseCsv(text, messages = DEFAULT_MESSAGES) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (result.errors?.length) {
    const first = result.errors[0];
    throw new Error(
      messages.csvParseError({
        row: first.row ?? "?",
        message: first.message
      })
    );
  }

  return result.data.map(mapRawRecord);
}

export function parseYaml(text, messages = DEFAULT_MESSAGES) {
  const data = yaml.load(text);

  if (!Array.isArray(data)) {
    throw new Error(messages.yamlExpectedList);
  }

  return data.map(mapRawRecord);
}

export function parseByFormat(text, format, messages = DEFAULT_MESSAGES) {
  if (format === "csv") {
    return parseCsv(text, messages);
  }

  if (format === "yaml") {
    return parseYaml(text, messages);
  }

  throw new Error(messages.unsupportedFormat(format));
}
