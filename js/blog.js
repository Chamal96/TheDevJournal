const markedLib = window.marked;

if (markedLib && typeof markedLib.setOptions === "function") {
  markedLib.setOptions({
    gfm: true,
    breaks: false,
  });
}

function blogConfig() {
  return window.BLOG || { title: "Blog", author: "Author", tagline: "" };
}

const THEME_KEY = "tdj-theme";

function storedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark") return value;
  } catch (error) {
    // Ignore private-mode storage failures.
  }
  return "";
}

function currentTheme() {
  return (
    storedTheme() ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    // Ignore private-mode storage failures.
  }

  const button = document.querySelector(".theme-toggle");
  if (!button) return;
  const next = theme === "dark" ? "light" : "dark";
  button.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  button.setAttribute("aria-label", `Switch to ${next} mode`);
  button.title = `Switch to ${next} mode`;
}

function mountThemeToggle() {
  const wrap = document.querySelector(".site-header .wrap");
  if (!wrap || wrap.querySelector(".theme-toggle")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";
  button.innerHTML = `
    <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M6.2 17.8l1.4-1.4M16.4 7.6l1.4-1.4"></path></svg>
    <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21 14.5A8.5 8.5 0 1111.5 3 7 7 0 0021 14.5z"></path></svg>
  `;
  button.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  });

  const brand = wrap.querySelector(".brand");
  if (brand) {
    const top = document.createElement("div");
    top.className = "header-top";
    brand.replaceWith(top);
    top.append(brand, button);
  } else {
    wrap.prepend(button);
  }

  applyTheme(currentTheme());
}

function applySiteChrome(currentPage) {
  const config = blogConfig();
  document.title = currentPage === "home" ? config.title : `${document.title} · ${config.title}`;
  mountThemeToggle();
  mountWriteNav(currentPage);

  document.querySelectorAll("[data-blog-title]").forEach((el) => {
    el.textContent = config.title;
  });
  document.querySelectorAll("[data-blog-tagline]").forEach((el) => {
    el.textContent = config.tagline;
  });
  document.querySelectorAll("[data-blog-author]").forEach((el) => {
    el.textContent = config.author;
  });
  document.querySelectorAll("[data-blog-footer]").forEach((el) => {
    el.textContent = config.footer || `${config.title} · ${config.author}`;
  });

  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.getAttribute("data-nav") === currentPage) {
      link.setAttribute("aria-current", "page");
    }
  });

  if (window.BlogPublish && BlogPublish.isConfigured() && BlogPublish.onAuth) {
    BlogPublish.onAuth((user) => {
      setAuthorSession(Boolean(user));
    });
  }
}

const AUTHOR_SESSION_KEY = "tdj-author";
let chromePage = "";

function hasAuthorSession() {
  try {
    return localStorage.getItem(AUTHOR_SESSION_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function setAuthorSession(on) {
  try {
    if (on) localStorage.setItem(AUTHOR_SESSION_KEY, "1");
    else localStorage.removeItem(AUTHOR_SESSION_KEY);
  } catch (error) {
    // Ignore private-mode storage failures.
  }
  mountWriteNav(chromePage);
}

function mountWriteNav(currentPage) {
  chromePage = currentPage || chromePage;
  const nav = document.querySelector("nav.nav");
  if (!nav) return;

  const existing = nav.querySelector('[data-nav="write"]');
  if (!hasAuthorSession()) {
    if (existing) existing.remove();
    return;
  }

  if (existing) {
    if (chromePage === "write") existing.setAttribute("aria-current", "page");
    else existing.removeAttribute("aria-current");
    return;
  }

  const link = document.createElement("a");
  link.href = "./write.html";
  link.setAttribute("data-nav", "write");
  link.textContent = "Write";
  nav.appendChild(link);
  if (chromePage === "write") {
    link.setAttribute("aria-current", "page");
  }
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function topicList() {
  const topics = blogConfig().topics;
  if (Array.isArray(topics) && topics.length) return topics;
  return [
    "Artificial Intelligence",
    "Machine Learning",
    "AWS",
    "Data Engineering",
    "Data Science",
    "Software",
  ];
}

function postTags(post) {
  return (Array.isArray(post && post.tags) ? post.tags : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean);
}

function postMatchesTopic(post, topic) {
  if (!topic || topic === "all") return true;
  const wanted = String(topic).toLowerCase();
  return postTags(post).some((tag) => tag.toLowerCase() === wanted);
}

async function loadFilePosts() {
  const response = await fetch("./posts/index.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load the post list.");
  }
  return response.json();
}

function mergePostLists(local, remote) {
  const map = new Map();
  local.forEach((post) => map.set(post.slug, post));
  remote.forEach((post) => {
    map.set(post.slug, { ...map.get(post.slug), ...post });
  });
  return [...map.values()]
    .filter((post) => !post.draft)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function loadPostIndex() {
  const local = await loadFilePosts();
  const remote =
    window.BlogPublish && BlogPublish.loadRemotePosts
      ? await BlogPublish.loadRemotePosts()
      : [];
  return mergePostLists(local, remote);
}

async function loadPostBody(post) {
  if (post && String(post.body || "").trim()) return post.body;
  if (post && post.source === "cloud") {
    if (window.BlogPublish && BlogPublish.loadRemotePost) {
      const full = await BlogPublish.loadRemotePost(post.slug);
      if (full && full.body) return full.body;
    }
    throw new Error("The post file could not be loaded.");
  }

  const response = await fetch(`./posts/${encodeURIComponent(post.slug)}.md`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("The post file could not be loaded.");
  }
  return response.text();
}

function renderMarkdown(markdown) {
  if (!markedLib) return markdown;
  if (typeof markedLib.parse === "function") return markedLib.parse(markdown);
  if (typeof markedLib === "function") return markedLib(markdown);
  return markdown;
}

const LANG_ALIASES = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
};

const LANG_KEYWORDS = {
  python:
    "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield",
  javascript:
    "async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof var void while yield",
  typescript:
    "as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function if import in infer instanceof interface let new null of return static super switch this throw true try type typeof var void while yield",
  sql: "add and alter as asc by case create delete desc distinct drop else end exists from group having in inner insert into is join left like limit not null on or order outer right select set table then union update values when where",
  bash: "alias break case do done elif else esac export fi for function if in return then until while",
};

const PYTHON_BUILTINS =
  "abs dict enumerate float int len list max min open print range set str sum tuple type zip";

function languageFromClass(block) {
  const langClass = [...block.classList].find((name) => name.startsWith("language-"));
  return langClass ? langClass.replace("language-", "").toLowerCase() : "";
}

function normalizeLang(lang) {
  const key = String(lang || "").toLowerCase();
  return LANG_ALIASES[key] || key;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tokenSpan(type, text) {
  return `<span class="hljs-${type}">${escapeHtml(text)}</span>`;
}

function highlightFallback(source, lang) {
  const holes = [];
  const plug = (html) => {
    const token = `__HLJS_HOLE_${holes.length}__`;
    holes.push(html);
    return token;
  };

  let text = String(source);
  lang = normalizeLang(lang);

  if (lang === "python") {
    text = text.replace(/('''[\s\S]*?'''|"""[\s\S]*?""")/g, (match) => plug(tokenSpan("string", match)));
    text = text.replace(/#.*$/gm, (match) => plug(tokenSpan("comment", match)));
  } else if (lang === "sql") {
    text = text.replace(/\/\*[\s\S]*?\*\//g, (match) => plug(tokenSpan("comment", match)));
    text = text.replace(/--.*$/gm, (match) => plug(tokenSpan("comment", match)));
  } else {
    text = text.replace(/\/\*[\s\S]*?\*\//g, (match) => plug(tokenSpan("comment", match)));
    text = text.replace(/\/\/.*$/gm, (match) => plug(tokenSpan("comment", match)));
    if (lang === "bash" || !lang) {
      text = text.replace(/(^|[\s])(#.*)$/gm, (_, lead, comment) => lead + plug(tokenSpan("comment", comment)));
    }
  }

  text = text.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, (match) => plug(tokenSpan("string", match)));
  text = text.replace(
    /\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g,
    (match) => plug(tokenSpan("number", match))
  );

  if (lang === "python") {
    text = text.replace(/\b(def|class)\s+([A-Za-z_]\w*)/g, (_, keyword, name) => {
      return `${keyword} ${plug(tokenSpan("title", name))}`;
    });
  }

  const keywords = LANG_KEYWORDS[lang];
  if (keywords) {
    const pattern = new RegExp(`\\b(?:${keywords.trim().split(/\s+/).join("|")})\\b`, "g");
    text = text.replace(pattern, (match) => plug(tokenSpan("keyword", match)));
  }

  if (lang === "python") {
    const builtins = new RegExp(`\\b(?:${PYTHON_BUILTINS.split(/\s+/).join("|")})\\b`, "g");
    text = text.replace(builtins, (match) => plug(tokenSpan("built_in", match)));
  }

  return escapeHtml(text).replace(/__HLJS_HOLE_(\d+)__/g, (_, index) => holes[Number(index)]);
}

function highlightWithLibrary(source, lang) {
  const hljs = window.hljs;
  if (!hljs) return "";
  const language = normalizeLang(lang);
  try {
    let value = "";
    if (language && typeof hljs.getLanguage === "function" && hljs.getLanguage(language)) {
      value = hljs.highlight(source, { language, ignoreIllegals: true }).value;
    } else if (typeof hljs.highlightAuto === "function") {
      value = hljs.highlightAuto(source).value;
    }
    if (value && value.includes("hljs-")) return value;
  } catch (error) {
    console.warn("Could not highlight a code block.", error);
  }
  return "";
}

function highlightCode(root) {
  if (!root) return;

  root.querySelectorAll("pre code").forEach((block) => {
    if (block.dataset.highlighted === "yes") return;
    const source = block.textContent;
    const lang = languageFromClass(block);
    const html = highlightWithLibrary(source, lang) || highlightFallback(source, lang);
    block.innerHTML = html;
    block.classList.add("hljs");
    if (lang) block.classList.add(`language-${normalizeLang(lang)}`);
    block.dataset.highlighted = "yes";
  });

  root.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".code-lang")) return;
    const code = pre.querySelector("code");
    const lang = code && languageFromClass(code);
    if (!lang) return;
    const label = document.createElement("span");
    label.className = "code-lang";
    label.textContent = normalizeLang(lang);
    pre.prepend(label);
  });
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const REACTION_API = "https://abacus.jasoncameron.dev";
const VOTE_PREFIX = "tdj-vote:";
const VIEW_PREFIX = "tdj-viewed:";

function reactionNamespace() {
  return blogConfig().reactionNamespace || "the-dev-journal";
}

function counterKey(slug, kind) {
  return `${slug}--${kind}`;
}

function voteStorageKey(slug) {
  return `${VOTE_PREFIX}${slug}`;
}

function getStoredVote(slug) {
  try {
    return localStorage.getItem(voteStorageKey(slug));
  } catch (error) {
    return null;
  }
}

function storeVote(slug, kind) {
  try {
    localStorage.setItem(voteStorageKey(slug), kind);
  } catch (error) {
    // Ignore private-mode storage failures.
  }
}

function hasRecordedView(slug) {
  try {
    return Boolean(localStorage.getItem(`${VIEW_PREFIX}${slug}`));
  } catch (error) {
    return false;
  }
}

function markViewRecorded(slug) {
  try {
    localStorage.setItem(`${VIEW_PREFIX}${slug}`, "1");
  } catch (error) {
    // Ignore private-mode storage failures.
  }
}

function plural(count, word) {
  const n = Number(count) || 0;
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatEngagementLine({ likes = 0, dislikes = 0, views = 0 } = {}) {
  return `${plural(views, "view")} · ${plural(likes, "like")} · ${plural(dislikes, "dislike")}`;
}

async function readCounter(kind, slug) {
  const namespace = encodeURIComponent(reactionNamespace());
  const key = encodeURIComponent(counterKey(slug, kind));
  try {
    const response = await fetch(`${REACTION_API}/get/${namespace}/${key}`, {
      cache: "no-store",
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return Number(data.value) || 0;
  } catch (error) {
    return 0;
  }
}

async function hitCounter(kind, slug) {
  const namespace = encodeURIComponent(reactionNamespace());
  const key = encodeURIComponent(counterKey(slug, kind));
  const response = await fetch(`${REACTION_API}/hit/${namespace}/${key}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Could not save that reaction.");
  }
  const data = await response.json();
  return Number(data.value) || 0;
}

async function loadEngagement(slug) {
  const [likes, dislikes, views] = await Promise.all([
    readCounter("likes", slug),
    readCounter("dislikes", slug),
    readCounter("views", slug),
  ]);
  return { likes, dislikes, views };
}

async function loadEngagementMap(slugs) {
  const entries = await Promise.all(
    slugs.map(async (slug) => [slug, await loadEngagement(slug)])
  );
  return Object.fromEntries(entries);
}

async function recordView(slug) {
  if (hasRecordedView(slug)) {
    return readCounter("views", slug);
  }
  try {
    const views = await hitCounter("views", slug);
    markViewRecorded(slug);
    return views;
  } catch (error) {
    return readCounter("views", slug);
  }
}

function setReactionState(bar, { likes, dislikes, vote, busy, status }) {
  const likeCount = bar.querySelector('[data-count="likes"]');
  const dislikeCount = bar.querySelector('[data-count="dislikes"]');
  const statusEl = bar.querySelector("[data-reaction-status]");
  const buttons = bar.querySelectorAll("[data-reaction]");

  if (likeCount && likes != null) likeCount.textContent = String(likes);
  if (dislikeCount && dislikes != null) dislikeCount.textContent = String(dislikes);
  if (statusEl && status != null) statusEl.textContent = status;

  buttons.forEach((button) => {
    const kind = button.getAttribute("data-reaction");
    button.setAttribute("aria-pressed", vote === kind ? "true" : "false");
    button.disabled = Boolean(busy);
  });
}

function reactionBarMarkup() {
  return `
    <div class="reaction-bar">
      <p class="reaction-prompt">Did this note help?</p>
      <div class="reaction-actions">
        <button type="button" class="reaction-btn" data-reaction="like" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M2 21h4V9H2zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 2 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
          <span>Like</span>
          <span class="reaction-count" data-count="likes">0</span>
        </button>
        <button type="button" class="reaction-btn" data-reaction="dislike" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M22 3h-4v12h4zM2.17 11.12C2.06 11.37 2 11.64 2 11.92v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2H6.16c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v.12z"/></svg>
          <span>Dislike</span>
          <span class="reaction-count" data-count="dislikes">0</span>
        </button>
      </div>
      <p class="reaction-status muted" data-reaction-status></p>
    </div>
  `;
}

async function mountReactions(bar, slug) {
  let engagement = await loadEngagement(slug);
  let vote = getStoredVote(slug);

  setReactionState(bar, {
    likes: engagement.likes,
    dislikes: engagement.dislikes,
    vote,
    status: vote ? "You already reacted from this browser." : "",
  });

  bar.querySelectorAll("[data-reaction]").forEach((button) => {
    button.addEventListener("click", async () => {
      const kind = button.getAttribute("data-reaction");
      if (vote) {
        setReactionState(bar, {
          vote,
          status: "Each browser can like or dislike a post once.",
        });
        return;
      }

      setReactionState(bar, { vote, busy: true, status: "Saving…" });
      try {
        const nextCount = await hitCounter(kind === "like" ? "likes" : "dislikes", slug);
        vote = kind;
        storeVote(slug, kind);
        if (kind === "like") engagement.likes = nextCount;
        else engagement.dislikes = nextCount;
        setReactionState(bar, {
          likes: engagement.likes,
          dislikes: engagement.dislikes,
          vote,
          busy: false,
          status: "Thanks — counted.",
        });
      } catch (error) {
        setReactionState(bar, {
          vote,
          busy: false,
          status: error.message || "Could not save that reaction.",
        });
      }
    });
  });

  return engagement;
}

function coverUrl(cover) {
  const value = String(cover || "").trim();
  if (!value || /^(javascript|data):/i.test(value)) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `./${value.replace(/^\.\/+/, "")}`;
}

function coverMarkup(post, className) {
  const src = coverUrl(post && post.cover);
  if (!src) return "";
  return `<img class="${className}" src="${src}" alt="" />`;
}

window.Blog = {
  applySiteChrome,
  formatDate,
  loadPostIndex,
  loadPostBody,
  renderMarkdown,
  highlightCode,
  slugify,
  topicList,
  postTags,
  postMatchesTopic,
  formatEngagementLine,
  loadEngagement,
  loadEngagementMap,
  recordView,
  reactionBarMarkup,
  mountReactions,
  coverUrl,
  coverMarkup,
  setAuthorSession,
};
