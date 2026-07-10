import { buildProfiles, type PersonProfile } from "./profiles";

let profiles: PersonProfile[] = [];
let columns: string[] = [];

export function setDataset(cols: string[], rawRows: Record<string, string>[]) {
  columns = cols;
  profiles = buildProfiles(rawRows);
}

export function getColumns() {
  return columns;
}

export function getProfileCount() {
  return profiles.length;
}

export function getAllProfiles() {
  return profiles;
}

export function getProfilesForJamaat(jamaat: string): PersonProfile[] {
  const target = jamaat.trim().toLowerCase();
  return profiles.filter((p) => (p.fields.Jamaat ?? "").trim().toLowerCase() === target);
}

export function isLoaded() {
  return profiles.length > 0;
}

export function clearDataset() {
  profiles = [];
  columns = [];
}
