function authorEmail() {
  const config = window.BLOG || {};
  return String(config.authorEmail || "").trim().toLowerCase();
}

function firebaseSettings() {
  return (window.BLOG && window.BLOG.firebase) || {};
}

function isFirebaseConfigured() {
  const cfg = firebaseSettings();
  return Boolean(cfg.apiKey && cfg.projectId && window.firebase);
}

let auth = null;
let db = null;
let started = false;

function initFirebase() {
  if (started) return Boolean(auth && db);
  started = true;
  if (!isFirebaseConfigured()) return false;
  if (!firebase.apps.length) firebase.initializeApp(firebaseSettings());
  auth = firebase.auth();
  db = firebase.firestore();
  return true;
}

function isAuthorUser(user) {
  const email = String((user && user.email) || "").trim().toLowerCase();
  return Boolean(email && email === authorEmail());
}

async function rejectIfNotAuthor(user) {
  if (isAuthorUser(user)) return user;
  if (auth) await auth.signOut();
  throw new Error(`Only ${authorEmail()} can publish.`);
}

function postFromDoc(doc) {
  const data = doc.data() || {};
  return {
    slug: doc.id,
    title: data.title || doc.id,
    date: data.date || "",
    summary: data.summary || "",
    cover: data.cover || "",
    body: data.body || "",
    draft: Boolean(data.draft),
    tags: Array.isArray(data.tags) ? data.tags : [],
    source: "cloud",
  };
}

async function loadRemotePosts() {
  if (!initFirebase()) return [];
  try {
    const snap = await db.collection("posts").where("draft", "==", false).get();
    return snap.docs.map(postFromDoc);
  } catch (error) {
    console.warn("Could not load cloud posts.", error);
    return [];
  }
}

async function loadRemotePost(slug) {
  if (!initFirebase() || !slug) return null;
  const doc = await db.collection("posts").doc(slug).get();
  if (!doc.exists) return null;
  return postFromDoc(doc);
}

async function loadAuthorPosts() {
  if (!initFirebase()) return [];
  await rejectIfNotAuthor(auth.currentUser);
  const snap = await db.collection("posts").get();
  return snap.docs
    .map(postFromDoc)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function savePost(post) {
  if (!initFirebase()) {
    throw new Error("Publishing is not configured yet. Add your Firebase keys in config.js.");
  }
  const user = await rejectIfNotAuthor(auth.currentUser);
  const slug = post.slug;
  if (!slug) throw new Error("Add a title first.");
  await db.collection("posts").doc(slug).set({
    title: post.title,
    date: post.date,
    summary: post.summary || post.title,
    cover: post.cover || "",
    body: post.body || "",
    tags: Array.isArray(post.tags) ? post.tags : [],
    draft: Boolean(post.draft),
    authorEmail: user.email,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return slug;
}

async function signInWithGoogle() {
  if (!initFirebase()) {
    throw new Error("Publishing is not configured yet. Add your Firebase keys in config.js.");
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account",
    login_hint: authorEmail(),
  });
  const result = await auth.signInWithPopup(provider);
  return rejectIfNotAuthor(result.user);
}

async function signOut() {
  if (auth) await auth.signOut();
}

function onAuth(callback) {
  if (!initFirebase()) {
    callback(null);
    return function () {};
  }
  return auth.onAuthStateChanged(async (user) => {
    if (user && !isAuthorUser(user)) {
      await auth.signOut();
      if (window.Blog) Blog.setAuthorSession(false);
      callback(null, new Error(`Only ${authorEmail()} can publish.`));
      return;
    }
    if (window.Blog) Blog.setAuthorSession(Boolean(user));
    callback(user || null);
  });
}

window.BlogPublish = {
  authorEmail,
  isConfigured: isFirebaseConfigured,
  loadRemotePosts,
  loadRemotePost,
  loadAuthorPosts,
  savePost,
  signInWithGoogle,
  signOut,
  onAuth,
  isAuthorUser,
};
