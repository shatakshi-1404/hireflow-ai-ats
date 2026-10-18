import { describe, expect, it } from "vitest";
import { ApiError, api, buildQuery } from "./api-client";
import { mockFetchJson } from "@/test/utils";

describe("buildQuery", () => {
  it("skips empty values and repeats array params", () => {
    expect(buildQuery({ q: "ada", stage: undefined, page: 2, empty: "", skills: ["a", "b"] })).toBe(
      "?q=ada&page=2&skills=a&skills=b",
    );
    expect(buildQuery({})).toBe("");
  });
});

describe("api errors", () => {
  it("formats FastAPI validation errors", async () => {
    mockFetchJson(422, { detail: [{ loc: ["body", "email"], msg: "Invalid email" }] });
    await expect(api.post("/x", {})).rejects.toMatchObject({ status: 422, message: "email: Invalid email" });
  });

  it("uses string details and generic server messages", async () => {
    mockFetchJson(409, { detail: "Already exists" });
    await expect(api.get("/x")).rejects.toThrow("Already exists");
    mockFetchJson(500, null);
    const err = await api.get("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/try again/i);
  });
});
