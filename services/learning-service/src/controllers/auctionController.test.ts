import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimAuctionClass } from "./auctionController";

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  classTransferRequest: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  class: {
    updateMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("@tutor-advantage/shared-config", () => ({
  logger: { error: vi.fn() },
}));

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function openTransfer() {
  return {
    transferId: "transfer-1",
    classId: "class-1",
    originalTutorId: "original-tutor",
    status: "OPEN",
    expiresAt: null,
    networkBonusRate: 5,
    class: {},
  };
}

describe("claimAuctionClass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.classTransferRequest.findUnique.mockResolvedValue(openTransfer());
    prisma.classTransferRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.class.updateMany.mockResolvedValue({ count: 1 });
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: prisma.user,
        classTransferRequest: prisma.classTransferRequest,
        class: prisma.class,
        $executeRaw: prisma.$executeRaw,
      } as never),
    );
  });

  it.each([
    [{ role: "STUDENT", verificationStatus: "VERIFIED", isActive: true }],
    [{ role: "TUTOR", verificationStatus: "UNVERIFIED", isActive: true }],
    [{ role: "TUTOR", verificationStatus: "VERIFIED", isActive: false }],
  ])("rejects a claimant who is not an active verified tutor", async (claimant) => {
    prisma.user.findUnique.mockResolvedValue(claimant);
    const res = response();

    await claimAuctionClass(
      {
        params: { transferId: "transfer-1" },
        user: { userId: "new-tutor" },
      } as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Tutor verification is required to claim a class",
    });
    expect(prisma.classTransferRequest.updateMany).not.toHaveBeenCalled();
    expect(prisma.class.updateMany).not.toHaveBeenCalled();
  });

  it("claims a class only for an active verified tutor", async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: "TUTOR",
      verificationStatus: "VERIFIED",
      isActive: true,
    });
    const res = response();

    await claimAuctionClass(
      {
        params: { transferId: "transfer-1" },
        user: { userId: "new-tutor" },
      } as never,
      res as never,
    );

    expect(prisma.classTransferRequest.updateMany).toHaveBeenCalledWith({
      where: { transferId: "transfer-1", status: "OPEN" },
      data: expect.objectContaining({
        status: "TRANSFERRED",
        newTutorId: "new-tutor",
      }),
    });
    expect(prisma.class.updateMany).toHaveBeenCalledWith({
      where: { classId: "class-1", tutorUserId: "original-tutor" },
      data: expect.objectContaining({ tutorUserId: "new-tutor" }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Class claimed successfully",
      transfer: { id: "transfer-1", classId: "class-1" },
    });
  });

  it("does not transfer a request lost to a concurrent claimant", async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: "TUTOR",
      verificationStatus: "VERIFIED",
      isActive: true,
    });
    prisma.classTransferRequest.updateMany.mockResolvedValue({ count: 0 });
    const res = response();

    await claimAuctionClass(
      {
        params: { transferId: "transfer-1" },
        user: { userId: "new-tutor" },
      } as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.class.updateMany).not.toHaveBeenCalled();
  });
});
