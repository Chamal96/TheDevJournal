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

window.Blog = {
  applySiteChrome,
  formatDate,
  loadPostIndex,
  renderMarkdown,
  slugify,
};
