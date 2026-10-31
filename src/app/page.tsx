"use client";

import { useEffect, useState, useRef } from "react";
import { createPlayer, applyDecay, applyDrill, applyMatch, mentorTips, mentorChat, recalcOvr, type Player, type DrillResult } from "@/lib/stats";
import { analyzeVideo } from "@/lib/pose";

const DRILLS = [
  { id: "sprint", name: "Max Sprint", emoji: "🏃", desc: "5 max-effort sprints. Boosts acceleration most.", cost: 20 },
  { id: "jump", name: "Vertical Jump", emoji: "🦘", desc: "Jump as high as you can. Boosts jumping.", cost: 20 },
  { id: "shuttle", name: "Shuttle Run", emoji: "↔️", desc: "Back-and-forth sprints. Boosts pace + stamina.", cost: 20 },
  { id: "plank", name: "Plank Hold", emoji: "🧘", desc: "Hold plank. Boosts strength + stamina.", cost: 15 },
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
  const color = value >= 85 ? "from-emerald-400 to-emerald-600" : value >= 70 ? "from-lime-400 to-lime-600" : value >= 55 ? "from-yellow-400 to-yellow-600" : value >= 40 ? "from-orange-400 to-orange-600" : "from-red-400 to-red-600";
  return (
    <div className="flex items-center gap-3 group">
      <span className="w-32 text-sm text-gray-300 group-hover:text-white transition">{label}</span>
      <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right font-mono font-bold text-white text-sm">{Math.round(value)}</span>
    </div>
  );
}

export default function Home() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [tab, setTab] = useState<"dash" | "drills" | "match" | "mentor">("dash");
  const [onboarding, setOnboarding] = useState(true);
  const [name, setName] = useState("");
  const [pos, setPos] = useState("ST");

  const [selectedDrill, setSelectedDrill] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const [mGoals, setMGoals] = useState(0);
  const [mAssists, setMAssists] = useState(0);
  const [mDistance, setMDistance] = useState(5);
  const [mSprints, setMSprints] = useState(10);
  const [mRating, setMRating] = useState(7);

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
      <main className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/40 via-transparent to-transparent" />
        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-6xl mb-2">⚽</div>
            <h1 className="text-4xl font-black tracking-tight">Career Mode</h1>
            <p className="text-gray-400 mt-2">Real-life football. Real progression.</p>
          </div>
          <div className="bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-gray-800">
            <label className="block mb-5">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Player Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-2 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 outline-none transition text-lg" placeholder="Your name" />
            </label>
            <label className="block mb-6">
              <span className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Position</span>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {POSITIONS.map((p) => (
                  <button key={p} onClick={() => setPos(p)} className={`py-2 rounded-lg text-sm font-bold transition ${pos === p ? "bg-green-600 text-white shadow-lg shadow-green-600/30" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>{p}</button>
                ))}
              </div>
            </label>
            <button onClick={startCareer} disabled={!name.trim()} className="w-full py-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-lg shadow-lg shadow-green-600/30 transition transform hover:scale-[1.02] active:scale-[0.98]">
              Start Career
            </button>
            <p className="text-xs text-gray-500 mt-4 text-center">Starting OVR ~50. Train hard, stay sharp.</p>
          </div>
        </div>
      </main>
    );
  }

  const a = player.attrs;
  const tips = mentorTips(player);

  const energyColor = player.energy >= 60 ? "from-blue-500 to-cyan-400" : player.energy >= 30 ? "from-yellow-500 to-orange-400" : "from-red-500 to-red-700";
  const sharpColor = player.sharpness >= 60 ? "from-purple-500 to-pink-400" : player.sharpness >= 30 ? "from-yellow-500 to-orange-400" : "from-red-500 to-red-700";

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-gray-900/70 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⚽</div>
            <div>
              <div className="font-bold leading-tight">{player.name}</div>
              <div className="text-xs text-gray-400">{player.position} · {player.drillsDone} drills · {player.matchesPlayed} matches</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={restDay} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition">Rest Day</button>
            <button onClick={reset} className="px-3 py-1.5 text-sm bg-red-900/50 hover:bg-red-800/60 text-red-300 rounded-lg border border-red-900/50 transition">Reset</button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
        {(["dash", "drills", "match", "mentor"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${tab === t ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg shadow-green-600/20 scale-105" : "bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-white"}`}>
            {t === "dash" ? "Dashboard" : t === "drills" ? "Drills" : t === "match" ? "Match Log" : "Mentor"}
          </button>
        ))}
      </nav>

      <div className="max-w-6xl mx-auto p-4 pb-12">
        {tab === "dash" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* FIFA Card */}
            <div className="lg:col-span-1">
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-yellow-500/20 via-gray-900 to-gray-900 border border-yellow-500/30 shadow-2xl p-6">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl" />
                <div className="relative flex items-center gap-4 mb-5">
                  <div className="text-7xl font-black bg-gradient-to-b from-yellow-300 to-yellow-600 bg-clip-text text-transparent drop-shadow-lg">{player.ovr}</div>
                  <div>
                    <div className="text-xl font-bold">{player.name}</div>
                    <div className="text-sm text-gray-400">{player.position}</div>
                    <div className="text-xs text-yellow-500/80 uppercase tracking-widest mt-1">Overall</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Energy</span><span>{Math.round(player.energy)}/100</span>
                    </div>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                      <div className={`h-full rounded-full bg-gradient-to-r ${energyColor} transition-all duration-700`} style={{ width: `${player.energy}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Sharpness</span><span>{Math.round(player.sharpness)}/100</span>
                    </div>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                      <div className={`h-full rounded-full bg-gradient-to-r ${sharpColor} transition-all duration-700`} style={{ width: `${player.sharpness}%` }} />
                    </div>
                  </div>
                </div>
                <div className="mt-5 pt-5 border-t border-gray-800 grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-400">{player.drillsDone}</div>
                    <div className="text-xs text-gray-500">Drills</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{player.matchesPlayed}</div>
                    <div className="text-xs text-gray-500">Matches</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="lg:col-span-1 bg-gray-900/60 backdrop-blur rounded-3xl p-6 border border-gray-800">
              <h2 className="font-bold mb-4 text-green-400 flex items-center gap-2"><span>⚡</span> Attributes</h2>
              <div className="space-y-3">
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

            {/* Tips + History */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gray-900/60 backdrop-blur rounded-3xl p-6 border border-gray-800">
                <h2 className="font-bold mb-3 text-green-400 flex items-center gap-2"><span>🧠</span> Mentor Tips</h2>
                <ul className="space-y-2">
                  {tips.map((t, i) => <li key={i} className="text-sm text-gray-200 bg-gray-800/50 rounded-xl px-3 py-2 border border-gray-700/50">{t}</li>)}
                </ul>
              </div>
              <div className="bg-gray-900/60 backdrop-blur rounded-3xl p-6 border border-gray-800">
                <h2 className="font-bold mb-3 text-green-400 flex items-center gap-2"><span>📋</span> Recent Activity</h2>
                {player.history.length === 0 && <p className="text-sm text-gray-500">No activity yet. Start training!</p>}
                <ul className="space-y-1.5">
                  {player.history.slice(0, 6).map((h, i) => (
                    <li key={i} className="text-sm text-gray-300 flex justify-between bg-gray-800/40 rounded-lg px-3 py-1.5">
                      <span className="truncate">{h.kind}</span>
                      <span className="text-gray-500 text-xs ml-2 shrink-0">{h.delta}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === "drills" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-green-400">Drills</h2>
              <p className="text-gray-400 text-sm mt-1">Pick a drill, upload a video, get AI pose-tracked stat gains.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DRILLS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedDrill(d.id); setVideoFile(null); setVideoUrl(null); setLastResult(null); }}
                  className={`p-5 rounded-2xl border text-left transition-all ${selectedDrill === d.id ? "border-green-500 bg-green-900/30 shadow-lg shadow-green-500/10 scale-[1.02]" : "border-gray-800 bg-gray-900/60 hover:bg-gray-800/60 hover:border-gray-700"}`}
                >
                  <div className="text-4xl mb-2">{d.emoji}</div>
                  <div className="font-bold">{d.name}</div>
                  <div className="text-xs text-gray-400 mt-1 leading-relaxed">{d.desc}</div>
                  <div className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> {d.cost} energy
                  </div>
                </button>
              ))}
            </div>

            {selectedDrill && (
              <div className="bg-gray-900/60 backdrop-blur rounded-3xl p-6 border border-gray-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{DRILLS.find((d) => d.id === selectedDrill)?.emoji}</div>
                  <div>
                    <h3 className="font-bold text-lg">{DRILLS.find((d) => d.id === selectedDrill)?.name}</h3>
                    <p className="text-sm text-gray-400">Upload a short video of you performing this drill.</p>
                  </div>
                </div>
                <label className="block">
                  <div className="border-2 border-dashed border-gray-700 hover:border-green-500 rounded-2xl p-6 text-center cursor-pointer transition">
                    <div className="text-3xl mb-2">📹</div>
                    <div className="text-sm text-gray-300">Click to select a video file</div>
                    <div className="text-xs text-gray-500 mt-1">MP4, MOV, WebM supported</div>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => e.target.files?.[0] && handleVideo(e.target.files[0])}
                    className="hidden"
                  />
                </label>
                {videoUrl && (
                  <video src={videoUrl} controls className="w-full max-h-72 rounded-2xl bg-black border border-gray-800" />
                )}
                <button
                  onClick={runAnalysis}
                  disabled={!videoFile || analyzing || player.energy < 5}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold shadow-lg shadow-green-600/20 transition transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  {analyzing ? `Analyzing... ${Math.round(progress)}%` : "Analyze & Apply Gains"}
                </button>
                {analyzing && (
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                )}
                {lastResult && <p className="text-sm text-gray-200 bg-gray-800/60 p-4 rounded-2xl border border-gray-700">{lastResult}</p>}
                <p className="text-xs text-gray-500">Energy: {Math.round(player.energy)}/100. Low energy reduces gains.</p>
              </div>
            )}
          </div>
        )}

        {tab === "match" && (
          <div className="max-w-lg">
            <div className="bg-gray-900/60 backdrop-blur rounded-3xl p-6 border border-gray-800">
              <h2 className="text-2xl font-bold text-green-400 mb-1">Log a Match</h2>
              <p className="text-gray-400 text-sm mb-6">Enter your match stats to boost sharpness & OVR.</p>
              <div className="space-y-5">
                {[
                  { label: "Goals", val: mGoals, set: setMGoals, max: 10, icon: "⚽" },
                  { label: "Assists", val: mAssists, set: setMAssists, max: 10, icon: "🎯" },
                  { label: "Distance (km)", val: mDistance, set: setMDistance, max: 15, icon: "🏃" },
                  { label: "Sprints", val: mSprints, set: setMSprints, max: 60, icon: "⚡" },
                  { label: "Match Rating", val: mRating, set: setMRating, max: 10, icon: "⭐" },
                ].map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-300 flex items-center gap-2"><span>{f.icon}</span>{f.label}</span>
                      <span className="font-mono font-bold text-white">{f.val}</span>
                    </div>
                    <input type="range" min={0} max={f.max} value={f.val} onChange={(e) => f.set(Number(e.target.value))} className="w-full accent-green-500" />
                  </div>
                ))}
              </div>
              <button onClick={logMatch} className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 font-bold shadow-lg shadow-green-600/20 transition transform hover:scale-[1.01] active:scale-[0.99]">
                Log Match
              </button>
            </div>
          </div>
        )}

        {tab === "mentor" && (
          <div className="bg-gray-900/60 backdrop-blur rounded-3xl border border-gray-800 flex flex-col h-[70vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xl">🧠</div>
              <div>
                <div className="font-bold">AI Mentor</div>
                <div className="text-xs text-gray-400">Your pro football coach</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {chatLog.map((c, i) => (
                <div key={i} className={`flex ${c.who === "you" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${c.who === "you" ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-br-md" : "bg-gray-800 text-gray-100 rounded-bl-md border border-gray-700"}`}>
                    {c.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-800 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Ask about sprint, jump, energy, sharpness, match, camera..."
                className="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/30 outline-none transition"
              />
              <button onClick={sendChat} className="px-5 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 font-semibold transition transform hover:scale-105 active:scale-95">➤</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
