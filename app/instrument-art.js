import { HOLES } from './fingering.js';

// Original high-resolution ceramic render; the live touch targets remain DOM
// elements so image quality and pointer ownership are independent.
export function bodySvg(prefix, decorative = false) {
  return `<svg class="${decorative ? 'decor-ocarina' : 'ocarina-body'}" viewBox="0 0 400 266.6667" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image href="./assets/ocarina-ceramic.png" width="400" height="266.6667" preserveAspectRatio="xMidYMid meet"/>${decorative ? HOLES.filter(h => !h.back).map(h => `<circle cx="${h.x * 4}" cy="${h.y * 8 / 3}" r="${h.small ? 6 : 11}" fill="#091a28" stroke="#84a6ae" stroke-width="1.2"/>`).join('') : ''}</svg>`;
}
