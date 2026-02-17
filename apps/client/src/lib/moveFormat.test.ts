import { describe, expect, it } from "vitest";
import { toCoordinateNotation, toMoveRows } from "./moveFormat";

describe("move formatter", () => {
  it("formats coordinate notation", () => {
    expect(
      toCoordinateNotation({
        san: "Nf3",
        from: "g1",
        to: "f3",
        piece: "n",
        color: "w"
      })
    ).toBe("Ng1→f3");

    expect(
      toCoordinateNotation({
        san: "Bxc4+",
        from: "f1",
        to: "c4",
        piece: "b",
        color: "w",
        captured: "p"
      })
    ).toBe("Bf1×c4");
  });

  it("groups history into move rows", () => {
    const rows = toMoveRows([
      { san: "e4", from: "e2", to: "e4", piece: "p", color: "w" },
      { san: "e5", from: "e7", to: "e5", piece: "p", color: "b" },
      { san: "Nf3", from: "g1", to: "f3", piece: "n", color: "w" }
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].white?.san).toBe("e4");
    expect(rows[0].black?.san).toBe("e5");
    expect(rows[1].white?.coordinate).toBe("Ng1→f3");
  });
});
