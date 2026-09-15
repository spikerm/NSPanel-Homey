'use strict';

const http = require('http');
const https = require('https');

function authHeader(username, password) {
  if (!username) return {};
  return {
    Authorization: `Basic ${Buffer.from(`${username}:${password || ''}`).toString('base64')}`
  };
}

function normalizeBaseUrl(baseUrl) {
  let value = String(baseUrl || '').trim();
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  return value.replace(/\/+$/, '');
}

function request(method, baseUrl, path, username='', password='', timeout=5000) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, `${normalizeBaseUrl(baseUrl)}/`);
    const mod = u.protocol === 'https:' ? https : http;

    const req = mod.request(u, {
      method,
      headers: {
        ...authHeader(username, password),
        'User-Agent': 'Homey-NSPanel/0.3',
        'Accept': 'application/json,*/*',
        'Connection': 'close'
      },
      timeout
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        resolve({ statusCode: res.statusCode, body: data, headers: res.headers });
      });
    });

    req.on('timeout', () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
    req.end();
  });
}

const enc = value => encodeURIComponent(value);

async function getEntity(baseUrl, domain, entity, username='', password='') {
  const r = await request(
    'GET',
    baseUrl,
    `/${domain}/${enc(entity)}?detail=all`,
    username,
    password
  );
  return JSON.parse(r.body);
}

async function action(baseUrl, domain, entity, actionName, username='', password='', params={}) {
  const q = new URLSearchParams(params).toString();
  return request(
    'POST',
    baseUrl,
    `/${domain}/${enc(entity)}/${actionName}${q ? `?${q}` : ''}`,
    username,
    password
  );
}

async function setNumber(baseUrl, entity, value, username='', password='') {
  return action(baseUrl, 'number', entity, 'set', username, password, { value });
}

async function setSelect(baseUrl, entity, option, username='', password='') {
  return action(baseUrl, 'select', entity, 'set', username, password, { option });
}

async function setText(baseUrl, entity, value, username='', password='') {
  return action(baseUrl, 'text', entity, 'set', username, password, { value });
}

async function pressButton(baseUrl, entity, username='', password='') {
  return action(baseUrl, 'button', entity, 'press', username, password);
}

/**
 * Minimal SSE/EventSource client for ESPHome /events.
 *
 * Supported event types:
 * - ping
 * - state
 * - log
 *
 * Returns an object with close().
 */
function openEventStream(baseUrl, username='', password='', handlers={}) {
  let closed = false;
  let req = null;
  let res = null;

  const u = new URL('/events', `${normalizeBaseUrl(baseUrl)}/`);
  const mod = u.protocol === 'https:' ? https : http;

  req = mod.request(u, {
    method: 'GET',
    headers: {
      ...authHeader(username, password),
      'User-Agent': 'Homey-NSPanel/0.3',
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });

  req.on('response', response => {
    res = response;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      let body = '';
      response.on('data', c => body += c);
      response.on('end', () => {
        if (!closed && handlers.onError) {
          handlers.onError(new Error(`SSE HTTP ${response.statusCode}: ${body.slice(0, 200)}`));
        }
      });
      return;
    }

    if (handlers.onOpen) handlers.onOpen(response);

    response.setEncoding('utf8');
    let buffer = '';
    let eventName = 'message';
    let dataLines = [];

    const dispatch = () => {
      if (!dataLines.length) {
        eventName = 'message';
        return;
      }

      const data = dataLines.join('\n');
      dataLines = [];

      try {
        let payload = data;
        if (eventName === 'state' || eventName === 'ping' || eventName === 'log') {
          try { payload = JSON.parse(data); } catch (_) {}
        }

        if (handlers.onEvent) handlers.onEvent(eventName, payload);
        if (eventName === 'state' && handlers.onState) handlers.onState(payload);
        if (eventName === 'ping' && handlers.onPing) handlers.onPing(payload);
        if (eventName === 'log' && handlers.onLog) handlers.onLog(payload);
      } finally {
        eventName = 'message';
      }
    };

    response.on('data', chunk => {
      buffer += chunk;

      while (true) {
        const idx = buffer.indexOf('\n');
        if (idx === -1) break;

        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);

        if (line === '') {
          dispatch();
          continue;
        }

        if (line.startsWith(':')) continue;

        const colon = line.indexOf(':');
        let field;
        let value;

        if (colon === -1) {
          field = line;
          value = '';
        } else {
          field = line.slice(0, colon);
          value = line.slice(colon + 1);
          if (value.startsWith(' ')) value = value.slice(1);
        }

        if (field === 'event') eventName = value || 'message';
        else if (field === 'data') dataLines.push(value);
      }
    });

    response.on('end', () => {
      if (!closed && handlers.onClose) handlers.onClose();
    });

    response.on('error', err => {
      if (!closed && handlers.onError) handlers.onError(err);
    });
  });

  req.on('error', err => {
    if (!closed && handlers.onError) handlers.onError(err);
  });

  req.end();

  return {
    close() {
      closed = true;
      try { res?.destroy(); } catch (_) {}
      try { req?.destroy(); } catch (_) {}
    }
  };
}

module.exports = {
  request,
  getEntity,
  action,
  setNumber,
  setSelect,
  setText,
  pressButton,
  openEventStream
};
