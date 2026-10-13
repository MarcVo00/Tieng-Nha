"""Pre-generates the Tieng Nha voice packs with VieNeu-TTS (local, free, Apache-2.0).

    python scripts/tts/generate_audio.py --onnx-dir <path to onnx_update> [--voices south-f,south-m,north-f,north-m]
                                         [--out public/audio] [--limit N]

Reads scripts/tts/texts.json (run extract_texts.mjs first), writes public/audio/<voiceId>/<key>.mp3
(mono, 24 kHz, 32 kbps) and public/audio/manifest.json. Existing files are skipped, so re-running after a
content change only generates the new texts. See scripts/tts/README.md.
"""
import argparse
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unicodedata

VOICES = {
    "south-f": {"accent": "south", "gender": "female", "label": "Mỹ Duyên", "preset": "Mỹ Duyên"},
    "south-m": {"accent": "south", "gender": "male", "label": "Thái Sơn", "preset": "Thái Sơn"},
    "north-f": {"accent": "north", "gender": "female", "label": "Đoan Trang", "preset": "Đoan Trang"},
    "north-m": {"accent": "north", "gender": "male", "label": "Phạm Tuyên", "preset": "Phạm Tuyên"},
}
MODEL_REPO = "pnnbao-ump/VieNeu-TTS-v3-Turbo"
HERE = pathlib.Path(__file__).resolve().parent


def normalize_speech_text(text: str) -> str:
    """Same as normalizeSpeechText in src/services/speechKey.ts."""
    return unicodedata.normalize("NFC", text).strip()


def speech_key(text: str) -> str:
    """First 16 hex chars of SHA-256 over the UTF-8 bytes of the normalised text (= MP3 file name)."""
    return hashlib.sha256(normalize_speech_text(text).encode("utf-8")).hexdigest()[:16]


def deref_hf_cache() -> int:
    """Windows without symlink rights: replace the symlinks of the Hugging Face cache by real copies."""
    root = pathlib.Path.home() / ".cache" / "huggingface" / "hub"
    count = 0
    for repo in root.glob("models--*"):
        for path in (repo / "snapshots").rglob("*"):
            if path.is_symlink():
                target = path.resolve()
                path.unlink()
                shutil.copy2(target, path)
                count += 1
    return count


def download_model(local_dir: pathlib.Path) -> pathlib.Path:
    """Downloads the ONNX files into a plain folder (no cache symlinks). Returns the onnx_update directory."""
    from huggingface_hub import snapshot_download

    snapshot_download(MODEL_REPO, local_dir=str(local_dir), allow_patterns=["onnx_update/*"])
    return local_dir / "onnx_update"


def convert_to_mp3(wav: pathlib.Path, mp3: pathlib.Path) -> None:
    """Writes to <name>.tmp then renames, so an interrupted run never leaves a truncated MP3 that would be skipped later."""
    mp3.parent.mkdir(parents=True, exist_ok=True)
    tmp = mp3.with_name(mp3.name + ".tmp")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-ar", "24000", "-b:a", "32k", "-f", "mp3", str(tmp)],
            check=True,
        )
        os.replace(tmp, mp3)
    finally:
        tmp.unlink(missing_ok=True)


def write_manifest(out: pathlib.Path, texts: list[str]) -> None:
    keys = [speech_key(t) for t in texts]
    voices = []
    for voice_id, meta in VOICES.items():
        present = [k for k in keys if (out / voice_id / f"{k}.mp3").is_file()]
        if present:
            voices.append({"id": voice_id, "accent": meta["accent"], "gender": meta["gender"], "label": meta["label"], "keys": present})
    out.mkdir(parents=True, exist_ok=True)
    # "keys" maps each normalised text to its key, so the app can start playback without hashing (iOS user gesture).
    manifest = {"version": 2, "keys": dict(zip(texts, keys)), "voices": voices}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--voices", default=",".join(VOICES), help="comma-separated voice ids")
    parser.add_argument("--onnx-dir", help="local folder with the VieNeu ONNX files (onnx_update)")
    parser.add_argument("--download-model", metavar="DIR", help="download the model into DIR first and use DIR/onnx_update")
    parser.add_argument("--deref-hf-cache", action="store_true", help="replace Hugging Face cache symlinks by copies (Windows)")
    parser.add_argument("--texts", default=str(HERE / "texts.json"))
    parser.add_argument("--out", default=str(HERE.parent.parent / "public" / "audio"), help="default: <repo>/public/audio")
    parser.add_argument("--limit", type=int, default=None, help="max new files per voice (smoke tests)")
    parser.add_argument("--manifest-only", action="store_true", help="only rewrite manifest.json from the MP3s on disk (no model, no ffmpeg)")
    args = parser.parse_args()

    if args.deref_hf_cache:
        print("dereferenced", deref_hf_cache(), "cache files")
    texts = json.loads(pathlib.Path(args.texts).read_text(encoding="utf-8"))
    texts = sorted({normalize_speech_text(t) for t in texts if normalize_speech_text(t)})
    out = pathlib.Path(args.out)
    if args.manifest_only:
        write_manifest(out, texts)
        print("manifest written:", out / "manifest.json")
        return 0

    onnx_dir = args.onnx_dir
    if args.download_model:
        onnx_dir = str(download_model(pathlib.Path(args.download_model)))
    if not onnx_dir:
        parser.error("--onnx-dir (or --download-model) is required")
    if not shutil.which("ffmpeg"):
        parser.error("ffmpeg must be on PATH")

    voice_ids = [v.strip() for v in args.voices.split(",") if v.strip()]
    unknown = [v for v in voice_ids if v not in VOICES]
    if unknown:
        parser.error(f"unknown voices: {', '.join(unknown)}")

    from vieneu import Vieneu  # imported late so --help works without the heavy dependency

    tts = Vieneu(onnx_dir=onnx_dir)
    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        wav = pathlib.Path(tmp) / "tmp.wav"
        for voice_id in voice_ids:
            preset = VOICES[voice_id]["preset"]
            created = skipped = 0
            for text in texts:
                target = out / voice_id / f"{speech_key(text)}.mp3"
                if target.is_file():
                    skipped += 1
                    continue
                if args.limit is not None and created >= args.limit:
                    break
                try:
                    audio = tts.infer(text, voice=preset)
                    tts.save(audio, str(wav))
                    convert_to_mp3(wav, target)
                    created += 1
                    print(f"[{voice_id}] {created}: {text}", flush=True)
                except Exception as error:  # keep going: one bad text must not lose the whole run
                    failures += 1
                    print(f"[{voice_id}] FAILED {text!r}: {error}", file=sys.stderr, flush=True)
            print(f"[{voice_id}] created {created}, skipped {skipped}")

    write_manifest(out, texts)
    print("manifest written:", out / "manifest.json")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
