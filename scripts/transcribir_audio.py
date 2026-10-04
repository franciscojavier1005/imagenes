#!/usr/bin/env python3
"""Transcribe un audio de la ronda (sin enviarlo a ningún servicio externo) y, opcionalmente, lo analiza con las mismas reglas del sistema.

  pip install faster-whisper
  python3 scripts/transcribir_audio.py ronda.m4a                 -> imprime el texto
  python3 scripts/transcribir_audio.py ronda.m4a --analizar 2026-10-02 > propuestas.json

Con --analizar llama a scripts/analizar_nota.js (Node) con el texto y el horario/docentes de data/ y escribe las propuestas en JSON.
El modelo se descarga una vez (modelo "base" ~140 MB; con --modelo small mejora en español). Todo corre en su computador.
"""
import argparse, json, os, subprocess, sys

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def transcribir(ruta, modelo="base", ruta_modelo=None):
    from faster_whisper import WhisperModel
    m = WhisperModel(ruta_modelo or modelo, device="cpu", compute_type="int8")
    segs, _ = m.transcribe(ruta, language="es", vad_filter=True, beam_size=5)
    return " ".join(s.text.strip() for s in segs).strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio")
    ap.add_argument("--modelo", default="base", help="base | small | medium, o la ruta de un modelo descargado")
    ap.add_argument("--analizar", metavar="AAAA-MM-DD", help="fecha de la ronda: además de transcribir, propone novedades (JSON)")
    a = ap.parse_args()
    texto = transcribir(a.audio, a.modelo)
    if not a.analizar:
        print(texto)
        return
    r = subprocess.run(["node", os.path.join(RAIZ, "scripts", "analizar_nota.js"), a.analizar], input=texto, text=True, capture_output=True)
    if r.returncode:
        sys.exit(r.stderr)
    print(json.dumps({"texto": texto, "analisis": json.loads(r.stdout)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
