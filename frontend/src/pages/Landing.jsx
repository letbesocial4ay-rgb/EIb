import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { FileUp, ArrowRight, ShieldCheck, LockKeyhole, Braces, Sigma, Layers, Sparkles, ChevronDown, Radio } from "lucide-react";
import axios from "axios";
import Constellation from "../components/Constellation";
import Logo from "../components/Logo";
import { API, useSession } from "../lib/session";

const CAPABILITIES = [
  { icon: Braces, title: "Raw logits, never verdicts", body: "The local causal LM only emits token log-probabilities. Every score is deterministic math your team can audit." },
  { icon: Sigma, title: "GLTR rank, PPL, burstiness", body: "Sentence-level perplexity, exact 1-based vocab rank, four-bin GLTR ribbon, and burstiness CV — visible, not hidden." },
  { icon: Layers, title: "ESL fairness safeguard", body: "A visible damping factor on formulaic-connector density so non-native fluency isn't confused with machine polish." },
  { icon: Sparkles, title: "Reviewer overrides", body: "Confirm or dismiss each signal. Your judgement travels with the dossier — not just the algorithm's." },
];

const SIGNAL_ROW = [
  { label: "Perplexity", value: "41.3", tone: "amber" },
  { label: "Top-10 rank", value: "62%", tone: "amber" },
  { label: "Burstiness", value: "0.28", tone: "green" },
  { label: "ESL score", value: "0.71", tone: "green" },
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
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "translate(0, 0)";
  };
  return (
    <button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={`ax-magnetic ${className}`}
      data-cursor="hover"
      {...rest}
    >
      {children}
    </button>
  );
}

export default function Landing() {
  const [session] = useSession();
  const nav = useNavigate();
  const [uploadState, setUploadState] = useState({ status: "idle", filename: "", preview: null, error: "", text: null });
  const [ingesting, setIngesting] = useState(false);
  const [streamState, setStreamState] = useState({ streaming: false, sentences: [], summary: null, error: "" });

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
        // Full ingest so we can stream a real analysis after.
        const r = await axios.post(`${API}/v1/ingest`, fd, { headers: { Authorization: `Bearer ${session.token}` } });
        setUploadState({
          status: "ready",
          filename: file.name,
          preview: { word_count: r.data.word_count, excerpt: r.data.text.split(/\s+/).slice(0, 14).join(" ") + "…", warning: r.data.warning },
          error: "",
          text: r.data.text,
        });
      } else {
        const r = await axios.post(`${API}/v1/ingest_preview`, fd);
        setUploadState({
          status: "ready",
          filename: file.name,
          preview: { word_count: r.data.word_count, excerpt: r.data.excerpt, warning: r.data.warning },
          error: "",
          text: null,
        });
      }
    } catch (x) {
      setUploadState({ status: "error", filename: file.name, preview: null, error: x.response?.data?.detail || "This file couldn't be parsed.", text: null });
    } finally {
      setIngesting(false);
    }
  }, [session]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  const startLiveStream = async () => {
    if (!session || !uploadState.text) return;
    setStreamState({ streaming: true, sentences: [], summary: null, error: "" });
    try {
      const res = await fetch(`${API}/v1/analyze/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
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
          if (evName === "sentence_evaluated") {
            setStreamState((prev) => ({ ...prev, sentences: [...prev.sentences, payload] }));
          } else if (evName === "analysis_complete") {
            setStreamState((prev) => ({ ...prev, streaming: false, summary: payload.document_summary }));
          } else if (evName === "analysis_error") {
            setStreamState((prev) => ({ ...prev, streaming: false, error: payload.detail }));
          }
        }
      }
    } catch (x) {
      setStreamState((prev) => ({ ...prev, streaming: false, error: "Stream failed. Try the workspace." }));
    }
  };

  // Ripple parallax based on scroll — subtle motion on the marketing background.
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    const onScroll = () => setScroll(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const riskClass = (score) => (score >= 0.62 ? "soft-red" : score >= 0.42 ? "soft-amber" : "soft-green");

  return (
    <div className="landing-root">
      <div className="landing-noise" aria-hidden="true" />
      <div
        className="landing-orbs"
        style={{ transform: `translate3d(0, ${scroll * -0.15}px, 0)` }}
        aria-hidden="true"
      >
        <span className="orb orb-a" />
        <span className="orb orb-b" />
      </div>

      <section className="landing-hero">
        <div className="hero-left">
          <motion.div
            className="hero-eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <ShieldCheck size={14} />
            <span>Explainable, not extractive · v1.0</span>
          </motion.div>
          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.05 }}
          >
            Read the evidence
            <br />
            <em>behind the signal.</em>
          </motion.h1>
          <motion.p
            className="hero-lede"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15 }}
          >
            Araxyss is a sentence-level essay auditor for admissions readers. The local model
            emits numbers — perplexity, rank bins, cliché matches — and deterministic code turns
            them into evidence you can inspect, challenge, and override.
          </motion.p>

          <div className="hero-signal-row" data-testid="hero-signal-row">
            {SIGNAL_ROW.map((s) => (
              <div key={s.label} className={`signal-chip tone-${s.tone}`}>
                <span className="signal-label">{s.label}</span>
                <span className="signal-value">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="hero-actions">
            <MagneticButton
              className="btn-primary"
              onClick={() => (window.location.href = "/signup")}
              data-testid="landing-cta-signup"
            >
              Open the workspace <ArrowRight size={16} />
            </MagneticButton>
            <Link to="/methodology" className="btn-ghost" data-testid="landing-cta-methodology" data-cursor="hover">
              Read the methodology
            </Link>
          </div>

          <div className="hero-trust">
            <span><LockKeyhole size={13} /> Zero essay retention</span>
            <span><Braces size={13} /> Local GPT-2 logits</span>
            <span><ShieldCheck size={13} /> ESL fairness safeguard</span>
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-scene">
            <Constellation />
          </div>

          <div
            {...getRootProps({
              className: `dropzone ${isDragActive ? "active" : ""} ${uploadState.status === "ready" ? "ready" : ""} ${uploadState.status === "error" ? "error" : ""}`,
            })}
            data-testid="landing-dropzone"
            data-cursor="hover"
          >
            <input {...getInputProps()} data-testid="landing-dropzone-input" />
            <div className="dz-icon"><FileUp size={22} /></div>
            {uploadState.status === "idle" && (
              <>
                <p className="dz-title">Drop an essay to preview</p>
                <p className="dz-sub">TXT · DOCX · PDF · up to 5MB. We parse it in memory and show a word count. Full analysis after sign-in.</p>
              </>
            )}
            {uploadState.status === "reading" && (
              <>
                <p className="dz-title">Reading <b>{uploadState.filename}</b>…</p>
                <p className="dz-sub">Extracting text in volatile memory.</p>
              </>
            )}
            {uploadState.status === "ready" && (
              <>
                <p className="dz-title">Parsed <b>{uploadState.filename}</b></p>
                <p className="dz-sub" data-testid="landing-dropzone-preview">
                  {uploadState.preview.word_count} words · excerpt: “{uploadState.preview.excerpt}”
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
                        <button
                          className="dz-cta"
                          data-testid="landing-live-open-workspace"
                          onClick={() => { sessionStorage.setItem("araxyss.pending_text", uploadState.text); nav("/dashboard"); }}
                          data-cursor="hover"
                        >
                          Open full evidence <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      className="dz-cta"
                      data-testid="landing-live-start"
                      onClick={startLiveStream}
                      disabled={!uploadState.text}
                      data-cursor="hover"
                    >
                      Stream live evidence <Radio size={13} />
                    </button>
                  )
                ) : (
                  <Link to="/signup" className="dz-cta" data-testid="landing-dropzone-signup" data-cursor="hover">
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
          <span>Scroll to see how it works</span>
        </div>
      </section>

      <section className="capabilities">
        <div className="cap-header">
          <div className="eyebrow">The four signal families</div>
          <h2>Every score is one click from its receipt.</h2>
        </div>
        <div className="cap-grid">
          {CAPABILITIES.map((c, i) => (
            <motion.div
              key={c.title}
              className="cap-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              data-cursor="hover"
            >
              <c.icon size={22} />
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="preview-block">
        <div className="preview-copy">
          <div className="eyebrow">A reviewer's view</div>
          <h2>Sentence heatmap. Evidence drawer. Your call.</h2>
          <p>
            Paste an essay and watch the sentences light up as the pipeline finishes each one.
            Pick any sentence to see the GLTR token ribbon, the perplexity, and the reasons the
            score landed where it did — then confirm or dismiss the signal for the committee.
          </p>
          <Link to="/methodology" className="link-arrow" data-cursor="hover">
            See what we tested against <ArrowRight size={14} />
          </Link>
        </div>
        <div className="preview-mock" data-testid="landing-preview-mock">
          <div className="mock-header">
            <Logo size={22} />
            <span>araxyss · workspace</span>
            <span className="mock-score">0.43 · Hybrid</span>
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
        </div>
      </section>

      <section className="landing-footer">
        <div className="foot-brand">
          <Logo size={22} showWord />
          <span className="foot-tag">Evidence, not certainty.</span>
        </div>
        <div className="foot-links">
          <Link to="/methodology" data-cursor="hover">Methodology</Link>
          <Link to="/signup" data-cursor="hover">Get access</Link>
          <a href="mailto:hello@araxyss.local" data-cursor="hover">Contact</a>
        </div>
        <div className="foot-note">
          <LockKeyhole size={12} /> Essay text is processed in volatile memory only.
        </div>
      </section>
    </div>
  );
}
