import Papa from "papaparse";
import yaml from "js-yaml";

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
      "bronapplicatie Saas of on premises",
      "Bronapplicatie Saas/on premises",
      "Source SaaS/On premises",
      "Source hosting"
    ]),
    doelHosting: getValueByAliases(rawRecord, [
      "Doelapplicatie Saas/on premises",
      "doelapplicatie Saas of on premises",
      "Target SaaS/On premises",
      "Target hosting"
    ]),
    koppelingSoort: getValueByAliases(rawRecord, [
      "Soort koppeling",
      "Type",
      "Connection type",
      "Integration type"
    ])
  };
}

export function parseCsv(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (result.errors?.length) {
    const first = result.errors[0];
    throw new Error(`CSV parse error on row ${first.row ?? "?"}: ${first.message}`);
  }

  return result.data.map(mapRawRecord);
}

export function parseYaml(text) {
  const data = yaml.load(text);

  if (!Array.isArray(data)) {
    throw new Error("YAML should contain a list of records.");
  }

  return data.map(mapRawRecord);
}

export function parseByFormat(text, format) {
  if (format === "csv") {
    return parseCsv(text);
  }

  if (format === "yaml") {
    return parseYaml(text);
  }

  throw new Error(`Unsupported format: ${format}`);
}
