import {
  db, auth, configured,
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp,
} from "./firebase.js";
import { ADMIN_EMAIL, SITE_URL, DEFAULTS } from "./config.js";
import { renderContract, downloadPdf, balanceOf, longDate, stamp, toDate } from "./contract.js";

const $ = (id) => document.getElementById(id);
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const FIELDS = [
  "clientName", "clientEmail", "clientPhone", "clientAddress",
  "eventName", "eventDate", "eventStart", "eventEnd", "eventLocation", "agreementDate",
  "coverageHours", "coverageStart", "coverageEnd", "productionServices", "deliverables",
  "totalPrice", "retainer", "balanceDue",
  "overtimeRate", "deliveryEstimate", "reviewDays", "archiveDays", "governingLaw",
  "repName", "repInitials", "repEmail", "repPhone", "businessAddress",
];

let contracts = [];
let filter = "all";
let editing = null; // pin being edited, or null for new
let viewing = null;

const views = ["login-view", "list-view", "edit-view", "view-view"];
function show(id) {
  views.forEach((v) => ($(v).hidden = v !== id));
  window.scrollTo({ top: 0 });
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 2800);
}

async function copy(text, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    prompt("Copy this:", text);
  }
}

const link = (pin) => `${SITE_URL}/?pin=${pin}`;
const inviteMsg = (c) =>
  `Hi ${String(c.clientName || "").split(" ")[0] || "there"}, your 830 Productions agreement for ${c.eventName || "your event"} is ready to review and sign.\n\n` +
  `Open: ${link(c.pin)}\nOr go to ${SITE_URL.replace(/^https?:\/\//, "")} and enter PIN ${c.pin}.\n\nThanks!\n830 Productions`;

// ---------- Auth ----------
if (!configured) {
  show("login-view");
  $("login-msg").textContent = "Firebase isn't configured yet. Paste your project's config into js/config.js (see README.md).";
  $("signin-btn").disabled = true;
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      $("user-box").hidden = true;
      return show("login-view");
    }
    $("user-box").hidden = false;
    $("user-email").textContent = user.email;
    if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      show("login-view");
      $("login-error").textContent = `${user.email} isn't authorized. Sign out and use ${ADMIN_EMAIL}.`;
      return;
    }
    $("login-error").textContent = "";
    show("list-view");
    await loadList();
  });
}

$("signin-btn").addEventListener("click", async () => {
  $("login-error").textContent = "";
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (ex) {
    if (ex.code !== "auth/popup-closed-by-user") $("login-error").textContent = ex.message;
  }
});
$("signout-btn").addEventListener("click", () => signOut(auth));

// ---------- List ----------
async function loadList() {
  $("list").innerHTML = `<div class="empty">Loading…</div>`;
  try {
    const snap = await getDocs(query(collection(db, "contracts"), orderBy("createdAt", "desc")));
    contracts = snap.docs.map((d) => ({ ...d.data(), pin: d.id }));
    renderList();
  } catch (ex) {
    console.error(ex);
    $("list").innerHTML = `<div class="empty">Couldn't load contracts: ${esc(ex.message)}</div>`;
  }
}

function renderList() {
  const signed = contracts.filter((c) => c.status === "signed").length;
  $("stats").innerHTML = `
    <div class="stat"><b>${contracts.length}</b><span>Total</span></div>
    <div class="stat"><b>${contracts.length - signed}</b><span>Awaiting</span></div>
    <div class="stat"><b>${signed}</b><span>Signed</span></div>`;

  const q = $("search").value.trim().toLowerCase();
  const rows = contracts.filter((c) => {
    if (filter !== "all" && (c.status || "pending") !== filter) return false;
    if (!q) return true;
    return [c.clientName, c.eventName, c.clientEmail, c.pin, c.eventLocation].join(" ").toLowerCase().includes(q);
  });

  if (!rows.length) {
    $("list").innerHTML = contracts.length
      ? `<div class="empty">No contracts match.</div>`
      : `<div class="empty">No contracts yet. Click <b>+ New customer</b> to create one.</div>`;
    return;
  }

  $("list").innerHTML = rows
    .map((c) => {
      const isSigned = c.status === "signed";
      const when = isSigned ? `Signed ${stamp(c.signature?.signedAt)}` : `Created ${toDate(c.createdAt)?.toLocaleDateString() || ""}`;
      return `
      <div class="item" data-pin="${esc(c.pin)}">
        <div class="item-main" data-act="view">
          <div class="item-top">
            <span class="badge ${isSigned ? "ok" : ""}">${isSigned ? "Signed" : "Awaiting"}</span>
            <span class="pin-chip" title="PIN">${esc(c.pin)}</span>
          </div>
          <div class="item-name">${esc(c.clientName || "Untitled")}</div>
          <div class="item-sub">${esc(c.eventName || "")}${c.eventDate ? ` · ${esc(longDate(c.eventDate))}` : ""}</div>
          <div class="item-when">${esc(when)}</div>
        </div>
        <div class="item-actions">
          ${isSigned
            ? `<button class="btn btn-primary btn-sm" data-act="pdf" type="button">Download signed PDF</button>`
            : `<button class="btn btn-ghost btn-sm" data-act="share" type="button">Copy invite</button>
               <button class="btn btn-ghost btn-sm" data-act="edit" type="button">Edit</button>`}
          <button class="btn btn-ghost btn-sm" data-act="view" type="button">View</button>
          <button class="btn btn-danger btn-sm" data-act="delete" type="button" aria-label="Delete">Delete</button>
        </div>
      </div>`;
    })
    .join("");
}

$("list").addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const pin = el.closest(".item").dataset.pin;
  const c = contracts.find((x) => x.pin === pin);
  if (!c) return;
  const act = el.dataset.act;
  if (act === "view") openView(c);
  if (act === "edit") openEditor(c);
  if (act === "share") copy(inviteMsg(c), "Invite message copied");
  if (act === "pdf") pdf(c, el);
  if (act === "delete") {
    const label = c.status === "signed" ? "SIGNED contract" : "contract";
    if (!confirm(`Delete the ${label} for ${c.clientName}? This can't be undone.`)) return;
    try {
      await deleteDoc(doc(db, "contracts", pin));
      contracts = contracts.filter((x) => x.pin !== pin);
      renderList();
      toast("Deleted");
    } catch (ex) {
      toast(ex.message);
    }
  }
});

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    filter = t.dataset.filter;
    renderList();
  })
);
$("search").addEventListener("input", renderList);
$("new-btn").addEventListener("click", () => openEditor(null));

async function pdf(c, btn) {
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Preparing…"; }
  try {
    await downloadPdf(c);
  } catch (ex) {
    console.error(ex);
    toast(ex.message || "Couldn't create the PDF");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

// ---------- Editor ----------
const form = $("edit-form");

function readForm() {
  const data = {};
  FIELDS.forEach((k) => (data[k] = (form.elements[k]?.value ?? "").trim()));
  return data;
}

function paintPreview() {
  const data = readForm();
  $("balance-out").value = balanceOf(data) || "";
  $("edit-preview").innerHTML = renderContract(data);
}

function openEditor(c) {
  editing = c ? c.pin : null;
  form.reset();
  $("edit-error").textContent = "";
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const src = c || { ...DEFAULTS, agreementDate: iso };
  FIELDS.forEach((k) => {
    if (form.elements[k]) form.elements[k].value = src[k] ?? "";
  });
  $("edit-eyebrow").textContent = c ? `Editing · PIN ${c.pin}` : "New customer";
  $("edit-title").textContent = c ? c.clientName || "Edit contract" : "Create contract";
  $("save-btn").textContent = c ? "Save changes" : "Save & get PIN";
  paintPreview();
  show("edit-view");
  form.elements.clientName.focus();
}

form.addEventListener("input", paintPreview);
$("cancel-btn").addEventListener("click", () => show("list-view"));

function randomPin() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
}

async function uniquePin() {
  for (let i = 0; i < 12; i++) {
    const pin = randomPin();
    const snap = await getDoc(doc(db, "contracts", pin));
    if (!snap.exists()) return pin;
  }
  throw new Error("Couldn't generate a unique PIN. Try again.");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = readForm();
  if (!data.clientName || !data.eventName) {
    $("edit-error").textContent = "Client name and event name are required.";
    return;
  }
  const btn = $("save-btn");
  btn.disabled = true;
  try {
    if (editing) {
      await updateDoc(doc(db, "contracts", editing), { ...data, updatedAt: serverTimestamp() });
      toast("Saved");
      await loadList();
      show("list-view");
    } else {
      const pin = await uniquePin();
      await setDoc(doc(db, "contracts", pin), {
        ...data,
        pin,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await loadList();
      show("list-view");
      showPinDialog({ ...data, pin });
    }
  } catch (ex) {
    console.error(ex);
    $("edit-error").textContent =
      ex.code === "permission-denied" ? "Permission denied. Signed contracts can't be edited." : ex.message;
  } finally {
    btn.disabled = false;
  }
});

function showPinDialog(c) {
  $("pd-name").textContent = c.clientName;
  $("pd-pin").textContent = c.pin.replace(/(\d{3})(\d{3})/, "$1 $2");
  $("pd-link").textContent = link(c.pin);
  $("pd-copy-pin").onclick = () => copy(c.pin, "PIN copied");
  $("pd-copy-msg").onclick = () => copy(inviteMsg(c), "Invite message copied");
  const email = $("pd-email");
  email.hidden = !c.clientEmail;
  email.href = `mailto:${encodeURIComponent(c.clientEmail || "")}?subject=${encodeURIComponent(
    "Your 830 Productions agreement"
  )}&body=${encodeURIComponent(inviteMsg(c))}`;
  $("pin-dialog").showModal();
}

// ---------- Viewer ----------
function openView(c) {
  viewing = c;
  const isSigned = c.status === "signed";
  $("view-status").textContent = isSigned ? `Signed ${stamp(c.signature?.signedAt)}` : `Awaiting signature · PIN ${c.pin}`;
  $("view-status").classList.toggle("ok", isSigned);
  $("view-title").textContent = c.clientName || "Contract";
  $("view-edit-btn").hidden = isSigned;
  $("view-share-btn").hidden = isSigned;
  $("view-pdf-btn").textContent = isSigned ? "Download signed PDF" : "Download PDF";
  $("view-paper").innerHTML = renderContract(c);
  show("view-view");
}

$("back-btn").addEventListener("click", () => show("list-view"));
$("view-edit-btn").addEventListener("click", () => openEditor(viewing));
$("view-share-btn").addEventListener("click", () => copy(inviteMsg(viewing), "Invite message copied"));
$("view-pdf-btn").addEventListener("click", (e) => pdf(viewing, e.currentTarget));
