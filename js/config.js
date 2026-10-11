// Firebase web config — paste the values from
// Firebase console → Project settings → Your apps → Web app.
// These values are not secrets; access is controlled by firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyAcRzTdvAEC3svQ-4w5DZB7Up8HaY2_9BU",
  authDomain: "sign-830.firebaseapp.com",
  projectId: "sign-830",
  storageBucket: "sign-830.firebasestorage.app",
  messagingSenderId: "114125791784",
  appId: "1:114125791784:web:ccd3e79ba0959fc794cb1d",
};

// Only this Google account can open the admin page.
// Keep it in sync with ADMIN_EMAIL in firestore.rules.
export const ADMIN_EMAIL = "830prod@gmail.com";

// Public URL of this site, used for the share links the admin page copies.
export const SITE_URL = "https://sign.830productions.com";

// Defaults pre-filled on every new contract (editable per contract).
export const DEFAULTS = {
  repName: "Jonathan Barkei",
  repEmail: "830prod@gmail.com",
  repPhone: "",
  businessAddress: "",
  repInitials: "JB",
  deliveryEstimate: "4–6 weeks",
  reviewDays: "7",
  archiveDays: "90",
  governingLaw: "New Jersey",
  overtimeRate: "",
  productionServices: "single-camera coverage, professional audio capture, and lighting",
  deliverables: "final edited video",
  balanceDue: "14 days before the event",
};
