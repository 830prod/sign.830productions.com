import { db, configured, doc, getDoc, updateDoc, serverTimestamp } from "./firebase.js";
import { renderContract, downloadPdf, TYPES, typeOf } from "./contract.js";

const $ = (id) => document.getElementById(id);
const boxes = [...$("pin-boxes").querySelectorAll("input")];
let contract = null;
let failures = 0;

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 3200);
}

// ---------- PIN entry ----------
function setPin(str) {
  const digits = String(str).replace(/\D/g, "").slice(0, 6).split("");
  boxes.forEach((b, i) => (b.value = digits[i] || ""));
  (boxes[digits.length] || boxes[5]).focus();
}

boxes.forEach((box, i) => {
  box.addEventListener("input", () => {
    const v = box.value.replace(/\D/g, "");
    if (v.length > 1) setPin(boxes.slice(0, i).map((b) => b.value).join("") + v);
    else box.value = v;
    if (v && boxes[i + 1]) boxes[i + 1].focus();
    if (boxes.every((b) => b.value)) $("pin-form").requestSubmit();
  });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !box.value && boxes[i - 1]) {
      boxes[i - 1].value = "";
      boxes[i - 1].focus();
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" && boxes[i - 1]) boxes[i - 1].focus();
    if (e.key === "ArrowRight" && boxes[i + 1]) boxes[i + 1].focus();
  });
  box.addEventListener("paste", (e) => {
    e.preventDefault();
    setPin((e.clipboardData || window.clipboardData).getData("text"));
    if (boxes.every((b) => b.value)) $("pin-form").requestSubmit();
  });
  box.addEventListener("focus", () => box.select());
});

$("pin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pin = boxes.map((b) => b.value).join("");
  const err = $("pin-error");
  err.textContent = "";
  if (!/^\d{6}$/.test(pin)) return (err.textContent = "Enter all 6 digits.");
  if (!configured) return (err.textContent = "Signing isn't set up yet. Please contact 830 Productions.");
  if (failures >= 5) return (err.textContent = "Too many attempts. Refresh the page and try again.");

  const btn = $("pin-submit");
  btn.disabled = true;
  btn.textContent = "Opening…";
  try {
    const snap = await getDoc(doc(db, "contracts", pin));
    if (!snap.exists()) {
      failures++;
      err.textContent = "That PIN didn't match a contract. Double-check it and try again.";
      boxes.forEach((b) => (b.value = ""));
      boxes[0].focus();
      return;
    }
    contract = { ...snap.data(), pin };
    showDoc();
  } catch (ex) {
    console.error(ex);
    err.textContent = "Couldn't reach the server. Check your connection and try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Open contract";
  }
});

// ---------- Document ----------
function preview() {
  return { name: $("sig-name").value.trim(), initials: $("sig-initials").value.trim() };
}

function paint() {
  if (!contract) return;
  $("paper").innerHTML = renderContract(contract, { preview: preview() });
}

function showDoc() {
  $("pin-view").hidden = true;
  $("doc-view").hidden = false;
  const signed = contract.status === "signed";
  $("doc-status").textContent = signed ? "Signed" : `Prepared for ${contract.clientName || "you"}`;
  $("doc-status").classList.toggle("ok", signed);
  $("doc-title").textContent = TYPES[typeOf(contract)].title;
  $("download-btn").hidden = !signed;
  $("signed-banner").hidden = !signed;
  $("sign-form").hidden = signed;
  if (contract.clientName) $("sig-name").placeholder = contract.clientName;
  paint();
  history.replaceState(null, "", location.pathname);
  window.scrollTo({ top: 0 });
}

function initialsOf(name) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("").slice(0, 4);
}

let initialsTouched = false;
function updatePreview() {
  const n = $("sig-name").value.trim();
  $("sig-preview").textContent = n || "Your name";
  $("sig-preview").classList.toggle("empty", !n);
}

$("sig-name").addEventListener("input", () => {
  if (!initialsTouched) $("sig-initials").value = initialsOf($("sig-name").value);
  updatePreview();
  paint();
});
$("sig-initials").addEventListener("input", () => {
  initialsTouched = true;
  paint();
});

$("sign-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("sign-error");
  err.textContent = "";
  const { name, initials } = preview();
  if (name.length < 2 || !/[a-z]/i.test(name)) return (err.textContent = "Please type your full legal name.");
  if (!initials) return (err.textContent = "Please add your initials.");
  if (!$("sig-agree").checked) return (err.textContent = "Please check the box to agree and sign.");

  const btn = $("sign-btn");
  btn.disabled = true;
  btn.textContent = "Signing…";
  try {
    const ref = doc(db, "contracts", contract.pin);
    await updateDoc(ref, {
      status: "signed",
      signature: {
        name,
        initials,
        signedAt: serverTimestamp(),
        userAgent: navigator.userAgent.slice(0, 300),
      },
    });
    const snap = await getDoc(ref);
    contract = { ...snap.data(), pin: contract.pin };
    showDoc();
    toast("Agreement signed");
  } catch (ex) {
    console.error(ex);
    err.textContent =
      ex.code === "permission-denied"
        ? "This agreement can no longer be signed. It may already be signed — reload to check."
        : "Something went wrong saving your signature. Please try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign agreement";
  }
});

$("download-btn").addEventListener("click", async () => {
  const btn = $("download-btn");
  btn.disabled = true;
  btn.textContent = "Preparing PDF…";
  try {
    await downloadPdf(contract);
  } catch (ex) {
    console.error(ex);
    toast(ex.message || "Couldn't create the PDF.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Download PDF";
  }
});

$("exit-btn").addEventListener("click", () => {
  contract = null;
  $("paper").innerHTML = "";
  $("sign-form").reset();
  initialsTouched = false;
  $("doc-view").hidden = true;
  $("pin-view").hidden = false;
  boxes.forEach((b) => (b.value = ""));
  boxes[0].focus();
});

// Support links like /?pin=123456
const qp = new URLSearchParams(location.search).get("pin");
if (qp && /^\d{6}$/.test(qp)) {
  setPin(qp);
  $("pin-form").requestSubmit();
} else {
  boxes[0].focus();
}
