---
title: "Building a home server I can rebuild - Proxmox, an iGPU and local AI"
categories: ["Engineering"]
tags: ["Home Lab", "Proxmox", "Self-Hosting", "AI"]
---

I finally stopped renting a server and put one on my own desk. A small Beelink mini PC, Proxmox on top, and everything I actually use running in containers on it - a local chat model, a media library, a few tool services. The interesting part is not that it works. The interesting part is that it is written down well enough that I could wipe the box tomorrow and have it back the same evening. That, and the fact that my "local AI" tops out at 24 tokens per second, which I want to talk about honestly rather than pretend otherwise.

We techies love owning our stack. :sweat_smile: Infrastructure as a code, CV as a code, blog as a code - and at some point you look at your monthly cloud bill and think, why is my always-on box in someone else's datacentre? So let's get cracking.

## Why a mini PC and not a real server ?

Here it is, next to the router, which gives you the scale better than any spec sheet:

<figure>
  <img src="{{ base_path }}/images/beelink-ser9-pro-home-server.jpg" alt="A small silver Beelink mini PC sitting on a dark wooden shelf beside a tall white home router, with cables coiled behind them. The mini PC is roughly a third the height of the router.">
</figure>

I very nearly bought a proper tower with a discrete GPU, and I'm glad I didn't. The thing about a home server is that the specs are only half the decision. The other half is that it has to live in your home, run all the time, and not annoy you. Four things decided it:

**It's cheap.** Not cheap in absolute terms, but cheap against the alternative. A tower with a GPU that would genuinely beat this at inference costs several times as much before you've bought a case, a PSU or the drives.

**It's quiet.** This sits in a living space, not a rack in a basement. It's on 24/7. A server you can hear is a server you resent, and a resented server gets unplugged. Even with the iGPU pinned to its top clock - which I'd normally expect to be the thing that makes a small box audible - I can't hear it from the sofa.

**The TDP is small.** The processor is a 65 W part, and the box idles well below that. Something that never turns off is a power bill rather than a purchase, so the number that matters is watts over a year, not peak performance. A desktop with a discrete GPU can sit at idle drawing what this thing pulls flat out.

**It takes no space.** One shelf, one power brick, one network cable. No rack, no noise enclosure, no rethinking where furniture goes.

And honestly, one more: I wanted to find out whether an integrated GPU could do this at all. That turned out to be the most interesting part of the whole build, and about two thirds of this article.

### What I gave up

Being straight about it, because these are real:

- **The RAM is soldered.** 24 GB is 24 GB forever. That's not a limit I can spend my way out of later.
- **There's no upgrade path for the GPU.** No slot, no card, no future where I drop something faster in.
- **The memory bandwidth is the ceiling on everything**, and it's the reason the benchmark section below lands where it does.

That first point is also why the rest of this article leans so hard on the setup being reproducible. The box is disposable, so the build instructions have to outlive it.

Oh, and see that pinhole on the front panel, next to the power button? Remember it. It comes up later, and not in a good way. :sweat_smile:

## What's in the box ?

Nothing exotic, and that's deliberate. A Beelink SER9 Pro:

| Part | What it is | Why it matters later |
|---|---|---|
| CPU | Ryzen 7 H 255 - Zen 4, 8 cores / 16 threads, 65 W | 8 *physical* cores. Inference scales with those, not with threads. |
| GPU | Radeon 780M iGPU, 12 CU RDNA 3 | It's integrated, which is the whole story below. |
| RAM | 24 GB LPDDR5X-6400, soldered, dual channel | Shared between CPU and GPU. Not upgradeable. This is the ceiling. |
| Storage | 2 x M.2 2280 PCIe 4.0 | Second slot is the backup target. |
| Network | 2.5 GbE | Use the wire, not the Wi-Fi. |

Proxmox VE 9.2 on top, and then everything else lives in LXC containers rather than VMs. Containers because this box has 24 GB of RAM and I'd rather not spend a third of it on guest kernels.

## Why was my GPU doing absolutely nothing ?

Here's the part I want to write down properly, because I lost a weekend to it and every guide online fixes exactly one of the four things that were wrong.

I had Ollama installed in a container. It answered questions. `ollama ps` said `100% CPU`. The GPU sat there, idle, all 12 compute units of it. Four independent layers were each blocking it, and you have to fix **all four** - fixing three gets you nothing at all, which is what makes it so miserable to debug.

**1. The container couldn't see the GPU.** LXC isolation means the device nodes just aren't there. Ollama wasn't ignoring `/dev/dri/renderD128`, it genuinely couldn't see it. Proxmox 9.x has a clean syntax for this - no more hand-written cgroup rules:

```bash
# on the host - use the GIDs from INSIDE the container, not the host's
pct set OLLAMA_CT --dev0 /dev/dri/renderD128,gid=<render gid>,mode=0660
pct set OLLAMA_CT --dev1 /dev/kfd,gid=<render gid>,mode=0660
```

*tip: run `getent group render video` inside the container to get those GIDs. If you use the host's numbers, the devices show up owned by `nobody` and nothing works.*

**2. Ollama skips integrated GPUs on purpose.** This one is a genuinely reasonable default that cost me hours. Since 2026, Ollama ignores iGPUs unless you tell it not to, because on most laptops the iGPU is slower than the CPU. Mine isn't a laptop, so:

```bash
OLLAMA_IGPU_ENABLE=1
```

**3. The 780M isn't on ROCm's list.** The 780M is LLVM target `gfx1103`. Ollama's ROCm allow-list has gfx1100, 1101, 1102, 1150, 1151 - no 1103. You have two ways out. Lie to ROCm with `HSA_OVERRIDE_GFX_VERSION=11.0.2` and pretend to be a 1102, or use the **Vulkan** backend, which doesn't care:

```bash
OLLAMA_VULKAN=1
```

Vulkan is the better answer here for a reason that has nothing to do with driver politics: on an APU, Vulkan/RADV sees the BIOS memory carve-out *plus* GTT as one pool, while ROCm on some APUs only sees the carve-out. That difference decides which models fit.

**4. No user-space driver inside the container.** Vulkan needs Mesa's RADV *in the container*, and the `ollama` user needs to be in the right groups:

```bash
apt install -y mesa-vulkan-drivers vulkan-tools
usermod -aG render,video ollama
vulkaninfo --summary | grep -E 'deviceName|driverName'
# want: AMD Radeon 780M Graphics (RADV GFX1103) / radv
```

Plus one BIOS setting, which is easy to miss because it's buried: `Advanced -> AMD CBS -> NBIO -> GFX Configuration`, set `UMA Frame Buffer Size` to **4G**. Your total RAM drops to about 20 GB in `free -h` afterwards - that's expected, not a bug.

After all four, `ollama ps` finally said `100% GPU`. :smile:

## So how fast is it really ?

This is where I have to be honest, because the internet is full of people claiming numbers they never measured.

Token *generation* on this kind of machine is memory-bandwidth bound, not compute bound. A dense model reads every single weight once per token, so there is a hard ceiling you can calculate before you benchmark anything:

```
tokens/sec ceiling = memory bandwidth / model size
```

My LPDDR5X-6400 in dual channel is 102 GB/s theoretical. A 4B model at Q4_K_M is 2.6 GB. So 102 / 2.6 = **39 tok/s**, absolute best case, at 100% memory efficiency, which nothing ever achieves. Here's what I actually got:

| Setup | tok/s | Effective bandwidth | % of theoretical |
|---|---|---|---|
| Ollama, default GPU governor | 19 | 49 GB/s | 48% |
| Ollama, GPU clock pinned `high` | **24** | 62 GB/s | 61% |
| Realistic ceiling at ~70% efficiency | ~28 | 72 GB/s | 70% |

Use that formula to sanity-check *any* result you read before you go chasing it. If someone claims 60 tok/s on a 7B model from an iGPU, ask them what bandwidth they think they have.

The other honest note: because both CPU and GPU read the same LPDDR5X, moving to the GPU did **not** make generation dramatically faster. What it actually bought me was prompt processing 2-4x faster - which you feel with long prompts and RAG - and a CPU that's now free for everything else on the box. The machine runs cool and quiet while a model is loaded. That's worth it, but it's not the "GPU go brrr" story people expect.

### The free 26% almost nobody mentions

The jump from 19 to 24 tok/s in that table came from one line. The `amdgpu` governor does not recognise inference as a demanding workload, so it happily downclocks the iGPU while it is completely busy. Force it:

```bash
GPU=$(readlink -f /sys/class/drm/renderD128/device)
echo high > $GPU/power_dpm_force_performance_level
```

That has to happen on the **host** - sysfs writes don't work from inside a container. Make it a tiny systemd unit so it survives reboots. The cost is that the iGPU now holds its top clock at idle too, so check your fan noise on a box that runs 24/7. On mine it's inaudible.

### The tempting BIOS setting that bricks your boot

The BIOS offers 7500 MT/s memory. Generation is bandwidth-bound, so the maths is seductive - 120 GB/s instead of 102, about 17% more tokens for free.

Do not. My modules are rated 6400. I tried it, the machine would not POST, and I had to do a physical CMOS clear with a pinhole on the front panel.

Two things are worth understanding here. First, **the BIOS menu is not module-aware** - the SER9 firmware is shared across the whole product family, so it lists every speed the *platform* supports, including ones that belong to a different model entirely. Beelink's own support has said as much on their forum. Second, memory training happens in firmware, long before a bootloader exists, so this fails identically under Proxmox, Windows, or nothing at all. There's no automatic fallback to the last good setting.

And the recovery cost goes up once the box is a server. A CMOS clear is physical - you can't do it over Tailscale from another country - and it resets *every* setting the build depends on: the TDP, the 4 GB UMA carve-out, boot order, auto-power-on. Write them down before you touch anything.

The part that actually made me back off, though: unstable memory doesn't crash, it silently returns wrong bits, and there's no ECC on this platform to catch it. A setting that fails loudly is one you can walk back. This one wouldn't.

## How is it all laid out ?

One LXC per concern, each with a static IP set in Proxmox rather than a DHCP reservation, so the addressing travels with the container through backup and restore.

```
Internet ──HTTPS──▶ Cloudflare ──Access (email allow-list)──▶ Tunnel
                                                                │ outbound only
  Phone/laptop ──Tailscale (WireGuard)──┐                       │
                                        ▼                       ▼
┌────────────── Beelink SER9 Pro · Proxmox VE 9.2 ───────────────────┐
│ host: tailscaled (subnet router + exit node)                       │
│                                                                    │
│  ai-engine    ollama                     (iGPU via Vulkan)         │
│  docker       open-webui, portainer, cloudflared                   │
│  media        jellyfin                   (direct play only)        │
│                                                                    │
│  Radeon 780M · 24 GB shared: 4 GB carve-out + GTT on demand        │
└────────────────────────────────────────────────────────────────────┘
```

The memory budget is the thing to plan first, and there's a nasty subtlety in it. GPU memory the driver allocates on behalf of a process inside a container - GTT pages - is **not** charged to that container's memory cgroup. So an 8 GB limit on the Ollama container does not cap the GPU side at all. Keep real headroom on the host, and keep `OLLAMA_MAX_LOADED_MODELS=1`.

The Docker container runs an ordinary compose stack - Open WebUI for chat, Portainer to manage things from a browser, cloudflared for the tunnel. One thing that bit me: Open WebUI has a concept called **PersistentConfig**, where a pile of environment variables are read *only on first start* and then stored in its database. Change `ENABLE_SIGNUP` in your compose file six months later and nothing happens. You change it in Admin Panel, or you set `ENABLE_PERSISTENT_CONFIG=false` and accept that compose owns it.

## How do I get to it from outside ?

Two paths, and the split matters.

**Cloudflare Tunnel** for the one thing I want on the public internet - the chat UI. The tunnel dials out, so there is no port forward on my router and no inbound hole at all. Then **Cloudflare Access** sits in front with an email allow-list, so the internet only ever sees Cloudflare's one-time-PIN page until someone proves they're me. Free tier covers it.

**Tailscale** for everything else. It runs on the Proxmox host, advertises the LAN as a subnet route and offers itself as an exit node:

```bash
tailscale set \
  --advertise-routes=<your-lan-subnet> \
  --advertise-exit-node \
  --accept-dns=false
```

Now every container is reachable by its LAN IP from any of my devices, without installing Tailscale in each one. The Proxmox UI, Portainer and Ollama all sit on their default ports, and none of them are ever exposed publicly.

Three things I'd have liked to know earlier:

- `--accept-dns=false` stops tailscaled rewriting `/etc/resolv.conf` on the host, which otherwise fights with Proxmox's own network config.
- Go into the Tailscale admin console and **disable key expiry** on the server node. Otherwise your remote access dies silently after 180 days, probably while you're away, which is exactly when you need it.
- Home LANs cluster on a handful of ranges, and ISP routers, hotels and cafés pick from the same short list. When you're on a network that happens to use the same range as yours, your advertised subnet collides with the local one and you can't reach your own boxes by LAN IP at all. The host is still reachable on its `100.x` Tailscale address, which is your break-glass path. Renumbering the home LAN to something nobody else uses is the permanent fix.

And one rule I'd underline: **don't stream media through the Cloudflare tunnel.** Public hostname routes are proxied through Cloudflare's CDN and subject to its restrictions on hosting large video files. That's a well-known way to get a domain flagged. Jellyfin goes over Tailscale, which is less work anyway - its apps take a plain host and port.

I also skipped hardware transcoding entirely. No GPU passed through to the media container, no VAAPI, no device mappings to get wrong. Every client I actually watch on decodes for itself, so Jellyfin just hands over the file and stays out of the way. That keeps the container slim, keeps one more thing out of the rebuild, and leaves the iGPU for the model - which is where I want it.

## What makes it recreatable ?

This is the bit I'm actually pleased with, and it's not clever - it's just discipline.

Every phase of the build is written down as commands, in order, with a **verification step at the end that has to pass before moving on**. Not "install Docker", but "install Docker, then `docker info` must show overlay2 and cgroup v2". The document has a troubleshooting table mapping symptoms to causes, and a final checklist of about twenty boxes. It's long and boring, which is the point - a runbook you have to interpret is a runbook you can't execute at 11pm.

On top of that:

- **vzdump backups** to the *second* M.2, never the same disk as the containers. Daily for the container holding chat history and uploads, weekly for the Ollama one - models are re-downloadable, the config is what matters.
- I actually **tested a restore** into a fresh container ID. A backup you've never restored is a hypothesis, not a backup.
- Secrets live in one `.env` at mode 600, referenced from compose, never inline.
- Containers set `onboot=1` with a startup order, so a power cut resolves itself.

The real test of all this: could I buy a better mini PC, wipe this one, and be back up the same evening? Yes. The document is the machine.

## Where this actually lands

Let me be plain about it, since that's more useful than a victory lap.

I have a recreatable home server. That's the win, and it's a real one. Everything I self-host now runs on hardware I own, reachable from anywhere, with nothing port-forwarded and no monthly bill. If it dies, I rebuild it from a document.

What I do **not** have is fast local AI. 24 tok/s on a 4B model is fine for chat and genuinely useful for tool-calling and summarising. It is not 50+ tok/s, and no amount of tuning on this box will get there - the memory bandwidth simply isn't present. That's arithmetic, not effort. Getting past it needs different hardware: more bandwidth, or discrete VRAM, or both.

But that's exactly why the runbook matters more than the benchmark. The setup isn't married to this machine. When I can justify better hardware, the containers restore, the document replays, and the same architecture runs faster. The box is the cheap part. The knowledge of how to put it back together is the thing worth having.

It's a start. :smile:

If you're going down the same road, the four-layer GPU thing and the bandwidth formula are the two things I'd hand you first - they'd have saved me a weekend each. If you think this is interesting, do check out my other articles. And if there's something you want to know, please get in touch.

Cheerio !! :smile:
