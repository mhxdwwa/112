/* ===== 技能图标 ===== */
const SKILL_ICONS = {
  sword: [
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L18 12" stroke-width="2.6"/><path d="M18 12 L22 12" stroke-width="3.2"/><path d="M8 9.5 L8 14.5" stroke-width="2"/><path d="M3 12 L5 12" stroke-width="2.4"/><path d="M1 9 L4 9" opacity="0.5"/><path d="M1 15 L4 15" opacity="0.5"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5 L12 19" stroke-width="2.6"/><path d="M12 19 L12 22" stroke-width="3.2"/><path d="M9 8 L15 8" stroke-width="2"/><path d="M12 5 L12 3" stroke-width="2.4"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2 L12 6.5" stroke-width="2.2"/><path d="M12 17.5 L12 22" stroke-width="2.2"/><path d="M2 12 L6.5 12" stroke-width="2.2"/><path d="M17.5 12 L22 12" stroke-width="2.2"/><circle cx="12" cy="12" r="5.5" opacity="0.3"/><circle cx="12" cy="12" r="8.5" opacity="0.15"/></svg>`
,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22 L16 8" stroke-width="2.8"/><path d="M16 8 L22 2" stroke-width="3.4"/><path d="M18 2 L22 2 L22 6" opacity="0.6"/><path d="M7 17 L9.5 19.5"/><circle cx="6" cy="18" r="3.4" opacity="0.25"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="4.5" width="15" height="15" rx="2" opacity="0.32" stroke-dasharray="2 3"/><path d="M12 2 L12 7.5"/><path d="M12 22 L12 16.5"/><path d="M2 12 L7.5 12"/><path d="M22 12 L16.5 12"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="6" opacity="0.2"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2 L5 13" stroke-width="2.2"/><path d="M12 1 L12 16" stroke-width="2.6"/><path d="M19 3 L19 12" stroke-width="2.2"/><path d="M5 13 L2.5 17 L7.5 17 Z" fill="currentColor" fill-opacity="0.85" stroke="none"/><path d="M12 16 L9 21 L15 21 Z" fill="currentColor" fill-opacity="0.9" stroke="none"/><path d="M19 12 L16.5 16 L21.5 16 Z" fill="currentColor" fill-opacity="0.85" stroke="none"/></svg>`
  ],
  blade: [
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20 Q8 12 19 4" stroke-width="2.6"/><path d="M3 20 L2 22" stroke-width="2.2"/><path d="M13 9 Q15 6 14 3 Q17 6 16 9" fill="currentColor" fill-opacity="0.3" opacity="0.85"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8" opacity="0.35" stroke-dasharray="2.5 3"/><path d="M12 3.5 L14 8 L12 10 L10 8 Z" fill="currentColor" fill-opacity="0.75" stroke="none"/><path d="M19.3 14.5 L14.8 15 L13 13.2 L15 12 Z" fill="currentColor" fill-opacity="0.75" stroke="none"/><path d="M4.7 14.5 L9.2 12 L11 13.8 L9 15 Z" fill="currentColor" fill-opacity="0.75" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 Q19 4 19 11 Q19 18 12 18 Q6 18 6 12 Q6 7 11 7 Q15 7 15 11 Q15 14 12 14" opacity="0.75"/><path d="M17 4.5 L19.5 6.5 L15.5 7.5 Z" fill="currentColor" fill-opacity="0.85" stroke="none"/><path d="M7 19.5 L4.5 17.5 L8.5 16.5 Z" fill="currentColor" fill-opacity="0.85" stroke="none"/></svg>`
,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8 L20 4" stroke-width="2.6"/><path d="M2 13 L20 9" stroke-width="2.6"/><path d="M2 18 L20 14" stroke-width="2.6"/><path d="M2 21 L6 20" opacity="0.5"/><circle cx="21" cy="11" r="2" fill="currentColor" stroke="none" opacity="0.7"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 L20 4" stroke-width="2.4"/><path d="M6 6 L9 6 L9 3" stroke-width="1.6"/><path d="M18 18 L15 18 L15 21" stroke-width="1.6"/><path d="M12 2 L12 6" opacity="0.6"/><path d="M2 12 L6 12" opacity="0.6"/><path d="M18 12 L22 12" opacity="0.6"/><path d="M12 18 L12 22" opacity="0.6"/><circle cx="12" cy="12" r="2.6" opacity="0.35"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 L6 9" stroke-width="2.6"/><path d="M6 9 L3 13 L9 13 Z" fill="currentColor" fill-opacity="0.9" stroke="none"/><path d="M12 14 Q16 12 18 16 Q20 20 12 22 Q4 20 6 16 Q8 12 12 14 Z" fill="currentColor" fill-opacity="0.45" stroke-width="1.4"/><path d="M17 4 L21 8" opacity="0.5"/><path d="M2 6 L4 4" opacity="0.4"/></svg>`
  ],
  spear: [
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20 Q6 16 5 12 Q4 8 8 6 Q12 4 14 7 Q16 10 19 9"/><path d="M19 9 L22 6" stroke-width="2.4"/><path d="M21 5 L22 3" opacity="0.6"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12 L15 12" stroke-width="2.2"/><path d="M15 12 L21 12" stroke-width="3.2"/><path d="M15 9 L21 12 L15 15 Z" fill="currentColor" fill-opacity="0.9" stroke="none"/><path d="M4 9 L7 9" opacity="0.5"/><path d="M4 15 L7 15" opacity="0.5"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M2 2 L9 9" stroke-width="2"/><path d="M22 2 L15 9" stroke-width="2"/><path d="M2 22 L9 15" stroke-width="2"/><path d="M22 22 L15 15" stroke-width="2"/><circle cx="12" cy="12" r="5" opacity="0.25"/><circle cx="12" cy="12" r="8" opacity="0.12"/></svg>`
,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21 L14 10" stroke-width="2.2"/><path d="M14 10 L21 3" stroke-width="2.8"/><path d="M14 10 L17 9 L15 12" stroke-width="1.6"/><path d="M6 8 Q9 5 13 6" opacity="0.55"/><path d="M18 6 Q21 7 21 10" opacity="0.55"/><path d="M4 12 Q7 14 10 12" opacity="0.35"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2 L4 9" stroke-width="2"/><path d="M9 2 L9 12" stroke-width="2"/><path d="M14 2 L14 8" stroke-width="2"/><path d="M19 2 L19 11" stroke-width="2"/><path d="M4 9 L2 12 L6 12 Z" fill="currentColor" stroke="none"/><path d="M9 12 L7 15 L11 15 Z" fill="currentColor" stroke="none"/><path d="M14 8 L12 11 L16 11 Z" fill="currentColor" stroke="none"/><path d="M19 11 L17 14 L21 14 Z" fill="currentColor" stroke="none"/><path d="M2 18 Q12 22 22 18" opacity="0.35"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1 L12 17" stroke-width="3"/><path d="M12 17 L8 22 L16 22 Z" fill="currentColor" fill-opacity="0.9" stroke="none"/><path d="M7 5 L9 5 L9 3" stroke-width="1.6"/><path d="M17 5 L15 5 L15 3" stroke-width="1.6"/><circle cx="12" cy="9" r="5" opacity="0.22"/><path d="M3 12 Q6 15 9 12" opacity="0.4"/><path d="M15 12 Q18 15 21 12" opacity="0.4"/></svg>`
  ],
  fist: [
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" fill="currentColor" fill-opacity="0.5" stroke-width="2"/><circle cx="12" cy="12" r="7" opacity="0.5"/><circle cx="12" cy="12" r="10" opacity="0.22"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.6" fill="currentColor" fill-opacity="0.75" stroke="none"/><path d="M12 2.5 L13.3 7.3M21.5 12 L16.7 13.3M12 21.5 L10.7 16.7M2.5 12 L7.3 10.7" stroke-width="2.1"/><path d="M18.7 5.3 L15.3 8.7M18.7 18.7 L15.3 15.3M5.3 18.7 L8.7 15.3M5.3 5.3 L8.7 8.7" opacity="0.55"/><circle cx="12" cy="12" r="8.6" opacity="0.22"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 8 Q9 6 11 6 L16 6 Q18 6 18 8 L18 14 Q18 16 16 16 L11 16 Q9 16 9 14 Z" stroke-width="2"/><path d="M5 8 L8 8" opacity="0.7"/><path d="M4 11 L8 11" opacity="0.55"/><path d="M5 14 L8 14" opacity="0.7"/></svg>`
,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity="0.55" stroke-width="1.8"/><circle cx="12" cy="12" r="7" opacity="0.4" stroke-dasharray="1.6 3"/><circle cx="12" cy="4" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="6" cy="16" r="1.4" fill="currentColor" stroke="none"/><circle cx="6" cy="8" r="1.4" fill="currentColor" stroke="none"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21 L7 12 Q7 6 12 6 Q17 6 17 12 L17 21" stroke-width="1.8" opacity="0.5"/><path d="M4 13 L7 10 L7 16 Z" fill="currentColor" fill-opacity="0.7" stroke="none"/><path d="M9 9 L9 4" stroke-width="2"/><path d="M12 8 L12 2.5" stroke-width="2.2"/><path d="M15 9 L15 4" stroke-width="2"/><path d="M2 6 L5 6" opacity="0.45"/><path d="M19 6 L22 6" opacity="0.45"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" opacity="0.3"/><path d="M12 3 Q17 8 12 12 Q7 16 12 21" stroke-width="2"/><path d="M3 12 Q8 7 12 12 Q16 17 21 12" stroke-width="2" opacity="0.7"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>`
  ],
  herb: [
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4 Q8 9 12 9 Q16 9 16 4 Q12 2 8 4 Z" fill="currentColor" fill-opacity="0.35"/><path d="M12 9 L12 15"/><path d="M9 12 Q5 13 4 17 Q8 18 11 15"/><path d="M15 12 Q19 13 20 17 Q16 18 13 15"/><circle cx="12" cy="19" r="2.2" fill="currentColor" fill-opacity="0.5"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22 Q6 14 10 12 Q13 10 13 6"/><path d="M8 22 Q10 16 15 13 Q19 11 20 6"/><path d="M13 22 Q16 18 20 16" opacity="0.6"/><path d="M9 9 Q11 7 13 9 Q11 11 9 9 Z" fill="currentColor" fill-opacity="0.6" stroke="none"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="1.5" stroke-dasharray="3 2"/><path d="M9.5 6 L14.5 6 M9.5 9 L14.5 9 M9.5 12 L13 12 M9.5 15 L14.5 15" opacity="0.75"/><path d="M12 19.5 L12 22" stroke-width="2.2"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 Q15 7 12 11 Q9 7 12 3 Z" fill="currentColor" fill-opacity="0.5"/><path d="M6 8 Q9 11 7 15 Q4 12 6 8 Z" fill="currentColor" fill-opacity="0.35"/><path d="M18 8 Q15 11 17 15 Q20 12 18 8 Z" fill="currentColor" fill-opacity="0.35"/><path d="M8 15 Q12 22 16 15 Q12 18 8 15 Z" fill="currentColor" fill-opacity="0.55"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="3.2"/><path d="M12 9.8 L12 5 M9.6 11 L5.5 7.5 M14.4 11 L18.5 7.5 M8.9 13.4 L4 15 M15.1 13.4 L20 15 M9.6 15 L6.5 19.5 M14.4 15 L17.5 19.5" stroke-width="1.4"/><circle cx="12" cy="13" r="0.9" fill="currentColor" stroke="none"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18 Q4 12 8 9 Q12 6 12 2" stroke-width="2.2"/><path d="M12 18 Q12 13 15 10 Q18 7 18 3" stroke-width="2"/><path d="M20 18 Q18 14 16 13" opacity="0.6"/><path d="M2 18 Q4 14 6 13" opacity="0.6"/><path d="M2 20 Q12 23 22 20" stroke-width="1.6" opacity="0.7"/></svg>`
  ],
  axe: [
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21 L14 5" stroke-width="2.6"/><path d="M14 5 Q20 3 21 9 Q19 13 13 12 Z" fill="currentColor" fill-opacity="0.65"/><path d="M13 12 Q8 13 6 17 Q10 17 13 15 Z" fill="currentColor" fill-opacity="0.35"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5 L9 3 Q12 6 9 9 Z" fill="currentColor" fill-opacity="0.6"/><path d="M3 12 L9 10 Q12 13 9 16 Z" fill="currentColor" fill-opacity="0.45"/><path d="M3 19 L9 17 Q12 20 9 23 Z" fill="currentColor" fill-opacity="0.3"/><path d="M10 4 L14 6 M10 11 L14 13 M10 18 L14 20" opacity="0.6"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity="0.5"/><path d="M12 3 Q17 7 12 12 Q7 17 12 21" stroke-width="2.2"/><path d="M3 12 Q7 7 12 12 Q17 17 21 12" stroke-width="1.6" opacity="0.65"/><circle cx="12" cy="12" r="8" stroke-dasharray="2 4" opacity="0.5"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L12 12" stroke-width="2.6"/><path d="M8 2 L16 2" stroke-width="2"/><path d="M12 12 L4 22 M12 12 L20 22" stroke-width="2"/><path d="M6 17 L9 19 M18 17 L15 19" opacity="0.55"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 Q9 2 12 2 Q15 2 15 6 L15 9 Q12 7 9 9 Z" fill="currentColor" fill-opacity="0.35"/><path d="M8 10 L16 10" stroke-width="2"/><path d="M12 10 L12 20" stroke-width="2.4"/><circle cx="7" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="13" r="1.2" fill="currentColor" stroke="none"/><path d="M12 16 L9 21 M12 16 L15 21" opacity="0.7"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12 Q12 4 22 12" stroke-width="2.2"/><path d="M2 12 Q12 20 22 12" stroke-width="2.2"/><path d="M12 2 L12 22" stroke-width="1.4" opacity="0.5"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M5 6 L8 9 M19 6 L16 9 M5 18 L8 15 M19 18 L16 15" opacity="0.55"/></svg>`
  ],
  talisman: [
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7.5" y="2.5" width="9" height="19" rx="1.2" fill="currentColor" fill-opacity="0.22"/><path d="M12 5 L12 9 M12 12 L12 19" stroke-width="1.4" opacity="0.8"/><path d="M9.5 7 L14.5 7 M9.5 14 L14.5 14" opacity="0.6"/><circle cx="12" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3 L8 3 L8 6 L4 6 Z" fill="currentColor" fill-opacity="0.5"/><path d="M7 6 L5 11 L9 10" stroke-width="2"/><path d="M16 3 L20 3 L20 6 L16 6 Z" fill="currentColor" fill-opacity="0.5"/><path d="M17 6 L19 11 L15 10" stroke-width="2"/><path d="M12 12 L12 22" stroke-width="2.4"/><path d="M9 15 L15 15" stroke-width="2"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="4" height="8" rx="0.8" fill="currentColor" fill-opacity="0.35"/><rect x="10" y="2" width="4" height="8" rx="0.8" fill="currentColor" fill-opacity="0.5"/><rect x="17" y="4" width="4" height="8" rx="0.8" fill="currentColor" fill-opacity="0.3"/><rect x="6" y="13" width="4" height="8" rx="0.8" fill="currentColor" fill-opacity="0.25"/><rect x="14" y="14" width="4" height="8" rx="0.8" fill="currentColor" fill-opacity="0.45"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L14 8 L12 9 L10 8 Z" fill="currentColor" fill-opacity="0.8"/><path d="M12 9 L12 17" stroke-width="2.4"/><path d="M8 11 L12 13 L16 11" stroke-width="2"/><path d="M12 17 L9 21 M12 17 L15 21" opacity="0.7"/><path d="M4 6 L7 9 M20 6 L17 9" opacity="0.5"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2" opacity="0.7"/><path d="M12 3 L12 8 M12 16 L12 21 M3 12 L8 12 M16 12 L21 12" stroke-width="1.8"/><rect x="9.5" y="9.5" width="5" height="5" transform="rotate(45 12 12)" fill="currentColor" fill-opacity="0.55"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20 Q7 16 12 20 Q17 24 22 20" stroke-width="1.8" opacity="0.65"/><path d="M6 18 Q6 11 9 8 Q12 5 12 2 Q12 5 15 8 Q18 11 18 18" fill="currentColor" fill-opacity="0.18"/><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="9" r="1.1" fill="currentColor" stroke="none"/><path d="M8 17 L10 15 M16 17 L14 15" opacity="0.6"/></svg>`
  ],
  cauldron: [
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 Q15 6 13 9 Q11 12 12 14" stroke-width="2.2"/><path d="M7 8 Q9 11 8 14 Q6 11 7 8 Z" fill="currentColor" fill-opacity="0.45" stroke="none"/><path d="M17 8 Q15 11 16 14 Q18 11 17 8 Z" fill="currentColor" fill-opacity="0.45" stroke="none"/><path d="M4 19 Q12 23 20 19" stroke-width="1.6" opacity="0.6"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8 Q12 6 19 8 L18 17 Q12 21 6 17 Z" fill="currentColor" fill-opacity="0.3"/><path d="M3 8 L21 8" stroke-width="2.2"/><path d="M9 20 L9 22 M15 20 L15 22" stroke-width="2"/><path d="M8 12 Q12 10 16 12" opacity="0.6"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 Q16 7 12 12 Q8 7 12 2 Z" fill="currentColor" fill-opacity="0.65"/><path d="M6 6 Q9 10 7 14 Q4 10 6 6 Z" fill="currentColor" fill-opacity="0.4"/><path d="M18 6 Q15 10 17 14 Q20 10 18 6 Z" fill="currentColor" fill-opacity="0.4"/><path d="M8 15 Q12 21 16 15 Q12 18 8 15 Z" fill="currentColor" fill-opacity="0.55"/><path d="M3 20 Q12 24 21 20" opacity="0.5"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="6" fill="currentColor" fill-opacity="0.3"/><circle cx="12" cy="13" r="3.2" stroke-width="1.4"/><path d="M12 2 Q14 6 12 9 Q10 6 12 2 Z" fill="currentColor" fill-opacity="0.6" stroke="none"/><path d="M5 6 Q8 8 8 11" opacity="0.6"/><path d="M19 6 Q16 8 16 11" opacity="0.6"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 Q7 13 10 17 Q13 21 17 17 Q20 14 22 17" stroke-width="2"/><path d="M5 12 Q8 9 11 12 Q14 15 17 12" stroke-width="1.8" opacity="0.7"/><path d="M8 7 Q10 5 12 7 Q14 9 16 7" stroke-width="1.6" opacity="0.5"/><circle cx="10" cy="17" r="1.1" fill="currentColor" stroke="none"/><circle cx="17" cy="17" r="1" fill="currentColor" stroke="none"/></svg>`,
    `<svg class="skill-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5" opacity="0.65"/><path d="M12 3.5 A8.5 8.5 0 0 1 12 20.5 A4.25 4.25 0 0 1 12 12 A4.25 4.25 0 0 0 12 3.5 Z" fill="currentColor" fill-opacity="0.28" stroke="none"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="16.2" r="1" fill="currentColor" stroke="none"/><path d="M4 4 L7 7 M20 4 L17 7 M4 20 L7 17 M20 20 L17 17" opacity="0.5"/></svg>`
  ]
};

/* ★ 把触屏技能按钮的图标同步成当前职业的真实技能图标（未学习的格子稍后隐藏） */
function syncTouchSkillIcons(){
  const p1w = (G && G.player) ? G.player.weaponIdx : 0;
  const p2w = (G && G.player2) ? G.player2.weaponIdx : p1w;
  const jobs = [[1, p1w], [2, p2w]];
  for(const [num, wIdx] of jobs){
    const w = WEAPONS[wIdx] || WEAPONS[0];
    const icons = SKILL_ICONS[w.id] || SKILL_ICONS.sword;
    const prefix = num === 1 ? 'p1' : 'p2';
    for(let i = 0; i < 6; i++){
      const el = document.getElementById(prefix + 'skill' + (i + 1));
      if(!el) continue;
      const tag = w.id + '_' + i;
      if(el.dataset.iconFor === tag) continue;
      el.innerHTML = icons[i] || `<span style="font-size:17px;opacity:.85;pointer-events:none">${i+1}</span>`;
      el.dataset.iconFor = tag;
    }
  }
}
window.syncTouchSkillIcons = syncTouchSkillIcons;

const skillIconCache = {};
function getSkillIconImage(weaponId, idx){
  const key = weaponId+'_'+idx;
  if(skillIconCache[key]) return skillIconCache[key];
  const arr = SKILL_ICONS[weaponId] || SKILL_ICONS.sword;
  const raw = arr[idx % arr.length];
  /* currentColor 换成白色（canvas 不解析 CSS 变量）
     + 补固有宽高：没有 width/height 的 SVG 在 canvas 里可能被当成 0 尺寸 */
  const svgStr = raw
    .replace(/currentColor/g, '#ffffff')
    .replace('<svg ', '<svg width="64" height="64" ');
  const entry = { img: new Image(), ready: false, failed: false };
  entry.img.onload = ()=>{ entry.ready = true; };
  entry.img.onerror = ()=>{ entry.failed = true; };
  skillIconCache[key] = entry;
  entry.img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  return entry;
}
/* 不能只信 onload：某些环境下 data URI 会先把 complete 置 true 而事件迟迟不派发，
   这里以「解码结果是否可用」为准，顺手把迟到的就绪状态补回去 */
function skillIconReady(entry){
  if(!entry) return false;
  if(entry.ready) return true;
  const im = entry.img;
  if(im && im.complete && im.naturalWidth > 0){ entry.ready = true; return true; }
  return false;
}
function hexToRgba(hex, a){
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function updateSkillIcons(num, weaponIdx){
  const wid = WEAPONS[weaponIdx].id;
  const icons = SKILL_ICONS[wid]; if(!icons) return;
  const prefix = num===1?'p1':'p2';
  for(let i=0;i<6;i++){
    const el = document.getElementById(prefix+'skill'+(i+1));
    if(el && icons[i]){
      /* 确保SVG使用白色 */
      const svgStr = icons[i].replace(/currentColor/g, '#ffffff');
      el.innerHTML = svgStr;
    }
  }
  refreshSkillLockUI();
}

/* ★ 技能栏锁定态：未领悟的招式直接隐藏，学会后再出现（方向/普攻/跳跃不受影响） */
function refreshSkillLockUI(){
  if(!G) return;
  const pairs = [[1, G.player], [2, G.player2]];
  for(const [num, p] of pairs){
    const prefix = num === 1 ? 'p1' : 'p2';
    for(let i = 0; i < 6; i++){
      const el = document.getElementById(prefix + 'skill' + (i + 1));
      if(!el) continue;
      let locked = false;
      if(p && !p.pvpAllSkills && !G.isPvp){
        locked = !(p.skillsUnlocked && p.skillsUnlocked[i]);
      }
      /* 隐藏而非灰显：未学习的技能不占视觉，学会后淡入 */
      el.style.visibility = locked ? 'hidden' : 'visible';
      el.style.opacity = locked ? '0' : '';
      el.style.pointerEvents = locked ? 'none' : 'auto';
      el.style.filter = '';
      el.title = '';
      el.classList.toggle('slot-hidden', locked);
    }
  }
}
window.refreshSkillLockUI = refreshSkillLockUI;

