/**
 * Clever Caravan dashboard strategy (Beta).
 *
 * Overview = single-pane control panel (custom:cc-overview).
 * Subviews = themed detail pages (custom:cc-view) with a large back button.
 * Both cards are bundled here; no third-party dependencies.
 *
 * Clever Caravan entities are matched by the stable part of their unique_id.
 * Extra integrations and cc_* labels are layered on top.
 */

const ASSET_BASE = "/clever_caravan_dashboard";
const P_POWER = "clever_caravan_power";
const P_TPMS = "clever_caravan_tpms";
const P_LOC = "clever_caravan_location";
const P_WX = "clever_caravan_weather";
const P_WAY = "clever_caravan_waymote";
const OWNED_PLATFORMS = [P_POWER, P_TPMS, P_LOC, P_WX, P_WAY];

const CATS = {
  power: { title: "Power", icon: "mdi:lightning-bolt", c: "#fc8181", rgb: "252,129,129" },
  water: { title: "Water", icon: "mdi:water", c: "#38bdf8", rgb: "56,189,248" },
  climate: { title: "Climate", icon: "mdi:weather-partly-cloudy", c: "#2dd4bf", rgb: "45,212,191" },
  lights: { title: "Lights", icon: "mdi:lightbulb-on", c: "#fbd38d", rgb: "251,211,141" },
  controls: { title: "Controls", icon: "mdi:tune-vertical", c: "#b794f4", rgb: "183,148,244" },
  status: { title: "Status", icon: "mdi:check-decagram", c: "#67e8f9", rgb: "103,232,249" },
  location: { title: "Location", icon: "mdi:map-marker", c: "#67e8f9", rgb: "103,232,249" },
  tyres: { title: "Tyres", icon: "mdi:car-tire-alert", c: "#67e8f9", rgb: "103,232,249" },
  security: { title: "Security", icon: "mdi:cctv", c: "#67e8f9", rgb: "103,232,249" },
  more: { title: "More", icon: "mdi:dots-horizontal", c: "#a0aec0", rgb: "160,174,192" },
};
const ORDER = ["power", "water", "climate", "lights", "controls", "location", "tyres", "security", "more"];

const LABEL_PREFIX = "cc_";
const WATER_RE = /(tank|water|pump|grey)/;
const LIGHT_RE = /(light|lamp|spot|flood)/;
const OUTSIDE_LIGHT_RE = /(ext|outside|outdoor|flood|spot|rock|courtesy|awning)/;
const POWER_DC = new Set(["power", "energy", "battery", "voltage", "current", "apparent_power", "reactive_power", "power_factor", "frequency"]);
const CLIMATE_DC = new Set(["temperature", "humidity", "pressure", "atmospheric_pressure", "wind_speed", "wind_direction", "precipitation", "precipitation_intensity", "illuminance", "irradiance"]);
const CONTROL_DOMAINS = new Set(["switch", "select", "number", "button", "input_boolean", "input_select", "input_number", "input_button", "cover", "lock", "valve", "script", "scene", "fan"]);
const TOGGLE_DOMAINS = new Set(["switch", "input_boolean", "light", "fan", "script"]);

/* =====================================================================
 * Shared card base
 * ===================================================================== */

const BASE_CSS = `
:host{box-sizing:border-box;--bg:#111118;--panel:#1b1f2b;--ink:#f0f0f5;--mute:#a0aec0;display:block;color:var(--ink);font-family:var(--ha-font-family-body,Roboto,sans-serif);background:var(--bg)}
*{box-sizing:border-box}
ha-icon{display:inline-flex}
.v{background:rgba(255,255,255,.04);border-radius:12px;padding:8px 12px;min-width:0;display:flex;flex-direction:column;justify-content:center;cursor:pointer}
.v .l{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.v .n{font-weight:700;line-height:1.15;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.v .s{font-size:14px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.v{container-type:inline-size}
.v.txt .n{white-space:normal;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.v.good .n{color:#48bb78}.v.warn .n{color:#ed8936}.v.bad .n{color:#fc8181}.v.dim{opacity:.45}
.bar{height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:6px}.bar i{display:block;height:100%;border-radius:4px}
.b{min-height:56px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#cbd5e0;
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:inherit;font-size:13px;font-weight:700;letter-spacing:.04em;
 text-transform:uppercase;cursor:pointer;padding:6px 4px;min-width:0;transition:all .2s;text-align:center;line-height:1.2}
.b span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%}
.b.on{background:rgba(var(--rgb),.3);border:2px solid var(--c);color:var(--c);box-shadow:0 0 16px rgba(var(--rgb),.45)}
.b.on ha-icon{filter:drop-shadow(0 0 6px var(--c))}
.b.alert{background:rgba(252,129,129,.25);border:2px solid #fc8181;color:#fc8181}
.b:active{transform:scale(.97)}
`;

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function collectIds(obj, out = []) {
  if (typeof obj === "string") {
    if (/^[a-z_]+\.[a-z0-9_]+$/.test(obj)) out.push(obj);
  } else if (Array.isArray(obj)) obj.forEach((x) => collectIds(x, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((x) => collectIds(x, out));
  return out;
}

function morph(from, to) {
  if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) {
    from.replaceWith(to.cloneNode(true));
    return;
  }
  if (from.nodeType === 3) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  if (from.nodeType !== 1) return;
  for (const a of [...from.attributes]) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
  for (const a of [...to.attributes]) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  patchChildren(from, to);
}

function patchChildren(parent, next) {
  const cur = [...parent.childNodes];
  const want = [...next.childNodes];
  want.forEach((n, i) => (i < cur.length ? morph(cur[i], n) : parent.appendChild(n.cloneNode(true))));
  for (let i = want.length; i < cur.length; i++) cur[i].remove();
}

// Update el's contents in place so unchanged nodes (icons, tiles) are never rebuilt.
function patchHtml(el, html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  patchChildren(el, tpl.content);
}

const DECIMALS = { "%": 0, W: 0, V: 1, A: 1, "°C": 1, "°F": 1, "km/h": 0, psi: 1, kWh: 1, L: 1, m: 0, Ah: 1 };

class CcBase extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._sig = null;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (ev) => this._click(ev));
    }
    if (this._hass) this._render();
  }
  set hass(hass) {
    this._hass = hass;
    this._hassChanged?.();
    const sig = this._signature();
    if (sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }
  _signature() {
    const h = this._hass;
    if (!h || !this._config) return "";
    return collectIds(this._config).map((id) => { const s = h.states[id]; return s ? s.last_updated + s.state : "-"; }).join("|");
  }
  _st(id) { return id ? this._hass.states[id] : undefined; }
  _num(id) { const n = parseFloat(this._st(id)?.state); return isNaN(n) ? null : n; }
  _on(id) { const s = this._st(id)?.state; return s === "on" || s === "open" || s === "heat" || s === "cool"; }
  _fmt(id) {
    const s = this._st(id);
    if (!s || s.state === "unavailable" || s.state === "unknown") return "—";
    const u = s.attributes.unit_of_measurement;
    let v = s.state;
    const n = parseFloat(v);
    if (!isNaN(n) && /^-?[\d.]+(e-?\d+)?$/.test(v)) {
      const d = u in DECIMALS ? DECIMALS[u] : Number.isInteger(n) ? 0 : 2;
      v = n.toFixed(d);
    }
    if (!isNaN(n) && /^-?[\d.]+(e-?\d+)?$/.test(s.state)) return u ? `${v}${u === "%" ? "" : " "}${u}` : v;
    try {
      if (this._hass.formatEntityState) return this._hass.formatEntityState(s);
    } catch (e) { /* fall through */ }
    return u ? `${v} ${u}` : v;
  }
  _name(id, strip = []) {
    let n = this._st(id)?.attributes.friendly_name || id;
    for (const re of strip) n = n.replace(re, "");
    return n.trim() || this._st(id)?.attributes.friendly_name || id;
  }
  _readout(label, value, { cls = "", sub = "", bar = null, barColor = "", entity = "" } = {}) {
    const b = bar === null ? "" : `<div class="bar"><i style="width:${Math.max(0, Math.min(100, bar))}%;background:${barColor}"></i></div>`;
    const act = entity ? `data-act="info:${esc(entity)}"` : "";
    return `<div class="v ${cls}" ${act}><div class="l">${esc(label)}</div><div class="n">${esc(value)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ""}${b}</div>`;
  }
  _button(label, icon, act, on = false, extra = "") {
    return `<button class="b ${on ? "on" : ""} ${extra}" data-act="${esc(act)}"><ha-icon icon="${icon}"></ha-icon><span>${esc(label)}</span></button>`;
  }
  _navigate(path) {
    if (!path) return;
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }
  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }
  _click(ev) {
    const el = ev.composedPath().find((n) => n.dataset && n.dataset.act);
    if (!el) return;
    const [kind, ...rest] = el.dataset.act.split(":");
    const arg = rest.join(":");
    const h = this._hass;
    switch (kind) {
      case "nav": return this._navigate(arg);
      case "info": return this._moreInfo(arg);
      case "toggle": return h.callService("homeassistant", "toggle", { entity_id: arg });
      case "press": return h.callService(domainOf(arg) === "input_button" ? "input_button" : "button", "press", { entity_id: arg });
      case "select": {
        const [id, ...opt] = rest;
        return h.callService(domainOf(id) === "input_select" ? "input_select" : "select", "select_option", { entity_id: id, option: opt.join(":") });
      }
      case "step": {
        const [id, dir] = rest;
        const s = this._st(id);
        const cur = parseFloat(s?.state);
        if (isNaN(cur)) return;
        const step = Number(s.attributes.step) || 1;
        let val = cur + step * Number(dir);
        if (s.attributes.min != null) val = Math.max(Number(s.attributes.min), val);
        if (s.attributes.max != null) val = Math.min(Number(s.attributes.max), val);
        return h.callService(domainOf(id), "set_value", { entity_id: id, value: val });
      }
      case "climate_toggle": {
        const on = this._st(arg)?.state !== "off";
        return h.callService("climate", on ? "turn_off" : "turn_on", { entity_id: arg });
      }
      case "climate_step": {
        const [id, dir] = rest;
        const s = this._st(id);
        const cur = parseFloat(s?.attributes.temperature);
        if (isNaN(cur)) return;
        return h.callService("climate", "set_temperature", { entity_id: id, temperature: cur + (s.attributes.target_temp_step || 1) * Number(dir) });
      }
      case "group": {
        const ids = this._groupIds(arg);
        const anyOn = ids.some((id) => this._on(id));
        return ids.length && h.callService("homeassistant", anyOn ? "turn_off" : "turn_on", { entity_id: ids });
      }
      case "alloff": {
        const ids = this._groupIds("all");
        return ids.length && h.callService("homeassistant", "turn_off", { entity_id: ids });
      }
      default: return undefined;
    }
  }
  _groupIds() { return []; }
}

/* =====================================================================
 * Overview card
 * ===================================================================== */

const OV_CSS = `
:host{height:calc(100dvh - var(--header-height,56px));padding:12px;container-type:size;container-name:host}
.wrap{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px}
.top{display:flex;align-items:center;gap:10px;min-width:0}
.logo{width:clamp(40px,7cqh,64px);height:clamp(40px,7cqh,64px);flex:none}
.hello{font-size:clamp(18px,3cqh,28px);font-weight:700;margin-right:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chips{display:flex;gap:8px;overflow:hidden}
.chip{display:flex;align-items:center;gap:6px;background:var(--panel);border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:6px 12px;font-size:15px;color:#cbd5e0;white-space:nowrap}
.chip ha-icon{--mdc-icon-size:18px;color:#67e8f9}.chip.away ha-icon{color:#718096}
.grid{display:grid;gap:12px;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));grid-auto-rows:minmax(0,1fr);min-height:0}
.p{border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:12px;min-height:0;overflow:hidden;container-type:size;
 background:linear-gradient(135deg,rgba(var(--rgb),.14) 0%,var(--panel) 55%,#161a24 100%);border:1px solid rgba(var(--rgb),.35);box-shadow:0 4px 24px rgba(var(--rgb),.12)}
.p.alarm{border:2px solid #fc8181;box-shadow:0 0 24px rgba(252,129,129,.35)}
.ph{display:flex;align-items:center;gap:10px;cursor:pointer;min-height:40px;flex:none}
.ph .ic{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(var(--rgb),.18);flex:none}
.ph .ic ha-icon{--mdc-icon-size:24px;color:var(--c)}
.p.alarm .ph .ic{background:rgba(252,129,129,.3)}.p.alarm .ph .ic ha-icon{color:#fc8181}
.ph .t{font-size:clamp(16px,5cqh,22px);font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c)}
.ph .go{margin-left:auto;color:var(--mute);--mdc-icon-size:28px}
.rd{flex:1;display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr));grid-auto-rows:minmax(0,1fr);min-height:0}
.v .n{font-size:clamp(20px,min(9cqh,25cqi),52px)}
.v.txt .n{font-size:clamp(16px,min(6cqh,15cqi),30px)}
.bt{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(min(84px,100%),1fr));flex:none}
.bt .b{min-height:clamp(56px,14cqh,84px)}
.bt .b ha-icon{--mdc-icon-size:clamp(22px,7cqh,32px)}
.bt.fill{flex:1;grid-auto-rows:minmax(56px,130px);align-content:center}
.phone-only{display:none}
@container host (max-width:1000px) and (min-width:601px){.grid{--cols:2}.chip.opt{display:none}}
@container host (max-width:600px){:host{padding:8px}.grid{--cols:2;gap:8px}.wrap{gap:8px}.chip.opt,.chip.person{display:none}
 .p{padding:10px;gap:8px}.rd .v:nth-child(n+3){display:none}.bt .b:nth-child(n+3){display:none}.wide-only{display:none!important}.phone-only{display:flex}
 .ph .t{font-size:15px;letter-spacing:.04em}.ph .ic{width:32px;height:32px}.ph .go{--mdc-icon-size:22px}}
@container host (max-width:380px){.hello{font-size:16px}}
`;

class CcOverview extends CcBase {
  getCardSize() { return 12; }
  connectedCallback() { this._timer = setInterval(() => this._render(), 30000); }
  disconnectedCallback() { clearInterval(this._timer); }

  _groupIds(which) {
    const L = this._config.panels?.lights?.lights || [];
    return L.filter((l) => which === "all" || (which === "outside") === !!l.outside).map((l) => l.id);
  }

  _panel(key, readouts, buttons, { alarm = false, fillButtons = false } = {}) {
    const s = CATS[key];
    const nav = this._config.panels[key]?.nav || "";
    return `<div class="p ${alarm ? "alarm" : ""}" style="--c:${s.c};--rgb:${s.rgb}">
      <div class="ph" data-act="nav:${esc(nav)}"><div class="ic"><ha-icon icon="${s.icon}"></ha-icon></div><div class="t">${s.title}</div>${nav ? '<ha-icon class="go" icon="mdi:chevron-right"></ha-icon>' : ""}</div>
      ${readouts.length ? `<div class="rd">${readouts.join("")}</div>` : ""}
      ${buttons.length ? `<div class="bt ${fillButtons || !readouts.length ? "fill" : ""}">${buttons.join("")}</div>` : ""}
    </div>`;
  }

  _tankColour(pct, inverse) {
    const p = inverse ? 100 - pct : pct;
    return p > 80 ? "#4ade80" : p > 60 ? "#a3e635" : p > 40 ? "#facc15" : p > 20 ? "#fb923c" : "#f87171";
  }

  _power(p) {
    const r = [];
    if (p.soc) {
      const flow = this._st(p.flow)?.state || "";
      const cls = /^charging/i.test(flow) ? "good" : /^discharging/i.test(flow) ? "bad" : "";
      const ttg = this._st(p.ttg)?.state;
      r.push(this._readout("Battery", this._fmt(p.soc), { cls, sub: [flow, ttg && ttg !== "unknown" ? ttg : ""].filter(Boolean).join(" · "), entity: p.soc }));
    }
    if (p.solar) r.push(this._readout("Solar", this._fmt(p.solar), { entity: p.solar }));
    if (p.shore) {
      const plugged = p.shore_connected ? this._on(p.shore_connected) : true;
      r.push(this._readout("Shore", plugged ? this._fmt(p.shore) : "Unplugged", { cls: plugged ? "" : "dim", entity: p.shore }));
    }
    if (p.dc) r.push(this._readout("DC load", this._fmt(p.dc), { entity: p.dc }));
    if (p.ac) r.push(this._readout("AC load", this._fmt(p.ac), { entity: p.ac }));
    (p.alts || []).forEach((a, i) => {
      if (this._on(a.charging)) r.push(this._readout(`DC-DC ${p.alts.length > 1 ? i + 1 : ""}`.trim(), this._fmt(a.power), { cls: "good", entity: a.power }));
    });
    const b = [];
    const inv = this._st(p.inverter);
    if (inv) {
      const icons = [[/charger/i, "mdi:battery-charging"], [/inverter/i, "mdi:transmission-tower"], [/off/i, "mdi:power"], [/on/i, "mdi:lightning-bolt"]];
      for (const opt of inv.attributes.options || []) {
        const icon = (icons.find(([re]) => re.test(opt)) || [0, "mdi:circle-outline"])[1];
        b.push(this._button(opt.replace(/\s*only$/i, ""), icon, `select:${p.inverter}:${opt}`, inv.state === opt));
      }
    }
    const alarm = (p.alarms || []).some((id) => this._on(id)) ||
      (p.alarm_sensors || []).some((id) => { const s = this._st(id)?.state; return s && !/^(no alarm|ok|unknown|unavailable)$/i.test(s); });
    return this._panel("power", r, b, { alarm });
  }

  _water(p) {
    const r = (p.tanks || []).map((t) => {
      const n = this._num(t.level) ?? 0;
      return this._readout(t.label, this._fmt(t.level), { sub: t.remaining ? this._fmt(t.remaining) : "", bar: n, barColor: this._tankColour(n, t.grey), entity: t.level });
    });
    const b = (p.buttons || []).map((x) => this._button(x.label, x.icon, `toggle:${x.id}`, this._on(x.id)));
    return this._panel("water", r, b);
  }

  _climate(p) {
    const r = [];
    if (p.outside) r.push(this._readout("Outside", this._fmt(p.outside), { entity: p.outside }));
    if (p.inside) r.push(this._readout("Inside", this._fmt(p.inside), { entity: p.inside }));
    if (p.humidity) r.push(this._readout("Humidity", this._fmt(p.humidity), { entity: p.humidity }));
    if (p.wind) {
      const dir = this._st(p.wind_dir)?.state;
      r.push(this._readout("Wind", `${this._fmt(p.wind)}${dir && dir !== "unknown" ? " " + dir : ""}`, { sub: p.gust ? `Gust ${this._fmt(p.gust)}` : "", entity: p.wind }));
    }
    if (p.uv) {
      const n = this._num(p.uv);
      r.push(this._readout("UV today", this._fmt(p.uv), { cls: n === null ? "" : n >= 8 ? "bad" : n >= 3 ? "warn" : "good", sub: this._st(p.uv_cat)?.state || "", entity: p.uv }));
    }
    const fireState = this._st(p.fire)?.state;
    if (p.fire && fireState && !/^(unknown|unavailable)$/.test(fireState)) {
      const f = fireState;
      r.push(this._readout("Fire danger", f || "—", { cls: `txt ${/extreme|catastrophic|high/i.test(f) ? "bad" : /moderate/i.test(f) ? "warn" : ""}`, entity: p.fire }));
    }
    if (p.forecast) r.push(this._readout("Today", this._fmt(p.forecast), { cls: "txt", entity: p.forecast }));
    const warn = this._num(p.warnings);
    if (warn) r.unshift(this._readout("Warnings", `${warn} active`, { cls: "bad", entity: p.warnings }));
    const b = [];
    const ac = this._st(p.ac);
    if (ac) {
      b.push(this._button(`AC ${ac.attributes.temperature ?? ""}°`, "mdi:air-conditioner", `climate_toggle:${p.ac}`, ac.state !== "off"));
      b.push(this._button("Cooler", "mdi:minus", `climate_step:${p.ac}:-1`));
      b.push(this._button("Warmer", "mdi:plus", `climate_step:${p.ac}:1`));
    }
    return this._panel("climate", r, b, { alarm: !!warn });
  }

  _lights(p) {
    const L = p.lights || [];
    const b = L.slice(0, 8).map((l) => this._button(l.label, l.icon, `toggle:${l.id}`, this._on(l.id), "wide-only"));
    const any = (outside) => L.filter((l) => !!l.outside === outside).some((l) => this._on(l.id));
    if (L.some((l) => !l.outside)) b.push(this._button("Inside", "mdi:lamps", "group:inside", any(false), "phone-only"));
    if (L.some((l) => l.outside)) b.push(this._button("Outside", "mdi:outdoor-lamp", "group:outside", any(true), "phone-only"));
    b.push(this._button("All off", "mdi:lightbulb-off", "alloff"));
    return this._panel("lights", [], b, { fillButtons: true });
  }

  _controls(p) {
    const b = (p.items || []).slice(0, 6).map((x) => this._button(x.label, x.icon, `toggle:${x.id}`, this._on(x.id)));
    return this._panel("controls", [], b, { fillButtons: true });
  }

  _tyres(p) {
    let low = null, lowId = null, alarm = (p.tyre_alarms || []).some((id) => this._on(id));
    for (const id of p.tyres || []) {
      let n = this._num(id);
      if (n === null) continue;
      if (/kpa/i.test(this._st(id).attributes.unit_of_measurement || "")) n *= 0.145;
      if (low === null || n < low) { low = n; lowId = id; }
    }
    const state = alarm || (low !== null && low < 40) ? "bad" : low !== null && low < 45 ? "warn" : "good";
    return { low, lowId, state };
  }

  _status(p) {
    const r = [];
    if (p.caravan) r.push(this._readout("Caravan", this._fmt(p.caravan), { cls: "txt", entity: p.caravan }));
    if (p.location) r.push(this._readout("Location", this._fmt(p.location), { cls: "txt", entity: p.location }));
    if (p.gps) r.push(this._readout("GPS", this._on(p.gps) ? "OK" : "No fix", { cls: this._on(p.gps) ? "good" : "bad", entity: p.gps }));
    if (p.internet) r.push(this._readout("Internet", this._on(p.internet) ? "Online" : "Offline", { cls: this._on(p.internet) ? "good" : "bad", entity: p.internet }));
    if (p.fridge || p.freezer) {
      const f = this._num(p.fridge), z = this._num(p.freezer);
      const bad = (f !== null && (f > 5 || f < 0)) || (z !== null && z > -12);
      r.push(this._readout("Fridge", [p.fridge ? `${f ?? "—"}°` : null, p.freezer ? `${z ?? "—"}°` : null].filter(Boolean).join(" / "), { cls: bad ? "bad" : "", entity: p.fridge || p.freezer }));
    }
    const t = (p.tyres || []).length ? this._tyres(p) : null;
    if (t && t.low !== null) r.push(this._readout("Lowest tyre", `${t.low.toFixed(1)} psi`, { cls: t.state, entity: t.lowId }));
    const b = [];
    if (p.location_nav) b.push(this._button("Location", "mdi:map-marker", `nav:${p.location_nav}`));
    if (p.security_nav) b.push(this._button("Security", "mdi:cctv", `nav:${p.security_nav}`));
    if (p.tyres_nav) b.push(this._button("Tyres", "mdi:car-tire-alert", `nav:${p.tyres_nav}`, false, t && t.state === "bad" ? "alert" : ""));
    return this._panel("status", r, b);
  }

  _top() {
    const c = this._config;
    const hour = new Date().getHours();
    const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const first = (this._hass.user?.name || "").split(" ")[0];
    const chips = [];
    for (const id of c.persons || []) {
      const s = this._st(id);
      if (!s) continue;
      chips.push(`<div class="chip person ${s.state === "home" ? "" : "away"}"><ha-icon icon="mdi:account"></ha-icon>${esc((s.attributes.friendly_name || "").split(" ")[0])}</div>`);
    }
    const loc = this._st(c.location_entity);
    if (loc) chips.push(`<div class="chip opt"><ha-icon icon="mdi:map-marker"></ha-icon>${esc(loc.state)}</div>`);
    const w = this._st(c.weather);
    if (w) chips.push(`<div class="chip opt"><ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>${w.attributes.temperature != null ? `${Math.round(w.attributes.temperature)}°` : esc(w.state)}</div>`);
    chips.push(`<div class="chip"><ha-icon icon="mdi:clock-outline"></ha-icon>${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>`);
    return `<div class="top"><img class="logo" src="${ASSET_BASE}/cc-logo.png" alt="Clever Caravan">
      <div class="hello">Good ${part}${first ? `, ${esc(first)}` : ""}</div><div class="chips">${chips.join("")}</div></div>`;
  }

  _render() {
    if (!this._hass || !this._config || !this.shadowRoot) return;
    const P = this._config.panels || {};
    const out = [];
    if (P.power) out.push(this._power(P.power));
    if (P.water) out.push(this._water(P.water));
    if (P.climate) out.push(this._climate(P.climate));
    if (P.lights) out.push(this._lights(P.lights));
    if (P.controls) out.push(this._controls(P.controls));
    if (P.status) out.push(this._status(P.status));
    if (!this._root) {
      this.shadowRoot.innerHTML = `<style>${BASE_CSS}${OV_CSS}</style><div class="wrap"></div>`;
      this._root = this.shadowRoot.querySelector(".wrap");
    }
    patchHtml(this._root, `${this._top()}<div class="grid">${out.join("")}</div>`);
  }
}

/* =====================================================================
 * Subview card
 * ===================================================================== */

const VIEW_CSS = `
:host{min-height:calc(100dvh - var(--header-height,56px));padding:12px}
.head{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.back{display:flex;align-items:center;gap:6px;height:56px;padding:0 20px 0 12px;border-radius:999px;border:1px solid rgba(var(--rgb),.4);
 background:rgba(var(--rgb),.14);color:var(--c);font:inherit;font-size:16px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
.back ha-icon{--mdc-icon-size:28px}
.title{display:flex;align-items:center;gap:10px;font-size:26px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c)}
.title ha-icon{--mdc-icon-size:30px}
#map{border-radius:20px;overflow:hidden;margin-bottom:12px}
#map:empty{display:none}
.groups{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));align-items:start}
.g{border-radius:20px;padding:14px;background:linear-gradient(135deg,rgba(var(--rgb),.12) 0%,var(--panel) 55%,#161a24 100%);border:1px solid rgba(var(--rgb),.3)}
.g h3{margin:0 0 10px;font-size:15px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c)}
.items{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.items .v .n{font-size:22px}
.wide{grid-column:1/-1}
.wide .n{font-size:16px!important;font-weight:400!important;white-space:normal!important;line-height:1.5}
.ctl{background:rgba(255,255,255,.04);border-radius:12px;padding:8px 12px;display:flex;flex-direction:column;gap:8px}
.ctl .l{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
.ctl .row{display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(70px,1fr))}
.ctl .row .b{min-height:48px;font-size:12px}
.num{display:flex;align-items:center;gap:8px}.num .val{flex:1;text-align:center;font-size:22px;font-weight:700}
.num .b{width:56px;min-height:48px}
.pic{width:100%;border-radius:12px;display:block}
`;

class CcView extends CcBase {
  getCardSize() { return 20; }

  _hassChanged() {
    if (this._mapCard) this._mapCard.hass = this._hass;
  }

  async _ensureMap() {
    const trackers = this._config.map || [];
    if (!trackers.length || this._mapCard || !window.loadCardHelpers) return;
    try {
      const helpers = await window.loadCardHelpers();
      this._mapCard = helpers.createCardElement({ type: "map", entities: trackers, default_zoom: 12, aspect_ratio: "21:9" });
      this._mapCard.hass = this._hass;
      this.shadowRoot.getElementById("map")?.appendChild(this._mapCard);
    } catch (e) {
      console.warn("Clever Caravan: map unavailable", e);
    }
  }

  _item(id, strip) {
    const s = this._st(id);
    if (!s) return "";
    const d = domainOf(id);
    const name = this._name(id, strip);
    if (TOGGLE_DOMAINS.has(d)) {
      const icon = s.attributes.icon || { light: "mdi:lightbulb", fan: "mdi:fan", script: "mdi:script-text" }[d] || "mdi:toggle-switch";
      return this._button(name, icon, `toggle:${id}`, this._on(id));
    }
    if (d === "button" || d === "input_button") return this._button(name, s.attributes.icon || "mdi:gesture-tap-button", `press:${id}`);
    if (d === "select" || d === "input_select") {
      const opts = s.attributes.options || [];
      return `<div class="ctl wide"><div class="l">${esc(name)}</div><div class="row">${opts
        .map((o) => this._button(o, "mdi:checkbox-blank-circle-outline", `select:${id}:${o}`, s.state === o)).join("")}</div></div>`;
    }
    if (d === "number" || d === "input_number") {
      return `<div class="ctl"><div class="l">${esc(name)}</div><div class="num">${this._button("", "mdi:minus", `step:${id}:-1`)}<div class="val">${esc(this._fmt(id))}</div>${this._button("", "mdi:plus", `step:${id}:1`)}</div></div>`;
    }
    if (d === "climate") {
      return `<div class="ctl wide"><div class="l">${esc(name)} · ${esc(s.state)}</div><div class="row">
        ${this._button(`AC ${s.attributes.temperature ?? ""}°`, "mdi:air-conditioner", `climate_toggle:${id}`, s.state !== "off")}
        ${this._button("Cooler", "mdi:minus", `climate_step:${id}:-1`)}${this._button("Warmer", "mdi:plus", `climate_step:${id}:1`)}</div></div>`;
    }
    if (d === "image" || d === "camera") {
      const pic = s.attributes.entity_picture;
      return pic ? `<div class="wide" data-act="info:${esc(id)}"><img class="pic" src="${esc(pic)}" alt="${esc(name)}"></div>` : "";
    }
    if (d === "binary_sensor") {
      const on = this._on(id);
      const dc = s.attributes.device_class;
      const problem = dc === "problem" || dc === "safety";
      const label = dc === "connectivity" ? (on ? "Connected" : "Offline") : dc === "plug" ? (on ? "Plugged in" : "Unplugged") : problem ? (on ? "Alarm" : "OK") : on ? "On" : "Off";
      const cls = problem ? (on ? "bad" : "good") : dc === "connectivity" ? (on ? "good" : "bad") : "";
      return this._readout(name, label, { cls, entity: id });
    }
    const val = this._fmt(id);
    if (String(s.state).length > 40) return this._readout(name, s.state, { cls: "wide txt", entity: id });
    return this._readout(name, val, { entity: id });
  }

  _render() {
    if (!this._hass || !this._config || !this.shadowRoot) return;
    const c = this._config;
    const cat = CATS[c.cat] || CATS.more;
    this.style.setProperty("--c", cat.c);
    this.style.setProperty("--rgb", cat.rgb);
    if (!this.shadowRoot.getElementById("body")) {
      this.shadowRoot.innerHTML = `<style>${BASE_CSS}${VIEW_CSS}</style>
        <div class="head"><button class="back" data-act="nav:${esc(c.back)}"><ha-icon icon="mdi:chevron-left"></ha-icon>Overview</button>
        <div class="title"><ha-icon icon="${cat.icon}"></ha-icon>${esc(cat.title)}</div></div>
        <div id="map"></div><div id="body"></div>`;
      this._ensureMap();
    }
    const strip = (c.strip || []).map((s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"));
    patchHtml(this.shadowRoot.getElementById("body"), `<div class="groups">${(c.groups || [])
      .map((g) => `<div class="g"><h3>${esc(g.title)}</h3><div class="items">${g.items
        .map((id) => this._item(id, [new RegExp(`^${g.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), ...strip])).join("")}</div></div>`)
      .join("")}</div>`);
  }
}

if (!customElements.get("cc-overview")) customElements.define("cc-overview", CcOverview);
if (!customElements.get("cc-view")) customElements.define("cc-view", CcView);

/* =====================================================================
 * Strategy
 * ===================================================================== */

const domainOf = (id) => id.split(".")[0];
const textOf = (hass, e) => `${e.entity_id} ${hass.states[e.entity_id]?.attributes.friendly_name || ""}`.toLowerCase();
const hasLabel = (e, l) => (e.labels || []).includes(l);
const first = (list) => list[0]?.entity_id;
const byDomain = (list, ...domains) => list.filter((e) => domains.includes(domainOf(e.entity_id)));

function isUsable(hass, e) {
  return !e.disabled_by && !e.hidden_by && !e.entity_category && hass.states[e.entity_id] !== undefined;
}

function findConfigState(hass, registry) {
  const mine = registry.filter((e) => e.platform === "clever_caravan_dashboard" && e.entity_id.startsWith("sensor."));
  const entry = mine.find((e) => e.translation_key === "config") || mine.find((e) => e.entity_id === "sensor.clever_caravan_dashboard_config") || mine[0];
  return entry ? hass.states[entry.entity_id] : undefined;
}

// Power: unique_id = {portal}_{key}_{instance}
function powerKey(list, key) {
  const re = new RegExp(`^[0-9a-f]+_${key}_(\\w+)$`);
  return list
    .filter((e) => e.platform === P_POWER && re.test(e.unique_id || ""))
    .map((e) => ({ e, inst: (e.unique_id.match(re) || [])[1] }))
    .sort((a, b) => String(a.inst).localeCompare(String(b.inst), undefined, { numeric: true }));
}
const powerOne = (list, key) => powerKey(list, key)[0]?.e.entity_id;
const uidEnds = (list, platform, suffix) => list.find((e) => e.platform === platform && (e.unique_id || "").endsWith(suffix))?.entity_id;

function labelCategory(e) {
  for (const l of e.labels || []) {
    if (!l.startsWith(LABEL_PREFIX)) continue;
    const c = l.slice(LABEL_PREFIX.length);
    if (c === "hidden") return null;
    if (CATS[c] && c !== "status") return c;
  }
  return undefined;
}

function classify(hass, e) {
  const fromLabel = labelCategory(e);
  if (fromLabel !== undefined) return fromLabel;
  const st = hass.states[e.entity_id];
  const d = domainOf(e.entity_id);
  const dc = st.attributes.device_class;
  const text = textOf(hass, e);
  const uid = e.unique_id || "";

  if (d === "light") return "lights";
  if (d === "camera") return "security";
  if (d === "device_tracker") return "location";
  if (d === "climate" || d === "weather") return "climate";
  if (e.platform === P_LOC) return "location";
  if (e.platform === P_TPMS) return "tyres";
  if (e.platform === P_WX) return "climate";
  if (e.platform === P_POWER) return /_tank_/.test(uid) ? "water" : "power";
  if (WATER_RE.test(text) && !CLIMATE_DC.has(dc)) return "water";
  if (CONTROL_DOMAINS.has(d) && LIGHT_RE.test(text)) return "lights";
  if (POWER_DC.has(dc)) return "power";
  if (CLIMATE_DC.has(dc)) return "climate";
  if (CONTROL_DOMAINS.has(d)) return "controls";
  return "more";
}

function deviceName(hass, id) {
  const d = id && hass.devices ? hass.devices[id] : undefined;
  return (d && (d.name_by_user || d.name)) || "";
}

function areaName(hass, e) {
  const areaId = e.area_id || (e.device_id && hass.devices?.[e.device_id]?.area_id);
  return (areaId && hass.areas?.[areaId]?.name) || "";
}

function friendly(hass, id) {
  return hass.states[id]?.attributes.friendly_name || id;
}

function lightLabel(hass, e) {
  const dev = deviceName(hass, e.device_id);
  let n = friendly(hass, e.entity_id);
  if (dev && n.startsWith(dev)) n = n.slice(dev.length);
  n = n.replace(/^waymote\s*/i, "").replace(/\bexternal\b/i, "").replace(/\blights?\b/i, "").replace(/\s+/g, " ").trim();
  return n || friendly(hass, e.entity_id);
}

function lightIcon(text, outside) {
  if (/courtesy|strip/.test(text)) return "mdi:led-strip-variant";
  if (/ambient/.test(text)) return "mdi:lamps";
  return outside ? "mdi:outdoor-lamp" : "mdi:lightbulb";
}

function controlIcon(text, d) {
  if (/suspension/.test(text)) return "mdi:car-lifted-pickup";
  if (/dust/.test(text)) return "mdi:weather-dust";
  if (d === "fan") return "mdi:fan";
  return "mdi:toggle-switch";
}

function buildOverview(hass, cats, all, nav) {
  const panels = {};
  const power = cats.get("power") || [];
  const allPower = all.filter((e) => e.platform === P_POWER);

  if (power.length) {
    const altPower = powerKey(allPower, "alt_power");
    const altCharging = powerKey(allPower, "alt_charging");
    panels.power = {
      nav: nav("power"),
      soc: powerOne(allPower, "battery_soc"),
      flow: powerOne(allPower, "battery_flow_direction"),
      ttg: powerOne(allPower, "battery_ttg_text"),
      solar: powerOne(allPower, "pv_power") || uidEnds(allPower, P_POWER, "_agg_solar_power"),
      shore: powerOne(allPower, "shore_power"),
      shore_connected: powerOne(allPower, "shore_connected"),
      dc: powerOne(allPower, "dc_consumption"),
      ac: powerOne(allPower, "ac_consumption"),
      alts: altPower.map(({ e, inst }) => ({ power: e.entity_id, charging: altCharging.find((c) => c.inst === inst)?.e.entity_id })),
      inverter: powerOne(allPower, "inverter_mode"),
      alarms: allPower.filter((e) => /_bm_alarm_/.test(e.unique_id || "")).map((e) => e.entity_id),
      alarm_sensors: allPower.filter((e) => /_inverter_alarm_/.test(e.unique_id || "")).map((e) => e.entity_id),
    };
  }

  const water = cats.get("water") || [];
  if (water.length) {
    const levels = powerKey(all, "tank_level");
    const remaining = powerKey(all, "tank_remaining");
    let pos = 0;
    const tanks = levels.map(({ e, inst }) => {
      const name = friendly(hass, e.entity_id).toLowerCase();
      const grey = /grey|gray|waste/.test(name);
      const num = (name.match(/(\d+)/) || [])[1];
      if (!grey) pos += 1;
      return { level: e.entity_id, remaining: remaining.find((r) => r.inst === inst)?.e.entity_id, grey, label: grey ? "Grey" : `Fresh ${num || pos}`, sort: grey ? 999 : Number(num || pos) };
    }).sort((a, b) => a.sort - b.sort).map(({ sort, ...t }) => t);
    // Extra-integration tanks (percent sensors not from Clever Caravan Power)
    for (const e of byDomain(water, "sensor").filter((x) => x.platform !== P_POWER && hass.states[x.entity_id].attributes.unit_of_measurement === "%")) {
      tanks.push({ level: e.entity_id, grey: /grey|gray|waste/.test(textOf(hass, e)), label: friendly(hass, e.entity_id) });
    }
    const switches = byDomain(water, "switch", "input_boolean");
    const buttons = [];
    for (const e of switches) {
      const t = textOf(hass, e);
      if (/pump/.test(t)) buttons.unshift({ id: e.entity_id, label: "Pump", icon: "mdi:water-pump" });
      else if (/tank/.test(t)) {
        const ext = /external/.test(t);
        const num = (t.match(/tank[_\s]*(\d+)/) || [])[1];
        buttons.push({ id: e.entity_id, label: ext ? "External" : `Tank ${num || ""}`.trim(), icon: ext ? "mdi:water-plus" : "mdi:swap-horizontal", sort: ext ? 99 : Number(num || 50) });
      } else if (/dump/.test(t)) buttons.push({ id: e.entity_id, label: "Grey dump", icon: "mdi:water-off", sort: 100 });
    }
    buttons.sort((a, b) => (a.sort ?? -1) - (b.sort ?? -1));
    panels.water = { nav: nav("water"), tanks, buttons: buttons.map(({ sort, ...b }) => b) };
  }

  const wx = all.filter((e) => e.platform === P_WX);
  const temps = all.filter((e) => domainOf(e.entity_id) === "sensor" && hass.states[e.entity_id].attributes.device_class === "temperature");
  const inside = first(all.filter((e) => hasLabel(e, "cc_inside_temp"))) ||
    first(temps.filter((e) => e.platform !== P_WX && e.platform !== P_TPMS && /inside|indoor|internal/.test(textOf(hass, e)) && !/fridge|freezer|cabinet/.test(textOf(hass, e))));
  const outside = first(all.filter((e) => hasLabel(e, "cc_outside_temp"))) || uidEnds(wx, P_WX, "_temp");
  const ac = first(byDomain(cats.get("climate") || [], "climate"));
  if (wx.length || inside || outside || ac) {
    panels.climate = {
      nav: nav("climate"),
      outside,
      inside,
      humidity: uidEnds(wx, P_WX, "_humidity"),
      wind: uidEnds(wx, P_WX, "_wind_speed_kilometre"),
      gust: uidEnds(wx, P_WX, "_gust_speed_kilometre"),
      wind_dir: uidEnds(wx, P_WX, "_wind_direction"),
      uv: uidEnds(wx, P_WX, "_0_uv_max_index"),
      uv_cat: uidEnds(wx, P_WX, "_0_uv_category"),
      forecast: uidEnds(wx, P_WX, "_0_short_text"),
      fire: uidEnds(wx, P_WX, "_0_fire_danger"),
      warnings: uidEnds(wx, P_WX, "_warnings"),
      ac,
    };
  }

  const lights = byDomain(cats.get("lights") || [], "light", "switch", "input_boolean");
  if (lights.length) {
    panels.lights = {
      nav: nav("lights"),
      lights: lights
        .map((e) => {
          const t = textOf(hass, e);
          const outside = OUTSIDE_LIGHT_RE.test(t) || /outside|outdoor|exterior/i.test(areaName(hass, e));
          return { id: e.entity_id, label: lightLabel(hass, e), icon: lightIcon(t, outside), outside };
        })
        .sort((a, b) => Number(a.outside) - Number(b.outside) || a.label.localeCompare(b.label)),
    };
  }

  const controls = byDomain(cats.get("controls") || [], "switch", "input_boolean", "fan");
  if (controls.length) {
    panels.controls = {
      nav: nav("controls"),
      items: controls.map((e) => ({
        id: e.entity_id,
        label: lightLabel(hass, e).replace(/\s+fan$/i, ""),
        icon: controlIcon(textOf(hass, e), domainOf(e.entity_id)),
      })),
    };
  }

  const loc = all.filter((e) => e.platform === P_LOC);
  const tpms = all.filter((e) => e.platform === P_TPMS);
  const status = {
    caravan: uidEnds(loc, P_LOC, "_status"),
    location: uidEnds(loc, P_LOC, "_current_location"),
    gps: uidEnds(loc, P_LOC, "_gps_healthy"),
    internet: first(all.filter((e) => domainOf(e.entity_id) === "binary_sensor" && e.platform !== P_WAY && e.platform !== P_POWER &&
      hass.states[e.entity_id].attributes.device_class === "connectivity" && /starlink|internet|wan|router/.test(textOf(hass, e)))),
    fridge: first(all.filter((e) => hasLabel(e, "cc_fridge"))),
    freezer: first(all.filter((e) => hasLabel(e, "cc_freezer"))),
    tyres: tpms.filter((e) => (e.unique_id || "").endsWith("-pressure")).map((e) => e.entity_id),
    tyre_alarms: tpms.filter((e) => (e.unique_id || "").endsWith("-alarm")).map((e) => e.entity_id),
    location_nav: nav("location"),
    security_nav: nav("security"),
    tyres_nav: nav("tyres"),
  };
  if (status.caravan || status.location || status.internet || status.fridge || status.tyres.length) panels.status = status;

  const weather = all.find((e) => e.platform === P_WX && domainOf(e.entity_id) === "weather" && !/hourly/.test(e.unique_id || ""))?.entity_id ||
    Object.keys(hass.states).find((id) => id.startsWith("weather."));

  return {
    type: "custom:cc-overview",
    persons: Object.keys(hass.states).filter((id) => id.startsWith("person.")),
    location_entity: status.location,
    weather,
    panels,
  };
}

function buildGroups(hass, cat, list) {
  const groups = new Map();
  const add = (title, id) => {
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(id);
  };
  const sorted = [...list].sort((a, b) => a.entity_id.localeCompare(b.entity_id));

  for (const e of sorted) {
    const d = domainOf(e.entity_id);
    if (d === "device_tracker" || d === "weather") continue;
    const t = textOf(hass, e);
    let g;
    if (cat === "lights") g = OUTSIDE_LIGHT_RE.test(t) || /outside|outdoor|exterior/i.test(areaName(hass, e)) ? "Outside" : "Inside";
    else if (cat === "tyres") g = (t.match(/(front|rear)[ _](left|right)/) || [])[0]?.replace("_", " ") || deviceName(hass, e.device_id) || "Tyres";
    else if (cat === "location") g = /gps|satellite|hdop|accuracy|fix|latitude|longitude|atomic|speed|climb|bearing|heading|elevation|gradient/.test(t) ? "GPS" : /climate|rainfall/.test(t) ? "Climate this month" : /population|statistical|wikipedia/.test(t) ? "About this place" : "Where you are";
    else if (cat === "climate" && e.platform === P_WX) g = /short_text|uv_|fire_danger/.test(e.unique_id || "") ? "Forecast" : "Now";
    else g = deviceName(hass, e.device_id) || CATS[cat].title;
    add(g.replace(/\b\w/g, (c) => c.toUpperCase()), e.entity_id);
  }
  return [...groups.entries()].map(([title, items]) => ({ title, items }));
}

function messageDashboard(message) {
  return { title: "Clever Caravan", views: [{ title: "Clever Caravan", icon: "mdi:caravan", cards: [{ type: "markdown", content: message }] }] };
}

class CleverCaravanStrategy {
  static async generate(config, hass) {
    let registry;
    try {
      registry = await hass.callWS({ type: "config/entity_registry/list" });
    } catch (err) {
      console.error("Clever Caravan: entity registry fetch failed", err);
      return messageDashboard("Couldn't read the entity registry. Reload the page to retry.");
    }
    const cfg = findConfigState(hass, registry);
    if (!cfg) return messageDashboard("Clever Caravan is still initialising. Reload this page once **Clever Caravan: Dashboard** has finished starting.");

    const attrs = cfg.attributes;
    const platforms = new Set([...OWNED_PLATFORMS, ...(Array.isArray(attrs.extra_platforms) ? attrs.extra_platforms : [])]);

    const cats = new Map();
    const all = [];
    for (const e of registry) {
      if (!isUsable(hass, e)) continue;
      const labelled = (e.labels || []).some((l) => l.startsWith(LABEL_PREFIX));
      if (!platforms.has(e.platform) && !labelled) continue;
      const cat = classify(hass, e);
      if (!cat) continue;
      all.push(e);
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat).push(e);
    }
    if (!cats.size) return messageDashboard("No devices found yet. Check the integration's settings on this unit.");

    // Tier hook: premium-only views go here (attrs.tier === "premium").
    const base = "/" + (window.location.pathname.split("/")[1] || "lovelace");
    const nav = (c) => (cats.has(c) ? `${base}/${c}` : "");
    const views = [{ title: "Overview", path: "overview", icon: "mdi:caravan", type: "panel", cards: [buildOverview(hass, cats, all, nav)] }];

    for (const c of ORDER) {
      if (!cats.has(c)) continue;
      const list = cats.get(c);
      views.push({
        title: CATS[c].title,
        path: c,
        icon: CATS[c].icon,
        subview: true,
        type: "panel",
        cards: [{
          type: "custom:cc-view",
          cat: c,
          back: `${base}/overview`,
          map: byDomain(list, "device_tracker").map((e) => e.entity_id),
          strip: ["Cerbo GX", "Waymote", "Clever Caravan", "Caravan", "TPMS"],
          groups: buildGroups(hass, c, list),
        }],
      });
    }
    return { title: "Clever Caravan", views };
  }
}

customElements.define("ll-strategy-dashboard-clever-caravan", CleverCaravanStrategy);

window.customStrategies = window.customStrategies || [];
window.customStrategies.push({
  type: "clever-caravan",
  strategyType: "dashboard",
  name: "Clever Caravan",
  description: "Auto-generates the Clever Caravan dashboard from the unit's hardware and product tier.",
});
