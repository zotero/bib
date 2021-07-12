export const isLikeZoteroItem = item => item && typeof item === 'object' && 'itemType' in item;
