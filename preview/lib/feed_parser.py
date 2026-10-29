"""Parse bounded public RSS/Atom from stdin; no network, files, or dependencies."""
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import urljoin


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        elif tag in ("p", "div", "br", "li", "h1", "h2", "h3") and not self.hidden:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)
        elif tag in ("p", "div", "li") and not self.hidden:
            self.parts.append(" ")

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def plain(value, limit):
    parser = PlainText()
    parser.feed(value)
    text = html.unescape("".join(parser.parts))
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    text = " ".join(text.split())
    return text[:limit]


def local(tag):
    return tag.rsplit("}", 1)[-1].lower()


def field(entry, *names):
    for name in names:
        for child in entry:
            if local(child.tag) == name:
                # Atom XHTML can contain real child nodes rather than escaped HTML.
                if len(child):
                    return " ".join(child.itertext())
                return child.text or ""
    return ""


def parse(raw):
    if len(raw) > 1536 * 1024:
        raise ValueError("Feed exceeds the size limit")
    # Reject all DTD/entity declarations before parsing. ElementTree does not
    # resolve external entities; this also blocks internal entity expansions.
    scan = raw.decode("utf-8", errors="ignore").replace("\x00", "")
    if re.search(r"<!\s*(DOCTYPE|ENTITY)\b", scan, re.I):
        raise ValueError("DTD and entity declarations are not accepted")
    root = ET.fromstring(raw)
    if local(root.tag) not in ("rss", "feed", "rdf"):
        raise ValueError("Response is not RSS or Atom")
    entries = [el for el in root.iter() if local(el.tag) in ("entry", "item")]
    items = []
    for entry in entries[:100]:
        link = ""
        if local(entry.tag) == "entry":
            for child in entry:
                if local(child.tag) == "link" and child.attrib.get("rel", "alternate") == "alternate":
                    link = child.attrib.get("href", "")
                    break
        else:
            link = field(entry, "link")
        if not link:
            continue
        base = entry.attrib.get("{http://www.w3.org/XML/1998/namespace}base", "")
        link = urljoin(base, link.strip())
        items.append({
            "title": plain(field(entry, "title"), 240),
            "url": link,
            "publishedAt": field(entry, "published", "pubdate", "date", "updated").strip() or None,
            "summary": plain(field(entry, "description", "summary", "content", "encoded"), 280),
        })
    return items


if __name__ == "__main__":
    try:
        result = parse(sys.stdin.buffer.read(1536 * 1024 + 1))
        print(json.dumps(result, ensure_ascii=False))
    except (ET.ParseError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
