// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

type ThemeModule = typeof import("./ThemeProvider");
type ThemeApi = ReturnType<ThemeModule["useTheme"]>;

let container: HTMLDivElement;
let root: Root | null = null;
let api: ThemeApi | null = null;

async function loadModule(): Promise<ThemeModule> {
  vi.resetModules();
  return import("./ThemeProvider");
}

function tree(mod: ThemeModule) {
  function Probe() {
    api = mod.useTheme();
    return React.createElement("span", { "data-theme": api.resolvedTheme }, api.theme);
  }
  return React.createElement(mod.ThemeProvider, null, React.createElement(Probe));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  document.documentElement.className = "";
  container = document.createElement("div");
  document.body.append(container);
  api = null;
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  container.remove();
});

describe("ThemeProvider", () => {
  it("starts from what the pre-paint script applied (no light flash)", async () => {
    localStorage.setItem("ta-theme", "dark");
    document.documentElement.classList.add("dark");
    const mod = await loadModule();
    const seen: string[] = [];
    function Spy() {
      seen.push(mod.useTheme().resolvedTheme);
      return null;
    }

    root = createRoot(container);
    await act(async () => root!.render(React.createElement(mod.ThemeProvider, null, React.createElement(Spy))));

    expect(seen[0]).toBe("dark");
    expect(new Set(seen)).toEqual(new Set(["dark"]));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("hydrates without a mismatch, then reports the client theme", async () => {
    localStorage.setItem("ta-theme", "dark");
    const mod = await loadModule();
    container.innerHTML = renderToString(tree(mod));
    expect(container.textContent).toBe("system");

    document.documentElement.classList.add("dark");
    const recoverable = vi.fn();
    await act(async () => {
      root = hydrateRoot(container, tree(mod), { onRecoverableError: recoverable });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(container.querySelector("span")?.getAttribute("data-theme")).toBe("dark");
    expect(container.textContent).toBe("dark");
  });

  it("applies the stored theme itself when the bootstrap script did not run", async () => {
    localStorage.setItem("ta-theme", "dark");
    const mod = await loadModule();

    root = createRoot(container);
    await act(async () => root!.render(tree(mod)));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(api?.resolvedTheme).toBe("dark");
  });

  it("setTheme and toggleTheme persist the choice and update <html>", async () => {
    const mod = await loadModule();
    root = createRoot(container);
    await act(async () => root!.render(tree(mod)));
    expect(api?.theme).toBe("system");

    await act(async () => api!.setTheme("dark"));
    expect(localStorage.getItem("ta-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(api?.resolvedTheme).toBe("dark");

    await act(async () => api!.toggleTheme());
    expect(localStorage.getItem("ta-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(api).toMatchObject({ theme: "light", resolvedTheme: "light" });
  });

  it("treats an unknown stored value as system", async () => {
    localStorage.setItem("ta-theme", "purple");
    const mod = await loadModule();
    root = createRoot(container);
    await act(async () => root!.render(tree(mod)));

    expect(api?.theme).toBe("system");
    expect(api?.resolvedTheme).toBe("light");
  });
});
