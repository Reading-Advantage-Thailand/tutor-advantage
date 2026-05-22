import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  calculateCommissionInfo,
  calculatePayoutMinor,
  formatIctPeriodMonth,
  getIctMonthWindow,
} from "../services/commissionService";

type TutorNode = {
  userId: string;
  displayName: string | null;
  email: string | null;
  sponsorTutorId: string | null;
  sponsorLockedAt: Date | null;
  createdAt: Date;
  personalVolumeMinor: bigint;
  groupVolumeMinor: bigint;
  estimatedPayoutMinor: bigint;
  rate: number;
  children: TutorNode[];
};

type TutorTreeResponse = ReturnType<typeof mapTutorSummary> & {
  totalDownlines: number;
  children: TutorTreeResponse[];
};

export async function getTutorNetwork(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not identified" },
      });
    }

    const periodMonth =
      typeof req.query.periodMonth === "string"
        ? req.query.periodMonth
        : formatIctPeriodMonth();
    const { start, end } = getIctMonthWindow(periodMonth);

    const tutors = await prisma.user.findMany({
      where: { role: "TUTOR", isActive: true },
      select: {
        userId: true,
        displayName: true,
        email: true,
        sponsorTutorId: true,
        sponsorLockedAt: true,
        createdAt: true,
      },
    });

    const currentTutor = tutors.find((t) => t.userId === userId);
    if (!currentTutor) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only tutors can view network data",
          requestId: req.id,
        },
      });
    }

    const classRows = await prisma.class.findMany({
      select: { classId: true, tutorUserId: true },
    });
    const classTutorMap = new Map(classRows.map((c) => [c.classId, c.tutorUserId]));

    const enrollments = await prisma.enrollment.findMany({
      where: { classId: { in: classRows.map((c) => c.classId) } },
      select: { enrollmentId: true, classId: true },
    });
    const enrollmentTutorMap = new Map<string, string>();
    for (const enrollment of enrollments) {
      const tutorId = classTutorMap.get(enrollment.classId);
      if (tutorId) enrollmentTutorMap.set(enrollment.enrollmentId, tutorId);
    }

    const successfulPayments = await prisma.paymentIntent.findMany({
      where: {
        status: "SUCCESS",
        updatedAt: { gte: start, lte: end },
        enrollmentId: { in: enrollments.map((e) => e.enrollmentId) },
      },
      select: { enrollmentId: true, amountMinor: true },
    });

    const personalVolumes = new Map<string, bigint>();
    for (const payment of successfulPayments) {
      const tutorId = enrollmentTutorMap.get(payment.enrollmentId);
      if (!tutorId) continue;
      personalVolumes.set(
        tutorId,
        (personalVolumes.get(tutorId) || 0n) + payment.amountMinor,
      );
    }

    const nodes = new Map<string, TutorNode>();
    for (const tutor of tutors) {
      nodes.set(tutor.userId, {
        ...tutor,
        personalVolumeMinor: personalVolumes.get(tutor.userId) || 0n,
        groupVolumeMinor: 0n,
        estimatedPayoutMinor: 0n,
        rate: 0,
        children: [],
      });
    }

    for (const node of nodes.values()) {
      if (node.sponsorTutorId && nodes.has(node.sponsorTutorId)) {
        nodes.get(node.sponsorTutorId)!.children.push(node);
      }
    }

    const calculateGroupVolume = (node: TutorNode, seen = new Set<string>()) => {
      if (seen.has(node.userId)) throw new Error("SPONSOR_TREE_CYCLE");
      seen.add(node.userId);
      node.groupVolumeMinor =
        node.personalVolumeMinor +
        node.children.reduce(
          (sum, child) => sum + calculateGroupVolume(child, new Set(seen)),
          0n,
        );
      node.rate = calculateCommissionInfo(Number(node.groupVolumeMinor) / 100).rate;
      return node.groupVolumeMinor;
    };

    const calculateDifferentialPayout = (
      node: TutorNode,
      seen = new Set<string>(),
    ) => {
      if (seen.has(node.userId)) throw new Error("SPONSOR_TREE_CYCLE");
      seen.add(node.userId);
      const childPayouts = node.children.reduce(
        (sum, child) => sum + calculateDifferentialPayout(child, new Set(seen)),
        0n,
      );
      const grossPayout = calculatePayoutMinor(node.groupVolumeMinor, node.rate);
      node.estimatedPayoutMinor =
        grossPayout > childPayouts ? grossPayout - childPayouts : 0n;
      return node.estimatedPayoutMinor;
    };

    for (const node of nodes.values()) {
      if (!node.sponsorTutorId || !nodes.has(node.sponsorTutorId)) {
        calculateGroupVolume(node);
        calculateDifferentialPayout(node);
      }
    }

    const me = nodes.get(userId)!;
    const sponsor = me.sponsorTutorId ? nodes.get(me.sponsorTutorId) : null;
    const upline = buildUpline(me, nodes);
    const subtreeIds = collectSubtreeIds(me).filter((id) => id !== userId);
    const depthCounts = countDepths(me);
    const appBaseUrl = (
      process.env.TUTOR_APP_BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
    const inviteUrl = `${appBaseUrl}/invite/${userId}`;

    return res.status(200).json({
      periodMonth,
      inviteUrl,
      sponsor: sponsor ? mapTutorSummary(sponsor) : null,
      upline: upline.map(mapTutorSummary),
      networkTree: mapTutorTree(me),
      summary: {
        directDownlines: me.children.length,
        totalDownlines: subtreeIds.length,
        activeDownlines: subtreeIds.filter(
          (id) => (nodes.get(id)?.personalVolumeMinor || 0n) > 0n,
        ).length,
        personalVolumeTHB: toTHB(me.personalVolumeMinor),
        groupVolumeTHB: toTHB(me.groupVolumeMinor),
        currentRate: me.rate,
        estimatedPayoutTHB: toTHB(me.estimatedPayoutMinor),
        level1Count: depthCounts.get(1) || 0,
        level2PlusCount: Array.from(depthCounts.entries()).reduce(
          (sum, [level, count]) => (level >= 2 ? sum + count : sum),
          0,
        ),
      },
      downlines: me.children
        .sort(compareTutorVolumeDesc)
        .map((child) => ({
          ...mapTutorSummary(child),
          totalDownlines: collectSubtreeIds(child).length - 1,
        })),
    });
  } catch (error: any) {
    console.error("Get Tutor Network Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch tutor network",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

function buildUpline(node: TutorNode, nodes: Map<string, TutorNode>) {
  const upline: TutorNode[] = [];
  const seen = new Set<string>([node.userId]);
  let current: TutorNode | undefined = node;

  while (current?.sponsorTutorId) {
    if (seen.has(current.sponsorTutorId)) break;
    const sponsor = nodes.get(current.sponsorTutorId);
    if (!sponsor) break;
    upline.push(sponsor);
    seen.add(sponsor.userId);
    current = sponsor;
  }

  return upline;
}

function collectSubtreeIds(node: TutorNode): string[] {
  return [
    node.userId,
    ...node.children.flatMap((child) => collectSubtreeIds(child)),
  ];
}

function countDepths(node: TutorNode, depth = 0, counts = new Map<number, number>()) {
  for (const child of node.children) {
    counts.set(depth + 1, (counts.get(depth + 1) || 0) + 1);
    countDepths(child, depth + 1, counts);
  }
  return counts;
}

function mapTutorSummary(node: TutorNode) {
  return {
    userId: node.userId,
    displayName: node.displayName || node.email || `Tutor ${node.userId.slice(0, 8)}`,
    email: node.email,
    sponsorLockedAt: node.sponsorLockedAt,
    joinedAt: node.createdAt,
    personalVolumeTHB: toTHB(node.personalVolumeMinor),
    groupVolumeTHB: toTHB(node.groupVolumeMinor),
    currentRate: node.rate,
    estimatedPayoutTHB: toTHB(node.estimatedPayoutMinor),
  };
}

function mapTutorTree(node: TutorNode): TutorTreeResponse {
  return {
    ...mapTutorSummary(node),
    totalDownlines: collectSubtreeIds(node).length - 1,
    children: [...node.children]
      .sort(compareTutorVolumeDesc)
      .map((child) => mapTutorTree(child)),
  };
}

function compareTutorVolumeDesc(a: TutorNode, b: TutorNode) {
  if (a.groupVolumeMinor === b.groupVolumeMinor) {
    return a.displayName?.localeCompare(b.displayName || "") || 0;
  }

  return a.groupVolumeMinor > b.groupVolumeMinor ? -1 : 1;
}

function toTHB(value: bigint) {
  return Number(value) / 100;
}
