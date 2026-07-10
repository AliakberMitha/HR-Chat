import * as duckdb from "@duckdb/duckdb-wasm";
import type { PersonProfile } from "./profiles";

// Columns never exposed to SQL (and therefore never visible to Gemini or in
// query results) -- keeps direct contact PII out of anything the model sees.
const PRIVATE_SOURCE_COLUMNS = new Set(["Mobile", "Email"]);
const ASSIGNMENT_SOURCE_COLUMNS = new Set(["Umoor", "Team", "Level"]);

const NUMERIC_SOURCE_COLUMNS = new Set([
  "Age",
  "360 degree feedback data (Leadership)",
  "360 degree feedback data (Behaviour)",
  "360 degree feedback data (Teamwork)",
  "360 degree feedback data (Dedication)",
]);

// Known Excel column -> clean, quote-free SQL identifier. Anything not
// listed here falls back to a generic slugified name so an unfamiliar
// dataset (different columns) still loads instead of silently dropping data.
const KNOWN_COLUMN_MAP: Record<string, string> = {
  ITSID: "itsid",
  Name: "name",
  Gender: "gender",
  Jamiat: "jamiat",
  Jamaat: "jamaat",
  Age: "age",
  Occupation: "occupation",
  "Category & Activities": "category_activities",
  "Skills & SubSkills": "skills_subskills",
  Badges: "badges",
  Degrees: "degrees",
  "Dini Qualification": "dini_qualification",
  Hunars: "hunars",
  Occupation2: "occupation2",
  "Occupation Sub 1": "occupation_sub_1",
  Designation: "designation",
  Hobbies: "hobbies",
  "360 degree feedback data (Leadership)": "leadership_score",
  "360 degree feedback data (Behaviour)": "behaviour_score",
  "360 degree feedback data (Teamwork)": "teamwork_score",
  "360 degree feedback data (Dedication)": "dedication_score",
  "LMS courses done by individual": "lms_courses",
};

function slugify(col: string): string {
  return col.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "col";
}

function sqlColumnName(col: string): string {
  return KNOWN_COLUMN_MAP[col] ?? slugify(col);
}

function queryableSourceColumns(columns: string[]): string[] {
  return columns.filter((c) => !ASSIGNMENT_SOURCE_COLUMNS.has(c) && !PRIVATE_SOURCE_COLUMNS.has(c));
}

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let dbInitPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const bundles = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(bundles);
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }),
      );
      const worker = new Worker(workerUrl);
      const logger = new duckdb.VoidLogger();
      const instance = new duckdb.AsyncDuckDB(logger, worker);
      await instance.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);
      db = instance;
      return instance;
    })();
  }
  return dbInitPromise;
}

export async function loadProfilesIntoSql(profiles: PersonProfile[], columns: string[]): Promise<void> {
  const database = await getDb();
  if (conn) {
    await conn.close();
    conn = null;
  }
  conn = await database.connect();

  const peopleSourceCols = queryableSourceColumns(columns);
  const peopleRows = profiles.map((p) => {
    const row: Record<string, string> = {};
    for (const c of peopleSourceCols) row[sqlColumnName(c)] = p.fields[c] ?? "";
    return row;
  });

  const assignmentRows: { itsid: string; umoor: string; team: string; level: string }[] = [];
  for (const p of profiles) {
    const itsid = p.fields.ITSID ?? "";
    for (const a of p.assignments) {
      assignmentRows.push({ itsid, umoor: a.Umoor, team: a.Team, level: a.Level });
    }
  }

  await database.registerFileText("people.json", JSON.stringify(peopleRows));
  await database.registerFileText("assignments.json", JSON.stringify(assignmentRows));

  await conn.query(`DROP TABLE IF EXISTS people_raw`);
  await conn.query(`CREATE TABLE people_raw AS SELECT * FROM read_json_auto('people.json')`);

  const numericCols = peopleSourceCols.filter((c) => NUMERIC_SOURCE_COLUMNS.has(c)).map(sqlColumnName);
  // Free-text location fields are entered inconsistently (e.g. "Pakistan" vs
  // "PAKISTAN") -- normalize case once at load time so every GROUP BY/filter
  // downstream treats them as the same value without relying on generated
  // SQL to remember to do so.
  const caseNormalizeCols = ["jamiat", "jamaat"].filter((c) => peopleSourceCols.map(sqlColumnName).includes(c));

  const overriddenCols = new Set([...numericCols, ...caseNormalizeCols]);
  const excludeClause = overriddenCols.size ? ` EXCLUDE (${[...overriddenCols].join(", ")})` : "";
  const castParts = [
    ...numericCols.map((c) => `TRY_CAST(NULLIF(${c}, '') AS DOUBLE) AS ${c}`),
    ...caseNormalizeCols.map((c) => `NULLIF(UPPER(TRIM(${c})), '') AS ${c}`),
  ];
  const castClause = castParts.join(", ");

  await conn.query(`DROP TABLE IF EXISTS people`);
  await conn.query(
    `CREATE TABLE people AS SELECT *${excludeClause}${castClause ? ", " + castClause : ""} FROM people_raw`,
  );
  await conn.query(`DROP TABLE IF EXISTS people_raw`);

  await conn.query(`DROP TABLE IF EXISTS assignments`);
  await conn.query(`CREATE TABLE assignments AS SELECT * FROM read_json_auto('assignments.json')`);
}

export function getSqlSchemaDescription(columns: string[]): string {
  const peopleSourceCols = queryableSourceColumns(columns);
  const lines = peopleSourceCols.map((c) => {
    const sqlCol = sqlColumnName(c);
    const type = NUMERIC_SOURCE_COLUMNS.has(c) ? "DOUBLE (nullable -- NULL means not recorded)" : "VARCHAR";
    return `    ${sqlCol} ${type}  -- from Excel column "${c}"`;
  });
  return `TABLE people (one row per person):
${lines.join("\n")}

TABLE assignments (one row per person-role assignment -- a person can hold several roles, so JOIN and
use COUNT(DISTINCT people.itsid) rather than COUNT(*) when counting PEOPLE through this table):
    itsid VARCHAR   -- join key, references people.itsid
    umoor VARCHAR
    team VARCHAR
    level VARCHAR`;
}

export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

const READ_ONLY_PREFIX = /^\s*(select|with)\b/i;

// Gemini is instructed to LIMIT "find a person" style queries to keep its own
// conversational answer readable. That's fine for the chat reply, but the
// Show Details table / Excel export should reflect every matching row --
// strip a trailing LIMIT (and OFFSET) so the full result set is available
// for display/export, independent of what's sent back to the model.
export function stripTrailingLimit(sql: string): string {
  return sql.trim().replace(/\s+limit\s+\d+(\s+offset\s+\d+)?\s*$/i, "");
}

export async function runSql(sql: string): Promise<SqlQueryResult> {
  if (!conn) throw new Error("Dataset not loaded yet.");
  if (!READ_ONLY_PREFIX.test(sql)) {
    throw new Error("Only SELECT / WITH queries are allowed.");
  }
  const table = await conn.query(sql);
  const rows = table.toArray().map((row) => {
    const obj = typeof (row as { toJSON?: () => Record<string, unknown> }).toJSON === "function"
      ? (row as { toJSON: () => Record<string, unknown> }).toJSON()
      : ({ ...(row as object) } as Record<string, unknown>);
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === "bigint") obj[k] = Number(obj[k]);
    }
    return obj;
  });
  return { columns: table.schema.fields.map((f) => f.name), rows };
}

export async function getDistinctUmoors(): Promise<string[]> {
  if (!conn) return [];
  const result = await runSql(
    "SELECT DISTINCT umoor FROM assignments WHERE umoor IS NOT NULL AND umoor != '' ORDER BY umoor",
  );
  return result.rows.map((r) => String(r.umoor)).filter(Boolean);
}
