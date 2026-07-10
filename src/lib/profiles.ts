// The source Excel has one row per (person x organizational-role) combination:
// a person holding multiple Umoor/Team/Level assignments appears as multiple
// rows with identical values in every other column. Flattening those into a
// single per-person profile (with assignments as a sub-list) is what makes
// "how many people..." questions answerable correctly -- counting raw rows
// over-counts anyone with more than one assignment.

export interface Assignment {
  Umoor: string;
  Team: string;
  Level: string;
}

export interface PersonProfile {
  _id: number;
  assignments: Assignment[];
  fields: Record<string, string>;
}

const ASSIGNMENT_FIELDS = new Set(["Umoor", "Team", "Level"]);

export function buildProfiles(rows: Record<string, string>[]): PersonProfile[] {
  const byId = new Map<string, PersonProfile>();
  let idCounter = 0;
  let noIdCounter = 0;

  for (const row of rows) {
    const key = row.ITSID || `__noid_${noIdCounter++}`;
    let profile = byId.get(key);
    if (!profile) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!ASSIGNMENT_FIELDS.has(k)) fields[k] = v;
      }
      profile = { _id: idCounter++, assignments: [], fields };
      byId.set(key, profile);
    }

    const assignment: Assignment = {
      Umoor: row.Umoor ?? "",
      Team: row.Team ?? "",
      Level: row.Level ?? "",
    };
    if (assignment.Umoor || assignment.Team || assignment.Level) {
      const exists = profile.assignments.some(
        (a) => a.Umoor === assignment.Umoor && a.Team === assignment.Team && a.Level === assignment.Level,
      );
      if (!exists) profile.assignments.push(assignment);
    }
  }

  return [...byId.values()];
}

export function profileAssignmentText(p: PersonProfile): string {
  return p.assignments.map((a) => [a.Umoor, a.Team, a.Level].filter(Boolean).join(" / ")).join("; ");
}
