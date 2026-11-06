import { beforeEach, describe, expect, it, vi } from "vitest";

const { api, ApiError } = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    constructor(status: number) {
      super(`API Error ${status}`);
      this.status = status;
    }
  }
  return {
    ApiError,
    api: { getClassDetails: vi.fn(), getClassArticles: vi.fn(), getClassReview: vi.fn(), getClassAttendance: vi.fn() },
  };
});
vi.mock("../../../../lib/api", () => ({ studentApi: api, StudentApiError: ApiError }));

import { fetchClassArticles, fetchClassAttendance, fetchClassReview } from "./classDetailData";

beforeEach(() => vi.resetAllMocks());

describe("fetchClassArticles", () => {
  it("passes the cycle id (or undefined for the default cycle)", async () => {
    api.getClassArticles.mockResolvedValue({ articles: [{ id: "a" }] });
    await expect(fetchClassArticles("c1", "cy")).resolves.toEqual([{ id: "a" }]);
    expect(api.getClassArticles).toHaveBeenLastCalledWith("c1", "cy");
    api.getClassArticles.mockResolvedValue({});
    await expect(fetchClassArticles("c1", "")).resolves.toEqual([]);
    expect(api.getClassArticles).toHaveBeenLastCalledWith("c1", undefined);
  });

  it("treats 402 as an empty list and rethrows other errors", async () => {
    api.getClassArticles.mockRejectedValue(new ApiError(402));
    await expect(fetchClassArticles("c1", "cy")).resolves.toEqual([]);
    api.getClassArticles.mockRejectedValue(new ApiError(500));
    await expect(fetchClassArticles("c1", "cy")).rejects.toMatchObject({ status: 500 });
  });
});

describe("fetchClassAttendance", () => {
  it("returns the student's own attendance", async () => {
    const mine = { summary: { present: 1, late: 0, absent: 0, rate: 1 }, records: [] };
    api.getClassAttendance.mockResolvedValue({ mine });
    await expect(fetchClassAttendance("c1")).resolves.toEqual(mine);
    expect(api.getClassAttendance).toHaveBeenLastCalledWith("c1");
  });

  it("rethrows failures so the section can offer a retry", async () => {
    api.getClassAttendance.mockRejectedValue(new ApiError(500));
    await expect(fetchClassAttendance("c1")).rejects.toMatchObject({ status: 500 });
  });
});

describe("fetchClassReview", () => {
  it("returns the review or null, never throws", async () => {
    api.getClassReview.mockResolvedValue({ review: { id: "r", rating: 4 } });
    await expect(fetchClassReview("c1")).resolves.toEqual({ review: { id: "r", rating: 4 } });
    api.getClassReview.mockResolvedValue({});
    await expect(fetchClassReview("c1")).resolves.toEqual({ review: null });
    api.getClassReview.mockRejectedValue(new Error("boom"));
    await expect(fetchClassReview("c1")).resolves.toEqual({ review: null });
  });
});
