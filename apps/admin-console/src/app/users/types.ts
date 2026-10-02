/** GET /v1/users row (finance userController.getUsers). Never contains settings/PII beyond name + email. */
export interface UserListItem {
  id: string;
  /** displayName → email → null (LINE sign-ups may have neither). */
  name: string | null;
  displayName: string | null;
  role: string;
  email: string | null;
  profilePictureUrl: string | null;
  activeClasses: number;
  status: "ACTIVE" | "INACTIVE";
  accountStatus: "ACTIVE" | "SUSPENDED" | "ANONYMIZED";
  verificationStatus: string;
  pendingVerificationCount: number;
  guardianSetup: boolean;
  createdAt: string;
}

export interface UserListResponse {
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; tutors: number; students: number; pendingReview: number; inactive: number };
}
