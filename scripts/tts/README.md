# Voice packs (Tiếng Nhà)

Pre-generates the Vietnamese voices with [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) (local, free, Apache-2.0).
See `docs/adr/0011-voice-packs.md`. This is **not** part of the npm build; the generated MP3s are committed.

Output: `public/audio/<voiceId>/<key>.mp3` and `public/audio/manifest.json`.
`key` = first 16 hex chars of SHA-256 over the UTF-8 bytes of `text.normalize("NFC").trim()`
(same function in `generate_audio.py` and `src/services/speechKey.ts`; test vector: `Xin chào bạn!` -> `761b6118b70fd9d4`).

| id | accent | VieNeu preset |
|---|---|---|
| `south-f` (default) | south | Mỹ Duyên |
| `south-m` | south | Thái Sơn |
| `north-f` | north | Đoan Trang |
| `north-m` | north | Phạm Tuyên |

## One-time setup (keep everything outside the repo, e.g. `../tts-tools`)
1. Python 3.11 venv and the engine: `py -3.11 -m venv ../tts-tools/venv`, then `../tts-tools/venv/Scripts/python -m pip install vieneu`.
2. `ffmpeg` on the PATH (`ffmpeg -version`).
3. The ONNX model. On Windows the Hugging Face cache uses symlinks, which fail without developer mode. Two workarounds, both built into the script:
   - `--download-model ../tts-tools/models/v3turbo` downloads `onnx_update/*` into a plain folder (no symlinks) and uses it; or
   - `--deref-hf-cache` replaces every symlink of `~/.cache/huggingface/hub` by a real copy (run once after a normal download).
   Then pass the folder with `--onnx-dir ../tts-tools/models/v3turbo/onnx_update`.

## Generate
```bash
node scripts/tts/extract_texts.mjs          # -> scripts/tts/texts.json (every string the app can speak, per language: `{ "vi": [...], "tl": [...] }`; the generator voices the `vi` list)
../tts-tools/venv/Scripts/python -I scripts/tts/generate_audio.py \
  --onnx-dir ../tts-tools/models/v3turbo/onnx_update
```
Options: `--voices south-f,north-m` (subset), `--out public/audio`, `--limit 3` (max new files per voice, smoke test: write to a scratch `--out` and delete it).
`--manifest-only` rewrites `manifest.json` (version 2: text -> key map + per-voice key lists) from the MP3s already on disk and `texts.json`, without the model or ffmpeg.
The full run synthesises ~380 texts x 4 voices; it is resumable (existing MP3s are skipped).

## After changing content
Edit `src/content/<language>/{lessons,dialogues,exam.json}`, then re-run both commands above: only the new texts are generated, the manifest is rewritten from the files on disk.
Commit `public/audio/**` together with the content change. Texts without a pack file are spoken by the device voice.
The preview and device-test phrase (`Chào bạn!`) is listed in `extract_texts.mjs` (`EXTRA_TEXTS`, kept per language: `vi` and `tl`); add any new hard-coded spoken string there.

## Tagalog voices (edge-tts)
`tl-f` (`fil-PH-BlessicaNeural`) and `tl-m` (`fil-PH-AngeloNeural`) come from [edge-tts](https://github.com/rany2/edge-tts) (free Microsoft neural voices, needs the network). See `docs/adr/0013-languages.md`.
```bash
py -3 -m venv ../tts-tools/edge-venv && ../tts-tools/edge-venv/Scripts/python -m pip install edge-tts   # once, outside the repo; ffmpeg on the PATH
node scripts/tts/extract_texts.mjs
../tts-tools/edge-venv/Scripts/python -I scripts/tts/generate_audio_edge.py     # the `tl` list, both voices, resumable
```
Options: `--voices tl-f`, `--limit 3 --no-manifest --out <scratch>` (smoke test), `--delay 0.2` (seconds between requests; failures are retried 5 times with back-off).
Files are re-encoded with ffmpeg to mono 24 kHz 32 kbps (same as the Vietnamese pack) and the script rewrites `manifest.json` with both the Vietnamese and the Tagalog voices. `generate_audio.py --manifest-only` does the same without any generation.
