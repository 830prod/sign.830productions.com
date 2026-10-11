# sign.830productions.com

E-signature site for 830 Productions contracts. Static HTML/JS (works on GitHub Pages) with Firebase (Firestore + Google sign-in) as the backend.

- **`/`**: the client enters their 6-digit PIN, reads the Videography Services Agreement filled in with their details, types their name to sign, and can download a PDF.
- **`/admin.html`**: you sign in with Google, create a customer and contract (live preview), get a PIN or invite link to send, and download the signed PDFs.

## How it works

- Each contract is a Firestore doc at `contracts/{PIN}`. The PIN is the document ID.
- Anyone with a PIN can read that one contract. Only the admin account can list, create, edit or delete contracts (`firestore.rules`).
- Signing writes `status: "signed"` plus `signature { name, initials, signedAt, userAgent }`. The rules only allow that on a pending contract, only those fields, and `signedAt` has to be the server timestamp. After that the contract is locked. The admin can delete it but can't edit it.
- PDFs are generated in the browser from the stored data. Nothing goes into Firebase Storage, so the free Spark plan is enough.
- The 830 Productions signature (your rep name in script) goes on when the contract is created. The client's typed name and initials appear in script, followed by an electronic-signature record (name, timestamp, PIN, device).
- The contract text lives in `js/contract.js` (`renderContract`). If you change the master .docx, edit the text there too.

## One-time Firebase setup

1. Go to <https://console.firebase.google.com>, click **Add project**, and name it something like `830-sign`. You can skip Analytics.
2. **Build → Firestore Database → Create database**. Production mode, any US region.
3. **Build → Authentication → Get started → Sign-in method → Google → Enable**.
4. **Authentication → Settings → Authorized domains**: add `sign.830productions.com`. `localhost` is already there.
5. **Project settings (gear) → Your apps → Web (`</>`)**: register an app and copy the `firebaseConfig` values into `js/config.js`.
6. Publish the security rules. Either paste `firestore.rules` into **Firestore → Rules → Publish**, or use the CLI:
   ```bash
   npm i -g firebase-tools && firebase login && firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```
7. **Firestore → Indexes**: none needed. The admin list sorts on a single field.

The admin email is `830prod@gmail.com` in both `js/config.js` and `firestore.rules`. If you change it, change it in both places.

## Hosting (GitHub Pages)

`CNAME` is already set to `sign.830productions.com`. Add a DNS record:

| Type  | Host | Value                |
|-------|------|----------------------|
| CNAME | sign | `830prod.github.io`  |

Then turn on Pages for the repo/branch serving this folder and tick **Enforce HTTPS**.

## Local testing

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080/admin.html>. It needs to be served over http, not opened as a `file://` page, because of ES modules and Google sign-in.

## Notes and limits

- **PIN guessing:** 6 digits is 900,000 possibilities. That's fine for this use, but Firestore rules can't rate-limit. For more protection, turn on **App Check** with reCAPTCHA Enterprise (Firebase console → App Check) and enforce it for Firestore. Delete contracts you no longer need from the dashboard. Keep your own copy of the PDF first.
- **Legal:** typed-name signatures with intent and consent checkboxes plus an audit record are generally valid under the U.S. ESIGN Act and UETA. This isn't legal advice. Have your attorney review the contract and process.
