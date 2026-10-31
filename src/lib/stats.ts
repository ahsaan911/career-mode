// Stat progression engine for Career Mode

export type Attrs = {
  pace: number; // 1-99
  sprintSpeed: number;
  acceleration: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  stamina: number;
  strength: number;
  jumping: number;
};

export type Player = {
  name: string;
  position: string;
  ovr: number;
  sharpness: number; // 0-100
  energy: number; // 0-100
  attrs: Attrs;
  lastActive: number; // timestamp ms
  createdAt: number;
  drillsDone: number;
  matchesPlayed: number;
  history: { date: number; kind: string; delta: string }[];
};

const clamp = (v: number, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, v));

export function createPlayer(name: string, position: string): Player {
  const base: Attrs = {
    pace: 55,
    sprintSpeed: 52,
    acceleration: 58,
    shooting: 48,
    passing: 50,
    dribbling: 52,
    defending: 45,
    physical: 50,
    stamina: 55,
    strength: 48,
    jumping: 50,
  };
  return {
    name,
    position,
    ovr: 50,
    sharpness: 50,
    energy: 100,
    attrs: base,
    lastActive: Date.now(),
    createdAt: Date.now(),
    drillsDone: 0,
    matchesPlayed: 0,
    history: [],
  };
}

export function recalcOvr(p: Player) {
  const a = p.attrs;
  const pace = (a.sprintSpeed + a.acceleration) / 2;
  const shoot = a.shooting;
  const pass = a.passing;
  const drib = a.dribbling;
  const defend = a.defending;
  const phys = (a.stamina + a.strength + a.jumping) / 3;
  // position weighting (generic)
  const raw =
    pace * 0.18 +
    shoot * 0.15 +
    pass * 0.15 +
    drib * 0.15 +
    defend * 0.12 +
    phys * 0.25;
  p.ovr = Math.round(clamp(raw, 40, 99));
  // sharpness bonus/penalty small
  if (p.sharpness < 30) p.ovr = Math.max(40, p.ovr - 2);
}

export function applyDecay(p: Player) {
  const now = Date.now();
  const days = (now - p.lastActive) / (1000 * 60 * 60 * 24);
  if (days < 0.5) return;
  // sharpness decay 2/day
  const sharpDecay = Math.min(p.sharpness, days * 2);
  p.sharpness = Math.max(0, p.sharpness - sharpDecay);
  // energy regen 20/day
  p.energy = Math.min(100, p.energy + days * 20);
  // stat decay if sharpness low
  if (p.sharpness < 30) {
    const d = (30 - p.sharpness) * 0.005 * days;
    const keys = Object.keys(p.attrs) as (keyof Attrs)[];
    for (const k of keys) p.attrs[k] = clamp(p.attrs[k] - d);
  }
  p.lastActive = now;
  recalcOvr(p);
}

// gain helper: adds to attr with diminishing returns near 99, scaled by energy & sharpness
function gain(current: number, amount: number, energy: number, sharpness: number): number {
  const energyFactor = energy >= 60 ? 1 : energy >= 30 ? 0.6 : 0.3;
  const sharpFactor = sharpness >= 40 ? 1 : 0.7;
  const diminishing = 1 - (current / 100) * 0.6;
  return amount * energyFactor * sharpFactor * diminishing;
}

export type DrillResult = { reps: number; metrics: string };

export function applyDrill(p: Player, drill: string, res: DrillResult) {
  const reps = Math.max(1, res.reps);
  const e = p.energy;
  const s = p.sharpness;
  const a = p.attrs;
  const cost = drill === "plank" ? 15 : 20;
  p.energy = Math.max(0, p.energy - cost);
  p.sharpness = Math.min(100, p.sharpness + 4 + Math.min(reps, 5));
  p.drillsDone += 1;

  const r = reps;
  switch (drill) {
    case "sprint":
      a.acceleration = clamp(a.acceleration + gain(a.acceleration, 1.2 * r, e, s));
      a.sprintSpeed = clamp(a.sprintSpeed + gain(a.sprintSpeed, 0.5 * r, e, s));
      a.stamina = clamp(a.stamina + gain(a.stamina, 0.4 * r, e, s));
      a.jumping = clamp(a.jumping + gain(a.jumping, 0.2 * r, e, s));
      a.pace = clamp((a.sprintSpeed + a.acceleration) / 2);
      break;
    case "jump":
      a.jumping = clamp(a.jumping + gain(a.jumping, 1.3 * r, e, s));
      a.strength = clamp(a.strength + gain(a.strength, 0.5 * r, e, s));
      a.stamina = clamp(a.stamina + gain(a.stamina, 0.3 * r, e, s));
      break;
    case "shuttle":
      a.pace = clamp(a.pace + gain(a.pace, 0.8 * r, e, s));
      a.sprintSpeed = clamp(a.sprintSpeed + gain(a.sprintSpeed, 0.6 * r, e, s));
      a.acceleration = clamp(a.acceleration + gain(a.acceleration, 0.6 * r, e, s));
      a.stamina = clamp(a.stamina + gain(a.stamina, 0.7 * r, e, s));
      break;
    case "plank":
      a.strength = clamp(a.strength + gain(a.strength, 0.9 * r, e, s));
      a.stamina = clamp(a.stamina + gain(a.stamina, 0.6 * r, e, s));
      a.physical = clamp((a.stamina + a.strength + a.jumping) / 3);
      break;
  }
  a.physical = clamp((a.stamina + a.strength + a.jumping) / 3);
  a.pace = clamp((a.sprintSpeed + a.acceleration) / 2);
  recalcOvr(p);
  p.history.unshift({ date: Date.now(), kind: "drill:" + drill, delta: `+${r} reps` });
  p.history = p.history.slice(0, 20);
  p.lastActive = Date.now();
}

export function applyMatch(p: Player, stats: { goals: number; assists: number; distance: number; sprints: number; rating: number }) {
  const boost = Math.min(15, stats.goals * 2 + stats.assists + Math.floor(stats.distance / 2) + Math.floor(stats.sprints / 5) + (stats.rating - 5));
  p.sharpness = Math.min(100, p.sharpness + 8 + boost * 0.5);
  p.energy = Math.max(0, p.energy - 30);
  // small stat bumps
  const a = p.attrs;
  a.stamina = clamp(a.stamina + gain(a.stamina, 0.5 + stats.distance * 0.1, p.energy + 30, p.sharpness));
  a.sprintSpeed = clamp(a.sprintSpeed + gain(a.sprintSpeed, stats.sprints * 0.05, p.energy + 30, p.sharpness));
  a.shooting = clamp(a.shooting + gain(a.shooting, stats.goals * 0.3, p.energy + 30, p.sharpness));
  a.passing = clamp(a.passing + gain(a.passing, stats.assists * 0.3, p.energy + 30, p.sharpness));
  recalcOvr(p);
  p.matchesPlayed += 1;
  p.history.unshift({ date: Date.now(), kind: "match", delta: `rating ${stats.rating}, +${boost} sharpness` });
  p.history = p.history.slice(0, 20);
  p.lastActive = Date.now();
}

export function mentorTips(p: Player): string[] {
  const tips: string[] = [];
  const a = p.attrs;
  if (p.energy < 30) tips.push("⚠️ Energy low (" + Math.round(p.energy) + "). Rest or gains will be minimal. Consider a rest day.");
  if (p.sharpness < 40) tips.push("📉 Sharpness low. Play a match or do a drill to regain form, or stats may decay.");
  // find weakest
  const entries: [string, number][] = [
    ["Acceleration", a.acceleration],
    ["Sprint Speed", a.sprintSpeed],
    ["Stamina", a.stamina],
    ["Jumping", a.jumping],
    ["Shooting", a.shooting],
    ["Passing", a.passing],
    ["Dribbling", a.dribbling],
  ];
  entries.sort((x, y) => x[1] - y[1]);
  tips.push(`🎯 Weakest attribute: ${entries[0][0]} (${entries[0][1]}). Focus drills there.`);
  if (a.acceleration < a.sprintSpeed + 3) tips.push("💡 Tip: Sprint drills boost acceleration the most — do 5x max-effort sprints.");
  if (p.drillsDone < 3) tips.push("📹 Use the camera on the Drills tab to track sprints/jumps and earn stat gains.");
  if (p.matchesPlayed === 0) tips.push("⚽ Log a match in Match Log to boost sharpness and OVR.");
  return tips;
}

export function mentorChat(p: Player, msg: string): string {
  const m = msg.toLowerCase();
  const a = p.attrs;
  if (m.includes("sprint") || m.includes("pace") || m.includes("accel")) {
    return `Your pace is ${Math.round(a.pace)} (acc ${a.acceleration}, sprint ${a.sprintSpeed}). Do 5 max-effort sprints with full recovery to push acceleration hardest. Keep energy above 60 for full gains.`;
  }
  if (m.includes("jump")) {
    return `Jumping is ${a.jumping}. Vertical jumps + squat jumps build it; strength (${a.strength}) supports it. Aim 3x10 reps.`;
  }
  if (m.includes("energy") || m.includes("tired")) {
    return `Energy is ${Math.round(p.energy)}/100. Below 30, gains drop to 30%. Rest a day or sleep; energy regens ~20/day.`;
  }
  if (m.includes("sharp")) {
    return `Sharpness ${Math.round(p.sharpness)}/100. Decays 2/day inactive; below 30 stats slowly drop. Log a match or drill to regain.`;
  }
  if (m.includes("match") || m.includes("game")) {
    return `Log match stats (goals/assists/distance/sprints/rating) on Match Log tab. Each match boosts sharpness + OVR and stamina.`;
  }
  if (m.includes("ovr") || m.includes("rating") || m.includes("overall")) {
    return `OVR ${p.ovr}. Improve weakest attributes and keep sharpness high. Drills + matches both contribute.`;
  }
  if (m.includes("camera") || m.includes("video")) {
    return `Upload a drill video on Drills tab. I'll run pose tracking to count reps and apply stat gains automatically.`;
  }
  return `Focus on your weakest stat. Energy ${Math.round(p.energy)}, Sharpness ${Math.round(p.sharpness)}, OVR ${p.ovr}. Ask me about sprint, jump, energy, sharpness, match, or camera.`;
}
