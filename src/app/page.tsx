"use client";

import { useEffect, useState, useRef } from "react";
import { createPlayer, applyDecay, applyDrill, applyMatch, mentorTips, mentorChat, recalcOvr, type Player, type DrillResult } from "@/lib/stats";
import { analyzeVideo } from "@/lib/pose";

const DRILLS = [
  { id: "sprint", name: "Max Sprint", emoji: "\u{1F3C3}", desc: "5 max-effort sprints. Boosts acceleration most.", cost: 20 },
  { id: "jump", name: "Vertical Jump", emoji: "\u{1F998}", desc: "Jump as high as you can. Boosts jumping.", cost: 20 },
  { id: "shuttle", name: "Shuttle Run", emoji: "\u2194\uFE0F", desc: "Back-and-forth sprints. Boosts pace + stamina.", cost: 20 },
  { id: "plank", name: "Plank Hold", emoji: "\u{1F9D8}", desc: "Hold plank. Boosts strength + stamina.", cost: 15 },
];

const POSITIONS = ["ST", "LW", "RW", "CAM", "CM", "CDM", "CB", "LB", "RB", "GK"];

function loadPlayer(): Player | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("career_player");
    if (!raw) return null;
    const p = JSON.parse(raw) as Player;
    applyDecay(p);
    return p;
  } catch {
    return null;
  }
}

function savePlayer(p: Player) {
  localStorage.setItem("career_player", JSON.stringify(p));
}

function StatBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : value >= 40 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 text-gray-300">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded">
        <div className={`h-2 rounded ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-white">{Math.round(value)}</span>
    </div>
  );
}

export default function Home() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [tab, setTab] = useState<"dash" | "drills" | "match" | "mentor">("dash");
  const [onboarding, setOnboarding] = useState(true);
  const [name, setName] = useState("");
  const [pos, setPos] = useState("ST");

  // drill state
  const [selectedDrill, setSelectedDrill] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // match state
  const [mGoals, setMGoals] = useState(0);
  const [mAssists, setMAssists] = useState(0);
  const [mDistance, setMDistance] = useState(5);
  const [mSprints, setMSprints] = useState(10);
  const [mRating, setMRating] = useState(7);

  // mentor chat
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<{ who: string; text: string }[]>([
    { who: "mentor", text: "Hey! I'm your pro football mentor. Ask me anything about training, stats, or matches." },
  ]);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = loadPlayer();
    if (p) {
      setPlayer(p);
      setOnboarding(false);
    }
  }, []);

  useEffect(() => {
    if (player) savePlayer(player);
  }, [player]);

  const startCareer = () => {
    if (!name.trim()) return;
    const p = createPlayer(name.trim(), pos);
    setPlayer(p);
    setOnboarding(false);
    setTab("dash");
  };

  const reset = () => {
    localStorage.removeItem("career_player");
    setPlayer(null);
    setOnboarding(true);
  };

  const restDay = () => {
    if (!player) return;
    const p = { ...player, energy: Math.min(100, player.energy + 40), sharpness: Math.min(100, player.sharpness + 5) };
    p.lastActive = Date.now();
    recalcOvr(p);
    setPlayer(p);
  };

  const handleVideo = (f: File) => {
    setVideoFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setLastResult(null);
  };

  const runAnalysis = async () => {
    if (!player || !selectedDrill || !videoFile) return;
    setAnalyzing(true);
    setProgress(0);
    try {
      const res = await analyzeVideo(videoFile, selectedDrill, (pct) => setProgress(pct));
      const drillRes: DrillResult = { reps: res.reps, metrics: res.note };
      const before = player.ovr;
      const p2 = JSON.parse(JSON.stringify(player)) as Player;
      applyDrill(p2, selectedDrill, drillRes);
      setPlayer(p2);
      setLastResult(`Analyzed ${res.frames} frames over ${res.duration.toFixed(1)}s. Detected ${res.reps} reps. ${res.note} OVR ${before} → ${p2.ovr}.`);
    } catch (e: any) {
      setLastResult("Analysis failed: " + (e?.message || e) + ". Try a shorter/clearer video.");
    } finally {
      setAnalyzing(false);
    }
  };

  const logMatch = () => {
    if (!player) return;
    const p2 = JSON.parse(JSON.stringify(player)) as Player;
    applyMatch(p2, { goals: mGoals, assists: mAssists, distance: mDistance, sprints: mSprints, rating: mRating });
    setPlayer(p2);
    setTab("dash");
  };

  const sendChat = () => {
    if (!chatInput.trim() || !player) return;
    const msg = chatInput.trim();
    setChatLog((l) => [...l, { who: "you", text: msg }]);
    const reply = mentorChat(player, msg);
    setTimeout(() => setChatLog((l) => [...l, { who: "mentor", text: reply }]), 300);
    setChatInput("");
  };

  if (onboarding || !player) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-900 via-gray-900 to-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-gray-800/80 rounded-2xl p-8 shadow-2xl border border-green-700">
          <h1 className="text-3xl font-bold mb-2 text-center">⚽ Career Mode</h1>
          <p className="text-gray-400 text-center mb-6">Real-life football career simulator</p>
          <label className="block mb-3">
            <span className="text-sm text-gray-300">Player Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:border-green-500 outline-none" placeholder="Your name" />
          </label>
          <label className="block mb-6">
            <span className="text-sm text-gray-300">Position</span>
            <select value={pos} onChange={(e) => setPos(e.target.value)} className="w-full mt-1 px-3 py-2 rounded bg-gray-700 border border-gray-600">
              {POSITIONS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <button onClick={startCareer} className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 font-bold text-lg">Start Career</button>
          <p className="text-xs text-gray-500 mt-4 text-center">Starting OVR ~50. Train hard, stay sharp.</p>
        </div>
      </main>
    );
  }

  const a = player.attrs;
  const tips = mentorTips(player);

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-900 via-gray-900 to-black text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚽</span>
          <div>
            <div className="font-bold">{player.name}</div>
            <div className="text-xs text-gray-400">{player.position} · {player.drillsDone} drills · {player.matchesPlayed} matches</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={restDay} className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">Rest Day</button>
          <button onClick={reset} className="px-3 py-1 text-sm bg-red-700 hover:bg-red-600 rounded">Reset</button>
        </div>
      </header>

      <nav className="flex gap-2 px-6 py-3 border-b border-gray-700">
        {(["dash", "drills", "match", "mentor"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg font-medium capitalize ${tab === t ? "bg-green-600" : "bg-gray-700 hover:bg-gray-600"}`}>
            {t === "dash" ? "Dashboard" : t === "drills" ? "Drills" : t === "match" ? "Match Log" : "Mentor"}
          </button>
        ))}
      </nav>

      <div className="p-6 max-w-5xl mx-auto">
        {tab === "dash" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* FIFA card */}
            <div className="bg-gradient-to-br from-yellow-600/20 to-gray-800 rounded-2xl p-6 border border-yellow-600/40 shadow-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-6xl font-black text-yellow-400">{player.ovr}</div>
                <div>
                  <div className="text-xl font-bold">{player.name}</div>
                  <div className="text-sm text-gray-400">{player.position}</div>
                  <div className="text-xs text-gray-500">OVR</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Energy</div>
                  <div className="h-3 bg-gray-700 rounded">
                    <div className="h-3 rounded bg-blue-500" style={{ width: `${player.energy}%` }} />
                  </div>
                  <div className="text-xs mt-1">{Math.round(player.energy)}/100</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Sharpness</div>
                  <div className="h-3 bg-gray-700 rounded">
                    <div className="h-3 rounded bg-purple-500" style={{ width: `${player.sharpness}%` }} />
                  </div>
                  <div className="text-xs mt-1">{Math.round(player.sharpness)}/100</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700">
              <h2 className="font-bold mb-3 text-green-400">Attributes</h2>
              <div className="space-y-2">
                <StatBar label="Pace" value={a.pace} />
                <StatBar label="Sprint Speed" value={a.sprintSpeed} />
                <StatBar label="Acceleration" value={a.acceleration} />
                <StatBar label="Shooting" value={a.shooting} />
                <StatBar label="Passing" value={a.passing} />
                <StatBar label="Dribbling" value={a.dribbling} />
                <StatBar label="Defending" value={a.defending} />
                <StatBar label="Physical" value={a.physical} />
                <StatBar label="Stamina" value={a.stamina} />
                <StatBar label="Strength" value={a.strength} />
                <StatBar label="Jumping" value={a.jumping} />
              </div>
            </div>

            {/* Tips */}
            <div className="md:col-span-2 bg-gray-800/80 rounded-2xl p-6 border border-gray-700">
              <h2 className="font-bold mb-3 text-green-400">Mentor Tips</h2>
              <ul className="space-y-2">
                {tips.map((t, i) => <li key={i} className="text-sm text-gray-200">{t}</li>)}
              </ul>
            </div>

            {/* History */}
            <div className="md:col-span-2 bg-gray-800/80 rounded-2xl p-6 border border-gray-700">
              <h2 className="font-bold mb-3 text-green-400">Recent Activity</h2>
              {player.history.length === 0 && <p className="text-sm text-gray-500">No activity yet. Start training!</p>}
              <ul className="space-y-1">
                {player.history.slice(0, 8).map((h, i) => (
                  <li key={i} className="text-sm text-gray-300 flex justify-between">
                    <span>{h.kind}</span>
                    <span className="text-gray-500">{h.delta} · {new Date(h.date).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === "drills" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-green-400">Drills</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DRILLS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedDrill(d.id); setVideoFile(null); setVideoUrl(null); setLastResult(null); }}
                  className={`p-4 rounded-xl border text-left ${selectedDrill === d.id ? "border-green-500 bg-green-900/40" : "border-gray-700 bg-gray-800/60 hover:bg-gray-700/60"}`}
                >
                  <div className="text-3xl mb-1">{d.emoji}</div>
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{d.desc}</div>
                  <div className="text-xs text-gray-500 mt-2">Energy cost {d.cost}</div>
                </button>
              ))}
            </div>

            {selectedDrill && (
              <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700 space-y-4">
                <h3 className="font-bold">Upload drill video — {DRILLS.find((d) => d.id === selectedDrill)?.name}</h3>
                <p className="text-sm text-gray-400">Upload a short video of you performing the drill. AI pose tracking counts reps and updates stats.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => e.target.files?.[0] && handleVideo(e.target.files[0])}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-green-600 file:text-white hover:file:bg-green-500"
                />
                {videoUrl && (
                  <video src={videoUrl} controls className="w-full max-h-64 rounded-lg bg-black" />
                )}
                <button
                  onClick={runAnalysis}
                  disabled={!videoFile || analyzing || player.energy < 5}
                  className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold"
                >
                  {analyzing ? `Analyzing... ${Math.round(progress)}%` : "Analyze & Apply Gains"}
                </button>
                {analyzing && (
                  <div className="h-2 bg-gray-700 rounded">
                    <div className="h-2 rounded bg-green-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
                {lastResult && <p className="text-sm text-gray-200 bg-gray-700/50 p-3 rounded">{lastResult}</p>}
                <p className="text-xs text-gray-500">Energy: {Math.round(player.energy)}/100. Low energy reduces gains.</p>
              </div>
            )}
          </div>
        )}

        {tab === "match" && (
          <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700 max-w-lg">
            <h2 className="text-xl font-bold text-green-400 mb-4">Log a Match</h2>
            <div className="space-y-3">
              {[
                { label: "Goals", val: mGoals, set: setMGoals, max: 10 },
                { label: "Assists", val: mAssists, set: setMAssists, max: 10 },
                { label: "Distance (km)", val: mDistance, set: setMDistance, max: 15 },
                { label: "Sprints", val: mSprints, set: setMSprints, max: 60 },
                { label: "Match Rating (1-10)", val: mRating, set: setMRating, max: 10 },
              ].map((f) => (
                <label key={f.label} className="block">
                  <span className="text-sm text-gray-300">{f.label}: {f.val}</span>
                  <input type="range" min={0} max={f.max} value={f.val} onChange={(e) => f.set(Number(e.target.value))} className="w-full" />
                </label>
              ))}
            </div>
            <button onClick={logMatch} className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold">Log Match</button>
          </div>
        )}

        {tab === "mentor" && (
          <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700 flex flex-col h-[60vh]">
            <h2 className="text-xl font-bold text-green-400 mb-3">AI Mentor</h2>
            <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2">
              {chatLog.map((c, i) => (
                <div key={i} className={`flex ${c.who === "you" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${c.who === "you" ? "bg-green-600" : "bg-gray-700"}`}>
                    {c.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Ask about sprint, jump, energy, sharpness, match, camera..."
                className="flex-1 px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:border-green-500 outline-none"
              />
              <button onClick={sendChat} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-semibold">Send</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
