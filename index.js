const q = require("daskeyboard-applet");
const fetch = require("node-fetch");
const logger = q.logger;

class ISSTracker extends q.DesktopApp {
  constructor() {
    super();
    this.pollingInterval = 30000; // runs every 30 seconds

    logger.info("ISS Tracker ready to launch!");
  }

  async getISSLocation() {
    const response = await fetch("http://api.open-notify.org/iss-now.json");
    const data = await response.json(); // fetching and parsing the response

    if (data.message !== "success") {
      throw new Error("Failed to get ISS Location"); // error thrown if api doesn't work
    }

    return {
      latitude: parseFloat(data.iss_position.latitude),
      longitude: parseFloat(data.iss_position.longitude),
    };
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    // haversine formula function to compute the great-circle distance between two points on a sphere
    const R = 6371; // Earth's radius
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // length of the arc between the two coordinates
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180); // conversion from degrees to radians (for the haversine formula)
  }

  generateSignal(distance) {
    let color;
    let effect;
    let message = "";

    if (distance < 500) {
      color = "#00FF00"; // green
      effect = "BLINK";
      message = `ISS is directly overhead – only ${Math.round(
        distance
      )}km away!`;
    } else if (distance < 1000) {
      color = "#FFDD00"; // yellow
      effect = "BLINK";
      message = `ISS is very close – ${Math.round(distance)}km away!`;
    } else if (distance < 2000) {
      color = "#FF6600"; // orange
      effect = "BLINK";
      message = `ISS is nearby – ${Math.round(distance)}km away.`;
    } else {
      color = "#FF0000"; // red
      effect = "SET_COLOR";
      message = `ISS is in orbit – ${Math.round(
        distance
      )}km from your location.`;
    }
    return new q.Signal({
      points: [[new q.Point(color, effect)]],
      name: "ISS Tracker",
      message: message,
    });
  }

  async run() {
    const userLat = this.config.latitude;
    const userLon = this.config.longitude;

    if (!userLat || !userLon) {
      return new q.Signal.error(["User needs to input his coordinates."]);
    }

    const issLocation = await this.getISSLocation();

    const distance = this.calculateDistance(
      userLat,
      userLon,
      issLocation.latitude,
      issLocation.longitude
    );

    return this.generateSignal(distance);
  }
}

module.exports = { ISSTracker: ISSTracker };
const applet = new ISSTracker();
