"""Local causal LM loader. Emits raw logits only — never used for conversational verdicts."""
import os, time, logging

logger = logging.getLogger("eaia.inference")


class LocalModel:
    def __init__(self, model, tokenizer, device, checkpoint, load_ms, dtype="float32"):
        self.model, self.tokenizer, self.device = model, tokenizer, device
        self.checkpoint, self.load_ms, self.dtype = checkpoint, load_ms, dtype

    @property
    def available(self):
        return self.model is not None and self.tokenizer is not None

    def token_evidence(self, text: str, max_tokens: int = 512):
        """Return per-token {token, rank, log_prob, top3} using the model's own next-token
        distribution. Deterministic math on raw logits — no chat prompting."""
        if not self.available:
            return None
        import torch
        try:
            encoded = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=max_tokens)
        except Exception:
            return None
        input_ids = encoded["input_ids"].to(self.device)
        if input_ids.shape[1] < 2:
            return []
        with torch.inference_mode():
            logits = self.model(input_ids).logits[0]
        # Predict token t from position t-1; align accordingly.
        shift_logits = logits[:-1].float()
        targets = input_ids[0, 1:]
        log_probs = torch.log_softmax(shift_logits, dim=-1)
        # Exact 1-based rank of the actual token under the model's distribution.
        target_lp = log_probs.gather(1, targets.unsqueeze(1)).squeeze(1)
        ranks = (shift_logits > shift_logits.gather(1, targets.unsqueeze(1))).sum(dim=-1) + 1
        # Top-3 alternatives per position.
        top_vals, top_idx = torch.topk(log_probs, k=3, dim=-1)
        rows = []
        input_tokens = self.tokenizer.convert_ids_to_tokens(input_ids[0].tolist())
        for i in range(targets.shape[0]):
            rank = int(ranks[i].item())
            bin_name = "green" if rank <= 10 else "yellow" if rank <= 100 else "red" if rank <= 1000 else "purple"
            alts = []
            for j in range(3):
                tok_id = int(top_idx[i, j].item())
                alts.append({
                    "token": self.tokenizer.decode([tok_id]).strip() or self.tokenizer.convert_ids_to_tokens(tok_id),
                    "prob": round(float(top_vals[i, j].exp().item()), 4),
                })
            surface = input_tokens[i + 1]
            # Clean up sentencepiece / BPE prefixes for display.
            surface = surface.replace("Ġ", " ").replace("▁", " ").replace("Ċ", "\n").strip() or surface
            rows.append({
                "token": surface,
                "token_id": int(targets[i].item()),
                "log_prob": round(float(target_lp[i].item()), 4),
                "rank": rank,
                "bin": bin_name,
                "alternatives": alts,
            })
        # Free intermediate tensors promptly to respect VRAM ceiling.
        del logits, shift_logits, log_probs, top_vals, top_idx
        if self.device == "cuda":
            torch.cuda.empty_cache()
        return rows


def _pick_device():
    import torch
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_local_model():
    """Try the configured checkpoint; fall back to gpt2 (smallest, CPU-friendly). If nothing
    can be loaded we return an unavailable instance so the deterministic pipeline still runs."""
    started = time.perf_counter()
    preferred = os.environ.get("EAIA_MODEL_CHECKPOINT", "gpt2")
    candidates = [preferred]
    for fallback in ("gpt2", "distilgpt2"):
        if fallback not in candidates:
            candidates.append(fallback)
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except Exception as exc:
        logger.warning("torch/transformers unavailable: %s", exc)
        return LocalModel(None, None, "cpu", "deterministic-fallback", round((time.perf_counter() - started) * 1000))

    device = _pick_device()
    dtype = torch.float16 if device in ("cuda", "mps") else torch.float32
    last_err = None
    for checkpoint in candidates:
        try:
            tokenizer = AutoTokenizer.from_pretrained(checkpoint)
            model = AutoModelForCausalLM.from_pretrained(checkpoint, torch_dtype=dtype)
            model = model.to(device).eval()
            # VRAM sanity check on CUDA — respect 4GB ceiling.
            if device == "cuda":
                mem_gb = torch.cuda.memory_allocated() / (1024 ** 3)
                if mem_gb > 4.0:
                    logger.warning("Model %s exceeds 4GB VRAM (%.2f GB); rerouting to CPU", checkpoint, mem_gb)
                    del model
                    torch.cuda.empty_cache()
                    device = "cpu"
                    dtype = torch.float32
                    model = AutoModelForCausalLM.from_pretrained(checkpoint, torch_dtype=dtype).to("cpu").eval()
            logger.info("Loaded %s on %s", checkpoint, device)
            return LocalModel(model, tokenizer, device, checkpoint,
                              round((time.perf_counter() - started) * 1000),
                              dtype=str(dtype).replace("torch.", ""))
        except Exception as exc:
            last_err = exc
            logger.warning("Failed to load %s: %s", checkpoint, exc)
            continue
    logger.error("All model checkpoints failed to load; last error: %s", last_err)
    return LocalModel(None, None, "cpu", "deterministic-fallback", round((time.perf_counter() - started) * 1000))
