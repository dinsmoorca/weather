// WeatherBridge widget for Scriptable (iPhone / iPad). Version 1.4 (WeatherBridge 2.14.2).
// Shows your own weather station on the Home Screen (small, medium) and the Lock Screen (rectangular, one line).
// It reads http://weatherbridge.local/console/widget.json on your home Wi-Fi. Away from home it reads the station's
// public copy (GitHub Pages) when one is set up, otherwise it keeps showing the last reading, marked "away".
// iOS decides how often widgets refresh (typically every 15-60 minutes).
// Set-up: Scriptable app -> + -> paste this script -> name it "WeatherBridge". Long-press the Home Screen -> + ->
// Scriptable -> pick a size -> tap the widget while editing -> Script: WeatherBridge.
// Parameter (optional): another address for the station, e.g. 192.168.1.50 or mypi.local, and/or the public copy's
// address, separated by a space, e.g.  weatherbridge.local https://yourname.github.io/weather/
// 1.3: iPad sizes (Apple's iPadOS widget table), Extra Large radar layout; add the word  lock  as well
//      ("radar lock") for a square widget on the iPad Lock Screen: white radar picture and large white text.
// 1.2: add the word  radar  to the Parameter for the radar widgets: Lock Screen rectangular (radar in white shades,
// as iOS shows Lock Screen widgets), Home Screen small, medium and large (colour radar). E.g.  radar

const PUBLIC_URL = "https://dinsmoorca.github.io/weather/";          // filled in by the station's "iPhone widget" page when a public copy is set up
const PUBLIC_ONLY = true;      // 1.4: true in the copy offered on the public page (reads only the public copy)
const PARTS = (args.widgetParameter || "").trim().split(/[\s,]+/).filter(Boolean);
const WORDS = ["radar", "lock"];
const RADAR = PARTS.some((p) => p.toLowerCase() === "radar");
const LOCK = PARTS.some((p) => p.toLowerCase() === "lock");
const HOST = (PARTS.find((p) => !/^https:/i.test(p) && !WORDS.includes(p.toLowerCase())) || "weatherbridge.local").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const PUBLIC = (PARTS.find((p) => /^https:/i.test(p)) || PUBLIC_URL).replace(/\/+$/, "");
const BASE = "http://" + HOST;
const C = { bg: new Color("#0b1116"), ink: new Color("#f2f5f4"), ink2: new Color("#aab6bb"), ink3: new Color("#7f8c92"),
  temp: new Color("#e8834a"), chill: new Color("#5fb3ff"), sky: new Color("#7fb8ff"), away: new Color("#e7c35a"),
  rain: new Color("#3aa6d8"), snow: new Color("#e9f0f7"), mix: new Color("#b48ce6"), ice: new Color("#ff7aa8") };
// NWS hazard colours for the alert stripe (subset; others get amber)
const ALERT_COLORS = { "Winter Weather Advisory": "#7b68ee", "Winter Storm Warning": "#ff69b4", "Winter Storm Watch": "#4682b4",
  "Blizzard Warning": "#ff4500", "Lake Effect Snow Warning": "#008b8b", "Wind Chill Advisory": "#afeeee", "Wind Chill Warning": "#b0c4de",
  "Extreme Cold Warning": "#0000ff", "Wind Advisory": "#d2b48c", "High Wind Warning": "#daa520", "Dense Fog Advisory": "#708090",
  "Severe Thunderstorm Warning": "#ffa500", "Severe Thunderstorm Watch": "#db7093", "Tornado Warning": "#ff0000", "Tornado Watch": "#ffff00",
  "Flood Warning": "#00ff00", "Flash Flood Warning": "#8b0000", "Heat Advisory": "#ff7f50", "Excessive Heat Warning": "#c71585",
  "Ice Storm Warning": "#8b008b", "Freeze Warning": "#483d8b", "Frost Advisory": "#6495ed" };

// ---------- data: live from the station, or the last copy ----------
const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), "weatherbridge-widget.json");
async function load() {
  try {
    if (PUBLIC_ONLY && PUBLIC) throw new Error("public copy only");    // 1.4: no station on this phone's network
    const r = new Request(BASE + "/console/widget.json");
    r.timeoutInterval = 6;
    const d = await r.loadJSON();
    if (!d || d.v !== 1) throw new Error("not a WeatherBridge station");
    fm.writeString(CACHE, JSON.stringify(d));
    return { d, away: false };
  } catch (e) {
    if (PUBLIC) {
      try {                       // 2.13: away from home, read the public copy
        const r = new Request(PUBLIC + "/widget.json?t=" + Math.floor(Date.now() / 60000));
        r.timeoutInterval = 10;
        const d = await r.loadJSON();
        if (d && d.v === 1) { fm.writeString(CACHE, JSON.stringify(d)); return { d, away: false, web: true }; }
      } catch (e2) { /* fall through to the last copy */ }
    }
    if (fm.fileExists(CACHE)) return { d: JSON.parse(fm.readString(CACHE)), away: true };
    return { d: null, away: true, error: String(e) };
  }
}

// ---------- helpers ----------
const n0 = (v) => v == null ? "--" : String(Math.round(v));
const n1 = (v) => v == null ? "--" : (Math.round(v * 10) / 10).toFixed(1);
const inch = (v) => v == null ? "--" : v > 0 && v < 0.1 ? "<0.1 in" : (Math.round(v * 10) / 10).toFixed(1) + " in";
function fmtTime(ts, tz, withDay) {
  const o = { hour: "numeric", minute: "2-digit" };
  if (withDay) o.weekday = "short";
  try { o.timeZone = tz; return new Intl.DateTimeFormat("en-US", o).format(new Date(ts * 1000)); }
  catch (e) { delete o.timeZone; return new Intl.DateTimeFormat("en-US", o).format(new Date(ts * 1000)); }
}
const hourLabel = (ts, tz) => fmtTime(ts, tz).replace(/:\d\d/, "").replace(" AM", "a").replace(" PM", "p");
function ptype(t) {
  t = (t || "").toLowerCase();
  if (/freezing|sleet|ice pellets|wintry mix/.test(t)) return "ice";
  const sn = /snow|flurr/.test(t), rn = /rain|drizzle/.test(t) || (/shower|thunder/.test(t) && !sn);
  return sn && rn ? "mix" : sn ? "snow" : "rain";
}
function feelsWord(d) {
  if (d.feels == null || d.temp == null) return "";
  return d.feels < d.temp - 0.5 ? " wind chill" : d.feels > d.temp + 0.5 ? " heat index" : "";
}
function text(stack, s, size, color, bold, lines) {
  const t = stack.addText(s);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = color || C.ink; t.lineLimit = lines || 1; t.minimumScaleFactor = 0.6;
  return t;
}
function row(stack, parts, size) {        // [["Wind ", false], ["12", true], [" SW", false]]
  const r = stack.addStack(); r.layoutHorizontally(); r.bottomAlignContent();
  parts.forEach(([s, bold, color]) => text(r, s, size || 12, color || (bold ? C.ink : C.ink2), bold));
  return r;
}
function bars(hours, tz, w, h) {          // next hours: chance of precipitation, coloured by rain / snow / mix / ice
  const dc = new DrawContext(); dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = true;
  const n = Math.max(1, hours.length), cw = w / n, top = 2, base = h - 26;
  hours.forEach((x, i) => {
    const pop = x.pop || 0, bh = Math.max(1.5, (base - top) * pop / 100);
    dc.setFillColor(C[ptype(x.short)]);
    dc.fillRect(new Rect(i * cw + cw * 0.22, base - bh, cw * 0.56, bh));
    dc.setTextAlignedCenter(); dc.setFont(Font.systemFont(9)); dc.setTextColor(C.ink3);
    dc.drawTextInRect(hourLabel(x.t, tz), new Rect(i * cw, base + 1, cw, 12));
    dc.setFont(Font.boldSystemFont(10)); dc.setTextColor(C.ink);
    dc.drawTextInRect(pop + "%", new Rect(i * cw, base + 12, cw, 13));
  });
  return dc.getImage();
}
function alertBar(w, d, long) {
  const a = (d.alerts || []).filter((x) => !x.ends || x.ends * 1000 > Date.now())[0];
  if (!a) return;
  const b = w.addStack(); b.layoutHorizontally(); b.centerAlignContent();
  b.backgroundColor = new Color("#2a2340"); b.cornerRadius = 6; b.setPadding(3, 6, 3, 6);
  const s = b.addStack(); s.size = new Size(3, 12); s.backgroundColor = new Color(ALERT_COLORS[a.event] || "#f6dc92"); s.cornerRadius = 1.5;
  b.addSpacer(5);
  text(b, a.event + (long && a.ends ? " · until " + fmtTime(a.ends, d.tz, true) : ""), 10.5, C.ink, true);
  b.addSpacer();
}
function header(w, d, away) {
  const h = w.addStack(); h.layoutHorizontally(); h.centerAlignContent();
  text(h, (d.station || "Weather").split(",")[0].toUpperCase(), 10, C.temp, true);
  h.addSpacer();
  text(h, away ? "away" : fmtTime(d.generated, d.tz), 9.5, away ? C.away : C.ink3);
}
function bigTemp(stack, d, size) {
  const t = stack.addStack(); t.layoutHorizontally(); t.topAlignContent();
  text(t, n1(d.temp), size, C.ink, true);
  text(t, "°F", size * 0.38, C.temp, true);
}

// ---------- 1.2: forecast high, sunrise/sunset countdown, radar pictures ----------
function dayKey(ts, tz) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts * 1000)); }
  catch (e) { return new Date(ts * 1000).toDateString(); }
}
function high(d) {                        // {t, label}: "High" today, "Tmrw" or the weekday name later
  const h = d.high; if (!h || h.t == null) return null;
  const now = Date.now() / 1000;
  if (dayKey(h.start, d.tz) === dayKey(now, d.tz)) return { t: h.t, label: "High", short: "H" };
  if (dayKey(h.start, d.tz) === dayKey(now + 86400, d.tz)) return { t: h.t, label: "Tmrw high", short: "Tmrw" };
  return { t: h.t, label: (h.name || "Next") + " high", short: (h.name || "Next").slice(0, 3) };
}
function sun(d) {                         // next sunrise or sunset
  const now = Date.now() / 1000;
  if (d.sunrise && now < d.sunrise) return { label: "Sunrise", ts: d.sunrise };
  if (d.sunset && now < d.sunset) return { label: "Sunset", ts: d.sunset };
  if (d.sunrise) return { label: "Sunrise", ts: d.sunrise + 86400 };
  return null;
}
function sunLine(stack, d, size, color, labelColor) {   // "Sunset in 2 hr, 41 min" (counts down between refreshes)
  const s = sun(d); if (!s) return;
  const r = stack.addStack(); r.layoutHorizontally(); r.bottomAlignContent();
  text(r, s.label + " ", size, labelColor || C.ink2);
  const dt = r.addDate(new Date(s.ts * 1000)); dt.applyRelativeStyle(); dt.font = Font.boldSystemFont(size); dt.textColor = color || C.ink;
  dt.lineLimit = 1; dt.minimumScaleFactor = 0.6;
}
async function radarImage(src, kind) {    // kind: sq | wide | mono. Home: the station's region; away: the public State view
  const area = src.web ? "state" : (src.d.radar && src.d.radar.area === "home" ? "region" : "state");
  const name = "radar-" + area + "-" + kind + (kind === "mono" ? ".png" : ".jpg");
  const file = fm.joinPath(fm.documentsDirectory(), "weatherbridge-" + kind + "." + (kind === "mono" ? "png" : "jpg"));
  if (!src.away) {
    try {
      const r = new Request((src.web ? PUBLIC + "/" : BASE + "/console/") + name + "?t=" + ((src.d.radar && src.d.radar.t) || 0));
      r.timeoutInterval = 8;
      const im = await r.loadImage();
      if (im) { try { fm.writeImage(file, im); } catch (e) { /* keep going */ } return im; }
    } catch (e) { /* fall back to the last picture */ }
  }
  return fm.fileExists(file) ? fm.readImage(file) : null;
}
function radarStamp(d, away) {
  return d.radar && d.radar.t ? "Radar " + fmtTime(d.radar.t, d.tz) + (away ? " · away" : "") : (away ? "away" : "Radar");
}

// ---------- layouts ----------
function small(d, away) {
  const w = new ListWidget(); w.backgroundColor = C.bg; w.setPadding(12, 13, 10, 13);
  header(w, d, away);
  w.addSpacer(2); bigTemp(w, d, 40);
  w.addSpacer(3);
  row(w, [["Feels ", false], [n0(d.feels) + "°", true, C.chill], [feelsWord(d), false]]);
  row(w, [["Wind ", false], [n0(d.wind), true], [" " + (d.dir || ""), false], [d.gust != null ? " · gust " : "", false], [d.gust != null ? n0(d.gust) : "", true]]);
  if (d.snow && d.snow.h24 >= 0.05) row(w, [["Snow 24 h ", false], [inch(d.snow.h24), true, C.snow]]);
  else if (away) row(w, [["Last reading " + fmtTime(d.generated, d.tz), false, C.away]]);
  else row(w, [["Rain today ", false], [d.rain == null ? "--" : d.rain.toFixed(2) + " in", true]]);
  w.addSpacer();
  alertBar(w, d, false);
  return w;
}
function medium(d, away) {
  const w = new ListWidget(); w.backgroundColor = C.bg; w.setPadding(12, 13, 10, 13);
  const top = w.addStack(); top.layoutHorizontally();
  const L = top.addStack(); L.layoutVertically(); L.size = new Size(140, 0);
  header(L, d, away);
  L.addSpacer(2); bigTemp(L, d, 38); L.addSpacer(3);
  row(L, [["Feels ", false], [n0(d.feels) + "°", true, C.chill], [feelsWord(d), false]], 11.5);
  row(L, [["Wind ", false], [n0(d.wind), true], [" " + (d.dir || ""), false], [d.gust != null ? " · gust " : "", false], [d.gust != null ? n0(d.gust) : "", true]], 11.5);
  row(L, [["Hum ", false], [n0(d.hum) + "%", true], [" · Rain ", false], [d.rain == null ? "--" : d.rain.toFixed(2), true]], 11.5);
  top.addSpacer(12);
  const R = top.addStack(); R.layoutVertically();
  const hrs = (d.hourly || []).slice(0, 6);
  const types = new Set(hrs.map((x) => ptype(x.short)));
  text(R, "NEXT 6 H · CHANCE OF " + (types.size === 1 ? [...types][0].toUpperCase() : "PRECIP"), 9.5, C.sky, true);
  if (hrs.length) { const im = R.addImage(bars(hrs, d.tz, 180, 66)); im.imageSize = new Size(180, 66); }
  else text(R, "Hourly forecast not available", 11, C.ink3);
  if (d.snow && d.snow.h48 >= 0.05) row(R, [["Snow 24 h ", false], [inch(d.snow.h24), true, C.snow], [" · 48 h ", false], [inch(d.snow.h48), true, C.snow]], 11);
  const now = Date.now() / 1000;
  if (d.sunset && d.sunset > now) {
    const s = R.addStack(); s.layoutHorizontally(); s.bottomAlignContent();
    text(s, "Sunset ", 11, C.ink2); text(s, fmtTime(d.sunset, d.tz), 11, C.ink, true); text(s, " · ", 11, C.ink2);
    const dt = s.addDate(new Date(d.sunset * 1000)); dt.applyRelativeStyle(); dt.font = Font.systemFont(11); dt.textColor = C.sky;
  } else if (d.sunrise) {
    const next = d.sunrise > now ? d.sunrise : d.sunrise + 86400;
    row(R, [["Sunrise ", false], [fmtTime(next, d.tz), true]], 11);
  }
  if (away) row(R, [[PUBLIC_ONLY ? "Last reading (offline)" : "Away from home Wi-Fi", false, C.away]], 10.5);
  w.addSpacer();
  alertBar(w, d, true);
  return w;
}
function lockRect(d, away) {              // Lock Screen, rectangular (shown in shades of grey by iOS)
  const w = new ListWidget(); w.addAccessoryWidgetBackground = true; w.setPadding(4, 8, 4, 8);
  const t = w.addStack(); t.layoutHorizontally(); t.bottomAlignContent();
  text(t, n1(d.temp) + "°", 22, Color.white(), true);
  t.addSpacer(6);
  text(t, "feels " + n0(d.feels) + "°", 12, Color.white());
  t.addSpacer();
  if (away) text(t, "away", 10, Color.white());
  text(w, "Wind " + n0(d.wind) + " " + (d.dir || "") + (d.gust != null ? " · gust " + n0(d.gust) : ""), 12, Color.white());
  const a = (d.alerts || []).filter((x) => !x.ends || x.ends * 1000 > Date.now())[0];
  if (a) text(w, "⚠︎ " + a.event, 12, Color.white(), true);
  else if (d.snow && d.snow.h24 >= 0.05) text(w, "Snow 24 h " + inch(d.snow.h24), 12, Color.white());
  else if (d.hourly && d.hourly.length) { const m = d.hourly.reduce((p, q) => (q.pop || 0) > (p.pop || 0) ? q : p, d.hourly[0]); text(w, "Next 6 h: " + (m.pop || 0) + "% " + ptype(m.short), 12, Color.white()); }
  return w;
}
function lockInline(d, away) {           // Lock Screen, the one line above the clock
  const w = new ListWidget();
  const a = (d.alerts || []).filter((x) => !x.ends || x.ends * 1000 > Date.now())[0];
  const parts = [n0(d.temp) + "°"], h = high(d), s = sun(d);
  if (h) parts.push(h.short + " " + n0(h.t) + "°");                                                   // 1.2: forecast high
  if (a) parts.push("⚠︎ " + (a.event.match(/(Warning|Watch|Advisory|Emergency)$/) || [a.event])[0]);   // full name on the other widgets
  else if (s) parts.push(s.label.toLowerCase() + " " + fmtTime(s.ts, d.tz));                          // 1.2: sunrise / sunset time
  else parts.push("feels " + n0(d.feels) + "°");
  text(w, (away ? "· " : "") + parts.join(" · "), 12);
  return w;
}
// ---------- 1.2: radar layouts ----------
function wsize() {                        // widget sizes in points (Apple HIG widget size tables; iPad: "Device" rows)
  const ss = Device.screenSize() || { width: 393, height: 852 };
  if (Device.isPad && Device.isPad()) {
    const a = Math.round(Math.min(ss.width, ss.height)), b = Math.round(Math.max(ss.width, ss.height));
    const P = (sm, w, xl) => ({ sm, w, med: sm, lg: w, xl });     // small, medium/large width, extra-large width
    if (a >= 1192) return P(188, 412, 860);
    if (a >= 1024) return P(160, 356, 748);
    if (a >= 954) return P(162, 350, 726);
    if (a >= 834 && b >= 1194) return P(136, 300, 628);     // 834 x 1194
    if (a >= 834) return P(132, 288, 600);                  // 834 x 1112
    if (a >= 820) return P(136, 300, 628);                  // 820 x 1180
    if (a >= 810) return P(124, 272, 568);
    return P(120, 260, 540);              // 768 x 1024 and 744 x 1133 (iPad mini)
  }
  const sw = Math.round(ss.width);
  if (sw >= 428) return { sm: 170, w: 364, med: 170, lg: 382 };
  if (sw >= 414) return { sm: 169, w: 360, med: 169, lg: 379 };
  if (sw >= 390) return { sm: 158, w: 338, med: 158, lg: 354 };
  return { sm: 148, w: 321, med: 148, lg: 324 };
}
function lockRadar(d, away, img) {        // Lock Screen rectangular: radar (white shades), temperature, high, sun
  const w = new ListWidget(); w.addAccessoryWidgetBackground = true; w.setPadding(2, 3, 2, 5);
  const row1 = w.addStack(); row1.layoutHorizontally(); row1.centerAlignContent();
  if (img) { const im = row1.addImage(img); im.imageSize = new Size(58, 58); im.cornerRadius = 8; row1.addSpacer(6); }
  const t = row1.addStack(); t.layoutVertically();
  const a = t.addStack(); a.layoutHorizontally(); a.bottomAlignContent();
  text(a, n0(d.temp) + "°", 19, Color.white(), true);
  if (away) { a.addSpacer(4); text(a, "away", 9, Color.white()); }
  const h = high(d);
  text(t, "Feels " + n0(d.feels) + "°" + (h ? " · " + h.short + " " + n0(h.t) + "°" : ""), 11, Color.white(), true);
  const s = sun(d);
  if (s) {                                // "Sunset 5:19 PM" then the countdown on its own line (it is long)
    text(t, s.label + " " + fmtTime(s.ts, d.tz), 10.5, Color.white());
    const dt = t.addDate(new Date(s.ts * 1000)); dt.applyRelativeStyle(); dt.font = Font.boldSystemFont(10.5); dt.textColor = Color.white();
    dt.lineLimit = 1; dt.minimumScaleFactor = 0.7;
  }
  return w;
}
function radarBox(stack, img, wPt, hPt, d, away) {   // radar picture with its time in the corner
  const s = stack.addStack(); s.size = new Size(wPt, hPt); s.layoutVertically();
  if (img) s.backgroundImage = img; else { s.backgroundColor = new Color("#0d1418"); s.addSpacer(); text(s, "Radar picture not available yet", 10, C.ink3); }
  s.addSpacer();
  const b = s.addStack(); b.setPadding(0, 6, 5, 6);
  const tag = b.addStack(); tag.backgroundColor = new Color("#000000", 0.6); tag.cornerRadius = 5; tag.setPadding(1, 5, 1, 5);
  text(tag, radarStamp(d, away), 9.5, away ? C.away : C.ink, true);
  return s;
}
function lockSquare(d, away, img) {       // 1.3: iPad Lock Screen square ("radar lock"): white picture, white text
  const z = wsize(), S = z.sm;
  const w = new ListWidget(); w.addAccessoryWidgetBackground = true; w.setPadding(6, 6, 6, 6);
  const top = w.addStack(); top.layoutHorizontally(); top.topAlignContent();
  if (img) { const im = top.addImage(img); im.imageSize = new Size(Math.round(S * 0.52), Math.round(S * 0.52)); im.cornerRadius = 10; top.addSpacer(6); }
  const t = top.addStack(); t.layoutVertically();
  text(t, n0(d.temp) + "°", Math.round(S * 0.2), Color.white(), true);
  text(t, "Feels " + n0(d.feels) + "°", Math.round(S * 0.075), Color.white(), true);
  const h = high(d);
  if (h) text(t, h.short + " " + n0(h.t) + "°", Math.round(S * 0.075), Color.white(), true);
  w.addSpacer();
  const s = sun(d);
  if (s) {
    text(w, s.label + " " + fmtTime(s.ts, d.tz), Math.round(S * 0.08), Color.white());
    const dt = w.addDate(new Date(s.ts * 1000)); dt.applyRelativeStyle(); dt.font = Font.boldSystemFont(Math.round(S * 0.085));
    dt.textColor = Color.white(); dt.lineLimit = 1; dt.minimumScaleFactor = 0.7;
  }
  text(w, radarStamp(d, away), Math.round(S * 0.065), Color.white());
  return w;
}
function xlRadar(d, away, img) {          // 1.3: iPad Extra Large: big colour radar with the readings beside it
  const z = wsize(), H = z.lg, W = z.xl;
  const w = new ListWidget(); w.backgroundColor = C.bg; w.setPadding(0, 0, 0, 0);
  const row1 = w.addStack(); row1.layoutHorizontally();
  radarBox(row1, img, Math.round(W * 0.62), H, d, away);
  const R = row1.addStack(); R.layoutVertically(); R.setPadding(14, 16, 14, 14);
  text(R, away ? "away · " + fmtTime(d.generated, d.tz) : (d.station || "") + " · " + fmtTime(d.generated, d.tz), 12, away ? C.away : C.ink3, false, 1);
  R.addSpacer(4); bigTemp(R, d, 56); R.addSpacer(6);
  row(R, [["Feels ", false], [n0(d.feels) + "°", true, C.chill], [feelsWord(d), false]], 15);
  row(R, [["Wind ", false], [n0(d.wind), true], [" " + (d.dir || ""), false], [d.gust != null ? " · gust " : "", false], [d.gust != null ? n0(d.gust) : "", true]], 15);
  const h = high(d);
  if (h) row(R, [[h.label + " ", false], [n0(h.t) + "°", true]], 15);
  sunLine(R, d, 15);
  R.addSpacer();
  alertBar(R, d, true);
  return w;
}
function smallRadar(d, away, img) {
  const w = new ListWidget(); w.backgroundColor = new Color("#0d1418"); w.setPadding(10, 11, 9, 11);
  if (img) w.backgroundImage = img;
  const top = w.addStack(); top.layoutHorizontally();
  const tag = top.addStack(); tag.backgroundColor = new Color("#000000", 0.55); tag.cornerRadius = 8; tag.setPadding(2, 7, 3, 7);
  text(tag, n0(d.temp) + "°", 24, C.ink, true);
  top.addSpacer();
  w.addSpacer();
  const b = w.addStack(); b.backgroundColor = new Color("#000000", 0.6); b.cornerRadius = 6; b.setPadding(2, 6, 2, 6); b.layoutVertically();
  const h = high(d);
  if (h) text(b, h.label + " " + n0(h.t) + "°", 10, C.ink, true);
  sunLine(b, d, 10, C.ink, C.ink2);
  return w;
}
function mediumRadar(d, away, img) {
  const w = new ListWidget(); w.backgroundColor = C.bg; w.setPadding(0, 0, 0, 0);
  const row1 = w.addStack(); row1.layoutHorizontally();
  const z = wsize(); radarBox(row1, img, z.med, z.med, d, away);
  const R = row1.addStack(); R.layoutVertically(); R.setPadding(11, 11, 10, 10);
  text(R, away ? "away · " + fmtTime(d.generated, d.tz) : fmtTime(d.generated, d.tz), 10, away ? C.away : C.ink3);
  R.addSpacer(2); bigTemp(R, d, 32); R.addSpacer(2);
  row(R, [["Feels ", false], [n0(d.feels) + "°", true, C.chill], [feelsWord(d), false]], 11);
  const h = high(d);
  if (h) row(R, [[h.label + " ", false], [n0(h.t) + "°", true]], 11);
  sunLine(R, d, 11);
  R.addSpacer();
  const a = (d.alerts || []).filter((x) => !x.ends || x.ends * 1000 > Date.now())[0];
  if (a) text(R, "⚠︎ " + a.event, 10, new Color(ALERT_COLORS[a.event] || "#f6dc92"), true, 2);
  return w;
}
function largeRadar(d, away, img) {
  const w = new ListWidget(); w.backgroundColor = C.bg; w.setPadding(0, 0, 10, 0);
  const z = wsize(); radarBox(w, img, z.w, Math.round(z.lg * 0.68), d, away);
  w.addSpacer(8);
  const b = w.addStack(); b.layoutHorizontally(); b.setPadding(0, 13, 0, 13); b.centerAlignContent();
  bigTemp(b, d, 40); b.addSpacer(12);
  const m = b.addStack(); m.layoutVertically();
  row(m, [["Feels ", false], [n0(d.feels) + "°", true, C.chill], [feelsWord(d), false]], 12);
  row(m, [["Wind ", false], [n0(d.wind), true], [" " + (d.dir || ""), false], [d.gust != null ? " · gust " : "", false], [d.gust != null ? n0(d.gust) : "", true]], 12);
  const h = high(d);
  if (h) row(m, [[h.label + " ", false], [n0(h.t) + "°", true]], 12);
  sunLine(m, d, 12);
  b.addSpacer();
  w.addSpacer(4);
  const al = w.addStack(); al.setPadding(0, 13, 0, 13); alertBar(al, d, true);
  return w;
}

function failed(info) {
  const w = new ListWidget(); w.backgroundColor = C.bg; w.setPadding(12, 12, 12, 12);
  text(w, "WeatherBridge", 12, C.temp, true);
  w.addSpacer(4);
  text(w, PUBLIC_ONLY ? "No reading yet. Check the internet connection." : "No reading yet. Open this widget once on home Wi-Fi.", 11, C.ink2, false, 4);
  w.addSpacer();
  text(w, PUBLIC_ONLY ? PUBLIC.replace(/^https:\/\//, "") : HOST, 9.5, C.ink3);
  return w;
}

// ---------- main ----------
const src = await load(), { d, away, web } = src;
const fam = config.widgetFamily || (RADAR ? "large" : "medium");
let w;
if (!d) w = fam.startsWith("accessory") ? (() => { const x = new ListWidget(); text(x, "WeatherBridge: no reading", 12); return x; })() : failed();
else if (fam === "accessoryInline") w = lockInline(d, away);
else if (RADAR && fam === "accessoryRectangular") w = lockRadar(d, away, await radarImage(src, "mono"));
else if (fam === "accessoryRectangular" || fam === "accessoryCircular") w = lockRect(d, away);
else if (RADAR && LOCK && fam === "small") w = lockSquare(d, away, await radarImage(src, "mono"));
else if (RADAR && fam === "small") w = smallRadar(d, away, await radarImage(src, "sq"));
else if (RADAR && fam === "medium") w = mediumRadar(d, away, await radarImage(src, "sq"));
else if (RADAR && fam === "extraLarge" && wsize().xl) w = xlRadar(d, away, await radarImage(src, "wide"));
else if (RADAR) w = largeRadar(d, away, await radarImage(src, "wide"));      // large (and extra large on an iPhone-sized screen)
else if (fam === "small") w = small(d, away);
else w = medium(d, away);                 // medium (large and extra-large show the medium layout)
w.url = web ? PUBLIC + "/" : BASE + "/console/";
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w);
else if (fam === "small") await w.presentSmall(); else if (fam === "large") await w.presentLarge(); else await w.presentMedium();
Script.complete();
