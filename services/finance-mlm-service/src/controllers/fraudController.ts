import { Request, Response } from "express";

const MOCK_FLAGS = [
  {
    id: "flg_9921nc9m21",
    type: "VELOCITY_SPIKE",
    severity: "HIGH",
    targetId: "usr_tutor99x",
    targetName: "Ajarn A",
    description: "Abnormal enrollment spikes: 25 new enrollments in 1 hour.",
    status: "INVESTIGATING",
    createdAt: "2026-03-04T12:00:00Z",
  },
  {
    id: "flg_102nf92n1f",
    type: "PAYMENT_ANOMALY",
    severity: "MEDIUM",
    targetId: "cls_abc88",
    targetName: "Origins Book 2",
    description:
      "Multiple failed payment attempts from identical IP before success.",
    status: "OPEN",
    createdAt: "2026-03-04T09:15:00Z",
  },
];

export const getFraudFlags = async (req: Request, res: Response) => {
  res.status(200).json({
    flags: MOCK_FLAGS,
    stats: {
      activeCount: 2,
      velocityStatus: "Normal",
      autoSuspensions: 0,
    },
  });
};

export const triggerFraudAction = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action } = req.body;

  res.status(200).json({
    success: true,
    message: `Action ${action} processed for flag ${id}`,
  });
};
