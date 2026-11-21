// gridlines.js — measure vertical alignment in a live page.
// Defines window.__gridlines(options) -> report, plus __gridlinesGuides() / __gridlinesClear().
// No dependencies. Paste into the console, or page.addScriptTag({ path }).

(() => {
  const DEFAULTS = { root: 'body', tolerance: 1, nearMiss: 6, minColumn: 3 };
  const ICON_TAGS = new Set(['svg', 'img']);

  const round = (n) => Math.round(n * 10) / 10;

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  }

  function ownText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) return true;
    }
    return false;
  }

  function classify(el) {
    const tag = el.tagName.toLowerCase();
    if (ICON_TAGS.has(tag)) return 'icon';
    if (el.getAttribute('role') === 'img' && !el.textContent.trim()) return 'icon';
    if (ownText(el)) return 'text';
    // An empty leaf box of icon size is an icon (icon font, background image, mask).
    if (!el.children.length) {
      const r = el.getBoundingClientRect();
      if (r.width >= 6 && r.width <= 40 && r.height >= 6 && r.height <= 40) return 'icon';
    }
    return null;
  }

  function path(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 4) {
      if (node.id) {
        parts.unshift('#' + node.id);
        break;
      }
      let part = node.tagName.toLowerCase();
      const cls = (node.className && typeof node.className === 'string')
        ? node.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      if (cls) part += '.' + cls;
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function cluster(values, tolerance) {
    const sorted = [...values].sort((a, b) => a - b);
    const groups = [];
    for (const v of sorted) {
      const last = groups[groups.length - 1];
      if (last && v - last.max <= tolerance) {
        last.items.push(v);
        last.max = v;
      } else {
        groups.push({ items: [v], max: v });
      }
    }
    return groups.map((g) => {
      const mean = g.items.reduce((a, b) => a + b, 0) / g.items.length;
      return { left: round(mean), count: g.items.length };
    });
  }

  function report(options) {
    const opts = { ...DEFAULTS, ...(options || {}) };
    const root = typeof opts.root === 'string' ? document.querySelector(opts.root) : opts.root;
    if (!root) return { error: `root not found: ${opts.root}` };

    const items = [];
    for (const el of root.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const kind = classify(el);
      if (!kind) continue;
      const r = el.getBoundingClientRect();
      items.push({
        el, kind, selector: path(el),
        left: round(r.left), right: round(r.right),
        top: round(r.top), bottom: round(r.bottom),
        cx: round(r.left + r.width / 2), cy: round(r.top + r.height / 2),
        w: round(r.width), h: round(r.height),
      });
    }

    const lefts = items.map((i) => i.left);
    const primary = cluster(lefts, opts.tolerance).filter((c) => c.count >= opts.minColumn);
    const onPrimary = (v) => primary.some((c) => Math.abs(c.left - v) <= opts.tolerance);
    const secondary = cluster(lefts.filter((v) => !onPrimary(v)), opts.tolerance)
      .filter((c) => c.count >= 2);
    const columns = [...primary, ...secondary].sort((a, b) => a.left - b.left);

    const nearMisses = [];
    const offGrid = [];
    for (const item of items) {
      if (!columns.length) break;
      let best = columns[0];
      for (const c of columns) {
        if (Math.abs(c.left - item.left) < Math.abs(best.left - item.left)) best = c;
      }
      const delta = round(item.left - best.left);
      const abs = Math.abs(delta);
      if (abs > opts.tolerance && abs <= opts.nearMiss) {
        nearMisses.push({ selector: item.selector, kind: item.kind, left: item.left, guide: best.left, delta });
      } else if (abs > opts.nearMiss) {
        offGrid.push({ selector: item.selector, kind: item.kind, left: item.left, nearest: best.left, delta });
      }
    }
    nearMisses.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));

    // Rows: same top within 2px, then icon -> text gaps.
    const rows = [];
    for (const item of items) {
      const row = rows.find((r) => Math.abs(r.top - item.top) <= 2);
      if (row) row.items.push(item);
      else rows.push({ top: item.top, items: [item] });
    }
    const iconGaps = [];
    for (const row of rows) {
      const icons = row.items.filter((i) => i.kind === 'icon').sort((a, b) => a.left - b.left);
      const texts = row.items.filter((i) => i.kind === 'text' && i.w > 2).sort((a, b) => a.left - b.left);
      if (icons.length !== 1 || !texts.length) continue;
      const text = texts.find((t) => t.left >= icons[0].right) || texts[0];
      iconGaps.push({ selector: text.selector, gap: round(text.left - icons[0].right), top: row.top });
    }
    const gapCounts = {};
    for (const g of iconGaps) gapCounts[g.gap] = (gapCounts[g.gap] || 0) + 1;
    const modalGap = Object.entries(gapCounts).sort((a, b) => b[1] - a[1])[0];
    const gapOutliers = modalGap
      ? iconGaps.filter((g) => Math.abs(g.gap - Number(modalGap[0])) > opts.tolerance)
      : [];

    // Toolbar-like containers: children must share one vertical centre.
    const centres = [];
    const toolbarSel = opts.toolbars || '[role="toolbar"], header, nav, .toolbar, .navbar, .topbar';
    for (const box of document.querySelectorAll(toolbarSel)) {
      if (!visible(box) || !(box.contains(root) || root.contains(box))) continue;
      const kids = [...box.children].filter(visible).map((c) => c.getBoundingClientRect());
      if (kids.length < 2) continue;
      const cys = kids.map((r) => r.top + r.height / 2);
      const spread = round(Math.max(...cys) - Math.min(...cys));
      if (spread > opts.tolerance) {
        centres.push({ selector: path(box), spread, children: kids.length });
      }
    }
    centres.sort((a, b) => b.spread - a.spread);

    return {
      region: opts.root,
      elements: items.length,
      columns,
      nearMisses,
      offGrid,
      iconGaps: {
        modal: modalGap ? Number(modalGap[0]) : null,
        rows: iconGaps.length,
        outliers: gapOutliers,
      },
      centres,
    };
  }

  function drawGuides(options) {
    clearGuides();
    const rep = window.__gridlinesReport || report(options);
    if (!rep || !rep.columns) return rep;
    for (const c of rep.columns) {
      const line = document.createElement('div');
      line.dataset.gridlines = 'guide';
      Object.assign(line.style, {
        position: 'fixed', top: '0', left: `${c.left}px`, width: '1px',
        height: '100vh', background: 'rgba(255,0,80,0.7)',
        pointerEvents: 'none', zIndex: '2147483647',
      });
      const tag = document.createElement('div');
      tag.textContent = `${c.left}px`;
      Object.assign(tag.style, {
        position: 'absolute', top: '0', left: '2px', font: '10px/1.4 monospace',
        color: '#fff', background: 'rgba(255,0,80,0.9)', padding: '1px 3px',
        whiteSpace: 'nowrap',
      });
      line.appendChild(tag);
      document.body.appendChild(line);
    }
    return rep;
  }

  function clearGuides() {
    for (const el of document.querySelectorAll('[data-gridlines="guide"]')) el.remove();
  }

  window.__gridlines = (options) => {
    const rep = report(options);
    window.__gridlinesReport = rep;
    if (console.table && rep.columns) {
      console.table(rep.columns);
      if (rep.nearMisses.length) console.table(rep.nearMisses);
      if (rep.iconGaps.outliers.length) console.table(rep.iconGaps.outliers);
      if (rep.centres.length) console.table(rep.centres);
    }
    return rep;
  };
  window.__gridlinesGuides = drawGuides;
  window.__gridlinesClear = clearGuides;
})();
