/**
 * Clever Caravan dashboard strategy (Beta).
 *
 * Overview  = single-pane control panel (custom:cc-overview, bundled below).
 * Subviews  = full detail + all controls per category (native cards).
 *
 * Entity sources: Clever Caravan integrations (always), extra integrations
 * ticked in the integration settings, and anything labelled cc_<category>.
 * Special labels: cc_fridge, cc_freezer, cc_inside_temp, cc_outside_temp, cc_hidden.
 */

const ASSET_BASE = "/clever_caravan_dashboard";

const OWNED_PLATFORMS = [
  "clever_caravan_power",
  "clever_caravan_tpms",
  "clever_caravan_safety_sam_tpms",
  "clever_caravan_location",
  "clever_caravan_weather",
  "clever_caravan_waymote",
];

const CATS = {
  power: { title: "Power", icon: "mdi:lightning-bolt" },
  water: { title: "Water", icon: "mdi:water" },
  climate: { title: "Climate", icon: "mdi:thermometer" },
  lights: { title: "Lights", icon: "mdi:lightbulb" },
  controls: { title: "Controls", icon: "mdi:tune-vertical" },
  location: { title: "Location", icon: "mdi:map-marker" },
  tyres: { title: "Tyres", icon: "mdi:car-tire-alert" },
  security: { title: "Security", icon: "mdi:cctv" },
  more: { title: "More", icon: "mdi:dots-horizontal" },
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

const POWER_HEADLINE = [
  { key: "battery_soc", name: "Battery" },
  { key: "pv_power", name: "Solar" },
  { key: "shore_power", name: "Shore" },
];

/* =====================================================================
 * Overview card
 * ===================================================================== */

const PANEL_STYLE = {
  power: { c: "#fc8181", rgb: "252,129,129", icon: "mdi:lightning-bolt", title: "Power" },
  water: { c: "#38bdf8", rgb: "56,189,248", icon: "mdi:water", title: "Water" },
  climate: { c: "#2dd4bf", rgb: "45,212,191", icon: "mdi:thermometer", title: "Climate" },
  lights: { c: "#fbd38d", rgb: "251,211,141", icon: "mdi:lightbulb-on", title: "Lights" },
  controls: { c: "#b794f4", rgb: "183,148,244", icon: "mdi:tune-vertical", title: "Controls" },
  status: { c: "#67e8f9", rgb: "103,232,249", icon: "mdi:check-decagram", title: "Status" },
};

const OPTION_ICON = [
  [/charger/i, "mdi:battery-charging"],
  [/inverter/i, "mdi:transmission-tower"],
  [/off/i, "mdi:power"],
  [/on/i, "mdi:lightning-bolt"],
];

const CSS = `
:host{display:block;height:calc(100dvh - var(--header-height,56px));box-sizing:border-box;padding:12px;background:#111118;color:#f0f0f5;font-family:var(--ha-font-family-body,Roboto,sans-serif);container-type:size}
*{box-sizing:border-box}
.wrap{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px}
.top{display:flex;align-items:center;gap:10px;min-width:0}
.logo{width:clamp(40px,7cqh,64px);height:clamp(40px,7cqh,64px);flex:none}
.hello{font-size:clamp(18px,3cqh,28px);font-weight:700;letter-spacing:.02em;margin-right:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chips{display:flex;gap:8px;flex-wrap:nowrap;overflow:hidden}
.chip{display:flex;align-items:center;gap:6px;background:#1b1f2b;border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:6px 12px;font-size:15px;color:#cbd5e0;white-space:nowrap}
.chip ha-icon{--mdc-icon-size:18px;color:#67e8f9}
.chip.away ha-icon{color:#718096}
.grid{display:grid;gap:12px;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));grid-auto-rows:minmax(0,1fr);min-height:0}
.p{--c:#fff;border-radius:20px;padding:clamp(10px,1.6cqh,16px);display:flex;flex-direction:column;gap:clamp(8px,1.4cqh,14px);min-height:0;overflow:hidden;
 background:linear-gradient(135deg,rgba(var(--rgb),.14) 0%,#1b1f2b 55%,#161a24 100%);border:1px solid rgba(var(--rgb),.35);box-shadow:0 4px 24px rgba(var(--rgb),.12)}
.ph{display:flex;align-items:center;gap:10px;cursor:pointer;min-height:40px}
.ph .ic{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(var(--rgb),.18);flex:none}
.ph .ic ha-icon{--mdc-icon-size:24px;color:var(--c)}
.ph .t{font-size:clamp(16px,2.4cqh,22px);font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c)}
.ph .go{margin-left:auto;color:#a0aec0;--mdc-icon-size:26px}
.rd{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px}
.v{background:rgba(255,255,255,.04);border-radius:12px;padding:8px 10px;min-width:0}
.v .l{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#a0aec0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.v .n{font-size:clamp(20px,3.6cqh,34px);font-weight:700;line-height:1.15;color:#f0f0f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.v.bad .n{color:#fc8181}.v.warn .n{color:#ed8936}.v.good .n{color:#48bb78}
.bar{height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:6px}.bar i{display:block;height:100%;border-radius:4px}
.bt{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px;margin-top:auto}
.b{min-height:clamp(56px,9cqh,84px);border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#cbd5e0;
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:inherit;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;padding:4px;min-width:0;transition:all .2s}
.b span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.b ha-icon{--mdc-icon-size:clamp(22px,3.6cqh,32px)}
.b.on{background:rgba(var(--rgb),.3);border:2px solid var(--c);color:var(--c);box-shadow:0 0 16px rgba(var(--rgb),.45)}
.b.on ha-icon{filter:drop-shadow(0 0 6px var(--c))}
.b.alert{background:rgba(252,129,129,.25);border:2px solid #fc8181;color:#fc8181}
.b:active{transform:scale(.97)}
@container (max-width:1000px) and (min-width:601px){.grid{--cols:2}.chip.opt{display:none}}
@container (max-width:600px){:host{padding:8px}.grid{--cols:2;gap:8px}.wrap{gap:8px}.chip.opt,.chip.person{display:none}
 .rd .v:nth-child(n+2){display:none}.bt .b:nth-child(n+3){display:none}.ph .t{font-size:15px;letter-spacing:.04em}.ph .ic{width:32px;height:32px}.v .n{font-size:22px}}
@container (max-width:380px){.hello{font-size:16px}.bt .b:nth-child(n+2){display:none}}
`;

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

class CcOverview extends HTMLElement {
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
    const sig = this._signature();
    if (sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }

  getCardSize() { return 12; }

  connectedCallback() {
    this._timer = setInterval(() => this._render(), 30000);
  }
  disconnectedCallback() {
    clearInterval(this._timer);
  }

  _ids() {
    const c = this._config || {};
    const out = [...(c.persons || []), c.weather, c.location_entity];
    for (const p of Object.values(c.panels || {})) {
      for (const v of Object.values(p)) {
        if (Array.isArray(v)) out.push(...v);
        else if (typeof v === "string") out.push(v);
      }
    }
    return out.filter((x) => typeof x === "string" && x.includes("."));
  }

  _signature() {
    const h = this._hass;
    if (!h) return "";
    return this._ids().map((id) => { const s = h.states[id]; return s ? s.last_updated + s.state : "-"; }).join("|");
  }

  _st(id) { return id ? this._hass.states[id] : undefined; }
  _fmt(id) {
    const s = this._st(id);
    if (!s) return "—";
    try { if (this._hass.formatEntityState) return this._hass.formatEntityState(s); } catch (e) { /* fall through */ }
    const u = s.attributes.unit_of_measurement;
    return u ? `${s.state} ${u}` : s.state;
  }
  _num(id) { const n = parseFloat(this._st(id)?.state); return isNaN(n) ? null : n; }
  _on(id) { const s = this._st(id)?.state; return s === "on" || s === "open" || s === "heat" || s === "cool"; }

  _readout(label, value, cls = "", barPct = null, barColor = null) {
    const bar = barPct === null ? "" : `<div class="bar"><i style="width:${Math.max(0, Math.min(100, barPct))}%;background:${barColor}"></i></div>`;
    return `<div class="v ${cls}"><div class="l">${esc(label)}</div><div class="n">${esc(value)}</div>${bar}</div>`;
  }
  _button(label, icon, act, on = false, extra = "") {
    return `<button class="b ${on ? "on" : ""} ${extra}" data-act="${esc(act)}"><ha-icon icon="${icon}"></ha-icon><span>${esc(label)}</span></button>`;
  }
  _panel(key, readouts, buttons) {
    const s = PANEL_STYLE[key];
    const nav = this._config.panels[key]?.nav || "";
    return `<div class="p" style="--c:${s.c};--rgb:${s.rgb}">
      <div class="ph" data-act="nav:${esc(nav)}"><div class="ic"><ha-icon icon="${s.icon}"></ha-icon></div><div class="t">${s.title}</div>${nav ? '<ha-icon class="go" icon="mdi:chevron-right"></ha-icon>' : ""}</div>
      ${readouts.length ? `<div class="rd">${readouts.join("")}</div>` : ""}
      ${buttons.length ? `<div class="bt">${buttons.join("")}</div>` : ""}
    </div>`;
  }

  _tankColour(pct, inverse = false) {
    const p = inverse ? 100 - pct : pct;
    if (p > 80) return "#4ade80";
    if (p > 60) return "#a3e635";
    if (p > 40) return "#facc15";
    if (p > 20) return "#fb923c";
    return "#f87171";
  }

  _power(p) {
    const r = [];
    const soc = this._num(p.soc);
    if (p.soc) r.push(this._readout("Battery", this._fmt(p.soc), soc === null ? "" : soc >= 75 ? "good" : soc >= 40 ? "warn" : "bad"));
    if (p.solar) r.push(this._readout("Solar", this._fmt(p.solar)));
    if (p.shore) r.push(this._readout("Shore", this._fmt(p.shore)));
    const b = [];
    const inv = this._st(p.inverter);
    if (inv) {
      for (const opt of (inv.attributes.options || []).slice(0, 4)) {
        const icon = (OPTION_ICON.find(([re]) => re.test(opt)) || [null, "mdi:circle-outline"])[1];
        b.push(this._button(opt.replace(/\s*only$/i, ""), icon, `select:${p.inverter}:${opt}`, inv.state === opt));
      }
    }
    return this._panel("power", r, b);
  }

  _water(p) {
    const r = [];
    for (const id of p.tanks || []) {
      const n = this._num(id);
      const name = this._st(id)?.attributes.friendly_name || id;
      const m = name.match(/tank\s*(\d)/i);
      r.push(this._readout(m ? `Tank ${m[1]}` : "Tank", this._fmt(id), "", n ?? 0, this._tankColour(n ?? 0)));
    }
    if (p.grey) {
      const n = this._num(p.grey);
      r.push(this._readout("Grey", this._fmt(p.grey), "", n ?? 0, this._tankColour(n ?? 0, true)));
    }
    const b = [];
    if (p.pump) b.push(this._button("Pump", "mdi:water-pump", `toggle:${p.pump}`, this._on(p.pump)));
    for (const id of p.select || []) {
      const m = (this._st(id)?.attributes.friendly_name || id).match(/tank\s*(\d)/i);
      b.push(this._button(m ? `Tank ${m[1]}` : "Tank", "mdi:swap-horizontal", `toggle:${id}`, this._on(id)));
    }
    return this._panel("water", r.slice(0, 4), b.slice(0, 4));
  }

  _climate(p) {
    const r = [];
    if (p.inside) r.push(this._readout("Inside", this._fmt(p.inside)));
    if (p.outside) r.push(this._readout("Outside", this._fmt(p.outside)));
    const b = [];
    const ac = this._st(p.ac);
    if (ac) {
      const on = ac.state !== "off" && ac.state !== "unavailable";
      if (ac.attributes.temperature != null) r.push(this._readout("AC set", `${ac.attributes.temperature}°`));
      b.push(this._button("AC", "mdi:air-conditioner", `climate_toggle:${p.ac}`, on));
      b.push(this._button("Cooler", "mdi:minus", `climate_step:${p.ac}:-1`));
      b.push(this._button("Warmer", "mdi:plus", `climate_step:${p.ac}:1`));
    }
    return this._panel("climate", r, b);
  }

  _lights(p) {
    const inside = p.inside || [], outside = p.outside || [];
    const count = (ids) => ids.filter((id) => this._on(id)).length;
    const r = [];
    if (inside.length) r.push(this._readout("Inside", `${count(inside)} on`));
    if (outside.length) r.push(this._readout("Outside", `${count(outside)} on`));
    const b = [];
    if (inside.length) b.push(this._button("Inside", "mdi:lamps", `group:inside`, count(inside) > 0));
    if (outside.length) b.push(this._button("Outside", "mdi:outdoor-lamp", `group:outside`, count(outside) > 0));
    b.push(this._button("All off", "mdi:lightbulb-off", `alloff`));
    return this._panel("lights", r, b);
  }

  _controls(p) {
    const b = (p.items || []).slice(0, 4).map((id) => {
      const s = this._st(id);
      const name = (s?.attributes.friendly_name || id).replace(/^waymote( can bus)?\s*/i, "");
      return this._button(name, s?.attributes.icon || "mdi:toggle-switch", `toggle:${id}`, this._on(id));
    });
    return this._panel("controls", [], b);
  }

  _tyreState(ids) {
    let worst = "good";
    for (const id of ids) {
      let n = this._num(id);
      if (n === null) continue;
      if (/kpa/i.test(this._st(id).attributes.unit_of_measurement || "")) n *= 0.145;
      if (n < 40) return "bad";
      if (n < 45) worst = "warn";
    }
    return worst;
  }

  _status(p) {
    const r = [];
    if (p.caravan) r.push(this._readout("Caravan", this._fmt(p.caravan)));
    if (p.internet) {
      const on = this._on(p.internet);
      r.push(this._readout("Internet", on ? "Online" : "Offline", on ? "good" : "bad"));
    }
    if (p.fridge || p.freezer) {
      const f = this._num(p.fridge), z = this._num(p.freezer);
      const bad = (f !== null && (f > 5 || f < 0)) || (z !== null && z > -12);
      const val = [p.fridge ? `${f ?? "—"}°` : null, p.freezer ? `${z ?? "—"}°` : null].filter(Boolean).join(" / ");
      r.push(this._readout("Fridge", val, bad ? "bad" : ""));
    }
    const b = [];
    if (p.location_nav) b.push(this._button("Location", "mdi:map-marker", `nav:${p.location_nav}`));
    if (p.security_nav) b.push(this._button("Security", "mdi:cctv", `nav:${p.security_nav}`));
    if (p.tyres_nav) {
      const t = this._tyreState(p.tyres || []);
      b.push(this._button("Tyres", "mdi:car-tire-alert", `nav:${p.tyres_nav}`, t === "good", t !== "good" ? "alert" : ""));
    }
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
      const home = s.state === "home";
      chips.push(`<div class="chip person ${home ? "" : "away"}"><ha-icon icon="mdi:account"></ha-icon>${esc((s.attributes.friendly_name || "").split(" ")[0])}</div>`);
    }
    if (c.location_entity && this._st(c.location_entity)) {
      chips.push(`<div class="chip opt"><ha-icon icon="mdi:map-marker"></ha-icon>${esc(this._st(c.location_entity).state)}</div>`);
    }
    const w = this._st(c.weather);
    if (w) {
      const t = w.attributes.temperature;
      chips.push(`<div class="chip opt"><ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>${t != null ? `${t}°` : esc(w.state)}</div>`);
    }
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    chips.push(`<div class="chip"><ha-icon icon="mdi:clock-outline"></ha-icon>${time}</div>`);
    return `<div class="top"><img class="logo" src="${ASSET_BASE}/cc-logo.png" alt="Clever Caravan">
      <div class="hello">Good ${part}${first ? `, ${esc(first)}` : ""}</div><div class="chips">${chips.join("")}</div></div>`;
  }

  _render() {
    if (!this._hass || !this._config || !this.shadowRoot) return;
    const P = this._config.panels || {};
    const panels = [];
    if (P.power) panels.push(this._power(P.power));
    if (P.water) panels.push(this._water(P.water));
    if (P.climate) panels.push(this._climate(P.climate));
    if (P.lights) panels.push(this._lights(P.lights));
    if (P.controls) panels.push(this._controls(P.controls));
    if (P.status) panels.push(this._status(P.status));
    this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="wrap">${this._top()}<div class="grid">${panels.join("")}</div></div>`;
  }

  _navigate(path) {
    if (!path) return;
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _click(ev) {
    const el = ev.composedPath().find((n) => n.dataset && n.dataset.act);
    if (!el) return;
    const [kind, ...rest] = el.dataset.act.split(":");
    const h = this._hass;
    const P = this._config.panels || {};
    if (kind === "nav") return this._navigate(rest.join(":"));
    if (kind === "toggle") return h.callService("homeassistant", "toggle", { entity_id: rest[0] });
    if (kind === "select") return h.callService("select", "select_option", { entity_id: rest[0], option: rest.slice(1).join(":") });
    if (kind === "climate_toggle") {
      const on = this._st(rest[0])?.state !== "off";
      return h.callService("climate", on ? "turn_off" : "turn_on", { entity_id: rest[0] });
    }
    if (kind === "climate_step") {
      const s = this._st(rest[0]);
      const cur = parseFloat(s?.attributes.temperature);
      if (isNaN(cur)) return;
      const step = s.attributes.target_temp_step || 1;
      return h.callService("climate", "set_temperature", { entity_id: rest[0], temperature: cur + step * Number(rest[1]) });
    }
    if (kind === "group") {
      const ids = P.lights?.[rest[0]] || [];
      const anyOn = ids.some((id) => this._on(id));
      return h.callService("homeassistant", anyOn ? "turn_off" : "turn_on", { entity_id: ids });
    }
    if (kind === "alloff") {
      const ids = [...(P.lights?.inside || []), ...(P.lights?.outside || [])];
      if (ids.length) return h.callService("homeassistant", "turn_off", { entity_id: ids });
    }
  }
}

if (!customElements.get("cc-overview")) customElements.define("cc-overview", CcOverview);

/* =====================================================================
 * Strategy helpers
 * ===================================================================== */

const domainOf = (id) => id.split(".")[0];
const textOf = (hass, e) => `${e.entity_id} ${hass.states[e.entity_id]?.attributes.friendly_name || ""}`.toLowerCase();
const hasLabel = (e, l) => (e.labels || []).includes(l);

function isUsable(hass, e) {
  return !e.disabled_by && !e.hidden_by && !e.entity_category && hass.states[e.entity_id] !== undefined;
}

function findConfigState(hass, registry) {
  const mine = registry.filter((e) => e.platform === "clever_caravan_dashboard" && e.entity_id.startsWith("sensor."));
  const entry =
    mine.find((e) => e.translation_key === "config") ||
    mine.find((e) => e.entity_id === "sensor.clever_caravan_dashboard_config") ||
    mine[0];
  return entry ? hass.states[entry.entity_id] : undefined;
}

function labelCategory(e) {
  for (const l of e.labels || []) {
    if (!l.startsWith(LABEL_PREFIX)) continue;
    const c = l.slice(LABEL_PREFIX.length);
    if (c === "hidden") return null;
    if (CATS[c]) return c;
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

  if (d === "light") return "lights";
  if (d === "camera") return "security";
  if (d === "device_tracker") return "location";
  if (d === "climate" || d === "weather") return "climate";
  if (e.platform === "clever_caravan_location") return "location";
  if (e.platform === "clever_caravan_tpms" || e.platform === "clever_caravan_safety_sam_tpms") return "tyres";
  if (WATER_RE.test(text) && !CLIMATE_DC.has(dc)) return "water";
  if (e.platform === "clever_caravan_weather") return "climate";
  if (e.platform === "clever_caravan_power") return "power";
  if (CONTROL_DOMAINS.has(d) && LIGHT_RE.test(text)) return "lights";
  if (POWER_DC.has(dc)) return "power";
  if (CLIMATE_DC.has(dc)) return "climate";
  if (CONTROL_DOMAINS.has(d)) return "controls";
  return "more";
}

function deviceName(hass, id) {
  const d = id && hass.devices ? hass.devices[id] : undefined;
  return (d && (d.name_by_user || d.name)) || "Other";
}

function areaName(hass, e) {
  const areaId = e.area_id || (e.device_id && hass.devices?.[e.device_id]?.area_id);
  return (areaId && hass.areas?.[areaId]?.name) || "Unassigned";
}

function shortName(hass, entityId, prefix) {
  const full = hass.states[entityId]?.attributes.friendly_name || "";
  if (prefix && full.startsWith(prefix + " ")) {
    const rest = full.slice(prefix.length + 1).trim();
    if (rest) return rest;
  }
  return undefined;
}

function cardFor(hass, id, name) {
  const d = domainOf(id);
  if (d === "camera" || d === "image") return { type: "picture-entity", entity: id, show_state: false, show_name: true };
  const card = { type: "tile", entity: id };
  if (name) card.name = name;
  if (TOGGLE_DOMAINS.has(d)) card.tap_action = { action: "toggle" };
  if (d === "button" || d === "input_button") {
    card.tap_action = { action: "perform-action", perform_action: `${d}.press`, target: { entity_id: id } };
  }
  if (d === "select" || d === "input_select") card.features = [{ type: "select-options" }];
  if (d === "number" || d === "input_number") card.features = [{ type: "numeric-input", style: "buttons" }];
  if (d === "climate") {
    const modes = hass.states[id]?.attributes.hvac_modes;
    card.features = [{ type: "target-temperature" }];
    if (Array.isArray(modes) && modes.length) card.features.push({ type: "climate-hvac-modes", hvac_modes: modes });
  }
  return card;
}

const heading = (text, extra = {}) => ({ type: "heading", heading: text, ...extra });
const placeholder = (name) => ({ type: "markdown", content: `\u26a0\ufe0f Unresolved: **${name}**` });

function resolvePowerKey(list, key) {
  const re = new RegExp(`^[0-9a-f]+_${key}_([^_]+)$`);
  const pool = list.filter((e) => e.platform === "clever_caravan_power");
  return (
    pool.filter((e) => re.test(e.unique_id || "")).sort((a, b) => a.unique_id.localeCompare(b.unique_id, undefined, { numeric: true }))[0] ||
    pool.find((e) => e.entity_id.startsWith("sensor.") && e.entity_id.includes(key))
  );
}

function powerHeadline(hass, entries) {
  const used = new Set();
  const cards = POWER_HEADLINE.map(({ key, name }) => {
    const hit = resolvePowerKey(entries, key);
    if (!hit) return placeholder(name);
    used.add(hit.entity_id);
    return cardFor(hass, hit.entity_id, name);
  });
  return { cards, used };
}

const byDomain = (list, ...domains) => list.filter((e) => domains.includes(domainOf(e.entity_id)));
const ids = (list, n) => [...new Set(list.map((e) => e.entity_id))].slice(0, n);
const first = (list) => list[0]?.entity_id;

/* ---------------- overview config ---------------- */

function buildOverviewConfig(hass, cats, all, base, catsPresent) {
  const panels = {};
  const nav = (c) => (catsPresent.has(c) ? `${base}/${c}` : "");

  const power = cats.get("power") || [];
  if (power.length) {
    panels.power = {
      nav: nav("power"),
      soc: resolvePowerKey(power, "battery_soc")?.entity_id,
      solar: resolvePowerKey(power, "pv_power")?.entity_id,
      shore: resolvePowerKey(power, "shore_power")?.entity_id,
      inverter: first(byDomain(power, "select").filter((e) => /inverter/.test(e.entity_id))),
    };
  }

  const water = cats.get("water") || [];
  if (water.length) {
    const levels = byDomain(water, "sensor").filter((e) => hass.states[e.entity_id].attributes.unit_of_measurement === "%");
    const switches = byDomain(water, "switch", "input_boolean");
    panels.water = {
      nav: nav("water"),
      tanks: ids(levels.filter((e) => !/grey/.test(textOf(hass, e))), 3),
      grey: first(levels.filter((e) => /grey/.test(textOf(hass, e)))),
      pump: first(switches.filter((e) => /pump/.test(textOf(hass, e)))),
      select: ids(switches.filter((e) => /tank/.test(textOf(hass, e)) && !/pump|dump/.test(textOf(hass, e))), 3),
    };
  }

  const climate = cats.get("climate") || [];
  const temps = all.filter((e) => domainOf(e.entity_id) === "sensor" && hass.states[e.entity_id].attributes.device_class === "temperature");
  const pickTemp = (label, re) =>
    first(all.filter((e) => hasLabel(e, label))) ||
    first(temps.filter((e) => re.test(textOf(hass, e)) && !/fridge|freezer|cabinet|battery|tyre|tpms|dew/.test(textOf(hass, e))));
  const inside = pickTemp("cc_inside_temp", /inside|indoor|internal|caravan/);
  const outside = pickTemp("cc_outside_temp", /outside|outdoor|external/);
  const ac = first(byDomain(climate, "climate"));
  if (climate.length || inside || outside || ac) {
    panels.climate = { nav: nav("climate"), inside, outside: outside !== inside ? outside : undefined, ac };
  }

  const lights = byDomain(cats.get("lights") || [], "light", "switch", "input_boolean");
  if (lights.length) {
    const isOutside = (e) => OUTSIDE_LIGHT_RE.test(textOf(hass, e)) || /outside|outdoor|exterior/i.test(areaName(hass, e));
    panels.lights = {
      nav: nav("lights"),
      inside: ids(lights.filter((e) => !isOutside(e)), 50),
      outside: ids(lights.filter(isOutside), 50),
    };
  }

  const controls = byDomain(cats.get("controls") || [], "switch", "input_boolean", "fan");
  if (controls.length) panels.controls = { nav: nav("controls"), items: ids(controls, 4) };

  const location = cats.get("location") || [];
  const status = {
    nav: "",
    caravan: first(byDomain(location, "sensor").filter((e) => /status/.test(e.entity_id))),
    internet: first(
      all.filter((e) => domainOf(e.entity_id) === "binary_sensor" && hass.states[e.entity_id].attributes.device_class === "connectivity" && /starlink|internet|wan|router/.test(textOf(hass, e)))
    ),
    fridge: first(all.filter((e) => hasLabel(e, "cc_fridge"))),
    freezer: first(all.filter((e) => hasLabel(e, "cc_freezer"))),
    location_nav: nav("location"),
    security_nav: nav("security"),
    tyres_nav: nav("tyres"),
    tyres: ids((cats.get("tyres") || []).filter((e) => hass.states[e.entity_id].attributes.device_class === "pressure"), 12),
  };
  if (status.caravan || status.internet || status.fridge || status.freezer || status.location_nav || status.tyres_nav) panels.status = status;

  const locEntity = first(byDomain(location, "sensor").filter((e) => /current_location/.test(e.entity_id)));
  const weather = first(all.filter((e) => domainOf(e.entity_id) === "weather")) ||
    Object.keys(hass.states).find((id) => id.startsWith("weather."));

  return {
    type: "custom:cc-overview",
    persons: Object.keys(hass.states).filter((id) => id.startsWith("person.")),
    location_entity: locEntity,
    weather,
    panels,
  };
}

/* ---------------- subviews ---------------- */

function groupSections(hass, list, keyFn, labelFn) {
  const groups = new Map();
  for (const e of list) {
    const k = keyFn(e);
    if (!groups.has(k)) groups.set(k, { label: labelFn(e), items: [] });
    groups.get(k).items.push(e);
  }
  return [...groups.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(({ label, items }) => ({
      type: "grid",
      cards: [
        heading(label, { heading_style: "subtitle" }),
        ...items
          .sort((a, b) => a.entity_id.localeCompare(b.entity_id))
          .map((e) => cardFor(hass, e.entity_id, shortName(hass, e.entity_id, label))),
      ],
    }));
}

function buildSubview(hass, cat, list) {
  const sections = [];
  let rest = list;

  if (cat === "power") {
    const { cards, used } = powerHeadline(hass, list);
    sections.push({ type: "grid", cards: [heading("Overview", { heading_style: "subtitle" }), ...cards] });
    rest = list.filter((e) => !used.has(e.entity_id));
  }

  if (cat === "location") {
    const trackers = ids(byDomain(list, "device_tracker"), 10);
    if (trackers.length) {
      sections.push({
        type: "grid",
        column_span: 2,
        cards: [{ type: "map", entities: trackers, default_zoom: 12, grid_options: { columns: "full", rows: 6 } }],
      });
    }
  }

  if (cat === "lights") {
    sections.push(...groupSections(hass, rest, (e) => areaName(hass, e), (e) => areaName(hass, e)));
  } else {
    sections.push(...groupSections(hass, rest, (e) => e.device_id || "_none", (e) => deviceName(hass, e.device_id)));
  }

  return { title: CATS[cat].title, path: cat, icon: CATS[cat].icon, subview: true, type: "sections", max_columns: 3, sections };
}

function messageDashboard(message) {
  return { title: "Clever Caravan", views: [{ title: "Clever Caravan", icon: "mdi:caravan", cards: [{ type: "markdown", content: message }] }] };
}

/* ---------------- strategy ---------------- */

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
    if (!cfg) {
      return messageDashboard("Clever Caravan is still initialising. Reload this page once **Clever Caravan: Dashboard** has finished starting.");
    }

    const attrs = cfg.attributes;
    const platforms = new Set([
      ...OWNED_PLATFORMS,
      ...(Array.isArray(attrs.owned_platforms) ? attrs.owned_platforms : []),
      ...(Array.isArray(attrs.extra_platforms) ? attrs.extra_platforms : []),
    ]);

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
    const catsPresent = new Set(cats.keys());
    const views = [
      {
        title: "Overview",
        path: "overview",
        icon: "mdi:caravan",
        type: "panel",
        cards: [buildOverviewConfig(hass, cats, all, base, catsPresent)],
      },
    ];
    for (const c of ORDER) if (cats.has(c)) views.push(buildSubview(hass, c, cats.get(c)));

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
