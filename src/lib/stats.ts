// Stat progression engine for IRL FC (real-life football career simulator)

export type Attrs = {
  // Pace
  acceleration: number;
  sprintSpeed: number;
  // Shooting
  finishing: number;
  shotPower: number;
  longShots: number;
  positioning: number;
  volleys: number;
  penalties: number;
  // Passing
  vision: number;
  crossing: number;
  shortPassing: number;
  longPassing: number;
  curve: number;
  freeKickAccuracy: number;
  // Dribbling
  agility: number;
  balance: number;
  reactions: number;
  ballControl: number;
  dribbling: number;
  composure: number;
  // Defending
  interceptions: number;
  defensiveAwareness: number;
  standingTackle: number;
  slidingTackle: number;
  heading: number;
  // Physical
  jumping: number;
  stamina: number;
  strength: number;
  // GK (optional)
  diving?: number;
  handling?: number;
  kicking?: number;
  reflexes?: number;
  gkPositioning?: number;
};

export type Categories = {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
};

export type Session = {
  id: string;
  date: number;
  drill: string;
  reps: number;
  evidence: "camera" | "manual" | "estimated";
  xp: number;
  changes: { attr: string; before: number; after: number }[];
  note: string;
};

export type Match = {
  id: string;
  date: number;
  opponent: string;
  competition: string;
  position: string;
  minutes: number;
  result: string;
  goals: number;
  assists: number;
  shots: number;
  chancesCreated: number;
  passesCompleted: number;
  passesAttempted: number;
  interceptions: number;
  tackles: number;
  distance: number;
  sprints: number;
  rating: number;
};

export type Achievement = { id: string; name: string; desc: string; date: number };

export type Player = {
  name: string;
  position: string;
  foot: string;
  experience: string;
  goals: string[];
  ovr: number;
  level: number;
  xp: number;
  xpToNext: number;
  sharpness: number;
  energy: number;
  form: number;
  attrs: Attrs;
  fractional: Record<string, number>;
  lastActive: number;
  createdAt: number;
  drillsDone: number;
  matchesPlayed: number;
  sessions: Session[];
  matches: Match[];
  achievements: Achievement[];
  history: { date: number; kind: string; delta: string }[];
  bestOvr: number;
  streak: number;
  lastDrillDate: string;
};

const clamp = (v: number, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, v));

const BASE_ATTRS: Record<string, Attrs> = {
  default: {
    acceleration: 58, sprintSpeed: 55,
    finishing: 50, shotPower: 52, longShots: 48, positioning: 52, volleys: 45, penalties: 50,
    vision: 52, crossing: 48, shortPassing: 55, longPassing: 48, curve: 45, freeKickAccuracy: 45,
    agility: 55, balance: 52, reactions: 50, ballControl: 52, dribbling: 50, composure: 48,
    interceptions: 45, defensiveAwareness: 45, standingTackle: 45, slidingTackle: 40, heading: 48,
    jumping: 52, stamina: 58, strength: 50,
  },
};

export function createPlayer(name: string, position: string, foot: string, experience: string, goals: string[]): Player {
  const base = JSON.parse(JSON.stringify(BASE_ATTRS.default)) as Attrs;
  // position tweaks
  if (position === "ST" || position === "LW" || position === "RW") {
    base.finishing += 6; base.positioning += 4; base.sprintSpeed += 2;
    base.interceptions -= 4; base.standingTackle -= 4;
  } else if (position === "CAM" || position === "CM") {
    base.vision += 6; base.shortPassing += 5; base.ballControl += 3;
  } else if (position === "CDM") {
    base.interceptions += 6; base.standingTackle += 5; base.defensiveAwareness += 5;
  } else if (position === "CB") {
    base.standingTackle += 6; base.heading += 5; base.interceptions += 4; base.strength += 3;
  } else if (position === "LB" || position === "RB") {
    base.stamina += 4; base.crossing += 4; base.acceleration += 3;
  } else if (position === "GK") {
    base.diving = 55; base.handling = 52; base.kicking = 50; base.reflexes = 55; base.gkPositioning = 52;
  }
  // clamp all
  for (const k of Object.keys(base)) (base as any)[k] = clamp((base as any)[k], 30, 70);
  return {
    name, position, foot, experience, goals,
    ovr: 50, level: 1, xp: 0, xpToNext: 200,
    sharpness: 50, energy: 100, form: 50,
    attrs: base, fractional: {},
    lastActive: Date.now(), createdAt: Date.now(),
    drillsDone: 0, matchesPlayed: 0,
    sessions: [], matches: [], achievements: [],
    history: [], bestOvr: 50, streak: 0, lastDrillDate: "",
  };
}

export function categoriesOf(p: Player): Categories {
  const a = p.attrs;
  const pace = (a.acceleration + a.sprintSpeed) / 2;
  const shooting = (a.finishing + a.shotPower + a.longShots + a.positioning + a.volleys + a.penalties) / 6;
  const passing = (a.vision + a.crossing + a.shortPassing + a.longPassing + a.curve + a.freeKickAccuracy) / 6;
  const dribbling = (a.agility + a.balance + a.reactions + a.ballControl + a.dribbling + a.composure) / 6;
  const defending = (a.interceptions + a.defensiveAwareness + a.standingTackle + a.slidingTackle + a.heading) / 5;
  const physical = (a.jumping + a.stamina + a.strength) / 3;
  return {
    pace: Math.round(clamp(pace)),
    shooting: Math.round(clamp(shooting)),
    passing: Math.round(clamp(passing)),
    dribbling: Math.round(clamp(dribbling)),
    defending: Math.round(clamp(defending)),
    physical: Math.round(clamp(physical)),
  };
}

const POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  ST: { pace: 0.18, shooting: 0.32, passing: 0.12, dribbling: 0.18, defending: 0.05, physical: 0.15 },
  LW: { pace: 0.25, shooting: 0.18, passing: 0.14, dribbling: 0.22, defending: 0.06, physical: 0.15 },
  RW: { pace: 0.25, shooting: 0.18, passing: 0.14, dribbling: 0.22, defending: 0.06, physical: 0.15 },
  CAM: { pace: 0.12, shooting: 0.18, passing: 0.28, dribbling: 0.22, defending: 0.08, physical: 0.12 },
  CM: { pace: 0.12, shooting: 0.12, passing: 0.26, dribbling: 0.16, defending: 0.16, physical: 0.18 },
  CDM: { pace: 0.10, shooting: 0.08, passing: 0.18, dribbling: 0.10, defending: 0.30, physical: 0.24 },
  CB: { pace: 0.10, shooting: 0.05, passing: 0.12, dribbling: 0.06, defending: 0.42, physical: 0.25 },
  LB: { pace: 0.20, shooting: 0.06, passing: 0.16, dribbling: 0.12, defending: 0.26, physical: 0.20 },
  RB: { pace: 0.20, shooting: 0.06, passing: 0.16, dribbling: 0.12, defending: 0.26, physical: 0.20 },
  GK: { pace: 0.05, shooting: 0.02, passing: 0.10, dribbling: 0.03, defending: 0.10, physical: 0.10 },
};

export function recalcOvr(p: Player) {
  const c = categoriesOf(p);
  const w = POSITION_WEIGHTS[p.position] || POSITION_WEIGHTS.ST;
  let raw = c.pace * w.pace + c.shooting * w.shooting + c.passing * w.passing + c.dribbling * w.dribbling + c.defending * w.defending + c.physical * w.physical;
  if (p.position === "GK") {
    const gk = ((p.attrs.diving || 50) + (p.attrs.handling || 50) + (p.attrs.kicking || 50) + (p.attrs.reflexes || 50) + (p.attrs.gkPositioning || 50)) / 5;
    raw = gk * 0.7 + c.physical * 0.3;
  }
  // sharpness small modifier
  if (p.sharpness < 30) raw -= 1.5;
  else if (p.sharpness > 80) raw += 0.5;
  p.ovr = Math.round(clamp(raw, 40, 99));
  if (p.ovr > p.bestOvr) p.bestOvr = p.ovr;
}

export function applyDecay(p: Player) {
  const now = Date.now();
  const days = (now - p.lastActive) / (1000 * 60 * 60 * 24);
  if (days < 0.25) return;
  // sharpness decay 2/day
  p.sharpness = Math.max(0, p.sharpness - Math.min(p.sharpness, days * 2));
  // energy regen 25/day
  p.energy = Math.min(100, p.energy + days * 25);
  // stat decay if sharpness low
  if (p.sharpness < 25) {
    const d = (25 - p.sharpness) * 0.004 * days;
    const keys = Object.keys(p.attrs) as (keyof Attrs)[];
    for (const k of keys) if (typeof (p.attrs as any)[k] === "number") (p.attrs as any)[k] = clamp((p.attrs as any)[k] - d);
  }
  // form drift toward 50
  p.form = p.form + (50 - p.form) * Math.min(0.3, days * 0.05);
  p.lastActive = now;
  recalcOvr(p);
}

function gain(current: number, amount: number, energy: number, sharpness: number, frac: number): { delta: number; newFrac: number } {
  const energyFactor = energy >= 60 ? 1 : energy >= 30 ? 0.6 : 0.25;
  const sharpFactor = sharpness >= 40 ? 1 : 0.7;
  const diminishing = 1 - (current / 100) * 0.55;
  const raw = amount * energyFactor * sharpFactor * diminishing + frac;
  const whole = Math.floor(raw);
  return { delta: whole, newFrac: raw - whole };
}

export type DrillDef = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  desc: string;
  cost: number;
  xp: number;
  weights: Record<string, number>; // attr -> base gain
  secondary: Record<string, number>;
};

export const DRILLS: DrillDef[] = [
  { id: "sprint", name: "Max Sprint", category: "Speed", emoji: "\u{1F3C3}", desc: "5 max-effort sprints. Boosts acceleration most.", cost: 20, xp: 40, weights: { acceleration: 1.4, sprintSpeed: 0.6 }, secondary: { stamina: 0.3, jumping: 0.1 } },
  { id: "jump", name: "Vertical Jump", category: "Physical", emoji: "\u{1F998}", desc: "Jump as high as you can. Boosts jumping.", cost: 20, xp: 35, weights: { jumping: 1.4, strength: 0.5 }, secondary: { stamina: 0.2 } },
  { id: "shuttle", name: "Shuttle Run", category: "Speed", emoji: "\u2194\uFE0F", desc: "Back-and-forth sprints. Boosts pace + stamina.", cost: 20, xp: 40, weights: { acceleration: 0.7, sprintSpeed: 0.7, stamina: 0.6 }, secondary: { agility: 0.2 } },
  { id: "plank", name: "Plank Hold", category: "Physical", emoji: "\u{1F9D8}", desc: "Hold plank. Boosts strength + stamina.", cost: 15, xp: 25, weights: { strength: 1.0, stamina: 0.7 }, secondary: {} },
  { id: "juggling", name: "Ball Juggling", category: "Ball Mastery", emoji: "\u26BD", desc: "Keep the ball up. Boosts ball control & composure.", cost: 15, xp: 30, weights: { ballControl: 1.2, composure: 0.6, reactions: 0.4 }, secondary: { agility: 0.2 } },
  { id: "dribble_cones", name: "Cone Dribbling", category: "Dribbling", emoji: "\u{1F6A7}", desc: "Weave through cones. Boosts dribbling & agility.", cost: 20, xp: 35, weights: { dribbling: 1.2, agility: 0.8, ballControl: 0.5 }, secondary: { balance: 0.3 } },
  { id: "wall_pass", name: "Wall Passing", category: "Passing", emoji: "\u{1F9F1}", desc: "Quick one-twos off a wall. Boosts passing & vision.", cost: 15, xp: 30, weights: { shortPassing: 1.2, vision: 0.6, reactions: 0.4 }, secondary: { ballControl: 0.2 } },
  { id: "shooting_acc", name: "Shooting Accuracy", category: "Shooting", emoji: "\u{1F3AF}", desc: "Hit targets in the goal. Boosts finishing & shot power.", cost: 20, xp: 40, weights: { finishing: 1.2, shotPower: 0.6, positioning: 0.4 }, secondary: { composure: 0.2 } },
  { id: "agility_course", name: "Agility Course", category: "Agility", emoji: "\u{1F500}", desc: "Ladder + cone agility. Boosts agility & balance.", cost: 20, xp: 35, weights: { agility: 1.3, balance: 0.8, reactions: 0.4 }, secondary: { acceleration: 0.2 } },
  { id: "defending", name: "Defensive Drills", category: "Defending", emoji: "\u{1F6E1}\uFE0F", desc: "Tackling + interceptions. Boosts defending.", cost: 20, xp: 35, weights: { standingTackle: 1.2, interceptions: 0.8, defensiveAwareness: 0.6 }, secondary: { strength: 0.2 } },
];

export function applyDrill(p: Player, drillId: string, reps: number, evidence: "camera" | "manual" | "estimated", submissionId: string): { xp: number; changes: { attr: string; before: number; after: number }[]; note: string } | null {
  // duplicate submission guard
  if (p.sessions.some((s) => s.id === submissionId)) return null;
  const drill = DRILLS.find((d) => d.id === drillId);
  if (!drill) return null;
  const r = Math.max(1, Math.min(60, reps));
  const before = JSON.parse(JSON.stringify(p.attrs));
  const a = p.attrs;
  const changes: { attr: string; before: number; after: number }[] = [];
  const recordChange = (attr: string) => {
    const b = (before as any)[attr];
    const af = (a as any)[attr];
    if (af !== b) changes.push({ attr, before: b, after: af });
  };

  const e = p.energy;
  const s = p.sharpness;
  p.energy = Math.max(0, p.energy - drill.cost);
  p.sharpness = Math.min(100, p.sharpness + 3 + Math.min(r, 4));
  p.drillsDone += 1;

  const applyWeight = (attr: string, base: number) => {
    const cur = (a as any)[attr] as number;
    const frac = p.fractional[attr] || 0;
    const { delta, newFrac } = gain(cur, base * r, e, s, frac);
    p.fractional[attr] = newFrac;
    if (delta > 0) (a as any)[attr] = clamp(cur + delta);
  };

  for (const [attr, w] of Object.entries(drill.weights)) applyWeight(attr, w);
  for (const [attr, w] of Object.entries(drill.secondary)) applyWeight(attr, w);

  // categories are computed on demand; no derived attrs stored
  const recalcDerived = () => {};
  recalcDerived();

  for (const attr of Object.keys(drill.weights)) recordChange(attr);
  for (const attr of Object.keys(drill.secondary)) recordChange(attr);

  // XP
  const xpGain = drill.xp + Math.min(r, 10) * 2;
  p.xp += xpGain;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level += 1;
    p.xpToNext = Math.round(p.xpToNext * 1.15);
  }

  // form bump
  p.form = clamp(p.form + 2, 1, 99);

  recalcOvr(p);

  // streak
  const today = new Date().toDateString();
  if (p.lastDrillDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    p.streak = p.lastDrillDate === yesterday ? p.streak + 1 : 1;
    p.lastDrillDate = today;
  }

  p.sessions.unshift({
    id: submissionId,
    date: Date.now(),
    drill: drill.name,
    reps: r,
    evidence,
    xp: xpGain,
    changes,
    note: `${r} reps via ${evidence}`,
  });
  p.sessions = p.sessions.slice(0, 50);

  p.history.unshift({ date: Date.now(), kind: "drill:" + drill.id, delta: `+${r} reps, +${xpGain} XP` });
  p.history = p.history.slice(0, 40);
  p.lastActive = Date.now();

  checkAchievements(p);

  return { xp: xpGain, changes, note: `${r} reps` };
}

export function applyMatch(p: Player, m: Match): { xp: number } {
  // duplicate guard
  if (p.matches.some((x) => x.id === m.id)) return { xp: 0 };
  const xpGain = 50 + m.goals * 10 + m.assists * 5 + Math.floor(m.minutes / 10);
  p.xp += xpGain;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level += 1;
    p.xpToNext = Math.round(p.xpToNext * 1.15);
  }
  p.sharpness = Math.min(100, p.sharpness + 8 + Math.min(12, m.goals * 2 + m.assists + Math.floor(m.distance / 2)));
  p.energy = Math.max(0, p.energy - 30);
  const a = p.attrs;
  // small bumps from match evidence
  const bump = (attr: string, amt: number) => {
    const cur = (a as any)[attr];
    (a as any)[attr] = clamp(cur + amt);
  };
  bump("stamina", Math.min(2, m.distance * 0.05));
  bump("sprintSpeed", Math.min(1, m.sprints * 0.03));
  bump("finishing", Math.min(1, m.goals * 0.2));
  bump("vision", Math.min(1, m.assists * 0.2));
  bump("shortPassing", Math.min(1, (m.passesCompleted / Math.max(1, m.passesAttempted)) * 2));
  bump("interceptions", Math.min(1, m.interceptions * 0.15));
  bump("standingTackle", Math.min(1, m.tackles * 0.15));

  // form from rating
  p.form = clamp(p.form + (m.rating - 6) * 2, 1, 99);

  recalcOvr(p);
  p.matchesPlayed += 1;
  p.matches.unshift(m);
  p.matches = p.matches.slice(0, 50);
  p.history.unshift({ date: Date.now(), kind: "match", delta: `vs ${m.opponent}: ${m.goals}-${m.assists}, rating ${m.rating}, +${xpGain} XP` });
  p.history = p.history.slice(0, 40);
  p.lastActive = Date.now();
  checkAchievements(p);
  return { xp: xpGain };
}

const ACHIEVEMENTS_DEF: { id: string; name: string; desc: string; check: (p: Player) => boolean }[] = [
  { id: "first_drill", name: "First Session", desc: "Complete your first training session.", check: (p) => p.drillsDone >= 1 },
  { id: "ten_drills", name: "Dedicated", desc: "Complete 10 training sessions.", check: (p) => p.drillsDone >= 10 },
  { id: "first_match", name: "Match Day", desc: "Record your first match.", check: (p) => p.matchesPlayed >= 1 },
  { id: "five_matches", name: "Seasoned", desc: "Record 5 matches.", check: (p) => p.matchesPlayed >= 5 },
  { id: "ovr_55", name: "Rising Star", desc: "Reach 55 OVR.", check: (p) => p.ovr >= 55 },
  { id: "ovr_60", name: "On the Radar", desc: "Reach 60 OVR.", check: (p) => p.ovr >= 60 },
  { id: "ovr_70", name: "Elite", desc: "Reach 70 OVR.", check: (p) => p.ovr >= 70 },
  { id: "level_5", name: "Level 5", desc: "Reach level 5.", check: (p) => p.level >= 5 },
  { id: "streak_3", name: "Consistent", desc: "3-day training streak.", check: (p) => p.streak >= 3 },
  { id: "streak_7", name: "Relentless", desc: "7-day training streak.", check: (p) => p.streak >= 7 },
  { id: "first_goal", name: "First Goal", desc: "Score your first goal in a recorded match.", check: (p) => p.matches.some((m) => m.goals > 0) },
  { id: "hat_trick", name: "Hat-Trick", desc: "Score 3+ goals in a match.", check: (p) => p.matches.some((m) => m.goals >= 3) },
];

export function checkAchievements(p: Player) {
  for (const def of ACHIEVEMENTS_DEF) {
    if (!p.achievements.some((a) => a.id === def.id) && def.check(p)) {
      p.achievements.unshift({ id: def.id, name: def.name, desc: def.desc, date: Date.now() });
    }
  }
}

export function mentorTips(p: Player): string[] {
  const tips: string[] = [];
  const c = categoriesOf(p);
  if (p.energy < 30) tips.push("Energy low (" + Math.round(p.energy) + "). Rest or gains will be minimal.");
  if (p.sharpness < 40) tips.push("Sharpness low. Play a match or drill to regain form, or stats may decay.");
  const entries: [string, number][] = [
    ["Pace", c.pace], ["Shooting", c.shooting], ["Passing", c.passing],
    ["Dribbling", c.dribbling], ["Defending", c.defending], ["Physical", c.physical],
  ];
  entries.sort((x, y) => x[1] - y[1]);
  tips.push("Weakest category: " + entries[0][0] + " (" + entries[0][1] + "). Focus drills there.");
  if (p.drillsDone < 2) tips.push("Use the camera on Training Ground to track drills and earn stat gains.");
  if (p.matchesPlayed === 0) tips.push("Log a match in Match Centre to boost sharpness and OVR.");
  if (p.streak >= 3) tips.push("Training streak: " + p.streak + " days. Keep it up!");
  return tips;
}

export function mentorChat(p: Player, msg: string): string {
  const m = msg.toLowerCase();
  const c = categoriesOf(p);
  if (m.includes("sprint") || m.includes("pace") || m.includes("accel")) {
    return "Pace " + c.pace + " (acc " + p.attrs.acceleration + ", sprint " + p.attrs.sprintSpeed + "). Do 5 max-effort sprints with full recovery to push acceleration hardest. Keep energy above 60 for full gains.";
  }
  if (m.includes("jump")) {
    return "Jumping " + p.attrs.jumping + ". Vertical jumps build it; strength (" + p.attrs.strength + ") supports it. Aim 3x10 reps.";
  }
  if (m.includes("energy") || m.includes("tired")) {
    return "Energy " + Math.round(p.energy) + "/100. Below 30, gains drop to 25%. Rest a day; energy regens ~25/day.";
  }
  if (m.includes("sharp")) {
    return "Sharpness " + Math.round(p.sharpness) + "/100. Decays 2/day inactive; below 25 stats slowly drop. Log a match or drill to regain.";
  }
  if (m.includes("match") || m.includes("game")) {
    return "Log match stats in Match Centre. Each match boosts sharpness + OVR, form and XP.";
  }
  if (m.includes("ovr") || m.includes("rating") || m.includes("overall")) {
    return "OVR " + p.ovr + " (best " + p.bestOvr + "). Improve weakest attributes and keep sharpness high. Drills + matches both contribute.";
  }
  if (m.includes("camera") || m.includes("video")) {
    return "Upload a drill video on Training Ground. Pose tracking counts reps and applies stat gains automatically.";
  }
  if (m.includes("weak") || m.includes("improve")) {
    const entries: [string, number][] = Object.entries(c) as any;
    entries.sort((x: any, y: any) => x[1] - y[1]);
    return "Weakest: " + entries[0][0] + " (" + entries[0][1] + "). Recommended drill: " + (entries[0][0] === "pace" ? "Max Sprint" : entries[0][0] === "shooting" ? "Shooting Accuracy" : entries[0][0] === "passing" ? "Wall Passing" : entries[0][0] === "dribbling" ? "Cone Dribbling" : entries[0][0] === "defending" ? "Defensive Drills" : "Plank Hold") + ".";
  }
  return "Focus on your weakest stat. Energy " + Math.round(p.energy) + ", Sharpness " + Math.round(p.sharpness) + ", OVR " + p.ovr + ", Level " + p.level + ". Ask about sprint, jump, energy, sharpness, match, camera, or weak.";
}

export function loadPlayer(): Player | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("irlfc_player");
    if (!raw) return null;
    const p = JSON.parse(raw) as Player;
    applyDecay(p);
    return p;
  } catch {
    return null;
  }
}

export function savePlayer(p: Player) {
  localStorage.setItem("irlfc_player", JSON.stringify(p));
}
