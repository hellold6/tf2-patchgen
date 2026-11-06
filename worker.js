// Tokenization + inference off the UI thread (transformers.js WASM, Xenova GPT-2 family).
// Pinned to match Text Drift.
const TRANSFORMERS_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";

// Rough download size guesses so progress does not jump to 100% on a tiny config.json.
const SIZE_HINTS = {
  "Xenova/distilgpt2": 85_000_000,
  "Xenova/gpt2": 130_000_000,
  "Xenova/gpt2-medium": 350_000_000,
};

let model = null;
let tokenizer = null;
let loadedModelId = null;
let stopping = null;
let TextStreamer = null;
let Tensor = null;
let loading = null;
let running = false;
let files = new Map();
let lastPercent = 0;
let sizeHint = 130_000_000;

function progress(info) {
  if (!info.file) return;
  const previous = files.get(info.file) || { loaded: 0, total: 0 };
  const total = info.total || previous.total;
  files.set(info.file, {
    total,
    loaded: info.status === "done" ? total : info.loaded ?? previous.loaded,
  });
  const values = [...files.values()];
  const loaded = values.reduce((sum, f) => sum + f.loaded, 0);
  const size = Math.max(sizeHint, values.reduce((sum, f) => sum + f.total, 0));
  lastPercent = Math.max(lastPercent, Math.min(99, (loaded / size) * 100));
  postMessage({
    type: "progress",
    percent: lastPercent,
    label: `Downloading model · ${(loaded / 1e6).toFixed(1)} / ${(size / 1e6).toFixed(0)} MB · ${Math.floor(lastPercent)}%`,
  });
}

async function load(modelId) {
  if (!modelId) throw new Error("No model id provided.");
  // Already loaded this exact model.
  if (model && loadedModelId === modelId) return;
  if (loading) return loading;

  // Reset progress state for a fresh download / switch.
  files = new Map();
  lastPercent = 0;
  sizeHint = SIZE_HINTS[modelId] || 130_000_000;
  model = null;
  tokenizer = null;
  loadedModelId = null;

  loading = (async () => {
    const lib = await import(TRANSFORMERS_URL);
    const {
      AutoTokenizer,
      AutoModelForCausalLM,
      env,
      InterruptableStoppingCriteria,
    } = lib;
    TextStreamer = lib.TextStreamer;
    Tensor = lib.Tensor;

    env.allowLocalModels = false;
    // GitHub Pages has no COOP/COEP; single-thread WASM works without them.
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
    try {
      if (!globalThis.caches) env.useBrowserCache = false;
      else await caches.open("transformers-cache");
    } catch {
      env.useBrowserCache = false;
    }

    stopping = new InterruptableStoppingCriteria();
    tokenizer = await AutoTokenizer.from_pretrained(modelId, {
      progress_callback: progress,
    });
    // Xenova GPT-2 family needs decoder_model_merged for the q8 WASM build.
    model = await AutoModelForCausalLM.from_pretrained(modelId, {
      dtype: "q8",
      device: "wasm",
      model_file_name: "decoder_model_merged",
      progress_callback: progress,
    });

    // WASM can resolve inference promises without yielding to queued worker messages.
    // Give Stop a turn between forward passes (a few ms, not on the UI thread).
    const forward = model.forward.bind(model);
    model.forward = async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return forward(...args);
    };

    loadedModelId = modelId;
    postMessage({
      type: "progress",
      percent: 100,
      label: "Download complete · preparing model…",
    });
  })();

  try {
    await loading;
  } finally {
    loading = null;
  }
}

self.onmessage = async ({ data }) => {
  if (data.type === "stop") {
    stopping?.interrupt();
    return;
  }

  if (data.type === "load") {
    try {
      await load(data.modelId);
      postMessage({ type: "ready", modelId: loadedModelId });
    } catch (error) {
      report(error);
    }
    return;
  }

  if (data.type !== "generate" || running || !model) return;
  running = true;
  stopping.reset();

  try {
    const { context, ...options } = data.settings;
    const encoded = tokenizer(data.text, { add_special_tokens: false });
    const total = encoded.input_ids.dims[1];
    const positions =
      model.config.n_positions || model.config.max_position_embeddings || 1024;
    // Keep the END of the prompt (new notes header) and drop early few-shots first.
    const used = Math.min(total, context, positions - options.max_new_tokens);
    if (used < 1) throw new Error("Prompt is too short after truncation.");

    const input_ids = encoded.input_ids.slice(null, [total - used, total]);
    const attention_mask = new Tensor(
      "int64",
      new BigInt64Array(used).fill(1n),
      [1, used]
    );
    postMessage({ type: "context", total, used });

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text) => postMessage({ type: "chunk", text }),
    });

    await model.generate({
      input_ids,
      attention_mask,
      ...options,
      do_sample: true,
      streamer,
      stopping_criteria: stopping,
    });
    postMessage({ type: "done", stopped: stopping.interrupted });
  } catch (error) {
    report(error);
  } finally {
    running = false;
  }
};

function report(error) {
  console.error(error);
  postMessage({
    type: "error",
    loaded: !!model,
    message: model
      ? "Generation ran into a problem. Your notes are safe. Try a shorter length or DistilGPT-2, then reload."
      : "The model could not download or start. Check your internet connection and available memory, then reload. This app needs WebAssembly and access to Hugging Face and jsDelivr. On a phone, try DistilGPT-2.",
  });
}
