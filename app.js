'use strict';

const Homey = require('homey');

class NSPanelApp extends Homey.App {
  async onInit() {
    this.log('NSPanel for Homey v0.8.1 initialized');
  }
}

module.exports = NSPanelApp;
