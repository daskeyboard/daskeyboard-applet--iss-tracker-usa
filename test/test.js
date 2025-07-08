const { ISSTracker } = require("../index"); // adjust path as needed
const fetch = require("node-fetch");
const q = require("daskeyboard-applet");
const { Response } = jest.requireActual("node-fetch");

jest.mock("node-fetch");

describe("ISSTracker", () => {
  let tracker;

  const validISSResponse = {
    message: "success",
    iss_position: { latitude: "10.0", longitude: "20.0" },
  };

  beforeEach(() => {
    tracker = new ISSTracker();
    tracker.config = { latitude: 30.2666, longitude: -97.7333 }; // Austin
  });

  describe("getISSLocation()", () => {
    it("throws if HTTP status is not ok", async () => {
      fetch.mockResolvedValue(
        new Response(JSON.stringify({}), { status: 404 })
      );
      await expect(tracker.getISSLocation()).rejects.toThrow(
        "Failed to get ISS location: API returned failure status"
      );
    });
    it("throws if message !== success", async () => {
      fetch.mockResolvedValue(
        new Response(JSON.stringify({ message: "failure" }), { status: 200 })
      );
      await expect(tracker.getISSLocation()).rejects.toThrow(
        "API returned failure status"
      );
    });

    it("returns valid coordinates on success", async () => {
      fetch.mockResolvedValue(
        new Response(JSON.stringify(validISSResponse), { status: 200 })
      );
      const result = await tracker.getISSLocation();
      expect(result).toEqual({ latitude: 10.0, longitude: 20.0 });
    });
  });

  describe("calculateDistance()", () => {
    it("returns 0 for the same coordinates", () => {
      expect(tracker.calculateDistance(1, 2, 1, 2)).toEqual(0);
    });
    it("returns ~111km for 1 degree longitude diff at equator", () => {
      expect(tracker.calculateDistance(0, 0, 0, 1)).toBeCloseTo(111, -1);
    });
  });

  describe("toRadians()", () => {
    it("converts degrees to radians correctly", () => {
      expect(tracker.toRadians(180)).toBeCloseTo(Math.PI);
      expect(tracker.toRadians(0)).toBe(0);
      expect(tracker.toRadians(-90)).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe("#generateSignal()", () => {
    it("returns green for distance < 500km", () => {
      const signal = tracker.generateSignal(300);
      expect(signal.points[0][0].color).toBe("#00FF00");
      expect(signal.message).toMatch(/overhead/);
    });

    it("returns yellow for < 1000km", () => {
      const signal = tracker.generateSignal(700);
      expect(signal.points[0][0].color).toBe("#FFDD00");
    });

    it("returns orange for < 2000km", () => {
      const signal = tracker.generateSignal(1500);
      expect(signal.points[0][0].color).toBe("#FF6600");
    });

    it("returns red for >= 2000km", () => {
      const signal = tracker.generateSignal(3000);
      expect(signal.points[0][0].color).toBe("#FF0000");
    });
  });

  describe("#run()", () => {
    it("returns error signal when config is missing", async () => {
      tracker.config = {};
      const signal = await tracker.run();
      expect(signal.errors).toEqual([
        "Invalid coordinates. Please check your latitude and longitude.",
      ]);
    });

    it("returns valid signal when ISS data is fetched", async () => {
      fetch.mockResolvedValue(
        new Response(JSON.stringify(validISSResponse), { status: 200 })
      );
      const signal = await tracker.run();
      expect(signal).toBeInstanceOf(q.Signal);
      expect(signal.message).toMatch(/ISS/);
    });
  });
});
