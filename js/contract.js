// Renders the 830 Productions Videography Services Agreement from a contract
// record, and exports it to PDF. Text mirrors the master .docx contract.

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Wraps a filled-in value; empty values render as a highlighted blank.
function f(value, blank = "________") {
  const v = String(value ?? "").trim();
  return v ? `<span class="k-fill">${esc(v)}</span>` : `<span class="k-fill k-missing">${blank}</span>`;
}

export function money(v) {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  if (v === "" || v == null || Number.isNaN(n)) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function balanceOf(c) {
  const t = Number(String(c.totalPrice ?? "").replace(/[^0-9.\-]/g, ""));
  const r = Number(String(c.retainer ?? "").replace(/[^0-9.\-]/g, ""));
  if (!c.totalPrice || Number.isNaN(t)) return "";
  return money(t - (Number.isNaN(r) ? 0 : r));
}

export function longDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function time12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (Number.isNaN(h)) return String(hhmm);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${ap}`;
}

export function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

export function stamp(ts) {
  const d = toDate(ts);
  return d
    ? d.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    : "";
}

function field(label, value, blank) {
  return `<div class="k-field"><div class="k-label">${label}</div><div class="k-val">${f(value, blank)}</div></div>`;
}

function eventWhen(c) {
  const parts = [];
  if (c.eventDate) parts.push(longDate(c.eventDate));
  if (c.eventStart || c.eventEnd) parts.push([time12(c.eventStart), time12(c.eventEnd)].filter(Boolean).join(" – "));
  if (c.eventLocation) parts.push(c.eventLocation);
  return parts.join(" · ");
}

function sigLine(label, inner, cls = "") {
  return `<div class="k-sigrow ${cls}"><div class="k-label">${label}</div><div class="k-sigval">${inner}</div></div>`;
}

/**
 * @param {object} c contract record
 * @param {object} [opts]
 * @param {object} [opts.preview] unsigned signature to preview {name, initials}
 */
export function renderContract(c, opts = {}) {
  const sig = c.signature || null;
  const preview = !sig && opts.preview && opts.preview.name ? opts.preview : null;
  const shown = sig || preview;
  const signedAt = sig ? stamp(sig.signedAt) : "";
  const signedDate = sig ? toDate(sig.signedAt)?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const pending = `<span class="k-awaiting">Awaiting signature</span>`;

  const clientSig = shown
    ? `<span class="k-script${preview ? " k-preview" : ""}">${esc(shown.name)}</span>`
    : pending;
  const clientInitials = shown
    ? `<span class="k-script k-initials${preview ? " k-preview" : ""}">${esc(shown.initials || "")}</span>`
    : pending;

  return `
<article class="contract">
  <header class="k-head">
    <img class="k-logo" src="assets/logo-doc.png" width="640" height="374" alt="830 Productions">
    <div class="k-titles">
      <div class="k-eyebrow">830 PRODUCTIONS</div>
      <h1>Videography Services Agreement</h1>
      <div class="k-sub">PROFESSIONAL SERVICE CONTRACT</div>
    </div>
  </header>

  <div class="k-grid">
    ${field("AGREEMENT DATE", longDate(c.agreementDate), "Month / Day / Year")}
    ${field("CLIENT", c.clientName, "Client Full Name / Company")}
    ${field("EVENT / PROJECT", c.eventName, "Event Name / Description")}
    ${field("EVENT DATE &amp; LOCATION", eventWhen(c), "Date, Start Time, End Time, Location")}
  </div>

  <p>This Videography Services Agreement (the “Agreement”) is entered into by and between 830 Productions (“Videographer”) and the client identified above (“Client”). The parties agree to the following terms and conditions.</p>

  <section>
    <h2>1. SERVICES &amp; SCOPE</h2>
    <p>Videographer will provide professional video production services for the Event / Project described above and according to the package or proposal selected by Client.</p>
    <ul>
      <li>Coverage hours: ${f(c.coverageHours ? `${c.coverageHours} hours` : "", "____ hours")}, beginning at ${f(time12(c.coverageStart), "____")} and ending at ${f(time12(c.coverageEnd), "____")}.</li>
      <li>Production services: ${f(c.productionServices, "single/multi-camera coverage, audio capture, lighting, etc.")}.</li>
      <li>Deliverables: ${f(c.deliverables, "final video(s), highlight film, social clips, photographs, etc.")}.</li>
      <li>Delivery method: digital download and/or online gallery.</li>
      <li>Any service, deliverable, location, or production requirement not expressly listed is outside the agreed scope and may incur an additional fee.</li>
    </ul>
    <p>Videographer retains reasonable creative discretion regarding camera placement, framing, lighting, audio capture, editing, color treatment, pacing, music selection, and overall artistic style, subject to the agreed deliverables.</p>
  </section>

  <section>
    <h2>2. FEES &amp; PAYMENT</h2>
    <div class="k-grid">
      ${field("TOTAL CONTRACT PRICE", money(c.totalPrice), "$__________")}
      ${field("NON-REFUNDABLE RETAINER", money(c.retainer), "$__________")}
      ${field("REMAINING BALANCE", balanceOf(c), "$__________")}
      ${field("BALANCE DUE", c.balanceDue, "____ days before event / other")}
    </div>
    <p>The date and production time are not reserved until the required retainer has been received and this Agreement has been signed by both parties. Unless otherwise stated in writing, all amounts are due by the dates specified above.</p>
    <p>Late balances may be assessed a late fee of 5% of the overdue amount, to the extent permitted by applicable law, plus reasonable collection costs. Videographer may suspend work or withhold delivery of final materials while an account remains materially past due.</p>
  </section>

  <section>
    <h2>3. CANCELLATION &amp; RESCHEDULING</h2>
    <p>Client cancellations must be submitted in writing. The retainer is non-refundable because it compensates Videographer for reserving the date and declining other work.</p>
    <ul>
      <li>Cancellation more than 30 days before the Event: retainer is retained; no additional cancellation fee is due unless otherwise stated in the proposal.</li>
      <li>Cancellation 11–30 days before the Event: Client is responsible for 20% of the total contract price, less amounts already paid.</li>
      <li>Cancellation 10 days or fewer before the Event: Client is responsible for 50% of the total contract price, less amounts already paid.</li>
      <li>Rescheduling is subject to Videographer’s availability and must be requested in writing. A $100 rescheduling fee may apply, plus documented non-refundable third-party costs.</li>
    </ul>
    <p>If Videographer is unable to perform because of serious illness, emergency, or another circumstance that makes performance reasonably impossible, Videographer will provide notice as soon as practicable and refund amounts paid for services not performed. This refund is the Client’s exclusive monetary remedy for such cancellation, except where prohibited by law.</p>
  </section>

  <section>
    <h2>4. PRODUCTION DELAYS, OVERTIME &amp; TRAVEL</h2>
    <ul>
      <li>Client is responsible for providing timely access to the venue, subjects, and scheduled activities.</li>
      <li>Delays caused by Client, venue restrictions, guests, traffic, or other third parties do not automatically extend coverage.</li>
      <li>Additional coverage may be purchased at ${f(money(c.overtimeRate), "$____")}/hour, subject to Videographer’s availability.</li>
      <li>Travel, parking, tolls, lodging, permits, special equipment, or other project expenses not included in the package may be billed when disclosed or reasonably required.</li>
      <li>For coverage exceeding 6 consecutive hours, Client will provide a reasonable meal or reimburse a reasonable meal expense for the Videographer and crew.</li>
    </ul>
  </section>

  <section>
    <h2>5. DELIVERABLES, EDITING &amp; REVISIONS</h2>
    <p>Final edited deliverables are expected within ${f(c.deliveryEstimate, "4–6 weeks")} following the Event, provided Client has supplied all required materials and approvals. Delivery estimates are not guaranteed deadlines unless expressly stated as a guaranteed delivery date in writing.</p>
    <ul>
      <li>Included revisions: 1 round of reasonable revisions to the final edit.</li>
      <li>Additional revisions, re-edits, alternate versions, or changes requested after approval may be billed at $100/hour or the applicable rate listed in the proposal.</li>
      <li>A revision round means one consolidated list of requested changes submitted by Client within the review period.</li>
      <li>Rush delivery, if available, may be subject to an additional fee.</li>
    </ul>
    <p>Client is responsible for reviewing deliverables promptly and reporting technical issues or requested revisions within ${f(c.reviewDays, "7")} days of delivery. Once a deliverable has been approved, substantial re-editing may be treated as a new service.</p>
  </section>

  <section>
    <h2>6. RAW FOOTAGE, FILES &amp; ARCHIVING</h2>
    <p>Unless expressly purchased or agreed in writing, raw footage, project files, source files, editing timelines, proxies, unused takes, and production files remain the property of 830 Productions and are not included in the final deliverables.</p>
    <p>Videographer will use reasonable care when storing project files but does not guarantee indefinite archival storage. Client is responsible for downloading and securely backing up delivered materials. Unless otherwise agreed, Videographer may delete project files after ${f(c.archiveDays ? `${c.archiveDays} days` : "", "90 days")} following final delivery.</p>
  </section>

  <section>
    <h2>7. INTELLECTUAL PROPERTY &amp; LICENSE</h2>
    <p>Copyright and ownership of raw footage and production materials remain with Videographer unless a separate written transfer is executed. Upon full payment, Client receives a perpetual, non-exclusive license to use the final delivered media for personal, internal, and promotional purposes.</p>
    <p>Client may not resell, sublicense, materially alter, or transfer the final media for commercial exploitation beyond the agreed purpose without written permission, except where such restriction is prohibited by law.</p>
    <p>Videographer retains the right to display completed work and excerpts for portfolio, website, social media, advertising, competitions, and other promotional purposes unless Client and Videographer agree in writing to a privacy or non-promotional restriction before production.</p>
  </section>

  <section>
    <h2>8. MUSIC, THIRD-PARTY MATERIALS &amp; CLIENT CONTENT</h2>
    <p>Videographer will use music, graphics, fonts, stock media, or other third-party materials subject to applicable licenses. Client acknowledges that platform availability and third-party licensing rules can change after delivery.</p>
    <p>Client represents that it has permission to provide Videographer with any photographs, logos, recordings, music, trademarks, footage, or other materials supplied by Client. Client is responsible for claims arising from materials supplied without the necessary rights or permissions.</p>
  </section>

  <section>
    <h2>9. CLIENT RESPONSIBILITIES</h2>
    <ul>
      <li>Obtain venue permissions, filming permits, access credentials, and other required clearances unless expressly assigned to Videographer.</li>
      <li>Provide accurate schedules, addresses, contact information, and key-event details.</li>
      <li>Identify important moments that must be captured, including speeches, performances, entrances, ceremonies, or other scheduled events.</li>
      <li>Ensure reasonable access and a safe working environment for Videographer, crew, and equipment.</li>
      <li>Inform guests, performers, speakers, and other relevant participants that recording may occur and obtain permissions required by the venue or applicable law.</li>
      <li>Prevent guests or other persons from intentionally obstructing cameras, audio equipment, lighting, or crew.</li>
      <li>Designate a reliable day-of point of contact when appropriate.</li>
    </ul>
  </section>

  <section>
    <h2>10. CREATIVE LIMITATIONS &amp; NO GUARANTEE</h2>
    <p>Videography is an observational and creative service. Videographer cannot guarantee that every guest, moment, detail, or event will be recorded. Missed footage may result from timing, blocked sightlines, lighting, audio conditions, venue rules, guest interference, equipment limitations, safety concerns, or circumstances outside Videographer’s reasonable control.</p>
    <p>Videographer will make reasonable professional efforts to produce a high-quality result but does not guarantee a particular artistic style, emotional reaction, social-media performance, audience response, or outcome.</p>
  </section>

  <section>
    <h2>11. WEATHER, VENUE &amp; SAFETY</h2>
    <p>Videographer may modify equipment, positioning, schedule, or coverage when conditions create a reasonable risk of injury or equipment damage. Outdoor coverage may be moved, delayed, shortened, or cancelled when weather or environmental conditions make filming unsafe or impracticable.</p>
    <p>Client is responsible for obtaining a safe location for equipment and crew. Videographer may refuse or stop work when a situation presents a reasonable threat to personal safety or equipment, including violence, hazardous conditions, unlawful activity, or unsafe crowd behavior.</p>
  </section>

  <section>
    <h2>12. LIMITATION OF LIABILITY</h2>
    <p>Videographer will take reasonable precautions to protect equipment and capture the Event. If equipment failure, data corruption, accident, or another unforeseen event materially prevents delivery, Videographer’s liability will be limited, to the maximum extent permitted by law, to the amount actually paid by Client for the affected services.</p>
    <p>Videographer will not be liable for indirect, incidental, consequential, special, or punitive damages, including lost profits, lost opportunities, reputational loss, or emotional distress, except where such limitation is prohibited by applicable law.</p>
  </section>

  <section>
    <h2>13. FORCE MAJEURE</h2>
    <p>Neither party will be considered in breach for a failure or delay caused by circumstances beyond reasonable control, including natural disasters, severe weather, fire, widespread utility or communications failures, government orders, labor disruptions, venue closure, civil emergencies, or other comparable events. The affected party will provide notice when reasonably practicable and the parties will attempt in good faith to reschedule or otherwise resolve the affected services.</p>
  </section>

  <section>
    <h2>14. INDEMNIFICATION</h2>
    <p>To the extent permitted by law, Client agrees to indemnify and hold harmless 830 Productions and its personnel from third-party claims, damages, losses, or reasonable expenses arising from Client’s breach of this Agreement, Client-provided materials, failure to obtain required permissions, or unsafe conditions under Client’s control, except to the extent caused by Videographer’s negligence or willful misconduct.</p>
  </section>

  <section>
    <h2>15. PRIVACY, RELEASES &amp; PUBLICITY</h2>
    <p>Client is responsible for identifying any participant who must not be recorded and for communicating applicable restrictions before filming. Videographer will make reasonable efforts to honor clearly communicated restrictions but cannot guarantee exclusion of every person from incidental background footage at public or crowded events.</p>
    <p>Any requested restriction on portfolio or promotional use should be documented in writing before the Event. Separate model or talent releases may be required for individuals appearing prominently in commercial content.</p>
  </section>

  <section>
    <h2>16. INDEPENDENT CONTRACTOR</h2>
    <p>830 Productions is an independent contractor and is not an employee, partner, joint venturer, or agent of Client. Videographer controls the manner and means of performing the services, subject to the agreed project requirements.</p>
  </section>

  <section>
    <h2>17. DISPUTE RESOLUTION &amp; GOVERNING LAW</h2>
    <p>The parties will first attempt in good faith to resolve any dispute through direct discussion. If a dispute cannot be resolved informally, the parties may pursue remedies available under applicable law.</p>
    <p>This Agreement will be governed by the laws of the State of ${f(c.governingLaw, "New Jersey")}, without regard to conflict-of-law principles, unless applicable law requires otherwise. Any venue or jurisdiction provision should be reviewed for enforceability under applicable law.</p>
  </section>

  <section>
    <h2>18. ENTIRE AGREEMENT, AMENDMENTS &amp; SEVERABILITY</h2>
    <p>This Agreement, together with any attached proposal, invoice, package description, or written addendum expressly incorporated into it, constitutes the entire agreement between the parties concerning the services. Any amendment must be in writing and accepted by both parties.</p>
    <p>If any provision is found invalid or unenforceable, the remaining provisions will remain in effect to the fullest extent permitted by law. A failure to enforce a provision on one occasion does not waive the right to enforce it later.</p>
  </section>

  <section>
    <h2>19. ELECTRONIC SIGNATURES &amp; NOTICES</h2>
    <p>Electronic signatures, scanned signatures, and electronically transmitted copies may be treated as originals to the extent permitted by applicable law. Notices under this Agreement may be delivered by email or another written method designated by the parties.</p>
  </section>

  <section class="k-signatures">
    <h2>20. ACKNOWLEDGMENT &amp; SIGNATURES</h2>
    <p>By signing below, the parties acknowledge that they have read, understood, and agreed to this Agreement and any incorporated project proposal. Client acknowledges that the payment, cancellation, revision, intellectual-property, and limitation-of-liability provisions are material terms of the Agreement.</p>
    <div class="k-sigs">
      <div class="k-sigcol">
        ${sigLine("CLIENT LEGAL NAME", f(sig?.name || c.clientName, ""))}
        ${sigLine("SIGNATURE", clientSig, "k-big")}
        ${sigLine("DATE", sig ? f(signedDate) : preview ? `<span class="k-preview">${esc(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</span>` : pending)}
        ${sigLine("EMAIL", f(c.clientEmail, ""))}
        ${sigLine("PHONE", f(c.clientPhone, ""))}
        ${sigLine("CLIENT INITIALS", clientInitials, "k-big")}
        ${sigLine("MAILING ADDRESS", f(c.clientAddress, ""))}
      </div>
      <div class="k-sigcol">
        ${sigLine("830 PRODUCTIONS REPRESENTATIVE", f(c.repName, ""))}
        ${sigLine("SIGNATURE", c.repName ? `<span class="k-script">${esc(c.repName)}</span>` : f("", ""), "k-big")}
        ${sigLine("DATE", f(longDate(c.agreementDate), ""))}
        ${sigLine("EMAIL", f(c.repEmail, ""))}
        ${sigLine("PHONE", f(c.repPhone, ""))}
        ${sigLine("830 PRODUCTIONS INITIALS", c.repInitials ? `<span class="k-script k-initials">${esc(c.repInitials)}</span>` : f("", ""), "k-big")}
        ${sigLine("BUSINESS ADDRESS", f(c.businessAddress, ""))}
      </div>
    </div>
  </section>

  ${
    sig
      ? `<div class="k-audit">
    <div class="k-label">ELECTRONIC SIGNATURE RECORD</div>
    <div>Signed electronically by <b>${esc(sig.name)}</b> on ${esc(signedAt)}.</div>
    <div>Document ID ${esc(c.pin || "")} · Signed via sign.830productions.com</div>
    ${sig.userAgent ? `<div class="k-ua">Device: ${esc(sig.userAgent)}</div>` : ""}
  </div>`
      : ""
  }
</article>`;
}

export function pdfName(c) {
  const who = String(c.clientName || "Client").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `830-Productions-Agreement-${who}${c.signature ? "-SIGNED" : ""}.pdf`;
}

// Renders the contract at letter-page width and saves it as a PDF.
export async function downloadPdf(c) {
  if (!window.html2pdf) throw new Error("PDF library failed to load. Check your connection and try again.");
  const host = document.createElement("div");
  host.className = "pdf-host";
  host.innerHTML = renderContract(c);
  document.body.appendChild(host);
  // html2canvas offsets the capture by the page scroll, so render from the top.
  const scrollY = window.scrollY;
  window.scrollTo(0, 0);
  try {
    await document.fonts.ready;
    await Promise.all(
      [...host.querySelectorAll("img")].map((img) =>
        img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })
      )
    );
    await window
      .html2pdf()
      .set({
        margin: [0.55, 0.6, 0.6, 0.6],
        filename: pdfName(c),
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["section", "li", "p", ".k-field", ".k-sigs", ".k-audit", ".k-head"] },
      })
      .from(host.firstElementChild)
      .save();
  } finally {
    host.remove();
    window.scrollTo(0, scrollY);
  }
}
