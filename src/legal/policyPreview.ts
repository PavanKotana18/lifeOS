import policy from './documents.json';

export { policy };

const terms = policy.documents.find(document => document.id === 'terms')!;
export const previewTerms = {
  initial: { version: policy.version, content: JSON.stringify(terms) },
  updated: {
    version: '0.4-preview',
    content: JSON.stringify({ ...terms, change: 'Example update: the export section now explains which copies remain after reset.' }),
  },
};

export async function previewReceipt(document: typeof previewTerms.initial, adult: boolean, agreed: boolean) {
  if (!adult || !agreed) throw new Error('Confirm both items before continuing.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(document.content));
  return {
    example: true as const,
    version: document.version,
    contentHash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
    acceptedAt: new Date().toISOString(),
  };
}
