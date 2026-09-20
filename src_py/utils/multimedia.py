"""
Multimedia processing utilities for images, documents, and audio notes.
Supports image inspection, OCR, PDF/Doc text extraction, and metadata analysis.
"""
import os
from pathlib import Path
from typing import Any, Dict, Optional
from PIL import Image
from utils.logger import get_logger

logger = get_logger("utils.multimedia")

def process_image(file_path: str, caption: str = "") -> Dict[str, Any]:
    """
    Analyze an image file: extract dimensions, color mode, format, and OCR text if available.
    """
    path = Path(file_path)
    if not path.exists():
        return {"error": f"Image file '{file_path}' does not exist."}

    try:
        with Image.open(path) as img:
            width, height = img.size
            img_format = img.format or "UNKNOWN"
            img_mode = img.mode
            file_size_kb = round(path.stat().st_size / 1024, 2)
            aspect_ratio = round(width / height, 2) if height > 0 else 1.0

        # Attempt OCR text extraction if pytesseract is installed and configured
        extracted_text = ""
        try:
            import pytesseract
            with Image.open(path) as img:
                extracted_text = pytesseract.image_to_string(img).strip()
        except Exception:
            extracted_text = ""

        summary_parts = [
            f"🖼️ Image Analysis ({img_format}, {width}x{height}px, {file_size_kb} KB, aspect ratio {aspect_ratio})"
        ]
        if caption:
            summary_parts.append(f"Caption: \"{caption}\"")
        if extracted_text:
            preview = extracted_text[:300] + ("..." if len(extracted_text) > 300 else "")
            summary_parts.append(f"Extracted Text (OCR):\n{preview}")
        else:
            summary_parts.append("Image received and verified.")

        return {
            "success": True,
            "width": width,
            "height": height,
            "dimensions": {"width": width, "height": height},
            "format": img_format,
            "mode": img_mode,
            "file_size_kb": file_size_kb,
            "aspect_ratio": aspect_ratio,
            "extracted_text": extracted_text,
            "summary": "\n".join(summary_parts),
            "analysis": f"Photo dimensions: {width}x{height}, format: {img_format}, mode: {img_mode}"
        }
    except Exception as e:
        logger.error(f"Error processing image {file_path}: {e}")
        return {"success": False, "error": str(e), "summary": f"Could not process image: {str(e)}"}

def process_document(file_path: str, file_name: Optional[str] = None, caption: str = "", mime_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract text and metadata from a document (PDF, TXT, MD, CSV, DOCX).
    """
    path = Path(file_path)
    if not path.exists():
        return {"error": f"Document '{file_path}' does not exist."}

    name = file_name or path.name
    ext = path.suffix.lower()
    file_size_kb = round(path.stat().st_size / 1024, 2)

    text_content = ""
    page_count = 1

    try:
        if ext == ".pdf":
            try:
                import pdfplumber
                with pdfplumber.open(path) as pdf:
                    page_count = len(pdf.pages)
                    pages_text = []
                    for i, page in enumerate(pdf.pages[:10]):  # Extract first 10 pages
                        page_t = page.extract_text() or ""
                        if page_t:
                            pages_text.append(f"--- Page {i+1} ---\n{page_t.strip()}")
                    text_content = "\n\n".join(pages_text)
            except Exception as e:
                text_content = f"[PDF extraction fallback: {str(e)}]"

        elif ext in (".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".py", ".sh", ".log"):
            text_content = path.read_text(encoding="utf-8", errors="replace")

        elif ext == ".docx":
            try:
                import docx
                doc = docx.Document(path)
                text_content = "\n".join(p.text for p in doc.paragraphs if p.text)
            except Exception:
                text_content = "[DOCX extraction not supported without python-docx]"
        else:
            text_content = f"Binary or unhandled format '{ext}'."

        word_count = len(text_content.split())
        preview = text_content[:500] + ("..." if len(text_content) > 500 else "")

        summary = (
            f"📄 Document: {name} ({file_size_kb} KB, {page_count} pages, ~{word_count} words)\n\n"
            f"Content Preview:\n{preview}"
        )

        return {
            "success": True,
            "file_name": name,
            "extension": ext,
            "mime_type": mime_type,
            "file_size_kb": file_size_kb,
            "page_count": page_count,
            "word_count": word_count,
            "char_count": len(text_content),
            "content": text_content,
            "extracted_text": text_content,
            "summary": summary
        }
    except Exception as e:
        logger.error(f"Error processing document {file_path}: {e}")
        return {"success": False, "error": str(e), "summary": f"Could not read document: {str(e)}"}

def process_voice_metadata(duration: int, file_size: Optional[int] = None, mime_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Format voice note metadata and duration.
    """
    minutes = duration // 60
    seconds = duration % 60
    dur_str = f"{minutes:02d}:{seconds:02d}"
    dur_verbose = f"{minutes}m {seconds}s" if minutes > 0 else f"{seconds}s"
    size_str = f"{round(file_size / 1024, 1)} KB" if file_size else "unknown size"

    return {
        "success": True,
        "duration_seconds": duration,
        "formatted_duration": dur_str,
        "formatted_duration_verbose": dur_verbose,
        "mime_type": mime_type or "audio/ogg",
        "file_size_bytes": file_size,
        "summary": f"🎙️ Voice Note received ({dur_str}, {size_str}, {mime_type or 'audio/ogg'}). Audio note registered."
    }
