import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseDateOnly, updateCurrentUserProfile } from "./userController";

const prisma = vi.hoisted(() => ({
  user: { update: vi.fn() },
  userConsent: { findFirst: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("date of birth profile validation", () => {
  beforeEach(() => {
    prisma.user.update.mockReset();
    prisma.userConsent.findFirst.mockReset();
  });

  it("accepts strict calendar dates and rejects invalid inputs", () => {
    expect(parseDateOnly("2008-07-01")?.toISOString()).toBe(
      "2008-07-01T00:00:00.000Z",
    );
    expect(parseDateOnly("2008-02-30")).toBeNull();
    expect(parseDateOnly("01/07/2008")).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
  });

  it("persists a date of birth and returns the guardian requirement", async () => {
    prisma.user.update.mockResolvedValue({
      userId: "student-1",
      role: "STUDENT",
      dateOfBirth: new Date("2012-01-01T00:00:00.000Z"),
    });
    prisma.userConsent.findFirst.mockResolvedValue(null);
    const req = {
      id: "req-1",
      user: { userId: "student-1", role: "STUDENT" },
      body: { dateOfBirth: "2012-01-01" },
    };
    const res = response();

    await updateCurrentUserProfile(req as never, res as never);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: "student-1" },
      data: { dateOfBirth: new Date("2012-01-01T00:00:00.000Z") },
      select: { userId: true, role: true, dateOfBirth: true },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: "student-1",
        dateOfBirth: "2012-01-01",
        requiresGuardian: true,
      },
    });
  });
});
