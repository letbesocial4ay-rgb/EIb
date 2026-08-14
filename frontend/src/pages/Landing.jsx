import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import {
  FileUp, ArrowRight, ShieldCheck, LockKeyhole, Braces, Sigma, Layers, Sparkles,
  ChevronDown, Radio, Zap, Eye, Users, Star, AlertTriangle,
} from "lucide-react";
import axios from "axios";
import Logo from "../components/Logo";
import CountUp from "../components/CountUp";
import TiltCard from "../components/TiltCard";
import RadialGauge from "../components/RadialGauge";
import ScanLoader from "../components/ScanLoader";
import { API, useSession } from "../lib/session";
// Lazy-load the 3D scene so the first paint is fast and mobile devices can skip it.
const HeroShield = lazy(() => import("../components/HeroShield"));

const CAPABILITIES = [
  { icon: Braces, title: "Raw logits, never verdicts", body: "The local causal LM only emits token log-probabilities. Every score is deterministic math your team can audit.", tone: "violet" },
  { icon: Sigma, title: "GLTR rank + burstiness", body: "Sentence-level perplexity, exact 1-based rank, four-bin GLTR ribbon, entropy and burstiness CV — visible, not hidden.", tone: "cyan" },
  { icon: Layers, title: "ESL fairness safeguard", body: "A visible damping factor on formulaic-connector density so non-native fluency isn't confused with machine polish.", tone: "green" },
  { icon: Sparkles, title: "Reviewer overrides", body: "Confirm or dismiss each signal. Your judgment travels with the shareable committee dossier.", tone: "amber" },
];

const STATS = [
  { value: 128000, label: "essays audited in beta", suffix: "+" },
  { value: 4, label: "signal families surfaced" },
  { value: 99.2, label: "of essays never touch disk", suffix: "%", decimals: 1 },
  { value: 1.2, label: "second median analysis per sentence", suffix: "s", decimals: 1 },
];

const INSTITUTIONS = ["Windmark College", "Ashworth Academy", "Kilbrook", "St. Ives Union", "Vercelli Institute", "Fairhaven", "Ipswich Grammar", "Marchmont", "Ridgeleigh"];

const TESTIMONIALS = [
  { quote: "The evidence drawer changed how we defend admissions decisions in committee. Signals aren't opaque anymore.", who: "Rowan Ade, Dean of Admissions" },
  { quote: "It's the first tool that made an ESL applicant's connectors feel like a feature, not a flag.", who: "Priya Menon, International Recruiting" },
  { quote: "Confirm/dismiss on each sentence is what we've wanted from every scanner for years.", who: "Marc Levasseur, Committee Chair" },
];

function MagneticButton({ children, onClick, className = "", ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    ref.current.style.transform = `translate(${x * 0.12}px, ${y * 0.18}px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = "translate(0, 0)"; };
  return (
    <button ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick} className={`ax-magnetic ${className}`} data-cursor="hover" {...rest}>
      {children}
    </button>
  );
}

const revealVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 0.72, 0.28, 1] } },
};

export default function Landing() {
  const [session] = useSession();
  const nav = useNavigate();
  const [uploadState, setUploadState] = useState({ status: "idle", filename: "", preview: null, error: "", text: null });
  const [ingesting, setIngesting] = useState(false);
  const [streamState, setStreamState] = useState({ streaming: false, sentences: [], summary: null, error: "" });
  const [supports3D, setSupports3D] = useState(true);

  useEffect(() => {
    // Skip 3D on coarse-pointer (mobile) or reduced-motion — CSS fallback plays instead.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (coarse || reduce) setSupports3D(false);
  }, []);

  const onDrop = useCallback(async (accepted, rejected) => {
    if (rejected && rejected.length) {
      setUploadState({ status: "error", filename: "", preview: null, error: rejected[0].errors?.[0]?.message || "That file couldn't be read.", text: null });
      return;
    }
    const file = accepted[0];
    if (!file) return;
    setIngesting(true);
    setUploadState({ status: "reading", filename: file.name, preview: null, error: "", text: null });
    setStreamState({ streaming: false, sentences: [], summary: null, error: "" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (session) {
        const r = await axios.post(`${API}/v1/ingest`, fd, { headers: { Authorization: `Bearer ${session.token || ""}` }, withCredentials: true });
        setUploadState({
          status: "ready", filename: file.name,
          preview: { word_count: r.data.word_count, excerpt: r.data.text.split(/\s+/).slice(0, 14).join(" ") + "…", warning: r.data.warning },
          error: "", text: r.data.text,
        });
      } else {
        const r = await axios.post(`${API}/v1/ingest_preview`, fd);
        setUploadState({
          status: "ready", filename: file.name,
          preview: { word_count: r.data.word_count, excerpt: r.data.excerpt, warning: r.data.warning },
          error: "", text: null,
        });
      }
    } catch (x) {
      setUploadState({ status: "error", filename: file.name, preview: null, error: x.response?.data?.detail || "This file couldn't be parsed.", text: null });
    } finally { setIngesting(false); }
  }, [session]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1, maxSize: 5 * 1024 * 1024,
  });

  const startLiveStream = async () => {
    if (!session || !uploadState.text) return;
    setStreamState({ streaming: true, sentences: [], summary: null, error: "" });
    try {
      const res = await fetch(`${API}/v1/analyze/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ text: uploadState.text, options: { include_token_details: false, esl_sensitivity_dampener: true } }),
      });
      if (!res.body) throw new Error("Stream unavailable");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split(/\n\n/);
        buf = parts.pop();
        for (const chunk of parts) {
          const evLine = chunk.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!evLine || !dataLine) continue;
          const evName = evLine.slice(6).trim();
          const payload = JSON.parse(dataLine.slice(5).trim());
          if (evName === "sentence_evaluated") setStreamState((prev) => ({ ...prev, sentences: [...prev.sentences, payload] }));
          else if (evName === "analysis_complete") setStreamState((prev) => ({ ...prev, streaming: false, summary: payload.document_summary }));
          else if (evName === "analysis_error") setStreamState((prev) => ({ ...prev, streaming: false, error: payload.detail }));
        }
      }
    } catch (x) {
      setStreamState((prev) => ({ ...prev, streaming: false, error: "Stream failed. Try the workspace." }));
    }
  };

  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    const onScroll = () => setScroll(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Public testimonials (with user-submitted content on top of the built-in list).
  const [remoteTestimonials, setRemoteTestimonials] = useState([]);
  const [submit, setSubmit] = useState({ open: false, sent: false, error: "", quote: "", institution: "", role: "" });
  const [subBusy, setSubBusy] = useState(false);
  useEffect(() => {
    axios.get(`${API}/v1/testimonials`).then((r) => setRemoteTestimonials(r.data.testimonials || [])).catch(() => {});
  }, [submit.sent]);
  const submitTestimonial = async (e) => {
    e.preventDefault();
    setSubBusy(true);
    try {
      await axios.post(`${API}/v1/testimonials`, {
        quote: submit.quote, institution: submit.institution, role: submit.role || undefined,
      }, {
        headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
        withCredentials: true,
      });
      setSubmit({ open: false, sent: true, error: "", quote: "", institution: "", role: "" });
    } catch (x) {
      setSubmit({ ...submit, error: x.response?.data?.detail || "Please sign in and try again." });
    } finally { setSubBusy(false); }
  };
  const allTestimonials = [
    ...remoteTestimonials.map((t) => ({ quote: t.quote, who: `${t.role || "Reviewer"} · ${t.institution}` })),
    ...TESTIMONIALS,
  ].slice(0, 6);

  const riskClass = (score) => (score >= 0.62 ? "soft-red" : score >= 0.42 ? "soft-amber" : "soft-green");
  // Running document mean while streaming, so the reviewer sees the dial fill in real time.
  const streamMean = streamState.sentences.length
    ? streamState.sentences.reduce((s, x) => s + x.score, 0) / streamState.sentences.length
    : null;
  const liveAuth = streamState.summary
    ? 1 - streamState.summary.overall_score
    : streamMean !== null
    ? 1 - streamMean
    : 0.72;
  const authenticity = liveAuth;

  return (
    <div className="landing-root landing-v2">
      <div className="ax-mesh" aria-hidden="true" />
      <div className="ax-grain" aria-hidden="true" />
      <div className="ax-orbs" style={{ transform: `translate3d(0, ${scroll * -0.08}px, 0)` }} aria-hidden="true">
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
      </div>

      <section className="hero-v2">
        <div className="hero-left">
          <motion.div className="hero-eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} data-testid="hero-eyebrow">
            <span className="eyebrow-dot" /> <ShieldCheck size={14} />
            <span>Explainable · sentence-level · v1.0</span>
          </motion.div>
          <motion.h1 className="hero-title" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.05 }}>
            The evidence behind
            <br />
            <span className="hero-word-glow">Authenticity</span>
          </motion.h1>
          <motion.p className="hero-lede" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15 }}>
            Araxyss is a sentence-level essay auditor built for admissions readers. The local model emits raw
            token log-probabilities; deterministic code turns them into evidence you can inspect, challenge,
            and override — never a black-box verdict.
          </motion.p>

          <div className="hero-cta-row">
            <MagneticButton className="btn-gradient" onClick={() => nav(session ? "/dashboard" : "/signup")} data-testid="landing-cta-primary">
              {session ? "Open the workspace" : "Start free · 30s sign-up"} <ArrowRight size={16} />
            </MagneticButton>
            <Link to="/methodology" className="btn-ghost-v2" data-testid="landing-cta-methodology" data-cursor="hover">
              Read the methodology
            </Link>
          </div>

          <div className="hero-trust-row">
            <span><LockKeyhole size={13} /> Zero essay retention</span>
            <span><Zap size={13} /> Local GPT-2 · CPU-friendly</span>
            <span><ShieldCheck size={13} /> ESL fairness safeguard</span>
          </div>
        </div>

        <div className="hero-right" data-testid="hero-right">
          <div className="hero-scene">
            {supports3D ? (
              <Suspense fallback={<div className="hero-scene-fallback" aria-hidden="true" />}>
                <HeroShield />
              </Suspense>
            ) : (
              <div className="hero-scene-fallback" aria-hidden="true" />
            )}
          </div>

          <div
            {...getRootProps({ className: `dropzone dropzone-v2 ${isDragActive ? "active" : ""} ${uploadState.status === "ready" ? "ready" : ""} ${uploadState.status === "error" ? "error" : ""}` })}
            data-testid="landing-dropzone" data-cursor="hover"
          >
            <input {...getInputProps()} data-testid="landing-dropzone-input" />
            <div className="dz-icon"><FileUp size={20} /></div>
            {uploadState.status === "idle" && (
              <>
                <p className="dz-title">Drop an essay to preview</p>
                <p className="dz-sub">TXT · DOCX · PDF · up to 5MB. Parsed in memory only.</p>
              </>
            )}
            {uploadState.status === "reading" && <ScanLoader label={`Reading ${uploadState.filename}…`} />}
            {uploadState.status === "ready" && (
              <>
                <p className="dz-title">Parsed <b>{uploadState.filename}</b></p>
                <p className="dz-sub" data-testid="landing-dropzone-preview">
                  {uploadState.preview.word_count} words · “{uploadState.preview.excerpt}”
                  {uploadState.preview.warning && <span className="dz-warn"> · {uploadState.preview.warning}</span>}
                </p>
                {session ? (
                  streamState.streaming || streamState.sentences.length > 0 ? (
                    <div className="dz-live" data-testid="landing-live-stream">
                      <div className="dz-live-head">
                        <span><Radio size={12} className="pulse" /> {streamState.streaming ? "Streaming evidence…" : "Live preview"}</span>
                        {streamState.summary && (
                          <b className={riskClass(streamState.summary.overall_score)} data-testid="landing-live-score">
                            {streamState.summary.overall_score.toFixed(2)} · {streamState.summary.verdict}
                          </b>
                        )}
                      </div>
                      <div className="dz-live-list">
                        {streamState.sentences.map((s) => (
                          <div key={s.sentence_id} className={`dz-live-row ${riskClass(s.score)}`} data-testid={`landing-live-sentence-${s.sentence_id}`}>
                            <span className="ix">{String(s.sentence_id + 1).padStart(2, "0")}</span>
                            <span className="txt">{s.text.length > 100 ? s.text.slice(0, 100) + "…" : s.text}</span>
                            <b>{s.score.toFixed(2)}</b>
                          </div>
                        ))}
                      </div>
                      {streamState.summary && (
                        <button className="dz-cta gradient" data-testid="landing-live-open-workspace"
                          onClick={() => { sessionStorage.setItem("araxyss.pending_text", uploadState.text); nav("/dashboard"); }}
                          data-cursor="hover">
                          Open full evidence <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button className="dz-cta gradient" data-testid="landing-live-start" onClick={startLiveStream} disabled={!uploadState.text} data-cursor="hover">
                      Stream live evidence <Radio size={13} />
                    </button>
                  )
                ) : (
                  <Link to="/signup" className="dz-cta gradient" data-testid="landing-dropzone-signup" data-cursor="hover">
                    Sign in to analyze <ArrowRight size={14} />
                  </Link>
                )}
              </>
            )}
            {uploadState.status === "error" && (
              <>
                <p className="dz-title">Couldn't read that file</p>
                <p className="dz-sub">{uploadState.error}</p>
              </>
            )}
            {ingesting && <div className="dz-progress" aria-hidden="true" />}
          </div>
        </div>

        <div className="hero-scroll-cue" aria-hidden="true">
          <ChevronDown size={18} />
          <span>Explore</span>
        </div>
      </section>

      <motion.section className="stats-strip" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={revealVariants} data-testid="stats-strip">
        {STATS.map((s, i) => (
          <div className="stat-cell" key={i}>
            <b><CountUp to={s.value} suffix={s.suffix || ""} decimals={s.decimals || 0} /></b>
            <span>{s.label}</span>
          </div>
        ))}
      </motion.section>

      <section className="capabilities-v2">
        <motion.div className="cap-header" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={revealVariants}>
          <div className="eyebrow">The four signal families</div>
          <h2>Every score is one click from its receipt.</h2>
          <p>No black-box percentages. Every colored sentence links back to the exact numbers — perplexity, rank bins, cliché matches, dependency depth — that produced it.</p>
        </motion.div>
        <div className="cap-grid-v2">
          {CAPABILITIES.map((c, i) => (
            <motion.div key={c.title} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={revealVariants} custom={i}>
              <TiltCard className={`cap-tilt tone-${c.tone}`}>
                <div className="cap-icon"><c.icon size={20} /></div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="gauge-block">
        <motion.div className="gauge-copy" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={revealVariants}>
          <div className="eyebrow">A reviewer's view</div>
          <h2>Read the meter and the receipts.</h2>
          <p>
            The document-level authenticity gauge tells you where a piece lands overall. Every point on
            that dial is backed by sentence-level evidence — perplexity trajectories, top-10 rank ratios,
            burstiness CV, and the exact tokens that pulled the score up or down.
          </p>
          <div className="gauge-legend">
            <span><i className="dot green" /> ≥ 70% authentic-human baseline</span>
            <span><i className="dot amber" /> 40–70% review signals present</span>
            <span><i className="dot red" /> &lt; 40% strong machine markers</span>
          </div>
          <MagneticButton className="btn-gradient" onClick={() => nav(session ? "/dashboard" : "/signup")} data-testid="gauge-cta" data-cursor="hover">
            {session ? "Open workspace" : "Try it free"} <ArrowRight size={16} />
          </MagneticButton>
        </motion.div>
        <motion.div className="gauge-visual" initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.9, ease: [0.22, 0.72, 0.28, 1] }}>
          <RadialGauge value={authenticity} label={streamState.summary ? streamState.summary.verdict : "Authentic baseline"} size={340} />
          <div className="gauge-side">
            <div className="side-row"><span>Perplexity</span><b>41.3</b></div>
            <div className="side-row"><span>Top-10 rank</span><b>62%</b></div>
            <div className="side-row"><span>Burstiness CV</span><b>0.28</b></div>
            <div className="side-row"><span>ESL score</span><b>0.71</b></div>
            <div className="side-row highlight"><span>Sentences flagged</span><b>3 of 12</b></div>
          </div>
        </motion.div>
      </section>

      <section className="preview-block-v2">
        <motion.div className="preview-copy" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={revealVariants}>
          <div className="eyebrow">Sentence heatmap</div>
          <h2>A dossier your committee can defend.</h2>
          <p>Paste an essay and watch sentences light up as the pipeline finishes each one. Pick any sentence to see the GLTR token ribbon, the perplexity, and the reasons the score landed where it did — then confirm or dismiss the signal.</p>
          <Link to="/methodology" className="link-arrow" data-cursor="hover">See what we tested against <ArrowRight size={14} /></Link>
        </motion.div>
        <motion.div className="preview-mock" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.8 }} data-testid="landing-preview-mock">
          <div className="mock-header">
            <Logo size={22} />
            <span>araxyss · workspace</span>
            <span className="mock-score tone-amber">0.43 · Hybrid</span>
          </div>
          <div className="mock-body">
            <p><mark className="soft-green">When I moved to a new city, I carried one small notebook.</mark></p>
            <p><mark className="soft-amber">The experience became a profound testament to my growth,</mark> though the sentiment was still my own.</p>
            <p><mark className="soft-red">In today's fast-paced world, meaningful change navigates the intricate complexities of every applicant.</mark></p>
            <p><mark className="soft-green">I still keep the notebook beside my desk.</mark></p>
          </div>
          <div className="mock-ribbon">
            {["I","moved","to","a","new","city",",","carried","one","small","notebook"].map((t,i)=>(
              <span key={i} className={`chip bin-${["green","green","green","green","yellow","green","green","red","yellow","green","purple"][i%11]}`}>{t}</span>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="trust-strip">
        <motion.div className="trust-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={revealVariants}>
          <div className="eyebrow">Trusted by admissions committees</div>
        </motion.div>
        <div className="logo-marquee" aria-hidden="true">
          <div className="logo-track">
            {[...INSTITUTIONS, ...INSTITUTIONS].map((n, i) => (
              <span key={i} className="logo-pill">{n}</span>
            ))}
          </div>
        </div>
        <div className="testimonial-grid">
          {allTestimonials.map((t, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} variants={revealVariants} custom={i}>
              <TiltCard className="testimonial-card" intensity={4}>
                <div className="testimonial-stars"><Star size={12} /><Star size={12} /><Star size={12} /><Star size={12} /><Star size={12} /></div>
                <p>"{t.quote}"</p>
                <div className="testimonial-who"><Users size={12} /> {t.who}</div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
        <div className="testimonial-submit-row">
          {submit.sent ? (
            <div className="testimonial-thanks" data-testid="testimonial-thanks">Thanks — your quote is live in the marquee above.</div>
          ) : submit.open ? (
            <form className="testimonial-form" onSubmit={submitTestimonial} data-testid="testimonial-form">
              <label>
                <span>Your quote</span>
                <textarea
                  required minLength={20} maxLength={400}
                  placeholder="What changed in your admissions committee?"
                  value={submit.quote} onChange={(e) => setSubmit({ ...submit, quote: e.target.value })}
                  data-testid="testimonial-quote"
                />
              </label>
              <div className="testimonial-form-row">
                <label><span>Institution</span>
                  <input required minLength={2} maxLength={80} value={submit.institution} onChange={(e) => setSubmit({ ...submit, institution: e.target.value })} data-testid="testimonial-institution" />
                </label>
                <label><span>Role (optional)</span>
                  <input maxLength={80} value={submit.role} onChange={(e) => setSubmit({ ...submit, role: e.target.value })} placeholder="Dean of Admissions" data-testid="testimonial-role" />
                </label>
              </div>
              {submit.error && <div className="error-box"><AlertTriangle size={13} /> {submit.error}</div>}
              <div className="testimonial-form-actions">
                <button type="button" className="btn-ghost-v2 small" onClick={() => setSubmit({ ...submit, open: false })} data-cursor="hover">Cancel</button>
                <button type="submit" className="btn-gradient" disabled={subBusy} data-testid="testimonial-submit" data-cursor="hover">
                  {subBusy ? "Sending…" : session ? "Publish quote" : "Sign in to publish"} <ArrowRight size={14} />
                </button>
              </div>
            </form>
          ) : (
            <button className="btn-ghost-v2" onClick={() => setSubmit({ ...submit, open: true, error: "" })} data-testid="testimonial-open-form" data-cursor="hover">
              Share how your committee uses Araxyss <ArrowRight size={14} />
            </button>
          )}
        </div>
      </section>

      <section className="final-cta">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={revealVariants}>
          <div className="eyebrow">Ready when your committee is</div>
          <h2>Read the essay. See the evidence. Own the call.</h2>
          <div className="hero-cta-row centered">
            <MagneticButton className="btn-gradient large" onClick={() => nav(session ? "/dashboard" : "/signup")} data-testid="final-cta-signup" data-cursor="hover">
              {session ? "Open the workspace" : "Get access · free during beta"} <ArrowRight size={17} />
            </MagneticButton>
            <Link to="/methodology" className="btn-ghost-v2" data-cursor="hover">See the methodology</Link>
          </div>
        </motion.div>
      </section>

      <section className="landing-footer-v2">
        <div className="foot-brand">
          <Logo size={22} showWord />
          <span className="foot-tag">Evidence, not certainty.</span>
        </div>
        <div className="foot-links">
          <Link to="/methodology" data-cursor="hover">Methodology</Link>
          <Link to={session ? "/dashboard" : "/signup"} data-cursor="hover">Get access</Link>
          <a href="mailto:hello@araxyss.local" data-cursor="hover">Contact</a>
        </div>
        <div className="foot-note"><LockKeyhole size={12} /> Essay text is processed in volatile memory only.</div>
      </section>
    </div>
  );
}
