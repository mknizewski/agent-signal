import { describe, expect, it } from "vitest";
import {
  defaultProjectColor,
  groupSessionsByProject,
  normalizeProjectGroupConfigs
} from "./project-groups";

const sessions = [
  { id: "one", projectName: "checkout-service" },
  { id: "two", projectName: "customer-portal" },
  { id: "three", projectName: "customer-portal" }
];

describe("project group presentation", () => {
  it("uses stable automatic colors and initials", () => {
    const groups = groupSessionsByProject(sessions, true, "No project", []);

    expect(groups.map((group) => group.name)).toEqual([
      "checkout-service",
      "customer-portal"
    ]);
    expect(groups[0].symbol).toBe("C");
    expect(groups[0].color).toBe(defaultProjectColor("checkout-service"));
  });

  it("applies custom labels, symbols, colors, and saved order", () => {
    const groups = groupSessionsByProject(sessions, true, "No project", [
      {
        projectKey: "customer-portal",
        label: "Portal klienta",
        symbol: "PK",
        color: "#8d6bc5",
        collapsed: true,
        order: 0
      },
      {
        projectKey: "checkout-service",
        label: "Płatności",
        symbol: "P",
        color: "#2d9f75",
        order: 1
      }
    ]);

    expect(groups.map((group) => group.name)).toEqual([
      "Portal klienta",
      "Płatności"
    ]);
    expect(groups[0]).toMatchObject({
      key: "customer-portal",
      symbol: "PK",
      color: "#8d6bc5",
      collapsed: true
    });
  });

  it("normalizes unsafe or malformed saved values", () => {
    expect(
      normalizeProjectGroupConfigs([
        {
          projectKey: "portal",
          label: "  Portal  ",
          symbol: "ABC",
          color: "#8D6BC5",
          collapsed: true,
          order: 2.4
        },
        {
          projectKey: "broken",
          color: "red",
          order: 0
        }
      ])
    ).toEqual([
      {
        projectKey: "broken",
        order: 0
      },
      {
        projectKey: "portal",
        label: "Portal",
        symbol: "AB",
        color: "#8d6bc5",
        collapsed: true,
        order: 2
      }
    ]);
  });
});
