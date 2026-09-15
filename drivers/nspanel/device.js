'use strict';

const Homey = require('homey');
const {
  getEntity,
  action,
  setNumber,
  setSelect,
  setText,
  pressButton,
  request,
  openEventStream
} = require('../../lib/esphome-web');

class NSPanelDevice extends Homey.Device {
  async onInit() {
    this.log('NSPanel for Homey v0.7.1 initialized');

    this._sse = null;
    this._reconnectTimer = null;
    this._watchdogTimer = null;
    this._fallbackTimer = null;
    this._lastEventAt = 0;
    this._reconnectDelay = 1000;

    this._lastLeft = false;
    this._lastRight = false;
    this._lastPage = null;
    this._online = null;
    this._lastHomeyButtonEvent = null;
    this._homeyInitialized = false;

    this.registerCapabilityListener('nspanel_relay_1', v => this._setRelay(1, v));
    this.registerCapabilityListener('nspanel_relay_2', v => this._setRelay(2, v));
    this.registerCapabilityListener('nspanel_brightness', v => this.setNumber('entity_brightness', v));
    this.registerCapabilityListener('nspanel_brightness_dim', v => this.setNumber('entity_brightness_dim', v));
    this.registerCapabilityListener('nspanel_brightness_sleep', v => this.setNumber('entity_brightness_sleep', v));
    this.registerCapabilityListener('nspanel_timeout_dim', v => this.setNumber('entity_timeout_dim', v));
    this.registerCapabilityListener('nspanel_timeout_page', v => this.setNumber('entity_timeout_page', v));
    this.registerCapabilityListener('nspanel_timeout_sleep', v => this.setNumber('entity_timeout_sleep', v));
    this.registerCapabilityListener('nspanel_sound_notification', v => this.setSwitch('entity_sound', v));

    // Start realtime connection immediately. Do not block on REST bootstrap.
    this.log(`Startup: host=${this.getSetting('host') || '(empty)'}`);
    this.log('Startup: opening SSE');
    this._connectEvents();

    // Run REST bootstrap asynchronously with detailed step logging.
    this._bootstrapRest()
      .then(() => this.log('Startup: REST bootstrap complete'))
      .catch(err => this.error('Startup: REST bootstrap failed:', err));

    // Watchdog: ESPHome sends ping events. Reconnect if stream is stale.
    this._watchdogTimer = this.homey.setInterval(() => {
      if (!this._lastEventAt) return;
      const age = Date.now() - this._lastEventAt;
      if (age > 60000) {
        this.log(`SSE watchdog: ${Math.round(age / 1000)}s stale, reconnecting`);
        this._scheduleReconnect(true);
      }
    }, 15000);

    // Slow REST fallback/health check. SSE remains primary.
    this._fallbackTimer = this.homey.setInterval(() => {
      this._healthCheck().catch(err => this.error('Health check:', err));
    }, 60000);
  }

  _baseUrl() {
    let host = String(this.getSetting('host') || '').trim();
    if (!host) throw new Error('NSPanel host ontbreekt');
    if (!/^https?:\/\//i.test(host)) host = `http://${host}`;
    return host;
  }

  _auth() {
    return {
      username: this.getSetting('username') || '',
      password: this.getSetting('password') || ''
    };
  }

  async _get(domain, key) {
    const entity = this.getSetting(key);
    if (!entity) throw new Error(`${key} ontbreekt`);
    const a = this._auth();
    return getEntity(this._baseUrl(), domain, entity, a.username, a.password);
  }

  async _safe(domain, key) {
    try { return await this._get(domain, key); }
    catch (_) { return null; }
  }

  async _setOnline(value, connectionText=null) {
    const changed = this._online !== value;
    this._online = value;

    await this.setCapabilityValue('nspanel_online', value).catch(() => {});
    if (connectionText !== null) {
      await this.setCapabilityValue('nspanel_connection', connectionText).catch(() => {});
    }

    if (value) await this.setAvailable().catch(() => {});
    else await this.setUnavailable('ESPHome niet bereikbaar').catch(() => {});

    if (changed) {
      if (value) {
        await this.driver.panelOnlineTrigger.trigger(this, {}, {}).catch(err => this.error(err));
      } else {
        await this.driver.panelOfflineTrigger.trigger(this, {}, {}).catch(err => this.error(err));
      }
    }
  }

  _connectEvents() {
    this._closeEvents();

    let baseUrl;
    try { baseUrl = this._baseUrl(); }
    catch (err) {
      this.error(err);
      return;
    }

    const a = this._auth();
    this.log(`SSE verbinden met ${baseUrl}/events`);

    this._sse = openEventStream(baseUrl, a.username, a.password, {
      onOpen: async () => {
        this._lastEventAt = Date.now();
        this._reconnectDelay = 1000;
        await this._setOnline(true, 'Realtime (SSE)');
      },

      onEvent: () => {
        this._lastEventAt = Date.now();
      },

      onState: payload => {
        this._lastEventAt = Date.now();
        this._handleState(payload).catch(err => this.error('State event:', err));
      },

      onPing: () => {
        this._lastEventAt = Date.now();
      },

      onClose: () => {
        this.log('SSE verbinding gesloten');
        this._setOnline(false, 'Opnieuw verbinden…').catch(() => {});
        this._scheduleReconnect();
      },

      onError: err => {
        this.error('SSE:', err.message);
        this._setOnline(false, 'SSE fout').catch(() => {});
        this._scheduleReconnect();
      }
    });
  }

  _closeEvents() {
    if (this._sse) {
      try { this._sse.close(); } catch (_) {}
      this._sse = null;
    }
  }

  _scheduleReconnect(immediate=false) {
    this._closeEvents();

    if (this._reconnectTimer) {
      this.homey.clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    const delay = immediate ? 250 : this._reconnectDelay;
    if (!immediate) this._reconnectDelay = Math.min(this._reconnectDelay * 2, 30000);

    this._reconnectTimer = this.homey.setTimeout(() => {
      this._reconnectTimer = null;
      this._connectEvents();
    }, delay);
  }

  /**
   * ESPHome 2026.1.3..2026.8.x sends:
   *   id      = legacy id
   *   name_id = domain/Entity Name
   *
   * ESPHome >= 2026.8 sends the new format in id.
   * Support both.
   */
  _eventIdentity(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const candidate =
      (typeof payload.name_id === 'string' && payload.name_id.includes('/'))
        ? payload.name_id
        : payload.id;

    if (!candidate || typeof candidate !== 'string') return null;

    if (candidate.includes('/')) {
      const parts = candidate.split('/');
      return {
        domain: parts.shift(),
        name: parts.pop(),
        raw: candidate
      };
    }

    // Legacy examples: sensor-temperature, binary_sensor-left_button
    const domains = [
      'binary_sensor','text_sensor','alarm_control_panel',
      'sensor','switch','number','select','button','light','fan'
    ];

    for (const domain of domains) {
      const prefix = `${domain}-`;
      if (candidate.startsWith(prefix)) {
        return {
          domain,
          name: candidate.slice(prefix.length),
          raw: candidate,
          legacy: true
        };
      }
    }

    return { domain: '', name: candidate, raw: candidate, legacy: true };
  }

  _norm(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  _matches(payload, settingKey) {
    const ident = this._eventIdentity(payload);
    if (!ident) return false;

    const configured = this.getSetting(settingKey);
    if (!configured) return false;

    // New event format preserves the exact configured name.
    if (!ident.legacy && ident.name === configured) return true;

    // Legacy ids are normalized.
    return this._norm(ident.name) === this._norm(configured);
  }

  async _handleState(payload) {
    if (!payload || typeof payload !== 'object') return;

    await this._setOnline(true, 'Realtime (SSE)');

    if (this._matches(payload, 'entity_temperature')) {
      const value = Number(payload.value);
      if (Number.isFinite(value)) await this.setCapabilityValue('measure_temperature', value);
      return;
    }

    if (this._matches(payload, 'entity_relay1')) {
      await this.setCapabilityValue('nspanel_relay_1', Boolean(payload.value));
      return;
    }

    if (this._matches(payload, 'entity_relay2')) {
      await this.setCapabilityValue('nspanel_relay_2', Boolean(payload.value));
      return;
    }

    if (this._matches(payload, 'entity_nextion')) {
      await this.setCapabilityValue('nspanel_nextion_ok', Boolean(payload.value));
      return;
    }

    if (this._matches(payload, 'entity_brightness')) {
      const value = Number(payload.value);
      if (Number.isFinite(value)) await this.setCapabilityValue('nspanel_brightness', value);
      return;
    }

    if (this._matches(payload, 'entity_brightness_dim')) {
      const value = Number(payload.value);
      if (Number.isFinite(value)) await this.setCapabilityValue('nspanel_brightness_dim', value);
      return;
    }

    if (this._matches(payload, 'entity_brightness_sleep')) {
      const value = Number(payload.value);
      if (Number.isFinite(value)) await this.setCapabilityValue('nspanel_brightness_sleep', value);
      return;
    }

    if (this._matches(payload, 'entity_sound')) {
      await this.setCapabilityValue('nspanel_sound_notification', Boolean(payload.value));
      return;
    }

    if (this._matches(payload, 'entity_timeout_dim')) {
      const value = Number(payload.value);
      if (Number.isFinite(value)) await this.setCapabilityValue('nspanel_timeout_dim', value);
      return;
    }

    if (this._matches(payload, 'entity_timeout_page')) {
      const value = Number(payload.value);
      if (Number.isFinite(value)) await this.setCapabilityValue('nspanel_timeout_page', value);
      return;
    }

    if (this._matches(payload, 'entity_timeout_sleep')) {
      const value = Number(payload.value);
      if (Number.isFinite(value)) await this.setCapabilityValue('nspanel_timeout_sleep', value);
      return;
    }

    if (this._matches(payload, 'entity_wakeup_page')) {
      const value = String(payload.value ?? payload.state ?? '');
      await this.setCapabilityValue('nspanel_wakeup_page', value);
      return;
    }

    if (this._matches(payload, 'entity_current_page')) {
      const page = String(payload.value ?? payload.state ?? '');
      await this.setCapabilityValue('nspanel_current_page', page);

      if (this._lastPage !== null && page && page !== this._lastPage) {
        await this.driver.pageChangedTrigger.trigger(this, { page }, {});
      }
      this._lastPage = page;
      return;
    }

    if (this._matches(payload, 'entity_left_button')) {
      const now = Boolean(payload.value);
      await this.setCapabilityValue('nspanel_left_button', now);

      if (now && !this._lastLeft) {
        await this.driver.leftButtonTrigger.trigger(this, {}, {});
      }
      this._lastLeft = now;
      return;
    }

    if (this._matches(payload, 'entity_right_button')) {
      const now = Boolean(payload.value);
      await this.setCapabilityValue('nspanel_right_button', now);

      if (now && !this._lastRight) {
        await this.driver.rightButtonTrigger.trigger(this, {}, {});
      }
      this._lastRight = now;
      return;
    }

    if (this._matches(payload, 'entity_version_blueprint')) {
      await this.setCapabilityValue(
        'nspanel_version_blueprint',
        String(payload.value ?? payload.state ?? '')
      );
      return;
    }

    if (this._matches(payload, 'entity_version_esphome')) {
      await this.setCapabilityValue(
        'nspanel_version_esphome',
        String(payload.value ?? payload.state ?? '')
      );
      return;
    }

    if (this._matches(payload, 'entity_version_tft')) {
      await this.setCapabilityValue(
        'nspanel_version_tft',
        String(payload.value ?? payload.state ?? '')
      );
      return;
    }

    if (this._matches(payload, 'entity_homey_command')) {
      await this.setCapabilityValue('nspanel_bridge_ready', true);
      return;
    }

    if (this._matches(payload, 'entity_homey_last_button')) {
      const raw = String(payload.value ?? payload.state ?? '');
      if (raw && raw !== this._lastHomeyButtonEvent) {
        this._lastHomeyButtonEvent = raw;
        await this._handleHomeyButtonEvent(raw);
      }
      return;
    }

    if (this._matches(payload, 'entity_homey_bridge_version')) {
      await this.setCapabilityValue('nspanel_bridge_ready', true);
      await this.setCapabilityValue(
        'nspanel_bridge_version',
        String(payload.value ?? payload.state ?? '')
      );
      return;
    }
  }

  async _bootstrapRest() {
    const a = this._auth();
    const baseUrl = this._baseUrl();

    this.log(`Bootstrap: GET ${baseUrl}/`);
    await request('GET', baseUrl, '/', a.username, a.password, 3000);
    this.log('Bootstrap: root OK');
    await this._setOnline(true, 'REST bootstrap');
    this.log('Bootstrap: reading entities');

    const list = await Promise.all([
      this._safe('sensor','entity_temperature'),
      this._safe('switch','entity_relay1'),
      this._safe('switch','entity_relay2'),
      this._safe('text_sensor','entity_current_page'),
      this._safe('binary_sensor','entity_nextion'),
      this._safe('binary_sensor','entity_left_button'),
      this._safe('binary_sensor','entity_right_button'),
      this._safe('number','entity_brightness'),
      this._safe('number','entity_brightness_dim'),
      this._safe('number','entity_brightness_sleep'),
      this._safe('switch','entity_sound'),
      this._safe('number','entity_timeout_dim'),
      this._safe('number','entity_timeout_page'),
      this._safe('number','entity_timeout_sleep'),
      this._safe('select','entity_wakeup_page'),
      this._safe('text_sensor','entity_version_blueprint'),
      this._safe('text_sensor','entity_version_esphome'),
      this._safe('text_sensor','entity_version_tft'),
      this._safe('text','entity_homey_command'),
      this._safe('text_sensor','entity_homey_bridge_version'),
      this._safe('text_sensor','entity_homey_last_button'),
      this._safe('text','entity_homey_portal_tft_url'),
      this._safe('text_sensor','entity_homey_portal_tft_version')
    ]);

    const keys = [
      'entity_temperature','entity_relay1','entity_relay2','entity_current_page',
      'entity_nextion','entity_left_button','entity_right_button',
      'entity_brightness','entity_brightness_dim','entity_brightness_sleep',
      'entity_sound','entity_timeout_dim','entity_timeout_page','entity_timeout_sleep',
      'entity_wakeup_page','entity_version_blueprint','entity_version_esphome','entity_version_tft',
      'entity_homey_command','entity_homey_bridge_version','entity_homey_last_button'
    ];

    for (let i = 0; i < list.length; i++) {
      const payload = list[i];
      if (!payload) continue;

      // REST ids and SSE ids are handled by the same state mapper,
      // but guarantee an exact match with the configured entity by injecting name_id.
      const configured = this.getSetting(keys[i]);
      if (configured) {
        const domainMap = [
          'sensor','switch','switch','text_sensor',
          'binary_sensor','binary_sensor','binary_sensor',
          'number','number','number',
          'switch','number','number','number',
          'select','text_sensor','text_sensor','text_sensor','text','text_sensor','text_sensor'
        ];
        payload.name_id = `${domainMap[i]}/${configured}`;
      }
      await this._handleState(payload);
    }

    this.log('Bootstrap: entity scan complete');

    // Restore the TFT globals that the HA Blueprint used to provide.
    this.log('Bootstrap: sending Homey panel init');
    try {
      await this.initializeHomeyPanel();
      this.log('Bootstrap: Homey panel init complete');
    } catch (err) {
      // Keep the realtime connection alive even if one display command fails.
      this.error('Bootstrap: Homey panel init had errors:', err);
    }
  }

  async _healthCheck() {
    try {
      const a = this._auth();
      await request('GET', this._baseUrl(), '/', a.username, a.password, 3000);

      if (!this._sse) {
        await this._setOnline(true, 'REST fallback');
        this._scheduleReconnect(true);
      }
    } catch (err) {
      await this._setOnline(false, 'Offline');
      throw err;
    }
  }

  async _setRelay(index, value) {
    const key = index === 1 ? 'entity_relay1' : 'entity_relay2';
    const a = this._auth();
    return action(
      this._baseUrl(),
      'switch',
      this.getSetting(key),
      value ? 'turn_on' : 'turn_off',
      a.username,
      a.password
    );
  }

  async setSwitch(key, value) {
    const a = this._auth();
    return action(
      this._baseUrl(),
      'switch',
      this.getSetting(key),
      value ? 'turn_on' : 'turn_off',
      a.username,
      a.password
    );
  }

  async setNumber(key, value) {
    const a = this._auth();
    return setNumber(
      this._baseUrl(),
      this.getSetting(key),
      value,
      a.username,
      a.password
    );
  }

  async setSelect(key, value) {
    const a = this._auth();
    return setSelect(
      this._baseUrl(),
      this.getSetting(key),
      value,
      a.username,
      a.password
    );
  }

  async pressButton(key) {
    const a = this._auth();
    return pressButton(
      this._baseUrl(),
      this.getSetting(key),
      a.username,
      a.password
    );
  }

  _escapeNextionText(value) {
    // Nextion strings are quoted. Keep commands predictable and avoid command injection.
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/[\r\n]/g, ' ');
  }

  _safeIdentifier(value, label='identifier') {
    const text = String(value || '').trim();
    if (!/^[A-Za-z0-9_]+$/.test(text)) {
      throw new Error(`Ongeldige ${label}: ${text}`);
    }
    return text;
  }

  async sendDisplayCommand(command) {
    const text = String(command || '').trim();
    if (!text) throw new Error('Display-commando is leeg');
    if (text.length > 240) throw new Error('Display-commando is te lang');

    this.log(`Display TX: ${text}`);
    const a = this._auth();
    try {
      await setText(
        this._baseUrl(),
        this.getSetting('entity_homey_command'),
        text,
        a.username,
        a.password
      );
      await this.setCapabilityValue('nspanel_bridge_ready', true).catch(() => {});
      this.log('Display TX: OK');
    } catch (err) {
      await this.setCapabilityValue('nspanel_bridge_ready', false).catch(() => {});
      throw new Error(`Homey Display Bridge niet bereikbaar: ${err.message}`);
    }
  }

  _cleanBridgeText(value, max=80) {
    return String(value ?? '')
      .replace(/[\r\n]/g, ' ')
      .replace(/:/g, ' ')
      .trim()
      .slice(0, max);
  }

  _sleep(ms) {
    return new Promise(resolve => this.homey.setTimeout(resolve, ms));
  }

  async initializeHomeyPanel() {
    await this.sendDisplayCommand('homey:init');
    this._homeyInitialized = true;

    if (this.getSetting('homey_page1_auto_show') !== false) {
      await this.renderHomeyPortal(true);
    }
  }

  async showDisplayPage(page) {
    page = this._safeIdentifier(page, 'pagina');
    return this.sendDisplayCommand(`page:${page}`);
  }

  async setDisplayText(page, component, text) {
    // The bridge works on components of the currently visible page.
    // 'page' is retained in the Flow card for compatibility/documentation.
    this._safeIdentifier(page, 'pagina');
    component = this._safeIdentifier(component, 'component');
    return this.sendDisplayCommand(`text:${component}:${this._cleanBridgeText(text, 160)}`);
  }

  async setDisplayValue(page, component, value) {
    this._safeIdentifier(page, 'pagina');
    component = this._safeIdentifier(component, 'component');

    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) throw new Error('Ongeldige displaywaarde');

    return this.sendDisplayCommand(`value:${component}:${number}`);
  }

  async setDisplayVisibility(page, component, visible) {
    this._safeIdentifier(page, 'pagina');
    component = this._safeIdentifier(component, 'component');
    return this.sendDisplayCommand(`vis:${component}:${visible ? 1 : 0}`);
  }

  _page1Label(index) {
    return this._cleanBridgeText(
      this.getSetting(`homey_page1_button${index}_label`) || `Knop ${index}`,
      22
    );
  }

  _page1Icon(index) {
    const raw = String(this.getSetting(`homey_page1_button${index}_icon`) || 'E6E8')
      .trim()
      .replace(/^U\+/i, '')
      .replace(/^0x/i, '')
      .toUpperCase();
    return /^[0-9A-F]{1,6}$/.test(raw) ? raw : 'E6E8';
  }

  _page1Info(index) {
    return this._cleanBridgeText(
      this.getSetting(`homey_page1_button${index}_info`) || '',
      10
    );
  }

  _page1IconFont() {
    const n = Math.round(Number(this.getSetting('homey_page1_icon_font') ?? 8));
    return Number.isFinite(n) && n >= 0 && n <= 255 ? n : 8;
  }

  _page1IconRgb() {
    const raw = String(this.getSetting('homey_page1_icon_color') || '255,255,255');
    const parts = raw.split(',').map(v => Math.max(0, Math.min(255, Math.round(Number(v.trim())))));
    if (parts.length !== 3 || parts.some(v => !Number.isFinite(v))) return [255,255,255];
    return parts;
  }

  _homeyButtonCommand(id, state, iconHex, rgb, font, info, label) {
    const safeLabel = this._cleanBridgeText(label, 22);
    const safeInfo = this._cleanBridgeText(info, 10);
    return `button:${id}:${state ? 1 : 0}:${iconHex}:${rgb[0]}:${rgb[1]}:${rgb[2]}:${font}:${safeInfo}:${safeLabel}`;
  }

  async showPortalPage(page) {
    const allowed = new Set([
      'homeyportal','room_lights','room_devices','climate_homey',
      'scenes_homey','ev_homey','battery_homey','media_homey',
      'door_homey','menu_homey','energy_homey','screensaver_homey'
    ]);
    const target = String(page || '').trim();
    if (!allowed.has(target)) throw new Error(`Onbekende Portal-pagina: ${target}`);
    await this.sendDisplayCommand(`portal:navigate:${target}`);
  }

  async setEnergyField(field, value) {
    const allowed = new Set([
      'solar_power','solar_today','battery_soc','battery_power','battery_state',
      'ev_power','ev_current','ev_state','grid_power','grid_state',
      'home_power','time','temperature'
    ]);
    const key = String(field || '').trim();
    if (!allowed.has(key)) throw new Error(`Onbekend Energy-veld: ${key}`);
    const safe = this._cleanBridgeText(value ?? '', 24);
    await this.sendDisplayCommand(`portal:energy:${key}:${safe}`);
  }

  async renderHomeyPortal(changePage=true) {
    if (!this._homeyInitialized) {
      await this.sendDisplayCommand('homey:init');
      this._homeyInitialized = true;
      await this._sleep(120);
    }

    if (changePage) {
      await this.sendDisplayCommand('portal:init');
      await this._sleep(300);
    }

    const title = this._cleanBridgeText(this.getSetting('portal_title') || 'Home', 40);
    const subtitle = this._cleanBridgeText(this.getSetting('portal_subtitle') || 'Homey', 40);
    const temp = this.getCapabilityValue('measure_temperature');
    const tempText = this.getSetting('portal_show_temperature') !== false && Number.isFinite(Number(temp))
      ? `${Number(temp).toFixed(1)}°C`
      : '';

    await this.sendDisplayCommand(`portal:header:${title}:${subtitle}:${tempText}`);
    await this._sleep(120);

    for (let i = 1; i <= 8; i++) {
      await this.setPortalTile(
        i,
        this._page1Label(i),
        false,
        this._page1Icon(i),
        this._page1Info(i),
        false
      );
      await this._sleep(220);
    }
  }

  async setPortalTile(tile, label, state, icon, info, ensurePage=true) {
    const n = Math.round(Number(tile));
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      throw new Error('Tegel moet 1 t/m 8 zijn');
    }

    const iconHex = String(icon || this._page1Icon(n))
      .trim()
      .replace(/^U\+/i, '')
      .replace(/^0x/i, '')
      .toUpperCase();
    if (!/^[0-9A-F]{1,6}$/.test(iconHex)) {
      throw new Error('Icooncode moet hex zijn');
    }

    if (ensurePage && this._lastPage !== 'buttonpage01') {
      await this.sendDisplayCommand('portal:init');
      await this._sleep(250);
    }

    const safeLabel = this._cleanBridgeText(label || this._page1Label(n), 22);
    const safeInfo = this._cleanBridgeText(info || '', 10);
    await this.sendDisplayCommand(
      `portal:tile:${n}:${state ? 1 : 0}:${iconHex}:${safeInfo}:${safeLabel}`
    );
  }

  async renderHomeyPage1(changePage=true) {
    if (!this._homeyInitialized) {
      await this.sendDisplayCommand('homey:init');
      this._homeyInitialized = true;
      await this._sleep(100);
    }

    if (changePage) {
      await this.sendDisplayCommand('page:buttonpage01');
      await this._sleep(250);
    }

    const title = this._cleanBridgeText(this.getSetting('homey_page1_title') || 'Homey', 60);
    await this.sendDisplayCommand(`text:page_label:${title}`);
    await this._sleep(60);

    for (let i = 1; i <= 8; i++) {
      const id = `button${String(i).padStart(2, '0')}`;
      const cmd = this._homeyButtonCommand(
        id,
        false,
        this._page1Icon(i),
        this._page1IconRgb(),
        this._page1IconFont(),
        this._page1Info(i),
        this._page1Label(i)
      );

      try {
        this.log(`Page1: sending ${id}`);
        await this.sendDisplayCommand(cmd);
        this.log(`Page1: ${id} OK`);
      } catch (err) {
        this.error(`Page1: ${id} failed:`, err);

        // Do not abort the full page on one bad component/timeout.
        // button08 is especially interesting because the current TFT may
        // differ in its final component set or queue behavior.
        if (i === 8) {
          this.log('Page1: continuing after button08 failure');
        }
      }

      await this._sleep(i === 8 ? 300 : 220);
    }
  }

  async setHomeyPage1Button(button, label, state) {
    const n = Math.round(Number(button));
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      throw new Error('Knop moet 1 t/m 8 zijn');
    }

    if (this._lastPage !== 'buttonpage01') {
      await this.renderHomeyPage1(true);
    }

    const id = `button${String(n).padStart(2, '0')}`;
    const text = this._cleanBridgeText(label || this._page1Label(n), 22);
    await this.sendDisplayCommand(this._homeyButtonCommand(
      id,
      state,
      this._page1Icon(n),
      this._page1IconRgb(),
      this._page1IconFont(),
      this._page1Info(n),
      text
    ));
  }

  async setHomeyPage1ButtonFull(button, label, state, icon, info) {
    const n = Math.round(Number(button));
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      throw new Error('Knop moet 1 t/m 8 zijn');
    }

    const iconHex = String(icon || this._page1Icon(n))
      .trim()
      .replace(/^U\+/i, '')
      .replace(/^0x/i, '')
      .toUpperCase();
    if (!/^[0-9A-F]{1,6}$/.test(iconHex)) {
      throw new Error('Icooncode moet hex zijn, bijvoorbeeld E6E8');
    }

    if (this._lastPage !== 'buttonpage01') {
      await this.renderHomeyPage1(true);
    }

    const id = `button${String(n).padStart(2, '0')}`;
    await this.sendDisplayCommand(this._homeyButtonCommand(
      id,
      Boolean(state),
      iconHex,
      this._page1IconRgb(),
      this._page1IconFont(),
      info || '',
      label || this._page1Label(n)
    ));
  }

  async testHomeyPage1Button(button) {
    const n = Math.round(Number(button));
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      throw new Error('Knop moet 1 t/m 8 zijn');
    }

    const id = `button${String(n).padStart(2, '0')}`;
    this.log(`Diagnostic: testing ${id}`);
    await this.sendDisplayCommand(this._homeyButtonCommand(
      id,
      false,
      this._page1Icon(n),
      this._page1IconRgb(),
      this._page1IconFont(),
      `T${n}`,
      `TEST ${n}`
    ));
    this.log(`Diagnostic: ${id} OK`);
    return true;
  }

  async _handleHomeyButtonEvent(raw) {
    // ESPHome: page|short_click|button01|counter
    const [page, press, component] = raw.split('|');
    if (!page || !press || !component) return;

    let match = null;
    if (page === 'buttonpage01') {
      match = /^button(0[1-8])$/.exec(component);
    } else if (page === 'home_smpl') {
      match = /^tile(0[1-8])$/.exec(component);
    } else {
      return;
    }

    if (!match) return;

    const number = Number(match[1]);
    const button = String(number);
    const label = this._page1Label(number);

    this.log(`Homey display button: ${page} ${component} ${press} (${label})`);
    await this.driver.homeyButtonTrigger.trigger(
      this,
      { page, button, label, press },
      {}
    ).catch(err => this.error('Button trigger:', err));
  }

  async uploadHomeyPortalTft(url) {
    const target = String(url || '').trim();
    if (!target) throw new Error('TFT URL is leeg');

    const a = this._auth();

    // First store the URL in the ESPHome text entity.
    await setText(
      this._baseUrl(),
      this.getSetting('entity_homey_portal_tft_url') || 'Homey Portal TFT URL',
      target,
      a.username,
      a.password
    );

    // Then trigger the upload button.
    await pressButton(
      this._baseUrl(),
      this.getSetting('entity_homey_portal_tft_upload') || 'Upload Homey Portal TFT',
      a.username,
      a.password
    );

    this.log(`Homey Portal TFT upload gestart: ${target}`);
  }

  async restoreStandardTft() {
    const a = this._auth();

    await pressButton(
      this._baseUrl(),
      this.getSetting('entity_homey_standard_tft_upload') || 'Upload Standard NSPanel EU TFT',
      a.username,
      a.password
    );

    this.log('Herstel standaard NSPanel EU TFT gestart');
  }

  async onSettings({ changedKeys }) {
    if (changedKeys.some(k => [
      'host','username','password',
      'entity_relay1','entity_relay2','entity_temperature',
      'entity_current_page','entity_nextion',
      'entity_left_button','entity_right_button',
      'entity_brightness','entity_brightness_dim','entity_brightness_sleep',
      'entity_sound','entity_timeout_dim','entity_timeout_page','entity_timeout_sleep',
      'entity_wakeup_page','entity_restart','entity_update_tft',
      'entity_version_blueprint','entity_version_esphome','entity_version_tft',
      'entity_homey_command','entity_homey_bridge_version','entity_homey_last_button'
    ].includes(k))) {
      this._lastPage = null;
      this._lastLeft = false;
      this._lastRight = false;
      this._homeyInitialized = false;
      this.homey.setTimeout(async () => {
        await this._bootstrapRest().catch(err => this.error(err));
        this._scheduleReconnect(true);
      }, 500);
    }
  }

  async onDeleted() {
    this._closeEvents();

    if (this._reconnectTimer) this.homey.clearTimeout(this._reconnectTimer);
    if (this._watchdogTimer) this.homey.clearInterval(this._watchdogTimer);
    if (this._fallbackTimer) this.homey.clearInterval(this._fallbackTimer);
  }
}

module.exports = NSPanelDevice;
