# /// script
# requires-python = ">=3.12,<3.14"
# dependencies = [
#     "pocket-tts==4.0.1",
#     "lameenc>=1.7",
# ]
#
# # On Linux PyPI's torch is the CUDA build (gigabytes of it); Pocket TTS runs on the CPU.
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
#
# [tool.uv.sources]
# torch = [{ index = "pytorch-cpu", marker = "sys_platform == 'linux'" }]
# ///
"""Renders the narrator's clips with Kyutai's Pocket TTS (docs/narration.md).

Run by tools/narration.mjs, which decides what to render; not meant to be run by hand:

    uv run tools/narration.py jobs.json results.json

jobs.json is {"jobs": [{"model", "voice", "temperature", "seed", "text", "out"}, ...]}: each job
is said by the Pocket TTS model `model` (a language config such as "english" or "german_24l") in
the predefined voice `voice`, with the noise seeded by `seed` (the same job always gives the same
audio), then trimmed, levelled and written as a mono MP3 to `out`. results.json gets
[{"out", "dur"}, ...], the clips' lengths in seconds.

The models come from the Hugging Face cache (downloaded the first time: no account needed, the
predefined voices work with the public weights).
"""

import json
import logging
import sys
import time

import lameenc
import numpy as np
import torch
from pocket_tts import TTSModel

# keep in step with PIPELINE in tools/narration.mjs: a change here renders every clip again
BITRATE = 48  # kbit/s, mono, at the model's 24 kHz
LEAD_IN = 0.05  # seconds of quiet kept before the voice
TAIL = 0.15  # and after it
TARGET_RMS_DB = -20.0  # loudness of the spoken part
PEAK_DB = -1.0  # never louder than this
SILENCE_DB = -40.0  # below this (from the clip's peak) counts as quiet, for the trim


def db(x):
    return 10 ** (x / 20)


def finish(audio, rate):
    """Trims the quiet at the ends and levels the clip: the spoken part at TARGET_RMS_DB,
    peaks at most PEAK_DB."""
    audio = audio.astype(np.float64)
    peak = np.abs(audio).max()
    if peak <= 0:
        raise ValueError("the model returned silence")
    # 10 ms windows: the loud ones are speech
    win = rate // 100
    frames = audio[: len(audio) // win * win].reshape(-1, win)
    rms = np.sqrt((frames**2).mean(axis=1))
    loud = np.nonzero(rms > peak * db(SILENCE_DB))[0]
    start = max(0, loud[0] * win - int(LEAD_IN * rate))
    end = min(len(audio), (loud[-1] + 1) * win + int(TAIL * rate))
    audio = audio[start:end]
    speech = frames[loud]
    level = np.sqrt((speech**2).mean())
    gain = min(db(TARGET_RMS_DB) / level, db(PEAK_DB) / peak)
    return (audio * gain).astype(np.float32)


def mp3(audio, rate):
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()
    return bytes(enc.encode(pcm) + enc.flush())


def main(jobs_path, results_path):
    logging.basicConfig(level=logging.WARNING)
    jobs = json.load(open(jobs_path))["jobs"]
    models, voices, results = {}, {}, []
    started = time.time()
    # one model at a time: the jobs grouped by model, in their order otherwise
    order = sorted(range(len(jobs)), key=lambda i: (jobs[i]["model"], i))
    for n, i in enumerate(order, 1):
        job = jobs[i]
        key = (job["model"], job["temperature"])
        if key not in models:
            print(f"narration: loading {job['model']}", file=sys.stderr, flush=True)
            models.clear()
            voices.clear()
            kwargs = {} if job["temperature"] is None else {"temp": job["temperature"]}
            models[key] = TTSModel.load_model(language=job["model"], **kwargs)
        model = models[key]
        if job["voice"] not in voices:
            voices[job["voice"]] = model.get_state_for_audio_prompt(job["voice"])
        torch.manual_seed(job["seed"])
        audio = model.generate_audio(voices[job["voice"]], job["text"]).numpy()
        audio = finish(audio, model.sample_rate)
        with open(job["out"], "wb") as f:
            f.write(mp3(audio, model.sample_rate))
        dur = round(len(audio) / model.sample_rate, 2)
        results.append({"out": job["out"], "dur": dur})
        print(f"narration: [{n}/{len(jobs)}] {dur:5.2f}s {job['text']}", file=sys.stderr, flush=True)
    json.dump(results, open(results_path, "w"))
    print(f"narration: {len(jobs)} clips in {time.time() - started:.0f}s", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
