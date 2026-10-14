// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Enrollment } from "../../../lib/enrollmentStatus";

const generateShareLink = vi.fn();
vi.mock("../../../lib/api", () => ({
  studentApi: { generateShareLink: (...args: unknown[]) => generateShareLink(...args) },
}));
const toastInfo = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfo(...args),
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));
const copyTextToClipboard = vi.fn();
vi.mock("./clipboard", () => ({ copyTextToClipboard: (...args: unknown[]) => copyTextToClipboard(...args) }));

import { useReferralInvite, type ReferralInviteState } from "./useReferralInvite";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function cls(id: string, name = `Class ${id}`): Enrollment {
  return { id, name, tutorName: "T", status: "open", nextSession: "-", progress: 0, bookName: null, seriesCefr: null };
}

let latest: ReferralInviteState;
function Probe({ classes }: { classes: Enrollment[] }) {
  latest = useReferralInvite(classes);
  return null;
}

describe("useReferralInvite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (classes: Enrollment[]) => act(() => root.render(<Probe classes={classes} />));

  it("explains with a toast when there is no shareable class", () => {
    render([]);
    act(() => latest.start());
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(generateShareLink).not.toHaveBeenCalled();
    expect(latest.pickerOpen).toBe(false);
  });

  it("opens the picker for several classes", () => {
    render([cls("a"), cls("b")]);
    act(() => latest.start());
    expect(latest.pickerOpen).toBe(true);
    expect(generateShareLink).not.toHaveBeenCalled();
  });

  it("creates the link for the only class and opens the QR", async () => {
    generateShareLink.mockResolvedValueOnce({ url: "https://x.test/join" });
    render([cls("a", "Reading A")]);
    await act(async () => latest.start());
    expect(generateShareLink).toHaveBeenCalledWith("a");
    expect(latest.qrOpen).toBe(true);
    expect(latest.invite).toEqual({ url: "https://x.test/join", className: "Reading A" });
    expect(latest.busy).toBe(false);
  });

  it("closes the picker after choosing a class", async () => {
    generateShareLink.mockResolvedValueOnce({ url: "https://x.test/b" });
    render([cls("a"), cls("b", "Reading B")]);
    act(() => latest.start());
    await act(async () => latest.openForClass("b"));
    expect(generateShareLink).toHaveBeenCalledWith("b");
    expect(latest.pickerOpen).toBe(false);
    expect(latest.invite?.className).toBe("Reading B");
  });

  it("shows an error toast when the link cannot be created", async () => {
    generateShareLink.mockRejectedValueOnce(new Error("500"));
    render([cls("a")]);
    await act(async () => latest.start());
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(latest.qrOpen).toBe(false);
    expect(latest.busy).toBe(false);
  });

  it("ignores taps while a link is being created", async () => {
    let resolve: (value: unknown) => void = () => {};
    generateShareLink.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render([cls("a")]);
    act(() => latest.start());
    expect(latest.busy).toBe(true);
    act(() => latest.start());
    await act(async () => latest.openForClass("a"));
    expect(generateShareLink).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ url: "https://x.test/a" }));
    expect(latest.qrOpen).toBe(true);
  });

  it("copies the link with a success toast", async () => {
    generateShareLink.mockResolvedValueOnce({ url: "https://x.test/join" });
    copyTextToClipboard.mockResolvedValueOnce(undefined);
    render([cls("a")]);
    await act(async () => latest.start());
    await act(async () => latest.copyLink());
    expect(copyTextToClipboard).toHaveBeenCalledWith("https://x.test/join");
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(latest.copied).toBe(true);
  });

  it("reports a failed copy", async () => {
    generateShareLink.mockResolvedValueOnce({ url: "https://x.test/join" });
    copyTextToClipboard.mockRejectedValueOnce(new Error("blocked"));
    render([cls("a")]);
    await act(async () => latest.start());
    await act(async () => latest.copyLink());
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(latest.copied).toBe(false);
  });
});
