import { envFileLoaded } from "../config/env.js";
import { createDatabasePool } from "../database/pool.js";

const knownApplicationTables = new Set([
  "academic_grades",
  "academic_terms",
  "admissions_applications",
  "attendance_records",
  "audit_logs",
  "class_meetings",
  "course_sections",
  "courses",
  "departments",
  "enrollments",
  "grade_scale",
  "permissions",
  "persons",
  "profile_correction_requests",
  "programs",
  "role_permissions",
  "roles",
  "rooms",
  "staff",
  "student_accounts",
  "student_document_requests",
  "student_documents",
  "students",
  "system_settings",
  "user_roles",
  "users",
]);

let pool;
let failure;

try {
  if (!envFileLoaded) {
    const error = new Error("Local server/.env configuration could not be loaded.");
    error.name = "ConfigurationError";
    throw error;
  }

  pool = createDatabasePool();
  const [serverRows] = await pool.query(
    "SELECT VERSION() AS server_version, DATABASE() AS database_name;",
  );
  const [tableRows] = await pool.query("SHOW TABLES;");

  const serverInfo = serverRows[0];
  if (!serverInfo) {
    throw new Error("Database baseline query returned no server information.");
  }

  const tableNames = tableRows
    .map((row) => Object.values(row)[0])
    .filter((name) => typeof name === "string")
    .sort((left, right) => left.localeCompare(right));
  const applicationTables = tableNames.filter((name) =>
    knownApplicationTables.has(name.toLowerCase()),
  );

  console.log(`Environment file loaded: ${envFileLoaded ? "yes" : "no"}`);
  console.log(`Database server version: ${serverInfo.server_version}`);
  console.log(`Active database name: ${serverInfo.database_name ?? "(none)"}`);
  console.log(
    `Current tables: ${tableNames.length > 0 ? tableNames.join(", ") : "(none)"}`,
  );
  console.log(`Database appears empty: ${tableNames.length === 0 ? "yes" : "no"}`);
  console.log(
    `Existing application tables: ${applicationTables.length > 0 ? applicationTables.join(", ") : "none"}`,
  );
  console.log(
    `Contains existing application tables: ${applicationTables.length > 0 ? "yes" : "no"}`,
  );
} catch (error) {
  failure = error;
} finally {
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      if (!failure) {
        failure = error;
      }
    }
  }
}

if (failure) {
  const name =
    typeof failure.name === "string" && /^[A-Za-z0-9_]+$/.test(failure.name)
      ? failure.name
      : "Error";
  const code =
    typeof failure.code === "string" && /^[A-Za-z0-9_]+$/.test(failure.code)
      ? failure.code
      : "unavailable";
  console.error(
    `Database baseline check failed (${name}, ${code}). Verify local database settings and network access.`,
  );
  process.exitCode = 1;
}
