// Choreography from owner-approved BusyDoo-launch.html, concept 04.
export const CINEMATIC_SECONDS = 5.4;
export const REGULAR_LAUNCH_MS = 280;

const starts = [[87, 177, -6], [273, 225, 5], [86, 395, 4], [273, 466, -5]];
const ends = [[145, 264], [215, 264], [145, 334], [215, 334]];
const curves = [12, -15, 16, -14];

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const range = (time: number, start: number, end: number) => clamp((time - start) / (end - start));
const smooth = (value: number) => value * value * (3 - 2 * value);
const ease = (value: number) => 1 - Math.pow(1 - value, 3);
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

function set(element: Element, name: string, value: string | number) {
  element.setAttribute(name, String(value));
}
const opacity = (element: Element, value: number) => set(element, 'opacity', value);

export function createLaunchRenderer(stage: HTMLElement) {
  const select = (selector: string) => stage.querySelector(selector)!;
  const intro = select('#intro');
  const glow = select('#glow');
  const connections = select('#connections');
  const threadPath = select('#connections path');
  const pieces = [...stage.querySelectorAll('.piece')].map(piece => ({
    piece,
    card: piece.querySelector('.card')!,
    copy: piece.querySelector('.copy')!,
    tile: piece.querySelector('.tile')!,
  }));
  const bars = [...stage.querySelectorAll<SVGRectElement>('.bar')].map(bar => ({ bar, height: Number(bar.dataset.h) }));
  const date = select('#date');
  const check = select('#check');
  const coin = select('#coin');
  const orbit = select('#orbit');
  const orbitPath = select('#orbitdraw');
  const brand = select('#brand');
  const tagline = select('#tagline');

  set(threadPath, 'stroke-dasharray', 1);
  set(check, 'stroke-dasharray', 1);
  set(orbitPath, 'stroke-dasharray', 1);

  return (time: number) => {
    const arrival = smooth(range(time, 0, .55));
    opacity(intro, arrival * (1 - smooth(range(time, 2.25, 2.85))));
    opacity(glow, .25 + .55 * smooth(range(time, 2.6, 4)));
    const thread = smooth(range(time, .95, 2.1));
    opacity(connections, thread * .65 * (1 - smooth(range(time, 2.45, 3.25))));
    set(threadPath, 'stroke-dashoffset', 1 - thread);

    pieces.forEach(({ piece, card, copy, tile }, index) => {
      const [startX, startY, rotation] = starts[index];
      const [endX, endY] = ends[index];
      const delay = .15 + index * .14;
      const enter = range(time, delay, delay + .63);
      const appear = ease(enter);
      const gather = range(time, 2.48 + index * .085, 3.62 + index * .045);
      const travel = smooth(gather);
      const curve = Math.sin(Math.PI * travel) * curves[index];
      const settle = range(time, 3.7, 4.05);
      const bounce = gather === 1 ? Math.sin(settle * Math.PI * 2) * Math.exp(-settle * 4) * 1.8 : 0;
      const x = mix(startX, endX, travel) + curve;
      const y = mix(startY + (1 - appear) * 32, endY, travel) + bounce;
      const scale = mix(.84 + .16 * appear, 1, travel);
      set(piece, 'transform', 'translate(' + x + ' ' + y + ') rotate(' + rotation * (1 - travel) + ') scale(' + scale + ')');
      opacity(piece, clamp(enter * 3));

      const shrink = smooth(range(gather, 0, .83));
      opacity(card, 1 - shrink);
      set(card, 'transform', 'scale(' + mix(1, .45, shrink) + ')');
      opacity(copy, 1 - smooth(range(gather, 0, .35)));
      const emphasis = Math.sin(Math.PI * range(time, .7 + index * .28, 1.2 + index * .28)) * .035;
      set(tile, 'transform', 'translate(0 ' + mix(-23, 0, travel) + ') scale(' + mix(.73 + emphasis, 1, travel) + ')');
    });

    opacity(date, smooth(range(time, .65, .95)) * (1 - smooth(range(time, 2.5, 2.8))));
    set(check, 'stroke-dashoffset', 1 - smooth(range(time, .92, 1.28)));
    bars.forEach(({ bar, height }, index) => {
      const growth = height * mix(.12, 1, ease(range(time, 1.2 + index * .12, 1.8 + index * .12)));
      set(bar, 'height', growth);
      set(bar, 'y', 18 - growth);
    });
    const drop = range(time, 1.45, 2.05);
    opacity(coin, Math.sin(Math.PI * drop) * .95);
    set(coin, 'transform', 'translate(0 ' + mix(-25, 17, smooth(drop)) + ') rotate(' + drop * 40 + ')');

    const orbitProgress = smooth(range(time, 3.62, 4.38));
    opacity(orbit, orbitProgress);
    set(orbitPath, 'stroke-dashoffset', 1 - orbitProgress);
    const wordmark = smooth(range(time, 4, 4.65));
    opacity(brand, wordmark);
    set(brand, 'transform', 'translate(0 ' + (1 - wordmark) * 12 + ')');
    opacity(tagline, smooth(range(time, 4.45, 5.1)));
  };
}
