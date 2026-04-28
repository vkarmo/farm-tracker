// __BUILD_TIME__ is injected by Vite at compile time
const buildId = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';
export const CACHE_NAME = `farm-tracker-v1.1-${buildId}`;
