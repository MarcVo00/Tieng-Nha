"""Pre-generates the Tagalog voice packs (tl-f, tl-m) with edge-tts (free Microsoft neural voices, needs the network).

    python -I scripts/tts/generate_audio_edge.py [--voices tl-f,tl-m] [--out public/audio] [--limit N]

Reads the "tl" list of scripts/tts/texts.json, writes public/audio/<voiceId>/<key>.mp3 (mono, 24 kHz, 32 kbps like the
Vietnamese files) and rewrites manifest.json (Vietnamese entries untouched). Existing files are skipped (resumable).
See scripts/tts/README.md and docs/adr/0013-languages.md.
"""
import argparse
import asyncio
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # `python -I` drops the script folder from sys.path
from generate_audio import TL_VOICES, load_texts, normalize_speech_text, speech_key, write_manifest  # noqa: E402

RETRIES = 5


def to_mp3(src: pathlib.Path, mp3: pathlib.Path) -> None:
    """Re-encode to mono 24 kHz 32 kbps (same as the Vietnamese pack); write to .tmp then rename (no truncated files)."""
    mp3.parent.mkdir(parents=True, exist_ok=True)
    tmp = mp3.with_name(mp3.name + ".tmp")
    try:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "24000", "-b:a", "32k", "-f", "mp3", str(tmp)], check=True)
        os.replace(tmp, mp3)
    finally:
        tmp.unlink(missing_ok=True)


async def synth(text: str, edge_voice: str, dest: pathlib.Path) -> None:
    import edge_tts

    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            await edge_tts.Communicate(text, edge_voice).save(str(dest))
            return
        except Exception as error:  # rate limit / network: back off and retry
            last = error
            await asyncio.sleep(2 * (attempt + 1))
    raise RuntimeError(f"edge-tts failed after {RETRIES} attempts: {last}")


async def run(args: argparse.Namespace) -> int:
    texts = sorted({normalize_speech_text(t) for t in load_texts(pathlib.Path(args.texts), "tl") if normalize_speech_text(t)})
    vi_texts = sorted({normalize_speech_text(t) for t in load_texts(pathlib.Path(args.texts), "vi") if normalize_speech_text(t)})
    out = pathlib.Path(args.out)
    voice_ids = [v.strip() for v in args.voices.split(",") if v.strip()]
    unknown = [v for v in voice_ids if v not in TL_VOICES]
    if unknown:
        print("unknown voices:", ", ".join(unknown), file=sys.stderr)
        return 2
    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        raw = pathlib.Path(tmp) / "raw.mp3"
        for voice_id in voice_ids:
            created = skipped = 0
            for text in texts:
                target = out / voice_id / f"{speech_key(text)}.mp3"
                if target.is_file():
                    skipped += 1
                    continue
                if args.limit is not None and created >= args.limit:
                    break
                try:
                    await synth(text, TL_VOICES[voice_id]["edge"], raw)
                    to_mp3(raw, target)
                    created += 1
                    print(f"[{voice_id}] {created}: {text}", flush=True)
                    await asyncio.sleep(args.delay)
                except Exception as error:
                    failures += 1
                    print(f"[{voice_id}] FAILED {text!r}: {error}", file=sys.stderr, flush=True)
            print(f"[{voice_id}] created {created}, skipped {skipped}")
    if not args.no_manifest:
        write_manifest(out, vi_texts, texts)
        print("manifest written:", out / "manifest.json")
    return 1 if failures else 0


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--voices", default=",".join(TL_VOICES))
    parser.add_argument("--texts", default=str(HERE / "texts.json"))
    parser.add_argument("--out", default=str(HERE.parent.parent / "public" / "audio"), help="default: <repo>/public/audio")
    parser.add_argument("--limit", type=int, default=None, help="max new files per voice (smoke tests; use a scratch --out and --no-manifest)")
    parser.add_argument("--delay", type=float, default=0.2, help="seconds between requests")
    parser.add_argument("--no-manifest", action="store_true")
    args = parser.parse_args()
    if not shutil.which("ffmpeg"):
        parser.error("ffmpeg must be on PATH")
    return asyncio.run(run(args))


if __name__ == "__main__":
    sys.exit(main())
