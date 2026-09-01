
// Ported from the original app's content.html required-documents doclist.
// viewUrl/downloadUrl still point at the original Google Drive files —
// these are the client's real documents, so the links stay valid regardless
// of which frontend serves the page. TODO before a real migration: move
// these into Supabase Storage and swap the URLs for signed Storage URLs, so
// document access isn't dependent on the original Drive files' sharing
// settings indefinitely.
export const REQUIRED_DOCUMENTS = [
  {
    id: "application-form",
    title: "Employment Application Form",
    action: "View Application Form",
    desc: "Your personal, education, and work-history details on record before the contract is drawn up.",
    viewUrl: "https://drive.google.com/file/d/1rBiYCcQowvAsDxCDdidLHVpEbVCmsP8C/view",
    downloadUrl: "https://drive.google.com/uc?export=download&id=1rBiYCcQowvAsDxCDdidLHVpEbVCmsP8C",
  },
  {
    id: "employment-contract",
    title: "Employment Contract",
    action: "View Employment Contract",
    desc: "The formal agreement covering your role, compensation, and terms of employment with VCB.",
    viewUrl: "https://docs.google.com/document/d/1-rGE5UXrP1sf891fIiD2TDHE-3XYkLrU/edit",
    downloadUrl: "https://docs.google.com/document/d/1-rGE5UXrP1sf891fIiD2TDHE-3XYkLrU/export?format=docx",
  },
  {
    id: "nda",
    title: "Confidentiality Agreement",
    action: "View NDA Form",
    desc: "Your commitment to keep company, project, and client information confidential.",
    viewUrl: "https://drive.google.com/file/d/1h6wtUT2WT2QZvJltZRG-vaE3gCLhFTf3/view",
    downloadUrl: "https://drive.google.com/uc?export=download&id=1h6wtUT2WT2QZvJltZRG-vaE3gCLhFTf3",
  },
  {
    id: "pdpa-consent",
    title: "Personal Data Consent Form (PDPA)",
    action: "View PDPA Consent Form",
    desc: "Your consent for VCB to collect, use, and store your personal data as an employee.",
    viewUrl: "https://drive.google.com/file/d/1b9rxQkdv-u1GddC5s4dNiLj0DGdUaPWK/view",
    downloadUrl: "https://drive.google.com/uc?export=download&id=1b9rxQkdv-u1GddC5s4dNiLj0DGdUaPWK",
  },
  {
    id: "pdpa-policy",
    title: "PDPA Data Protection Policy (Reference)",
    action: "View PDPA Policy",
    desc: "Acknowledgement that you have read the company's policy on how personal data is protected.",
    viewUrl: "https://drive.google.com/file/d/1S2De-qUCccdpJeam1lc_4Ob4VIk6_6dw/view",
    downloadUrl: "https://drive.google.com/uc?export=download&id=1S2De-qUCccdpJeam1lc_4Ob4VIk6_6dw",
  },
  {
    id: "anti-corruption",
    title: "Anti-Corruption Policy Acknowledgement",
    action: "View Anti-Corruption Form",
    desc: "Acknowledgement of VCB's zero-tolerance policy on bribery and corruption.",
    viewUrl: "https://drive.google.com/file/d/1uNT9bFy0Hrj7OyaXSTUQvjm1gke7xnXF/view",
    downloadUrl: "https://drive.google.com/uc?export=download&id=1uNT9bFy0Hrj7OyaXSTUQvjm1gke7xnXF",
  },
  {
    id: "reporting-form",
    title: "New Employee Reporting Form",
    action: "View Reporting Form",
    desc: "Confirms your official start date and reports you as active to HR on day one.",
    viewUrl: "https://drive.google.com/file/d/10Q1geYqL7DO-3hJYHtpnKAVJqDQ5OXKA/view",
    downloadUrl: "https://drive.google.com/uc?export=download&id=10Q1geYqL7DO-3hJYHtpnKAVJqDQ5OXKA",
  },
  {
    id: "tax-form",
    title: "Tax Registration Form",
    action: "View Tax Form",
    desc: "Your tax ID and withholding details for payroll registration.",
    // No viewUrl/downloadUrl in the original either — this is the one
    // document that never got a real Drive file attached (see the
    // original app's docs/CONTENT_GUIDE.md).
  },
];
