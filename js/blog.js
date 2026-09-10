const markedLib = window.marked;

function blogConfig() {
  return window.BLOG || { title: "Blog", author: "Author", tagline: "" };
}

function applySiteChrome(currentPage) {
  const config = blogConfig();
  document.title = currentPage === "home" ? config.title : `${document.title} · ${config.title}`;

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

async function loadPostIndex() {
  const response = await fetch("./posts/index.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load the post list.");
  }
  const posts = await response.json();
  return posts
    .filter((post) => !post.draft)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function renderMarkdown(markdown) {
  if (!markedLib) return markdown;
  return markedLib.parse(markdown);
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

window.Blog = {
  applySiteChrome,
  formatDate,
  loadPostIndex,
  renderMarkdown,
  slugify,
  formatEngagementLine,
  loadEngagement,
  loadEngagementMap,
  recordView,
  reactionBarMarkup,
  mountReactions,
};
