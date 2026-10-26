// =====================================================================
//  STORE CONFIG — the only file you need to edit for a new business.
//  Products, prices and collections live in the database (Supabase),
//  or in src/config/demo-data.js while you're in demo mode.
// =====================================================================

const storeConfig = {
  // ---- Brand ---------------------------------------------------------
  brand: {
    mark: 'TML',               // big bold part of the logo
    sub: 'Store',              // small spaced-out part of the logo
    fullName: 'TML Store',     // used in page titles, emails, footer
    footerLine: 'Statement wall art, framed artwork and multi-panel collections.',
    metaDescription: 'Statement wall art, framed artwork and multi-panel collections. Order online, pay cash on delivery.',
  },

  // ---- Look ----------------------------------------------------------
  theme: {
    accent: '#8F86FF',         // focus rings and highlights
  },

  // ---- Money & time --------------------------------------------------
  currency: 'EGP',             // shown before every price
  numberLocale: 'en-US',       // how numbers are formatted (1,234)
  timezone: 'Africa/Cairo',    // "today" and "this month" in the dashboard use this
  orderRefPrefix: 'TML',       // order numbers look like TML-261026-4821 (1–5 capital letters)
  customRefPrefix: 'CR',       // custom-request numbers

  // ---- Contact (leave blank to hide) ---------------------------------
  contact: {
    phone: '',                 // e.g. '+20 10 1234 5678'
    whatsapp: '',              // international format, digits only, e.g. '201012345678'
    email: '',
  },
  social: [
    { label: 'Instagram', url: '' },
    { label: 'TikTok', url: '' },
    { label: 'Facebook', url: '' },
  ],

  // ---- Delivery ------------------------------------------------------
  regionLabel: 'City / governorate',
  regions: [
    'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Dakahlia', 'Sharqia', 'Gharbia', 'Monufia',
    'Beheira', 'Kafr El Sheikh', 'Damietta', 'Port Said', 'Ismailia', 'Suez', 'Faiyum',
    'Beni Suef', 'Minya', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'Matrouh',
    'New Valley', 'North Sinai', 'South Sinai',
  ],
  phoneExample: '010 1234 5678',
  phoneCountryCode: '20',      // used to open WhatsApp chats with customers from the dashboard

  // ---- Features ------------------------------------------------------
  features: {
    customOrders: true,        // "Request a custom piece" form + dashboard tab
    whatsappConfirm: true,     // "Confirm on WhatsApp" button after an order (needs contact.whatsapp)
    multiPanel: true,          // three/five-panel layouts. Turn off for a normal single-item shop.
  },

  // ---- Homepage copy -------------------------------------------------
  home: {
    heroTitle: 'Your walls.',
    heroTitleItalic: 'A different universe.',
    heroLead: 'Statement wall art for spaces that feel like you.',
    heroProductId: 'neon-shrine',          // product shown in the hero (falls back to the first featured)
    // Collection cards: [collection id, product id used as the picture]
    collectionCards: [['anime', 'sakura-drift'], ['gaming', 'boss-room'], ['multi', 'signal-lost']],
    // "In real spaces" mockups (set to null to hide the section)
    spaces: { living: 'neon-shrine', bedroom: 'last-light', hallway: 'tidecaller', desk: 'orbit-station' },
    craft: {
      show: true,
      title: 'The difference is in the details.',
      intro: 'A closer look at how each piece is finished — from the surface of the print to the way it meets the wall.',
      details: [
        { title: 'Surface', copy: 'A close-up of the print surface and its finish.', spec: '' },
        { title: 'Edges', copy: 'How each edge is wrapped and finished.', spec: '' },
        { title: 'Backing', copy: 'The reverse side and the hanging hardware.', spec: '' },
        { title: 'Panel alignment', copy: 'How multi-panel pieces line up across the wall.', spec: '' },
        { title: 'Mounting', copy: 'What comes in the box, and how a piece goes up.', spec: '' },
      ],
    },
    faq: [
      { q: 'How does ordering work?', a: 'Add pieces to your bag and send an order request with your contact and delivery details. Nothing is charged online — you pay cash on delivery. We call you to confirm before anything is made or sent.' },
      { q: 'How are the dimensions listed?', a: 'Every piece lists its sizes on its own page. Multi-panel pieces show the total installed size of the full arrangement and the size of each panel.' },
      { q: 'Where do you deliver, and how long does it take?', a: 'We deliver across the country. We confirm the delivery fee and timing with you by phone after you send your request.' },
      { q: 'Can I request a custom piece?', a: 'Yes. Share a reference image, the size or arrangement you want and a short description. We review each request and contact you with pricing.' },
    ],
  },

  // ---- Product page --------------------------------------------------
  productSpecs: [                          // shown on every product page (leave [] to hide)
    { label: 'Material', value: '[To be confirmed]' },
    { label: 'Surface finish', value: '[To be confirmed]' },
    { label: 'Hanging', value: '[What’s included — to be confirmed]' },
  ],
  deliveryNote: 'Delivery fee is confirmed with you by phone after you send your order. You pay cash on delivery.',
};

export default storeConfig;
