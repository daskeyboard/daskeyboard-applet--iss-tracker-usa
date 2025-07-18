const q = require("daskeyboard-applet");
const fetch = require("node-fetch");
const logger = q.logger;

class ISSTracker extends q.DesktopApp {
  constructor() {
    super();
    this.pollingInterval = 60 * 0.5 * 1000; // runs every 30 seconds

    logger.info("ISS Tracker ready to launch!");
  }

  async applyConfig() {
    if (!this.config.postalCode) {
      throw new Error("Postal code is required.");
    }
    const location = await this.getUserCoordinates();

    this.userLat = location.latitude;
    this.userLon = location.longitude;
    logger.info(
      `User coordinates set to: ${location.latitude}, ${location.longitude}`
    );
    return true;
  }

  async getISSLocation() {
    try {
      const response = await fetch(
        "https://api.wheretheiss.at/v1/satellites/25544"
      ); // 25544 is the ISS's NORAD ID
      const data = await response.json(); // fetching and parsing the response

      return {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
      };
    } catch (error) {
      throw new Error(`Failed to get ISS location: ${error.message}`);
    }
  }

  async getUserCoordinates() {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${this.config.postalCode}&count=1&countryCode=US`;
    const response = await fetch(geoUrl);

    if (!response.ok) {
      throw new Error(`Geocoding API failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error(`Postal code not found: "${this.config.postalCode}".`);
    }

    return data.results[0];
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
    const issLocation = await this.getISSLocation();

    const distance = this.calculateDistance(
      this.userLat,
      this.userLon,
      issLocation.latitude,
      issLocation.longitude
    );

    return this.generateSignal(distance);
  }
}

module.exports = { ISSTracker: ISSTracker };
const applet = new ISSTracker();
