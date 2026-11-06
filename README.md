# TF2 Patch Notes Generator

A single-page, fully client-side app that writes **fictional** Team Fortress 2-style patch notes. A small instruction-tuned LLM runs in your browser on **WebGPU** via [WebLLM](https://github.com/mlc-ai/web-llm). There is no backend.

**Live:** https://hellold.dev/tf2-patchgen/

All notes are made up. This project is not affiliated with Valve Corporation.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Entire app (inline CSS + JS). Loads WebLLM from jsDelivr. |
| `.nojekyll` | Tells GitHub Pages not to run Jekyll. |
| `README.md` | This file. |

## Requirements

- A browser with **WebGPU**:
  - Chrome or Edge 113+ (desktop)
  - Recent Chrome on Android
  - Safari 26+ with WebGPU
  - Firefox with `dom.webgpu.enabled` in `about:config`
- First visit downloads the model (hundreds of MB). After that the browser cache keeps it.

## Models

Pinned WebLLM version: **`@mlc-ai/web-llm@0.2.87`**.

Default and dropdown options (must exist in that version's `prebuiltAppConfig.model_list`):

| Role | Model id |
|------|----------|
| Smaller | `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` |
| Default | `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` |
| Larger | `Llama-3.2-3B-Instruct-q4f16_1-MLC` |

### How to swap models

1. Open `index.html`.
2. Change `DEFAULT_MODEL` near the top of the `<script type="module">` block.
3. Edit the `MODEL_OPTIONS` array (labels + ids).
4. Confirm the ids exist in WebLLM's prebuilt list for the pinned version (see `prebuiltAppConfig.model_list` in the package).
5. Optionally bump `WEBLLM_URL` to a newer pinned jsDelivr version, then re-check the model list.

## Local preview

Any static server works, for example:

```bash
npx --yes serve -l 4173 .
# then open http://127.0.0.1:4173/
```

WebGPU is required for generation. Headless Chromium often needs flags such as `--enable-unsafe-webgpu` or a SwiftShader adapter.

## Deploy (GitHub Pages)

```bash
gh repo create hellold6/tf2-patchgen --public --source=. --remote=origin --push
gh api -X POST repos/hellold6/tf2-patchgen/pages \
  -f "source[branch]=main" -f "source[path]=/"
```

Project Pages for this account are served under the user custom domain, e.g. `https://hellold.dev/tf2-patchgen/`.
