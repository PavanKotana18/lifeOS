const savedAppearance = localStorage.getItem('lifeos-appearance');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialDark = savedAppearance === 'dark' || (savedAppearance !== 'light' && systemDark);

document.documentElement.classList.toggle('dark', initialDark);
document.documentElement.style.colorScheme = initialDark ? 'dark' : 'light';
document.querySelector('meta[name="theme-color"]')?.setAttribute(
  'content',
  initialDark ? '#090d16' : '#f8fafc'
);
