# TF2 Patch Notes Generator

A single-page, fully client-side app that writes **fictional** Team Fortress 2-style patch notes. A Xenova **GPT-2** model (transformers.js, WASM) continues a few-shot prompt in your browser. There is no backend.

**Live:** https://hellold.dev/tf2-patchgen/

All notes are made up. This project is not affiliated with Valve Corporation.

## Files

| File | Purpose |
|------|---------|
| `index.html` | UI (inline CSS + JS). Spawns `worker.js`. |
| `worker.js` | Module worker: downloads + runs the model off the UI thread. |
| `.nojekyll` | Tells GitHub Pages not to run Jekyll. |
| `README.md` | This file. |

## Requirements

- A modern browser with **WebAssembly** and module workers (Chrome, Firefox, Safari, Edge).
- First visit downloads the model (tens to a few hundred MB). After that the browser cache keeps it when storage is available.
- No WebGPU required.

## Models

Pinned runtime: **`@huggingface/transformers@3.8.1`** (jsDelivr).

Every option loads the q8 WASM build with `model_file_name: 'decoder_model_merged'` (required for Xenova GPT-2).

| Role | Model id | Approx first download |
|------|----------|------------------------|
| Smaller / mobile default | `Xenova/distilgpt2` | ~85 MB |
| Desktop default (`DEFAULT_MODEL`) | `Xenova/gpt2` | ~130 MB |
| Larger | `Xenova/gpt2-medium` | ~350 MB |

Phones (coarse pointer, narrow viewport, or low `deviceMemory`) default to DistilGPT-2.

### How to swap models

1. Open `index.html` and edit `DEFAULT_MODEL`, `SMALL_MODEL`, and the `MODEL_OPTIONS` array.
2. Mirror any new size hints in `SIZE_HINTS` inside `worker.js`.
3. Keep `model_file_name: 'decoder_model_merged'` for Xenova GPT-2 family checkpoints.
4. Optionally bump the transformers URL pin in `worker.js` (`TRANSFORMERS_URL`).

## Mobile layout

Single column, ≥44px tap targets, 16px inputs (no iOS zoom), safe-area padding, and a fixed bottom Generate / Stop bar with a matching spacer so Focus / Copy / Clear / Regenerate / the footer can scroll fully into view.

## Local preview

```bash
npx --yes serve -l 4173 .
# open http://127.0.0.1:4173/
```

## Deploy (GitHub Pages)

```bash
git push origin main
# Pages already serves from main /
```

Project Pages for this account are under the user custom domain, e.g. `https://hellold.dev/tf2-patchgen/`.
