import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  GeoPermissibleObjects,
  geoContains,
  geoGraticule10,
  geoOrthographic,
  geoPath,
} from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countriesAtlas from 'world-atlas/countries-110m.json';

export interface GlobeTarget {
  latitude: number;
  longitude: number;
  /** ISO 3166-1 numeric id of the country to highlight (e.g. "620" = Portugal). Detected from the coordinates when omitted. */
  countryId?: string;
}

/** Scroll phases (fractions of `progress`). Kept together so the story is easy to retime. */
const PHASE = {
  rotate: [0, 0.3], // spin the globe until the target faces the viewer
  zoom: [0.26, 0.6], // dive from space to street level
  city: [0.48, 0.64], // cross-fade into the stylised city map (before the coarse coastline shows)
  pins: [0.64, 0.9], // drop the lead pins one by one
} as const;

const MAX_ZOOM = 30;
const IDLE_SPEED_DEG_PER_S = 5;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const phase = (progress: number, [start, end]: readonly [number, number]) =>
  clamp01((progress - start) / (end - start));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Deterministic pseudo-random generator so the city layout is identical on every render. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

interface CityPin {
  x: number; // offset from centre, in fractions of the city radius
  y: number;
  status: 'ok' | 'missing' | 'partial';
}

/**
 * Canvas globe driven by a 0..1 `progress` (typically scroll progress).
 * Spins towards `target`, zooms in and turns into a stylised city map with lead pins.
 * Drawing happens in a requestAnimationFrame loop outside Angular change detection.
 */
@Component({
  selector: 'app-globe',
  template: '<canvas #canvas class="globe"></canvas>',
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }

    .globe {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class GlobeComponent {
  readonly progress = input(0);
  readonly target = input.required<GlobeTarget>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  private readonly topology = countriesAtlas as unknown as Topology<{
    countries: GeometryCollection;
  }>;
  private readonly countries = feature(this.topology, this.topology.objects.countries);
  private readonly borders = mesh(
    this.topology,
    this.topology.objects.countries,
    (a, b) => a !== b,
  );
  private readonly graticule = geoGraticule10();
  private readonly projection = geoOrthographic().clipAngle(90).precision(0.3);
  private readonly pins = this.createPins();

  /** Country containing the target, used for the highlight. */
  private readonly targetCountry = computed(() => {
    const { latitude, longitude, countryId } = this.target();
    return this.countries.features.find((country) =>
      countryId ? country.id === countryId : geoContains(country, [longitude, latitude]),
    );
  });

  /** Position actually drawn; eases towards `target` so a late change (e.g. geolocation) glides instead of jumping. */
  private current: { latitude: number; longitude: number } | null = null;
  private readonly streets = this.createStreets();

  constructor() {
    afterNextRender(() => this.start());
  }

  private start(): void {
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    // Keep the backing store in sync with the element size and device pixel ratio.
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const loop = (time: number) => {
      this.draw(context, canvas.clientWidth, canvas.clientHeight, reduceMotion ? 0 : time / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    });
  }

  private draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    seconds: number,
  ): void {
    const progress = this.progress();
    const target = this.follow(this.target());
    const rotate = easeInOut(phase(progress, PHASE.rotate));
    const zoom = easeInOut(phase(progress, PHASE.zoom));
    const city = phase(progress, PHASE.city);

    // Wide screens: globe on the right, hero text on the left.
    // Narrow screens: globe rises from the bottom like a horizon so it does not sit under the text.
    const wide = width > 900;
    const cx = lerp(wide ? width * 0.7 : width / 2, width / 2, rotate);
    const cy = lerp(wide ? height * 0.52 : height * 1.02, height / 2, rotate);
    const baseScale = wide ? Math.min(width, height) * 0.36 : width * 0.62;
    const scale = baseScale * MAX_ZOOM ** zoom;

    // Idle spin fades out as the scroll takes over the rotation.
    const idle = (seconds * IDLE_SPEED_DEG_PER_S) % 360;
    const longitude = target.longitude + (80 + idle) * (1 - rotate);
    const latitude = lerp(18, target.latitude, rotate);
    this.projection.rotate([-longitude, -latitude]).scale(scale).translate([cx, cy]);
    const path = geoPath(this.projection, ctx);

    ctx.clearRect(0, 0, width, height);

    if (city < 1) {
      ctx.globalAlpha = 1 - city;
      this.drawAtmosphere(ctx, cx, cy, scale, zoom);
      this.drawSphere(ctx, path, cx, cy, scale);
      // The highlight fades while diving so the zoomed-in country is not a flat block of colour.
      this.drawCountries(ctx, path, rotate * (1 - zoom * 0.75));
      if (rotate > 0.4) this.drawTargetPulse(ctx, target, seconds, (rotate - 0.4) / 0.6);
      ctx.globalAlpha = 1;
    }

    if (city > 0) this.drawCity(ctx, width, height, city, progress, seconds);
  }

  /** Moves the drawn position ~8% of the way to the target per frame (longitude takes the short way round). */
  private follow(target: GlobeTarget): { latitude: number; longitude: number } {
    if (!this.current) this.current = { latitude: target.latitude, longitude: target.longitude };
    const deltaLongitude = ((target.longitude - this.current.longitude + 540) % 360) - 180;
    this.current.latitude += (target.latitude - this.current.latitude) * 0.08;
    this.current.longitude += deltaLongitude * 0.08;
    return this.current;
  }

  private drawAtmosphere(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    zoom: number,
  ): void {
    if (zoom > 0.6) return;
    const glow = ctx.createRadialGradient(cx, cy, scale * 0.9, cx, cy, scale * 1.35);
    glow.addColorStop(0, `rgba(99, 102, 241, ${0.45 * (1 - zoom)})`);
    glow.addColorStop(0.4, `rgba(6, 182, 212, ${0.12 * (1 - zoom)})`);
    glow.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, scale * 1.35, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSphere(
    ctx: CanvasRenderingContext2D,
    path: ReturnType<typeof geoPath>,
    cx: number,
    cy: number,
    scale: number,
  ): void {
    // Light comes from the top-left to give the ocean some depth.
    const ocean = ctx.createRadialGradient(
      cx - scale * 0.4,
      cy - scale * 0.4,
      scale * 0.1,
      cx,
      cy,
      scale,
    );
    ocean.addColorStop(0, '#1e3a8a');
    ocean.addColorStop(1, '#0b1440');
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.fillStyle = ocean;
    ctx.fill();

    ctx.beginPath();
    path(this.graticule);
    ctx.strokeStyle = 'rgba(148, 163, 255, 0.12)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  private drawCountries(
    ctx: CanvasRenderingContext2D,
    path: ReturnType<typeof geoPath>,
    rotate: number,
  ): void {
    ctx.beginPath();
    path(this.countries as GeoPermissibleObjects);
    ctx.fillStyle = '#3446a8';
    ctx.fill();

    ctx.beginPath();
    path(this.borders);
    ctx.strokeStyle = 'rgba(199, 210, 254, 0.35)';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Highlight the target country as it rotates into view.
    const country = this.targetCountry();
    if (country && rotate > 0) {
      ctx.beginPath();
      path(country);
      ctx.fillStyle = `rgba(6, 182, 212, ${0.85 * rotate})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(165, 243, 252, ${rotate})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  private drawTargetPulse(
    ctx: CanvasRenderingContext2D,
    target: { latitude: number; longitude: number },
    seconds: number,
    strength: number,
  ): void {
    const point = this.projection([target.longitude, target.latitude]);
    if (!point) return;
    const [x, y] = point;
    const wave = (seconds * 0.8) % 1;

    ctx.beginPath();
    ctx.arc(x, y, 6 + wave * 26, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - wave) * 0.8 * strength})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${strength})`;
    ctx.fill();
  }

  /** Stylised street map with a search radius and lead pins dropping in. */
  private drawCity(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    city: number,
    progress: number,
    seconds: number,
  ): void {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.36;
    // Slow zoom continues after the cross-fade so the map never feels frozen.
    const drift = 1 + progress * 0.15;

    ctx.save();
    ctx.globalAlpha = city;
    ctx.fillStyle = '#0a1030';
    ctx.fillRect(0, 0, width, height);

    ctx.translate(cx, cy);
    ctx.scale(drift, drift);

    // Streets: rotated grid + a few avenues, all derived from a fixed seed.
    ctx.lineCap = 'round';
    for (const street of this.streets) {
      ctx.beginPath();
      ctx.moveTo(street.x1 * width, street.y1 * height);
      ctx.lineTo(street.x2 * width, street.y2 * height);
      ctx.strokeStyle = street.main ? 'rgba(129, 140, 248, 0.28)' : 'rgba(129, 140, 248, 0.1)';
      ctx.lineWidth = street.main ? 3 : 1;
      ctx.stroke();
    }

    // River
    ctx.beginPath();
    ctx.moveTo(-width, height * 0.18);
    ctx.bezierCurveTo(
      -width * 0.2,
      -height * 0.05,
      width * 0.1,
      height * 0.35,
      width,
      height * 0.1,
    );
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Search radius
    ctx.beginPath();
    ctx.arc(0, 0, radius * city, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.fill();
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -seconds * 12;
    ctx.strokeStyle = 'rgba(165, 180, 252, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Pins drop in sequence across the "pins" phase.
    const pinsProgress = phase(progress, PHASE.pins);
    this.pins.forEach((pin, index) => {
      const local = clamp01(pinsProgress * this.pins.length - index);
      if (local <= 0) return;
      this.drawPin(ctx, pin.x * radius, pin.y * radius - (1 - easeOutBack(local)) * 40, pin, local);
    });

    // Centre marker (the searched locality)
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 12 + ((seconds * 0.8) % 1) * 18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - ((seconds * 0.8) % 1))})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private drawPin(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    pin: CityPin,
    alpha: number,
  ): void {
    const colors = { ok: '#34d399', partial: '#fbbf24', missing: '#f87171' };
    ctx.save();
    ctx.globalAlpha *= Math.min(1, alpha * 1.5);
    ctx.translate(x, y);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 2, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // Teardrop
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-4, -6, -10, -12, -10, -19);
    ctx.arc(0, -19, 10, Math.PI, 0);
    ctx.bezierCurveTo(10, -12, 4, -6, 0, 0);
    ctx.fillStyle = colors[pin.status];
    ctx.shadowColor = colors[pin.status];
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(0, -19, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1030';
    ctx.fill();
    ctx.restore();
  }

  private createPins(): CityPin[] {
    const random = seeded(7);
    const statuses: CityPin['status'][] = ['missing', 'ok', 'partial', 'missing', 'ok', 'missing'];
    return Array.from({ length: 16 }, (_, index) => {
      // Spread pins evenly by angle, random distance inside the search radius.
      const angle = index * 2.4 + random() * 0.6;
      const distance = 0.25 + random() * 0.7;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        status: statuses[index % statuses.length],
      };
    });
  }

  private createStreets(): { x1: number; y1: number; x2: number; y2: number; main: boolean }[] {
    const random = seeded(42);
    const streets = [];
    const angle = 0.21; // slight rotation so the grid does not look like graph paper
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let i = -14; i <= 14; i++) {
      const offset = i * 0.07 + (random() - 0.5) * 0.02;
      const main = i % 5 === 0;
      // Horizontal-ish and vertical-ish lines, coordinates as fractions of the viewport.
      streets.push({ x1: -cos, y1: offset - sin, x2: cos, y2: offset + sin, main });
      streets.push({ x1: offset + sin, y1: -cos, x2: offset - sin, y2: cos, main });
    }
    // Diagonal avenues
    streets.push({ x1: -1, y1: -0.8, x2: 1, y2: 0.9, main: true });
    streets.push({ x1: -0.9, y1: 1, x2: 0.8, y2: -1, main: true });
    return streets;
  }
}
