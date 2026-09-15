'use strict';
const Homey = require('homey');

class NSPanelDriver extends Homey.Driver {
  async onInit() {
    this.leftButtonTrigger = this.homey.flow.getDeviceTriggerCard('left_button_pressed');
    this.rightButtonTrigger = this.homey.flow.getDeviceTriggerCard('right_button_pressed');
    this.pageChangedTrigger = this.homey.flow.getDeviceTriggerCard('page_changed');
    this.panelOnlineTrigger = this.homey.flow.getDeviceTriggerCard('panel_online');
    this.panelOfflineTrigger = this.homey.flow.getDeviceTriggerCard('panel_offline');
    this.homeyButtonTrigger = this.homey.flow.getDeviceTriggerCard('homey_button_pressed');

    this.homey.flow.getActionCard('restart_panel')
      .registerRunListener(async ({ device }) => device.pressButton('entity_restart'));

    this.homey.flow.getActionCard('update_tft')
      .registerRunListener(async ({ device }) => device.pressButton('entity_update_tft'));

    this.homey.flow.getActionCard('set_brightness')
      .registerRunListener(async ({ device, value }) => device.setNumber('entity_brightness', value));

    this.homey.flow.getActionCard('set_dim_brightness')
      .registerRunListener(async ({ device, value }) => device.setNumber('entity_brightness_dim', value));

    this.homey.flow.getActionCard('set_sleep_brightness')
      .registerRunListener(async ({ device, value }) => device.setNumber('entity_brightness_sleep', value));

    this.homey.flow.getActionCard('set_timeout_dim')
      .registerRunListener(async ({ device, seconds }) => device.setNumber('entity_timeout_dim', seconds));

    this.homey.flow.getActionCard('set_timeout_page')
      .registerRunListener(async ({ device, seconds }) => device.setNumber('entity_timeout_page', seconds));

    this.homey.flow.getActionCard('set_timeout_sleep')
      .registerRunListener(async ({ device, seconds }) => device.setNumber('entity_timeout_sleep', seconds));

    this.homey.flow.getActionCard('set_notification_sound')
      .registerRunListener(async ({ device, enabled }) => device.setSwitch('entity_sound', enabled));

    this.homey.flow.getActionCard('set_wakeup_page')
      .registerRunListener(async ({ device, page }) => device.setSelect('entity_wakeup_page', page));

    this.homey.flow.getActionCard('display_command')
      .registerRunListener(async ({ device, command }) => device.sendDisplayCommand(command));

    this.homey.flow.getActionCard('display_page')
      .registerRunListener(async ({ device, page }) => device.showDisplayPage(page));

    this.homey.flow.getActionCard('display_text')
      .registerRunListener(async ({ device, page, component, text }) =>
        device.setDisplayText(page, component, text));

    this.homey.flow.getActionCard('display_value')
      .registerRunListener(async ({ device, page, component, value }) =>
        device.setDisplayValue(page, component, value));

    this.homey.flow.getActionCard('display_visibility')
      .registerRunListener(async ({ device, page, component, visible }) =>
        device.setDisplayVisibility(page, component, visible));

    this.homey.flow.getActionCard('show_homey_page1')
      .registerRunListener(async ({ device }) => device.renderHomeyPage1(true));

    this.homey.flow.getActionCard('set_homey_page1_button')
      .registerRunListener(async ({ device, button, label, state }) =>
        device.setHomeyPage1Button(button, label, state));

    this.homey.flow.getActionCard('test_homey_page1_button')
      .registerRunListener(async ({ device, button }) =>
        device.testHomeyPage1Button(button));

    this.homey.flow.getActionCard('set_homey_page1_button_full')
      .registerRunListener(async ({ device, button, label, state, icon, info }) =>
        device.setHomeyPage1ButtonFull(button, label, state, icon, info));

    this.homey.flow.getActionCard('show_homey_portal')
      .registerRunListener(async ({ device }) => device.renderHomeyPortal(true));

    this.homey.flow.getActionCard('set_portal_tile')
      .registerRunListener(async ({ device, tile, label, state, icon, info }) =>
        device.setPortalTile(tile, label, state, icon, info));

    this.homey.flow.getActionCard('upload_homey_portal_tft')
      .registerRunListener(async ({ device, url }) =>
        device.uploadHomeyPortalTft(url));

    this.homey.flow.getActionCard('restore_standard_tft')
      .registerRunListener(async ({ device }) =>
        device.restoreStandardTft());


    this.homey.flow.getActionCard('show_portal_page')
      .registerRunListener(async ({ device, page }) =>
        device.showPortalPage(page));

    this.homey.flow.getActionCard('set_energy_field')
      .registerRunListener(async ({ device, field, value }) =>
        device.setEnergyField(field, value));

  }

  async onPair(session) {
    session.setHandler('list_devices', async () => [{
      name: 'wandpaneel',
      data: { id: `nspanel-${Date.now()}` },
      settings: {
        host:'wandpaneel.local',
        username:'',
        password:'',
        entity_relay1:'Relay 1',
        entity_relay2:'Relay 2',
        entity_temperature:'Temperature',
        entity_current_page:'Current Page',
        entity_nextion:'Nextion display',
        entity_left_button:'Left Button',
        entity_right_button:'Right Button',
        entity_brightness:'Display Brightness',
        entity_brightness_dim:'Display Brightness Dimdown',
        entity_brightness_sleep:'Display Brightness Sleep',
        entity_sound:'Sound - Notification',
        entity_timeout_dim:'Timeout Dimming',
        entity_timeout_page:'Timeout Page',
        entity_timeout_sleep:'Timeout Sleep',
        entity_wakeup_page:'Wake-up page',
        entity_restart:'Restart',
        entity_update_tft:'Update TFT display',
        entity_version_blueprint:'Version Blueprint',
        entity_version_esphome:'Version ESPHome',
        entity_version_tft:'Version TFT',
        entity_homey_command:'Homey Display Command',
        entity_homey_bridge_version:'Homey Bridge Version',
        entity_homey_last_button:'Homey Last Button',
        entity_homey_portal_tft_url:'Homey Portal TFT URL',
        entity_homey_portal_tft_upload:'Upload Homey Portal TFT',
        entity_homey_standard_tft_upload:'Upload Standard NSPanel EU TFT',
        entity_homey_portal_tft_version:'Homey Portal TFT Version',
        homey_page1_auto_show:true,
        homey_page1_title:'Homey',
        homey_page1_button1_label:'Knop 1',
        homey_page1_button2_label:'Knop 2',
        homey_page1_button3_label:'Knop 3',
        homey_page1_button4_label:'Knop 4',
        homey_page1_button5_label:'Knop 5',
        homey_page1_button6_label:'Knop 6',
        homey_page1_button7_label:'Knop 7',
        homey_page1_button8_label:'Knop 8',
        homey_page1_icon_font:8,
        homey_page1_icon_color:'255,255,255',
        homey_page1_button1_icon:'E6E8',
        homey_page1_button2_icon:'E6E8',
        homey_page1_button3_icon:'E6E8',
        homey_page1_button4_icon:'E6E8',
        homey_page1_button5_icon:'E6E8',
        homey_page1_button6_icon:'E6E8',
        homey_page1_button7_icon:'E6E8',
        homey_page1_button8_icon:'E6E8',
        homey_page1_button1_info:'',
        homey_page1_button2_info:'',
        homey_page1_button3_info:'',
        homey_page1_button4_info:'',
        homey_page1_button5_info:'',
        homey_page1_button6_info:'',
        homey_page1_button7_info:'',
        homey_page1_button8_info:''
      }
    }]);
  }
}

module.exports = NSPanelDriver;
