"""
Розшифровка голосових з Telegram для агента правок (telegram-edit.yml).

Безкоштовно і без секретів: faster-whisper на CPU раннера GitHub Actions.
Мова: автовизначення; якщо модель не впевнена — українська (так говорять
у темі правок найчастіше, а whisper охоче плутає її з російською).

    python transcribe.py <model> <list.tsv> <out_dir>

list.tsv — рядки «шлях<TAB>ключ», де ключ — `edits/<issue>/<msg>.<ext>`.
На кожен файл у out_dir пишеться <n>.md — готове тіло коментаря до issue.
Збій одного файлу не зупиняє решту: у коментарі буде «не вдалося».
"""

import re
import sys
from pathlib import Path

from faster_whisper import WhisperModel

# Підказка словником: назви, які whisper інакше пише навмання.
PROMPT = "Правка для сайту БАБАКА, babaka.shop: банер, кнопка, заголовок, худі, світшот, футболка, принт, кошик, головна."
SURE = 0.7


def clean(text: str) -> str:
    """Розшифровка йде в публічну issue і в агента: без HTML-коментарів і згадок."""
    text = re.sub(r"<!--|-->", "", text)
    text = text.replace("@", "@​")
    return re.sub(r"\s+", " ", text).strip()


def transcribe(model: WhisperModel, path: str) -> str:
    opts = dict(beam_size=5, vad_filter=True, initial_prompt=PROMPT)
    # Сегменти — лінивий генератор: мова визначається одразу, а сам текст —
    # лише коли їх читають. Тому перепитати з мовою uk нічого не коштує.
    segments, info = model.transcribe(path, language=None, **opts)
    if info.language_probability < SURE and info.language != "uk":
        segments, info = model.transcribe(path, language="uk", **opts)
    return clean(" ".join(s.text for s in segments))


def main() -> int:
    model_name, listing, out_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    out_dir.mkdir(parents=True, exist_ok=True)
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    for n, line in enumerate(Path(listing).read_text(encoding="utf-8").splitlines(), start=1):
        if "\t" not in line:
            continue
        path, key = line.split("\t", 1)
        try:
            text = transcribe(model, path) or "(тиша — слів не розібрав)"
            body = f"🎙 Розшифровка: {text}"
        except Exception as error:  # noqa: BLE001 — один зіпсований файл не має зупиняти решту
            print(f"{key}: {error}", file=sys.stderr)
            body = "🎙 Не вдалося розшифрувати голосове — попроси, будь ласка, написати текстом."
        (out_dir / f"{n}.md").write_text(f"{body}\n\n<!-- transcript:{key} -->\n", encoding="utf-8")
        print(f"{key}: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
