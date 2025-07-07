const q = require("daskeyboard-applet");
const fetch = require("node-fetch");
const logger = q.logger;

class ISSTracker extends q.DesktopApp {
  constructor() {
    super();
    this.pollingInterval = 30000;

    logger.info("ISS Tracker ready to launch!");
  }

  async getISSLocation() {
    const response = await fetch("http://api.open-notify.org/iss-now.json");
    const data = await response.json();

    if (data.message !== "success") {
      throw new Error("Failed to get ISS Location");
    }

    return {
      latitude: parseFloat(data.iss_position.latitude),
      longitude: parseFloat(data.iss_position.longitude),
      timestamp: data.timestamp,
    };
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  generateSignal(distance) {
    let color = "#000000";
    let effect = "SOLID";
    let message = "";

    if (distance < 500) {
      color = "#FFFFFF";
      effect = "BLINK";
      message = `ISS is ${Math.round(distance)}km away! Look up!`;
    } else if (distance < 1000) {
      color = "#0080FF";
      effect = "BREATHE";
      message = `ISS is approaching - ${Math.round(distance)}km away!`;
    } else {
      color = "#004080";
      effect = "SOLID";
      message = `ISS tracking - ${Math.round(distance)}km away.`;
    }

    return new q.Signal({
      points: [[new q.Point(color, effect)]],
      name: "ISS Tracker",
      message: message,
    });
  }

  async run() {
    try {
      const userLat = this.config.latitude;
      const userLon = this.config.longitude;

      if (!userLat || !userLon) {
        return new q.Signal({
          points: [[new q.Point("#FF0000")]],
          name: "ISS Tracker",
          message: "Please configure your location in settings",
        });
      }

      const issLocation = await this.getISSLocation();

      const distance = this.calculateDistance(
        userLat,
        userLon,
        issLocation.latitude,
        issLocation.longitude
      );
      return this.generateSignal(distance);
    } catch (error) {
      logger.error("Error in ISS Tracker:", error);
      return new q.Signal({
        points: [[new q.Point("#FF0000")]],
        name: "ISS Tracker Error",
        message: "Failed to get ISS data",
      });
    }
  }
}

module.exports = { ISSTracker: ISSTracker };
const applet = new ISSTracker();

if (require.main === module) {
  (async () => {
    const tracker = new ISSTracker();

    try {
      // Step 1: Get real-time ISS location
      const issLocation = await tracker.getISSLocation();

      console.log("🌍 ISS Current Location:");
      console.log(`Latitude:  ${issLocation.latitude}`);
      console.log(`Longitude: ${issLocation.longitude}`);
      console.log(
        `Timestamp: ${new Date(issLocation.timestamp * 1000).toLocaleString()}`
      );

      // Step 2: Define user location (simulate Austin, TX)
      const userLat = 30.2672;
      const userLon = -97.7431;

      // Step 3: Calculate distance to ISS
      const distance = tracker.calculateDistance(
        userLat,
        userLon,
        issLocation.latitude,
        issLocation.longitude
      );

      console.log(`📏 Distance from Austin, TX: ${Math.round(distance)} km`);

      // Step 4: Generate the signal
      const signal = tracker.generateSignal(distance);

      // Step 5: Print out the full signal for inspection
      console.log("📡 Generated Signal:");
      console.log(JSON.stringify(signal, null, 2));
    } catch (error) {
      console.error("❌ Error during ISS Tracker test:", error.message);
    }
  })();
}
