import { describe, expect, it } from "vitest";
import { cascadeClosure, databaseNameFromUrl } from "./guards";

describe("dev database guards", () => {
  it("follows foreign keys transitively (what CASCADE truncates)", () => {
    const edges = [
      { child: "learning.books", parent: "learning.series" },
      { child: "learning.articles", parent: "learning.books" },
      { child: "learning.classes", parent: "identity.users" },
      { child: "learning.enrollments", parent: "learning.classes" },
    ];
    expect(cascadeClosure(["identity.users"], edges)).toEqual([
      "identity.users",
      "learning.classes",
      "learning.enrollments",
    ]);
    expect(cascadeClosure(["learning.series"], edges)).toEqual(["learning.articles", "learning.books", "learning.series"]);
    expect(cascadeClosure(["finance_mlm.audit_events"], edges)).toEqual(["finance_mlm.audit_events"]);
  });

  it("handles FK cycles", () => {
    const edges = [
      { child: "a.x", parent: "a.y" },
      { child: "a.y", parent: "a.x" },
    ];
    expect(cascadeClosure(["a.x"], edges)).toEqual(["a.x", "a.y"]);
  });

  it("reads the database name for the type-to-confirm guard", () => {
    expect(databaseNameFromUrl("postgresql://postgres:postgres@127.0.0.1:5432/tutor_local?schema=public")).toBe("tutor_local");
    expect(databaseNameFromUrl("postgresql://h/")).toBeNull();
    expect(databaseNameFromUrl(undefined)).toBeNull();
    expect(databaseNameFromUrl("not a url")).toBeNull();
  });
});
