// new -> read -> replied -> closed. Closed is final: the buyer can start a fresh inquiry instead.
export const INQUIRY_TRANSITIONS = Object.freeze({ new: ['read', 'replied', 'closed'], read: ['replied', 'closed'], replied: ['closed'], closed: [] });
export const canMoveInquiry = (from, to) => INQUIRY_TRANSITIONS[from]?.includes(to) ?? false;
