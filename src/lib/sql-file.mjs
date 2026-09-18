/**
 * Splits a .sql file into executable statements.
 *
 * Line comments are stripped *before* splitting on semicolons: prose in a
 * comment can contain a semicolon, and splitting first would cut a statement
 * in half and silently drop it.
 *
 * Plain JavaScript so the app and the seed script share one implementation.
 */
export function splitStatements(sql) {
  return sql
    .split("\n")
    .map((line) => {
      const comment = line.indexOf("--");
      // Only strip when the "--" is not inside a quoted string.
      if (comment === -1) return line;
      const before = line.slice(0, comment);
      const quotes = (before.match(/'/g) ?? []).length;
      return quotes % 2 === 0 ? before : line;
    })
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}
