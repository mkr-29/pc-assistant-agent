"""
Web interaction, search, and crawling tools for the PC Assistant Agent with SSRF validation
and standardized responses.
"""
import re
import urllib.parse
from typing import Dict, Any, List, Optional
import httpx
from bs4 import BeautifulSoup

try:
    from tools.registry import register_tool
    from utils.response import success_response, error_response
    from security.validator import validate_url
    from utils.cache import global_cache
except ImportError:
    from src_py.tools.registry import register_tool
    from src_py.utils.response import success_response, error_response
    from src_py.security.validator import validate_url
    from src_py.utils.cache import global_cache

DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

@register_tool("fetch_web_page", "web")
async def fetch_web_page(url: str, extract_text: bool = True, max_chars: int = 6000) -> Dict[str, Any]:
    """
    Fetch a web page and extract clean text or markdown content with SSRF protection.

    Args:
        url: URL of the web page to fetch
        extract_text: Whether to strip HTML tags and return clean text
        max_chars: Maximum characters to return in content

    Returns:
        Standardized dictionary containing title, content, url, and status_code
    """
    url_val = validate_url(url)
    if not url_val["is_safe"]:
        return error_response(url_val["reason"], code="SSRF_SECURITY_BLOCK", url=url)

    clean_url = url_val["url"]
    cache_key = f"fetch_web_page:{clean_url}:{extract_text}:{max_chars}"
    cached_res = global_cache.get(cache_key)
    if cached_res is not None:
        return cached_res

    headers = {"User-Agent": DEFAULT_USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            resp = await client.get(clean_url, headers=headers)

            if resp.status_code != 200:
                return error_response(
                    f"HTTP request failed with status {resp.status_code}",
                    code="HTTP_ERROR",
                    status_code=resp.status_code,
                    url=clean_url
                )

            html = resp.text

            if not extract_text:
                return success_response(data={
                    "url": clean_url,
                    "status_code": resp.status_code,
                    "content": html[:max_chars],
                    "content_length": len(html)
                })

            soup = BeautifulSoup(html, "html.parser")

            # Remove noise elements
            for tag in soup(["script", "style", "noscript", "svg", "header", "footer", "nav", "aside"]):
                tag.decompose()

            title = (soup.title.string or "").strip() if soup.title else ""
            text = soup.get_text(separator="\n", strip=True)

            cleaned_text = re.sub(r'\n{3,}', '\n\n', text)
            truncated_text = cleaned_text[:max_chars]

            res = success_response(data={
                "url": clean_url,
                "title": title,
                "status_code": resp.status_code,
                "content": truncated_text,
                "is_truncated": len(cleaned_text) > max_chars,
                "total_chars": len(cleaned_text)
            })
            global_cache.set(cache_key, res, ttl=300.0)
            return res

    except Exception as e:
        return error_response(f"Failed to fetch {clean_url}: {str(e)}", code="FETCH_ERROR", url=clean_url)

@register_tool("search_web", "web")
async def search_web(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Search the web for information using DuckDuckGo.

    Args:
        query: Search query string
        max_results: Maximum number of search results to return (1-10)

    Returns:
        Standardized dictionary containing search query and list of result items
    """
    clean_query = query.strip() if query else ""
    if not clean_query:
        return error_response("Search query cannot be empty.", code="EMPTY_QUERY", results=[])

    limit = max(1, min(max_results, 10))
    cache_key = f"search_web:{clean_query}:{limit}"
    cached_res = global_cache.get(cache_key)
    if cached_res is not None:
        return cached_res

    search_url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(clean_query)}"
    headers = {"User-Agent": DEFAULT_USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(search_url, headers=headers)
            if resp.status_code != 200:
                return error_response(f"Search failed with status {resp.status_code}", code="SEARCH_HTTP_ERROR", results=[])

            soup = BeautifulSoup(resp.text, "html.parser")
            results = []

            for result in soup.find_all("div", class_="result"):
                if len(results) >= limit:
                    break

                title_elem = result.find("a", class_="result__a")
                snippet_elem = result.find("a", class_="result__snippet")

                if not title_elem:
                    continue

                raw_url = title_elem.get("href", "")
                title = title_elem.get_text(strip=True)
                snippet = snippet_elem.get_text(strip=True) if snippet_elem else ""

                actual_url = raw_url
                if "uddg=" in raw_url:
                    match = re.search(r'uddg=([^&]+)', raw_url)
                    if match:
                        actual_url = urllib.parse.unquote(match.group(1))

                results.append({
                    "title": title,
                    "url": actual_url,
                    "snippet": snippet
                })

            res = success_response(data={
                "query": clean_query,
                "count": len(results),
                "results": results
            })
            global_cache.set(cache_key, res, ttl=300.0)
            return res

    except Exception as e:
        return error_response(f"Error performing web search: {str(e)}", code="SEARCH_ERROR", results=[])

@register_tool("crawl_web", "web")
async def crawl_web(start_url: str, max_pages: int = 5, url_filter: str = "") -> Dict[str, Any]:
    """
    Crawl documentation or linked pages from a start URL with SSRF validation.

    Args:
        start_url: Root URL to begin crawling
        max_pages: Maximum number of pages to crawl (1-10)
        url_filter: Optional regex or substring filter for discovered links

    Returns:
        Standardized dictionary with crawled pages and their extracted content
    """
    url_val = validate_url(start_url)
    if not url_val["is_safe"]:
        return error_response(url_val["reason"], code="SSRF_SECURITY_BLOCK", pages=[])

    clean_url = url_val["url"]
    parsed_start = urllib.parse.urlparse(clean_url)
    origin = f"{parsed_start.scheme}://{parsed_start.netloc}"

    limit = max(1, min(max_pages, 10))
    visited = set()
    queue = [clean_url]
    crawled_pages = []
    headers = {"User-Agent": DEFAULT_USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            while queue and len(crawled_pages) < limit:
                current_url = queue.pop(0)
                if current_url in visited:
                    continue
                visited.add(current_url)

                try:
                    target_val = validate_url(current_url)
                    if not target_val["is_safe"]:
                        continue

                    resp = await client.get(target_val["url"], headers=headers)
                    if resp.status_code != 200:
                        continue

                    content_type = resp.headers.get("content-type", "")
                    if "text/html" not in content_type:
                        continue

                    soup = BeautifulSoup(resp.text, "html.parser")
                    for tag in soup(["script", "style", "nav", "footer"]):
                        tag.decompose()

                    title = (soup.title.string or "").strip() if soup.title else current_url
                    text = soup.get_text(separator="\n", strip=True)
                    cleaned = re.sub(r'\n{3,}', '\n\n', text)[:2500]

                    crawled_pages.append({
                        "url": current_url,
                        "title": title,
                        "character_count": len(cleaned),
                        "preview": cleaned[:300]
                    })

                    # Discover internal links
                    for a in soup.find_all("a", href=True):
                        href = a["href"].strip()
                        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
                            continue

                        resolved = urllib.parse.urljoin(current_url, href)
                        if resolved.startswith(origin) and resolved not in visited:
                            if not url_filter or re.search(url_filter, resolved, re.I):
                                queue.append(resolved)

                except Exception:
                    continue

        return success_response(data={
            "start_url": clean_url,
            "pages_crawled": len(crawled_pages),
            "pages": crawled_pages
        })

    except Exception as e:
        return error_response(f"Error crawling {clean_url}: {str(e)}", code="CRAWL_ERROR", pages=[])

@register_tool("parse_sitemap", "web")
async def parse_sitemap(sitemap_url: str) -> Dict[str, Any]:
    """
    Parse an XML sitemap into a list of URLs with SSRF protection.

    Args:
        sitemap_url: URL to the sitemap XML

    Returns:
        Standardized dictionary with list of URLs found in sitemap
    """
    url_val = validate_url(sitemap_url)
    if not url_val["is_safe"]:
        return error_response(url_val["reason"], code="SSRF_SECURITY_BLOCK", urls=[])

    clean_url = url_val["url"]
    headers = {"User-Agent": DEFAULT_USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(clean_url, headers=headers)
            if resp.status_code != 200:
                return error_response(f"Failed to fetch sitemap: HTTP {resp.status_code}", code="HTTP_ERROR", urls=[])

            soup = BeautifulSoup(resp.text, features="xml")
            loc_tags = soup.find_all("loc")
            urls = [tag.get_text(strip=True) for tag in loc_tags if tag.get_text(strip=True)]

            return success_response(data={
                "sitemap_url": clean_url,
                "total_urls": len(urls),
                "urls": urls[:100]
            })

    except Exception as e:
        return error_response(f"Error parsing sitemap: {str(e)}", code="PARSE_ERROR", urls=[])
