import { describe, expect, it } from "vitest";
import { nextSort, pageCount, parseTableState, serializeTableState, toApiQuery } from "./tableState";

const config = {
  defaultPageSize: 20,
  defaultSort: { key: "createdAt", dir: "desc" as const },
  sortKeys: ["createdAt", "amount"],
  filterKeys: ["status"],
  defaultFilters: { status: "PENDING" },
};

describe("table state", () => {
  it("parses with defaults and validation", () => {
    expect(parseTableState(new URLSearchParams(""), config)).toEqual({
      page: 1,
      pageSize: 20,
      sort: { key: "createdAt", dir: "desc" },
      q: "",
      filters: { status: "PENDING" },
    });
    const state = parseTableState(new URLSearchParams("page=3&size=50&sort=amount&q=som&status=APPROVED"), config);
    expect(state).toEqual({ page: 3, pageSize: 50, sort: { key: "amount", dir: "asc" }, q: "som", filters: { status: "APPROVED" } });
    const bad = parseTableState(new URLSearchParams("page=-2&size=7&sort=-evil;drop"), config);
    expect(bad.page).toBe(1);
    expect(bad.pageSize).toBe(20);
    expect(bad.sort).toEqual({ key: "createdAt", dir: "desc" });
  });

  it("serialises without defaults and keeps foreign params", () => {
    const params = serializeTableState(
      { page: 1, pageSize: 20, sort: { key: "createdAt", dir: "desc" }, q: "", filters: { status: "PENDING" } },
      config,
      "tab=lines",
    );
    expect(params.toString()).toBe("tab=lines");
    const changed = serializeTableState(
      { page: 2, pageSize: 50, sort: { key: "amount", dir: "desc" }, q: "a b", filters: { status: "" } },
      config,
    );
    expect(changed.toString()).toBe("page=2&size=50&sort=-amount&q=a+b&status=");
    expect(parseTableState(changed, config).filters).toEqual({});
  });

  it("supports a prefix for a second table", () => {
    const params = serializeTableState({ page: 4, pageSize: 20, sort: null, q: "", filters: {} }, { prefix: "lines" });
    expect(params.toString()).toBe("lines_page=4");
    expect(parseTableState(params, { prefix: "lines" }).page).toBe(4);
  });

  it("cycles sort and builds API params", () => {
    expect(nextSort(null, "amount")).toEqual({ key: "amount", dir: "asc" });
    expect(nextSort({ key: "amount", dir: "asc" }, "amount")).toEqual({ key: "amount", dir: "desc" });
    expect(nextSort({ key: "amount", dir: "desc" }, "amount")).toBeNull();
    expect(toApiQuery({ page: 2, pageSize: 20, sort: { key: "amount", dir: "desc" }, q: " x ", filters: { status: "", from: "2026-01-01" } })).toEqual({
      page: 2,
      pageSize: 20,
      sort: "amount",
      order: "desc",
      q: "x",
      from: "2026-01-01",
    });
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(41, 20)).toBe(3);
  });
});
