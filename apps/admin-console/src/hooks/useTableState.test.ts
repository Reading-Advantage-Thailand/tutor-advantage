// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { TableStateConfig } from "../lib/tableState";
import { useTableState, type UseTableStateResult } from "./useTableState";

// Stand-in for next/navigation. `search` is what useSearchParams() returns, and router.replace()
// does NOT update it: the real router keeps the old params until the RSC response for the new URL
// arrives. land() is that response arriving.
const nav = vi.hoisted(() => {
  const replace = vi.fn<(href: string, options?: { scroll?: boolean }) => void>();
  return { replace, router: { replace }, search: "" };
});

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/users",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const CONFIG: TableStateConfig = { filterKeys: ["role", "status"] };

let container: HTMLDivElement;
let root: Root;
let table: UseTableStateResult;
let renders = 0;

function TableProbe(_props: { tick: number }) {
  table = useTableState(CONFIG);
  return null;
}

async function render() {
  renders += 1;
  await act(async () => {
    root.render(React.createElement(TableProbe, { tick: renders }));
  });
}

async function mount(search: string) {
  nav.search = search;
  await render();
}

/** The navigation lands: useSearchParams() now returns the new params. */
async function land(search: string) {
  nav.search = search;
  await render();
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function replacedUrls() {
  return nav.replace.mock.calls.map(([href]) => href);
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  nav.search = "";
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useTableState", () => {
  it("reset() is not undone by the search debounce while the URL is still catching up", async () => {
    await mount("q=local&status=ACTIVE");
    expect(table.searchValue).toBe("local");
    expect(table.filters).toEqual({ status: "ACTIVE" });

    await act(async () => table.reset());
    expect(table.searchValue).toBe("");
    expect(replacedUrls()).toEqual(["/users"]);
    expect(nav.replace).toHaveBeenLastCalledWith("/users", { scroll: false });

    // Slow RSC response: useSearchParams() still says q=local&status=ACTIVE when the debounce is due.
    await advance(1000);
    expect(replacedUrls().filter((href) => href.includes("status=ACTIVE"))).toEqual([]);
    expect(replacedUrls()).toEqual(["/users"]);

    await land("");
    await advance(1000);
    expect(replacedUrls()).toEqual(["/users"]);
    expect(table.searchValue).toBe("");
    expect(table.isFiltered).toBe(false);
  });

  it("typing commits q once, after the debounce, and keeps the other params", async () => {
    await mount("status=ACTIVE");

    await act(async () => table.setSearchValue("som"));
    expect(table.searchValue).toBe("som");
    await advance(299);
    expect(nav.replace).not.toHaveBeenCalled();
    await advance(1);
    expect(replacedUrls()).toEqual(["/users?status=ACTIVE&q=som"]);
    expect(nav.replace).toHaveBeenLastCalledWith("/users?status=ACTIVE&q=som", { scroll: false });

    // No second commit while it is in flight, nor once it has landed.
    await advance(1000);
    await land("status=ACTIVE&q=som");
    await advance(1000);
    expect(replacedUrls()).toEqual(["/users?status=ACTIVE&q=som"]);
    expect(table.q).toBe("som");
    expect(table.searchValue).toBe("som");
  });

  it("keeps committing what is typed while an earlier commit is still in flight", async () => {
    await mount("");

    await act(async () => table.setSearchValue("so"));
    await advance(300);
    await act(async () => table.setSearchValue("som"));
    await advance(300);
    await act(async () => table.setSearchValue(""));
    await advance(300);

    expect(replacedUrls()).toEqual(["/users?q=so", "/users?q=som"]);
    // "" equals the URL that never moved: nothing to send from here until a navigation lands.
    await land("q=som");
    await advance(300);
    expect(replacedUrls()).toEqual(["/users?q=so", "/users?q=som", "/users"]);
  });

  it("a filter picked while the q commit is in flight keeps the typed q", async () => {
    await mount("");

    await act(async () => table.setSearchValue("som"));
    await advance(300);
    expect(replacedUrls()).toEqual(["/users?q=som"]);

    // Clicked before ?q=som landed: built on the commit in flight, not on the URL that has no q yet.
    await act(async () => table.setFilter("status", "ACTIVE"));
    expect(replacedUrls()).toEqual(["/users?q=som", "/users?q=som&status=ACTIVE"]);

    await land("q=som&status=ACTIVE");
    await advance(1000);
    expect(replacedUrls()).toEqual(["/users?q=som", "/users?q=som&status=ACTIVE"]);
    expect(table.searchValue).toBe("som");
    expect(table.filters).toEqual({ status: "ACTIVE" });
  });

  it("re-applies the typed q when another navigation overtakes the q commit", async () => {
    await mount("");

    await act(async () => table.setSearchValue("som"));
    await advance(300);
    expect(replacedUrls()).toEqual(["/users?q=som"]);

    // Something else on the page navigated first (a link, a second table): ?q=som never lands.
    await land("status=ACTIVE");

    expect(table.searchValue).toBe("som");
    await advance(300);
    expect(replacedUrls()).toEqual(["/users?q=som", "/users?status=ACTIVE&q=som"]);
  });

  it("typing right after reset() does not bring the cleared filters back", async () => {
    await mount("q=local&status=ACTIVE");

    await act(async () => table.reset());
    expect(replacedUrls()).toEqual(["/users"]);

    // The reset has not landed: useSearchParams() still says q=local&status=ACTIVE.
    await act(async () => table.setSearchValue("dev"));
    await advance(300);
    expect(replacedUrls()).toEqual(["/users", "/users?q=dev"]);
    expect(nav.replace).toHaveBeenLastCalledWith("/users?q=dev", { scroll: false });

    await land("q=dev");
    await advance(1000);
    expect(replacedUrls()).toEqual(["/users", "/users?q=dev"]);
    expect(table.searchValue).toBe("dev");
    expect(table.filters).toEqual({});
  });

  it("two filters removed one after the other both stay removed", async () => {
    await mount("role=TUTOR&status=ACTIVE");

    await act(async () => table.setFilter("role", ""));
    await act(async () => table.setFilter("status", ""));
    expect(replacedUrls()).toEqual(["/users?status=ACTIVE", "/users"]);
  });

  it("header clicks add up while in flight: ascending, descending, then back to the default", async () => {
    await mount("status=ACTIVE");

    await act(async () => table.toggleSort("name"));
    await act(async () => table.toggleSort("name"));
    expect(replacedUrls()).toEqual(["/users?status=ACTIVE&sort=name", "/users?status=ACTIVE&sort=-name"]);

    // Back to where the URL still is: sent anyway, to take over from the commit in flight.
    await act(async () => table.toggleSort("name"));
    expect(replacedUrls()).toEqual(["/users?status=ACTIVE&sort=name", "/users?status=ACTIVE&sort=-name", "/users?status=ACTIVE"]);

    // Nothing is in flight any more: the next click starts from the URL again.
    await act(async () => table.toggleSort("name"));
    expect(nav.replace).toHaveBeenLastCalledWith("/users?status=ACTIVE&sort=name", { scroll: false });
  });

  it("a commit that has landed is not built on again when the same params come back", async () => {
    await mount("status=ACTIVE");

    await act(async () => table.reset());
    expect(replacedUrls()).toEqual(["/users"]);
    await land("");

    // A link back to the filtered list: same params the reset was issued from.
    await land("status=ACTIVE");
    await act(async () => table.setPage(2));
    expect(replacedUrls()).toEqual(["/users", "/users?status=ACTIVE&page=2"]);
  });

  it("does nothing when the state asked for is already in the URL", async () => {
    await mount("status=ACTIVE");

    await act(async () => table.setFilter("status", "ACTIVE"));
    await act(async () => table.setPage(1));
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("follows a URL changed from outside (back/forward) without committing", async () => {
    await mount("q=som");
    expect(table.searchValue).toBe("som");

    await land("q=nida&status=ACTIVE");
    expect(table.searchValue).toBe("nida");
    await advance(1000);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("keeps a trailing space in the box while the trimmed term goes to the URL", async () => {
    await mount("");

    // "สมชาย " with the surname still to come: the URL and the query get "สมชาย".
    await act(async () => table.setSearchValue("som "));
    await advance(300);
    expect(replacedUrls()).toEqual(["/users?q=som"]);
    expect(table.searchValue).toBe("som ");

    // The navigation lands with the trimmed term: the box is not rewritten.
    await land("q=som");
    expect(table.q).toBe("som");
    expect(table.apiQuery.q).toBe("som");
    expect(table.searchValue).toBe("som ");
    await advance(1000);
    expect(replacedUrls()).toEqual(["/users?q=som"]);

    await act(async () => table.setSearchValue("som c"));
    await advance(300);
    expect(replacedUrls()).toEqual(["/users?q=som", "/users?q=som+c"]);
    await land("q=som+c");
    expect(table.searchValue).toBe("som c");
  });

  it("keeps what was typed after the space when the trimmed commit lands", async () => {
    await mount("");

    await act(async () => table.setSearchValue("som "));
    await advance(300);
    expect(replacedUrls()).toEqual(["/users?q=som"]);

    // Typed on while ?q=som was still on its way.
    await act(async () => table.setSearchValue("som ch"));
    await land("q=som");
    expect(table.searchValue).toBe("som ch");

    await advance(300);
    expect(replacedUrls()).toEqual(["/users?q=som", "/users?q=som+ch"]);
  });

  it("a space added to a term that is already in the URL commits nothing and stays in the box", async () => {
    await mount("q=som");

    await act(async () => table.setSearchValue("som "));
    await advance(1000);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(table.searchValue).toBe("som ");

    // Only spaces: nothing to search for, nothing sent.
    await land("");
    await act(async () => table.setSearchValue("  "));
    await advance(1000);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(table.searchValue).toBe("  ");
  });

  it("setQuery() keeps the text as given in the box and sends it trimmed", async () => {
    await mount("status=ACTIVE");

    await act(async () => table.setQuery("som "));
    expect(replacedUrls()).toEqual(["/users?status=ACTIVE&q=som"]);
    expect(table.searchValue).toBe("som ");

    await land("status=ACTIVE&q=som");
    await advance(1000);
    expect(replacedUrls()).toEqual(["/users?status=ACTIVE&q=som"]);
    expect(table.searchValue).toBe("som ");
  });
});
