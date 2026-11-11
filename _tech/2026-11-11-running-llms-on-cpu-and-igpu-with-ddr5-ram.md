---
title: "Running LLMs on CPU and iGPU with DDR5 RAM"
---

Can you run high-quality large language models without a dedicated GPU? If you have access to modern DDR5 memory, the answer is a surprising yes. While you won't hit the lightning speeds of an H100, the landscape for local inference on consumer hardware—specifically using integrated GPUs (iGPUs) and efficient CPU implementations—is changing rapidly.

In this post, I explore what's possible when your primary constraint isn't VRAM capacity, but rather memory bandwidth. I'll share some initial benchmarking results from my own setup: a Beelink SER9 Pro with 24GB of LPDDR5X-6400 RAM and a Radeon 780M iGPU.

## The Bandwidth Bottleneck

When running models on a discrete GPU, the bottleneck is often the speed at which the model weights can be moved from VRAM to the compute cores. On an integrated system, the CPU and GPU share the same system memory (DDR5). This means your "VRAM" is limited by your system's memory bandwidth.

As I noted in my previous article about [building a home server](d:\Projects\thulana.github.io\_tech\2026-09-16-home-server-i-can-rebuild.md), token generation is fundamentally memory-bandwidth bound. For a 4B model at Q4_K_M quantization, the theoretical ceiling on a dual-channel LPDDR5X-6400 setup (approx. 102 GB/s) is around 39 tokens per second.

## Testing the Limits: CPU vs. iGPU

I've been testing several models using Open WebUI and Ollama to see which ones provide a usable experience on this hardware. My goal was to find models that "pass"—meaning they provide a smooth enough chat experience—versus those that "fail" due to extreme latency or memory pressure.

Here is the initial breakdown of models I've tested so far:

| Model | Result | Notes |
|---|---|---|
| **gemm4-26b-a4b** | ✅ Passed | Surprisingly capable despite the size. |
| **spark-x-2.6-4b** | ✅ Passed | Very snappy on this hardware. |
| **LFM-3.0-2B** | ⚠️ Almost | Hit some stability/latency issues. |
| **LFM-2.5-24B-a2B** | ⚠️ Barely | Pushes the 24GB limit hard; slow but functional. |

## Lessons Learned from the Benchmarks

### 1. The iGPU is more than just a display driver
Setting up AMD's iGPU for inference isn't always plug-and-play. As I discovered, you often need to explicitly enable it in Ollama (`OLLAMA_IGPU_ENABLE=1`) and sometimes use Vulkan to bypass ROCm compatibility issues with specific hardware targets like the Radeon 780M (`gfx1103`).

### 2. DDR5 is the real hero
The jump from DDR4 to DDR5 has been transformative for local AI on consumer hardware. The increased bandwidth makes the difference between a model that feels "broken" and one that feels "useful."

### 3. Managing the Memory Budget
With 24GB of shared memory, every bit counts. You have to account for:
- The OS kernel and running services (Proxmox/Linux).
- The GPU's own requirements.
- The model weights + KV cache.

I highly recommend setting `OLLAMA_MAX_LOADED_MODELS=1` to avoid accidental memory exhaustion when switching between models.

## What's Next?

This is just the beginning. I plan to dive deeper into:
- Comparing different quantization methods (GGUF vs others).
- Testing more models from the Llama and Mistral families.
- Measuring exact tokens per second across various memory configurations.

If you're looking to build a low-power, quiet AI engine for your home lab, don't overlook the power of a well-configured iGPU and fast DDR5.

---
*Note: I will be enriching this article with more detailed performance data and specific configuration steps in a follow-up post.*