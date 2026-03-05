import { Request, Response } from "express";

const MOCK_USERS = [
  {
    id: "usr_94kd82ms9f2",
    name: "Ajarn Somchai",
    role: "TUTOR",
    email: "somchai.t@example.com",
    activeClasses: 3,
    status: "ACTIVE",
    joined: "2025-11-20",
  },
  {
    id: "usr_3918fns91kk",
    name: "Nong M.",
    role: "STUDENT",
    guardianSetup: true,
    activeClasses: 1,
    status: "ACTIVE",
    joined: "2026-03-01",
  },
  {
    id: "usr_102nf9102nf",
    name: "Kittipong",
    role: "STUDENT",
    guardianSetup: false,
    activeClasses: 0,
    status: "PENDING_GUARDIAN",
    joined: "2026-03-03",
  },
];

const MOCK_USER_DETAIL = {
  id: "usr_94kd82ms9f2",
  name: "Ajarn Somchai",
  email: "somchai.t@example.com",
  phone: "089-123-4567",
  role: "TUTOR",
  status: "ACTIVE",
  joinedAt: "2025-11-20T10:00:00Z",
  guardianSetup: false,
  consentLogs: [
    {
      id: "cns_1",
      version: "v1.2",
      type: "TERMS_OF_SERVICE",
      timestamp: "2025-11-20T10:05:00Z",
    },
    {
      id: "cns_2",
      version: "v1.0",
      type: "PRIVACY_POLICY",
      timestamp: "2025-11-20T10:05:00Z",
    },
  ],
  classes: [
    {
      id: "cls_abc1",
      name: "Origins 1 (Sat 10:00)",
      students: 15,
      status: "FULL",
    },
    {
      id: "cls_abc2",
      name: "Quest 4 (Sun 13:00)",
      students: 8,
      status: "OPEN",
    },
  ],
};

export const getUsers = async (req: Request, res: Response) => {
  res.status(200).json({ users: MOCK_USERS });
};

export const getUserDetails = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (id === MOCK_USER_DETAIL.id) {
    res.status(200).json({ user: MOCK_USER_DETAIL });
    return;
  }

  // Try to find in list, then expand with empty stuff
  const liteUser = MOCK_USERS.find((u) => u.id === id);
  if (liteUser) {
    res.status(200).json({
      user: {
        ...liteUser,
        joinedAt: liteUser.joined,
        phone: "000-000-0000",
        consentLogs: [],
        classes: [],
      },
    });
    return;
  }

  res.status(404).json({ error: "User not found" });
};

export const anonymizeUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  res
    .status(200)
    .json({ success: true, message: `User ${id} has been anonymized` });
};
