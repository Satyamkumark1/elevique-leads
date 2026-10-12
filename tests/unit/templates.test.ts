import { describe, expect, it } from "vitest";
import { renderTemplate, welcomeParams } from "@/server/whatsapp/templates";

const lead = {
  id: "L1",
  full_name: "Asha Verma",
  brand_name: "Kesar Threads",
  category: "Fashion",
  budget_range: "₹50k–1L",
  start_timeline: "This month",
};
const reels = [
  { category: "Beauty & personal care", url: "https://x/beauty", sort: 0 },
  { category: "Fashion", url: "https://x/fashion-2", sort: 2 },
  { category: "Fashion", url: "https://x/fashion-1", sort: 1 },
  { category: "Other", url: "https://x/other", sort: 0 },
];

describe("welcome template params (TC-U-33)", () => {
  it("orders params {{1}} name, {{2}} brand, {{3}} category, {{4}} category reel", () => {
    expect(welcomeParams(lead, reels, "https://x/showreel")).toEqual([
      "Asha",
      "Kesar Threads",
      "fashion",
      "https://x/fashion-1",
    ]);
  });

  it("falls back to the Other reel, then the showreel", () => {
    expect(welcomeParams({ ...lead, category: "Electronics" }, reels, "https://x/showreel")[3]).toBe(
      "https://x/other",
    );
    expect(welcomeParams({ ...lead, category: "Electronics" }, [], "https://x/showreel")[3]).toBe(
      "https://x/showreel",
    );
  });

  it("handles missing name and brand", () => {
    const p = welcomeParams({ ...lead, full_name: null, brand_name: null }, reels, "");
    expect(p.slice(0, 2)).toEqual(["there", "your brand"]);
  });

  it("renders the approved text with params", () => {
    expect(renderTemplate("welcome_samples", ["A", "B", "c", "u"])).toBe(
      "Hi A, thanks for your interest in AI video ads for B! Here are a few samples we made for c brands: u. Want a quick call to plan yours?",
    );
  });
});
