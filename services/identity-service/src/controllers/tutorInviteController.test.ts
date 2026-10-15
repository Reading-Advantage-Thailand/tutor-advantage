import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => {
  const mock = {
    tutorInvite: { create: vi.fn() },
    auditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation(async (fn: (tx: typeof mock) => unknown) => fn(mock));
  return mock;
});
vi.mock("@tutor-advantage/database", () => ({ prisma }));

import { createTutorInvite } from "./tutorInviteController";
import { hashInviteToken } from "../services/tutorInvite";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

describe("createTutorInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TUTOR_APP_BASE_URL", "https://tutor.example.com/");
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
    prisma.tutorInvite.create.mockImplementation(({ data }: { data: { expiresAt: Date } }) =>
      Promise.resolve({ tutorInviteId: "inv-1", expiresAt: data.expiresAt }),
    );
  });

  it("returns a one-time link and stores only the token hash, with an audit event", async () => {
    const res = response();
    await createTutorInvite({ id: "r", user: { userId: "admin-1", role: "ADMIN" }, body: { reason: "ผู้นำทีมภาคเหนือ" } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    const token = body.inviteUrl.replace("https://tutor.example.com/invite/root/", "");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(prisma.tutorInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tokenHash: hashInviteToken(token), createdBy: "admin-1" }),
      select: expect.any(Object),
    });
    expect(JSON.stringify(prisma.tutorInvite.create.mock.calls[0][0])).not.toContain(token);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "TUTOR_INVITE_CREATE", entityId: "inv-1" }),
    });
  });

  it("requires a reason", async () => {
    const res = response();
    await createTutorInvite({ id: "r", user: { userId: "admin-1", role: "ADMIN" }, body: { reason: " " } } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.tutorInvite.create).not.toHaveBeenCalled();
  });
});
