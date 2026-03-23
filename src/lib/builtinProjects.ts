/**
 * Built-in projects are added via code, not through the UI.
 * Each project has a `slug` that maps to a route under /projects/[slug].
 */
export interface BuiltinProject {
  id: string;
  name: string;
  description: string;
  slug: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const BUILTIN_PROJECTS: BuiltinProject[] = [
  {
    id: "builtin-collection-card",
    name: "Collection Card",
    description: "Browse, filter and inspect NFT collection cards from the wallet API.",
    slug: "collection-card",
    tags: ["API", "NFT", "Cards", "Wallet"],
    createdAt: "2026-02-25T00:00:00.000Z",
    updatedAt: "2026-02-25T00:00:00.000Z",
  },
  {
    id: "builtin-buzznet",
    name: "Buzznet",
    description: "Batch-generate AI article interaction content from a CSV of persona segments.",
    slug: "buzznet",
    tags: ["AI", "Content", "Batch", "CSV"],
    createdAt: "2026-03-06T00:00:00.000Z",
    updatedAt: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "builtin-distribution-tester",
    name: "Distribution Engine Tester",
    description: "Verify influencer post distribution logic — input a post ID, query DB, and see pass/fail checks.",
    slug: "distribution-tester",
    tags: ["DB", "Distribution", "Verification", "Influencer"],
    createdAt: "2026-03-19T00:00:00.000Z",
    updatedAt: "2026-03-19T00:00:00.000Z",
  },
  {
    id: "builtin-checkout-simulator",
    name: "Checkout Simulator",
    description: "Simulate a product checkout page and test the transaction API.",
    slug: "checkout-simulator",
    tags: ["Payment", "Checkout", "Transaction", "API"],
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:00:00.000Z",
  },
];
