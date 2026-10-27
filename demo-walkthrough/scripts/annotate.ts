import type { Page } from "@playwright/test";

const RED = "#e11d48";

/** Annotation directions describe where the arrow sits relative to the target. */
type Direction = "up" | "down" | "left" | "right";

export type AnnotateSpec = {
  /** CSS selector for a single target. */
  selector?: string;
  /** CSS selector for a collection; pair with `text`. */
  all?: string;
  /** Exact trimmed text of the item to pick out of `all`. */
  text?: string;
  dir: Direction;
  caption: string;
  badge?: string;
};

/**
 * Draws a spotlight, a ring, an arrow and a numbered badge over one element.
 *
 * Everything is injected as a fixed-position overlay inside the page, which is
 * the only way annotations survive a screenshot. Call `clearAnnotations` before
 * the next step so overlays do not stack.
 */
export async function annotate(page: Page, spec: AnnotateSpec) {
  await page.evaluate(
    ({ spec, RED }) => {
      // Apps render mobile and desktop copies of the same control. The hidden
      // copy has a zero-size rect, so only visible candidates are eligible.
      const candidates = [
        ...document.querySelectorAll(spec.all ?? spec.selector ?? ""),
      ].filter((node) => node.getBoundingClientRect().width > 0);

      const el = spec.text
        ? candidates.find((node) => node.textContent?.trim() === spec.text)
        : candidates[0];

      if (!el) throw new Error(`annotation target not found: ${spec.selector ?? spec.text}`);

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const gap = 84;

      let start: [number, number];
      let end: [number, number];

      if (spec.dir === "up") {
        start = [cx, Math.min(innerHeight - 24, r.bottom + gap)];
        end = [cx, r.bottom + 7];
      } else if (spec.dir === "down") {
        start = [cx, Math.max(24, r.top - gap)];
        end = [cx, r.top - 7];
      } else if (spec.dir === "left") {
        start = [Math.max(24, Math.min(innerWidth - 24, r.right + gap)), cy];
        end = [r.right + 7, cy];
      } else {
        start = [Math.max(24, Math.min(innerWidth - 24, r.left - gap)), cy];
        end = [r.left - 7, cy];
      }

      const layer = document.createElement("div");
      layer.setAttribute("data-annotation", "true");
      layer.style.cssText = "position:fixed;inset:0;z-index:2147483000;pointer-events:none;";

      const spot = document.createElement("div");
      spot.style.cssText = [
        "position:absolute",
        `left:${r.left - 7}px`,
        `top:${r.top - 7}px`,
        `width:${r.width + 14}px`,
        `height:${r.height + 14}px`,
        "border-radius:12px",
        `box-shadow:0 0 0 3px ${RED}, 0 0 0 9999px rgba(15,23,42,0.38)`,
      ].join(";");
      layer.appendChild(spot);

      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("width", String(innerWidth));
      svg.setAttribute("height", String(innerHeight));
      svg.style.cssText = "position:absolute;inset:0;overflow:visible;";
      layer.appendChild(svg);

      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", String(start[0]));
      line.setAttribute("y1", String(start[1]));
      line.setAttribute("x2", String(end[0]));
      line.setAttribute("y2", String(end[1]));
      line.setAttribute("stroke", RED);
      line.setAttribute("stroke-width", "5");
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);

      const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
      const size = 17;
      const head = document.createElementNS(NS, "polygon");
      head.setAttribute(
        "points",
        [
          `${end[0]},${end[1]}`,
          `${end[0] - size * Math.cos(angle - 0.5)},${end[1] - size * Math.sin(angle - 0.5)}`,
          `${end[0] - size * Math.cos(angle + 0.5)},${end[1] - size * Math.sin(angle + 0.5)}`,
        ].join(" ")
      );
      head.setAttribute("fill", RED);
      svg.appendChild(head);

      const badgeSize = 34;
      const badge = document.createElement("div");
      badge.textContent = spec.badge ?? "";
      badge.style.cssText = [
        "position:absolute",
        `left:${start[0] - badgeSize / 2}px`,
        `top:${start[1] - badgeSize / 2}px`,
        `width:${badgeSize}px`,
        `height:${badgeSize}px`,
        "border-radius:999px",
        `background:${RED}`,
        "color:#fff",
        "font:600 17px/34px system-ui, -apple-system, Segoe UI, sans-serif",
        "text-align:center",
        "box-shadow:0 2px 8px rgba(0,0,0,.35)",
      ].join(";");
      layer.appendChild(badge);

      const caption = document.createElement("div");
      caption.textContent = spec.caption;
      caption.style.cssText = [
        "position:absolute",
        "left:50%",
        "bottom:22px",
        "transform:translateX(-50%)",
        "max-width:88%",
        "padding:11px 18px",
        "border-radius:999px",
        "background:#0f172a",
        "color:#fff",
        "font:500 15px/1.3 system-ui, -apple-system, Segoe UI, sans-serif",
        "white-space:nowrap",
        "overflow:hidden",
        "text-overflow:ellipsis",
        "box-shadow:0 6px 20px rgba(0,0,0,.35)",
      ].join(";");
      layer.appendChild(caption);

      document.body.appendChild(layer);
    },
    { spec, RED }
  );

  await page.waitForTimeout(350);
}

export async function clearAnnotations(page: Page) {
  await page.evaluate(() => {
    for (const node of document.querySelectorAll('[data-annotation="true"]')) node.remove();
  });
}

/** Annotate, capture, then clean up so the next step starts from a plain page. */
export async function shot(page: Page, path: string, spec: AnnotateSpec) {
  await annotate(page, spec);
  await page.screenshot({ path });
  await clearAnnotations(page);
  console.log("saved", path);
}
