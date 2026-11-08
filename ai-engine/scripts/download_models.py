"""Pre-downloads the embedding model at build time.

Free hosts (Render) wipe the disk on every restart, so without this the
~65 MB model would be re-downloaded on each cold start.
Usage: FASTEMBED_CACHE=./models python scripts/download_models.py
"""
import os

from fastembed import TextEmbedding

cache = os.environ.get("FASTEMBED_CACHE", "./models")
TextEmbedding(model_name="BAAI/bge-small-en-v1.5", cache_dir=cache)
print(f"Embedding model ready in {cache}")
