import { Marked } from 'marked';
import DOMPurify from 'dompurify';

const KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|async|await|true|false|null|undefined|def|self|public|private|void|int|float|using|extends)\b/g;

/** A tiny highlighter for code blocks: strings, comments, numbers, keywords and calls. */
function highlight(code: string, lang: string): string {
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (lang === 'xml' || lang === 'html') {
    // One pass, so the spans it adds are never colored again
    return esc.replace(/(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([\w:-]+)|([\w:-]+)=("[^"]*")/g, (_m, c, open, tag, attr, val) =>
      c ? `<span class="tok-c">${c}</span>` : tag ? `${open}<span class="tok-k">${tag}</span>` : `<span class="tok-n">${attr}</span>=<span class="tok-s">${val}</span>`,
    );
  }
  // Pull strings and comments out first so keywords inside them stay plain.
  // The placeholder holds no letters or digits, so the later passes can't touch it.
  const saved: string[] = [];
  const keep = (cls: string) => (m: string) => {
    saved.push(`<span class="${cls}">${m}</span>`);
    return `\u0000${String.fromCharCode(0xe000 + saved.length - 1)}\u0000`;
  };
  let s = esc
    .replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g, keep('tok-c'))
    .replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, keep('tok-s'));
  s = s
    .replace(KEYWORDS, '<span class="tok-k">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-n">$1</span>')
    .replace(/\b([A-Za-z_]\w*)(?=\()/g, '<span class="tok-f">$1</span>');
  return s.replace(/\u0000([-])\u0000/g, (_, c: string) => saved[c.charCodeAt(0) - 0xe000]);
}

function videoEmbed(url: string): string | null {
  const yt = url.match(/^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,15})/);
  if (yt) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="Video" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
  if (/^https?:\/\/\S+\.(mp4|webm)(\?\S*)?$/i.test(url)) return `<video src="${url}" controls muted playsinline preload="metadata"></video>`;
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif)(\?\S*)?$/i.test(url)) return `<img src="${url}" alt="" loading="lazy">`;
  return null;
}

const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }) {
      return `<pre><code>${highlight(text, (lang || '').toLowerCase())}</code></pre>`;
    },
    paragraph({ tokens, raw }) {
      // A link to a picture or video alone on its line shows the picture or video
      const only = raw.trim();
      if (/^https?:\/\/\S+$/.test(only)) {
        const embed = videoEmbed(only);
        if (embed) return embed;
      }
      return `<p>${this.parser.parseInline(tokens)}</p>`;
    },
  },
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (node.tagName === 'IFRAME' && !/^https:\/\/www\.youtube-nocookie\.com\/embed\//.test(node.getAttribute('src') || '')) node.remove();
});

export function renderMarkdown(src: string): string {
  const html = md.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe', 'video'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'loading', 'controls', 'muted', 'playsinline', 'preload', 'target'],
  });
}
