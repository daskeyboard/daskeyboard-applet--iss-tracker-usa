const { ISSTracker } = require("../index");
const fetch = require("node-fetch");
const q = require("daskeyboard-applet");

jest.mock("node-fetch");
jest.mock("daskeyboard-applet", () => {
  return {
    DesktopApp: class {},
    Point: jest.fn().mockImplementation((color, effect) => ({ color, effect })),
    Signal: jest.fn().mockImplementation(({ name, message, points }) => ({
      name,
      message,
      points,
    })),
    Signal: class {
      constructor({ name, message, points }) {
        this.name = name;
        this.message = message;
        this.points = points;
      }
      static error(errors) {
        return { errors };
      }
    },
    logger: { info: jest.fn(), error: jest.fn() },
  };
});

describe("ISSTracker", () => {
  let tracker;

  const validISSResponse = {
    message: "success",
    iss_position: { latitude: "10.0", longitude: "20.0" },
  };

  const validGeoResponse = {
    results: [{ latitude: 30.2666, longitude: -97.7333 }],
  };

  beforeEach(() => {
    tracker = new ISSTracker();
    tracker.config = { postalCode: "78701" }; // Austin
    fetch.mockReset();
  });

  describe("getISSLocation()", () => {
    it("throws if message !== success", async () => {
      fetch.mockResolvedValueOnce({
        json: async () => ({ message: "failure" }),
      });
      await expect(tracker.getISSLocation()).rejects.toThrow(
        "API returned failure status"
      );
    });

    it("returns valid coordinates on success", async () => {
      fetch.mockResolvedValueOnce({
        json: async () => validISSResponse,
      });
      const result = await tracker.getISSLocation();
      expect(result).toEqual({ latitude: 10.0, longitude: 20.0 });
    });
  });

  describe("getUserCoordinates()", () => {
    it("throws if API returns no results", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await expect(tracker.getUserCoordinates()).rejects.toThrow(
        'Postal code not found: "78701".'
      );
    });

    it("returns latitude and longitude on success", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validGeoResponse,
      });

      const coords = await tracker.getUserCoordinates();
      expect(coords).toEqual([30.2666, -97.7333]);
    });
  });

  describe("calculateDistance()", () => {
    it("returns 0 for same coordinates", () => {
      expect(tracker.calculateDistance(1, 2, 1, 2)).toBeCloseTo(0);
    });

    it("returns ~111km for 1° longitude difference at equator", () => {
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

  describe("generateSignal()", () => {
    it("returns green signal for < 500km", () => {
      const signal = tracker.generateSignal(300);
      expect(signal.points[0][0].color).toBe("#00FF00");
      expect(signal.message).toMatch(/overhead/);
    });

    it("returns yellow for < 1000km", () => {
      const signal = tracker.generateSignal(800);
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

  describe("run()", () => {
    it("returns error signal for invalid coordinates", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ latitude: 999, longitude: 999 }] }),
      });

      const signal = await tracker.run();
      expect(signal.errors).toEqual([
        "Invalid coordinates. Please check your latitude and longitude.",
      ]);
    });

    it("returns valid signal with correct distance and message", async () => {
      // mock geocoding
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validGeoResponse,
      });

      // mock ISS location
      fetch.mockResolvedValueOnce({
        json: async () => validISSResponse,
      });

      const signal = await tracker.run();

      expect(signal.name).toBe("ISS Tracker");
      expect(signal.message).toMatch(/ISS/);
      expect(signal.points[0][0]).toHaveProperty("color");
    });
  });
});
