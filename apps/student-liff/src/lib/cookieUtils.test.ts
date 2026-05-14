/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { Cookies } from "./cookieUtils";

describe("Cookies", () => {
  beforeEach(() => {
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0]?.trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
  });

  it("sets and reads encoded cookie values", () => {
    Cookies.set("session token", "a value with spaces");

    expect(Cookies.get("session token")).toBe("a value with spaces");
    expect(document.cookie).toContain("session%20token=a%20value%20with%20spaces");
  });

  it("removes cookies by expiring them", () => {
    Cookies.set("token", "abc");
    Cookies.remove("token");

    expect(Cookies.get("token")).toBeNull();
  });
});
