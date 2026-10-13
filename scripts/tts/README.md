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
node scripts/tts/extract_texts.mjs          # -> scripts/tts/texts.json (every string the app can speak)
../tts-tools/venv/Scripts/python -I scripts/tts/generate_audio.py \
  --onnx-dir ../tts-tools/models/v3turbo/onnx_update
```
Options: `--voices south-f,north-m` (subset), `--out public/audio`, `--limit 3` (max new files per voice, smoke test: write to a scratch `--out` and delete it).
The full run synthesises ~380 texts x 4 voices; it is resumable (existing MP3s are skipped).

## After changing content
Edit lessons/dialogues/exam, then re-run both commands above: only the new texts are generated, the manifest is rewritten from the files on disk.
Commit `public/audio/**` together with the content change. Texts without a pack file are spoken by the device voice.
The preview and device-test phrases (`Xin chào bạn!`, `Xin chào!`) are listed in `extract_texts.mjs` (`EXTRA_TEXTS`); add any new hard-coded spoken string there.
