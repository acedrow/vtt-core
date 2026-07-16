import type { Ref } from "vue";
import { computed, nextTick, ref, watch } from "vue";

import { readPersistedViewport, writePersistedViewport } from "./uiPersist.js";

const CONTENT_PAD = 0;
const ZOOM_MAX_FACTOR = 4;
const ZOOM_OUT_MIN_FACTOR = 0.65;
const PAN_MIN_VISIBLE_FRACTION = 0.2;
const FOCUS_ANIM_MS = 350;

function clampPanAxis(pan: number, scaledSize: number, viewportSize: number): number {
  const minVisible = Math.min(
    scaledSize * PAN_MIN_VISIBLE_FRACTION,
    viewportSize * PAN_MIN_VISIBLE_FRACTION,
  );
  return Math.min(viewportSize - minVisible, Math.max(minVisible - scaledSize, pan));
}

export function useBoardViewport(
  viewportEl: Ref<HTMLElement | null>,
  contentWidthPx: Ref<number>,
  contentHeightPx: Ref<number>,
  isReady: Ref<boolean>,
  viewportKey: Ref<string | null>,
  topInsetPx: Ref<number> = ref(0),
) {
  const scale = ref(1);
  const panX = ref(0);
  const panY = ref(0);
  const fitScale = ref(1);
  const fitPanX = ref(0);
  const fitPanY = ref(0);
  const stageAnimating = ref(false);

  const stageStyle = computed(() => {
    const s = scale.value;
    const fit = fitScale.value;
    // Keep on-screen icon size at fit zoom; grow linearly to 2× that size at max zoom.
    let iconCounterScale = 2;
    if (fit > 0 && s > 0) {
      const r = s / fit;
      const growth = Math.max(1, (r + ZOOM_MAX_FACTOR - 2) / (ZOOM_MAX_FACTOR - 1));
      iconCounterScale = ((2 * fit) / s) * growth;
    }
    return {
      transform: `translate(${panX.value}px, ${panY.value}px) scale(${s})`,
      "--board-scale": String(s),
      "--board-fit-scale": String(fit),
      "--board-icon-counter-scale": String(iconCounterScale),
      ...(stageAnimating.value ? { transition: `transform ${FOCUS_ANIM_MS}ms ease-out` } : {}),
    };
  });

  const isTransformed = computed(
    () =>
      Math.abs(scale.value - fitScale.value) > 0.005 ||
      Math.abs(panX.value - fitPanX.value) > 1 ||
      Math.abs(panY.value - fitPanY.value) > 1,
  );

  function getContentSize() {
    return {
      w: contentWidthPx.value + CONTENT_PAD,
      h: contentHeightPx.value + CONTENT_PAD,
    };
  }

  function viewportSize(el: HTMLElement): { vw: number; vh: number } | null {
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    return vw > 0 && vh > 0 ? { vw, vh } : null;
  }

  function computeFitTransform(vw: number, vh: number) {
    const { w, h } = getContentSize();
    const inset = topInsetPx.value;
    const availH = Math.max(1, vh - inset);
    const s = Math.min(vw / w, availH / h);
    return { scale: s, panX: (vw - w * s) / 2, panY: inset + (availH - h * s) / 2 };
  }

  function updateFitState() {
    const el = viewportEl.value;
    if (!el) return;
    const size = viewportSize(el);
    if (!size) return;
    const fit = computeFitTransform(size.vw, size.vh);
    fitScale.value = fit.scale;
    fitPanX.value = fit.panX;
    fitPanY.value = fit.panY;
  }

  function clampView() {
    const el = viewportEl.value;
    if (!el || !viewportSize(el)) return;
    const minS = fitScale.value * ZOOM_OUT_MIN_FACTOR;
    const maxS = fitScale.value * ZOOM_MAX_FACTOR;
    scale.value = Math.min(maxS, Math.max(minS, scale.value));
    const { w, h } = getContentSize();
    const scaledW = w * scale.value;
    const scaledH = h * scale.value;
    panX.value = clampPanAxis(panX.value, scaledW, el.clientWidth);
    panY.value = clampPanAxis(panY.value, scaledH, el.clientHeight);
  }

  function fitToView(animate = false) {
    const el = viewportEl.value;
    const size = el ? viewportSize(el) : null;
    if (!el || !size || !isReady.value) return;
    const fit = computeFitTransform(size.vw, size.vh);
    fitScale.value = fit.scale;
    fitPanX.value = fit.panX;
    fitPanY.value = fit.panY;
    if (animate) {
      animateViewportTo(fit.scale, fit.panX, fit.panY);
      return;
    }
    cancelStageAnimation();
    scale.value = fit.scale;
    panX.value = fit.panX;
    panY.value = fit.panY;
    persistViewport();
  }

  let stageAnimTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelStageAnimation() {
    if (stageAnimTimer) clearTimeout(stageAnimTimer);
    stageAnimTimer = null;
    stageAnimating.value = false;
  }

  function animateViewportTo(nextScale: number, nextPanX: number, nextPanY: number) {
    cancelStageAnimation();
    stageAnimating.value = true;
    requestAnimationFrame(() => {
      scale.value = nextScale;
      panX.value = nextPanX;
      panY.value = nextPanY;
      persistViewport();
      stageAnimTimer = setTimeout(() => {
        stageAnimating.value = false;
        stageAnimTimer = null;
      }, FOCUS_ANIM_MS);
    });
  }

  function focusOnRect(contentX: number, contentY: number, contentW: number, contentH: number, padding = 48) {
    const el = viewportEl.value;
    const size = el ? viewportSize(el) : null;
    if (!el || !size || !isReady.value) return;
    updateFitState();
    const maxS = fitScale.value * ZOOM_MAX_FACTOR;
    const availW = Math.max(1, size.vw - padding * 2);
    const availH = Math.max(1, size.vh - topInsetPx.value - padding * 2);
    const nextScale = Math.min(maxS, Math.min(availW / contentW, availH / contentH));
    const cx = contentX + contentW / 2;
    const cy = contentY + contentH / 2;
    let nextPanX = size.vw / 2 - cx * nextScale;
    let nextPanY = topInsetPx.value + (size.vh - topInsetPx.value) / 2 - cy * nextScale;
    const { w, h } = getContentSize();
    nextPanX = clampPanAxis(nextPanX, w * nextScale, el.clientWidth);
    nextPanY = clampPanAxis(nextPanY, h * nextScale, el.clientHeight);
    animateViewportTo(nextScale, nextPanX, nextPanY);
  }

  function panToRect(contentX: number, contentY: number, contentW: number, contentH: number) {
    const el = viewportEl.value;
    const size = el ? viewportSize(el) : null;
    if (!el || !size || !isReady.value) return;
    const s = scale.value;
    const cx = contentX + contentW / 2;
    const cy = contentY + contentH / 2;
    let nextPanX = size.vw / 2 - cx * s;
    let nextPanY = topInsetPx.value + (size.vh - topInsetPx.value) / 2 - cy * s;
    const { w, h } = getContentSize();
    nextPanX = clampPanAxis(nextPanX, w * s, el.clientWidth);
    nextPanY = clampPanAxis(nextPanY, h * s, el.clientHeight);
    animateViewportTo(s, nextPanX, nextPanY);
  }

  function restoreOrFit() {
    const el = viewportEl.value;
    const key = viewportKey.value;
    if (!el || !isReady.value || !key) return;
    updateFitState();
    const saved = readPersistedViewport(key);
    if (saved && saved.scale > 0) {
      scale.value = saved.scale;
      panX.value = saved.panX;
      panY.value = saved.panY;
      clampView();
      persistViewport();
      return;
    }
    fitToView();
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function persistViewport() {
    const key = viewportKey.value;
    if (!key) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      writePersistedViewport(key, scale.value, panX.value, panY.value);
    }, 150);
  }

  let resizeFrame = 0;

  const resizeObserver = new ResizeObserver(() => {
    const wasFit = !isTransformed.value;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const el = viewportEl.value;
      if (!el || !viewportSize(el)) return;
      if (wasFit) fitToView();
      else {
        updateFitState();
        clampView();
      }
    });
  });

  let wheelFrame = 0;
  let pendingPanDx = 0;
  let pendingPanDy = 0;
  let pendingZoom: { deltaY: number; mx: number; my: number } | null = null;

  function applyWheelUpdate() {
    wheelFrame = 0;
    const el = viewportEl.value;
    if (!el) {
      pendingPanDx = 0;
      pendingPanDy = 0;
      pendingZoom = null;
      return;
    }

    if (pendingZoom) {
      const { deltaY, mx, my } = pendingZoom;
      pendingZoom = null;
      const minS = fitScale.value * ZOOM_OUT_MIN_FACTOR;
      const maxS = fitScale.value * ZOOM_MAX_FACTOR;
      const next = Math.min(maxS, Math.max(minS, scale.value * Math.exp(-deltaY * 0.005)));
      const ratio = next / scale.value;
      panX.value = mx - (mx - panX.value) * ratio;
      panY.value = my - (my - panY.value) * ratio;
      scale.value = next;
      clampView();
      persistViewport();
      return;
    }

    const dx = pendingPanDx;
    const dy = pendingPanDy;
    pendingPanDx = 0;
    pendingPanDy = 0;
    if (dx === 0 && dy === 0) return;

    panX.value -= dx;
    panY.value -= dy;
    clampView();
    persistViewport();
  }

  function onWheel(e: WheelEvent) {
    if (!viewportEl.value) return;
    cancelStageAnimation();
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const rect = viewportEl.value.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (pendingZoom) pendingZoom.deltaY += e.deltaY;
      else pendingZoom = { deltaY: e.deltaY, mx, my };
      pendingZoom.mx = mx;
      pendingZoom.my = my;
      pendingPanDx = 0;
      pendingPanDy = 0;
    } else {
      pendingPanDx += e.deltaX;
      pendingPanDy += e.deltaY;
    }

    if (!wheelFrame) wheelFrame = requestAnimationFrame(applyWheelUpdate);
  }

  function observeViewport(el: HTMLElement | null, prev: HTMLElement | null) {
    if (prev) resizeObserver.unobserve(prev);
    if (el) resizeObserver.observe(el);
  }

  function disconnect() {
    cancelStageAnimation();
    if (wheelFrame) cancelAnimationFrame(wheelFrame);
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    if (persistTimer) clearTimeout(persistTimer);
    resizeObserver.disconnect();
  }

  watch(
    [viewportEl, viewportKey, isReady],
    ([el, key, ready]) => {
      if (!el || !key || !ready) return;
      nextTick(restoreOrFit);
    },
    { immediate: true },
  );

  watch(topInsetPx, () => {
    const wasFit = !isTransformed.value;
    updateFitState();
    if (wasFit) fitToView();
    else clampView();
  });

  return {
    scale,
    fitScale,
    panX,
    panY,
    stageStyle,
    isTransformed,
    fitToView,
    focusOnRect,
    panToRect,
    restoreOrFit,
    onWheel,
    observeViewport,
    disconnect,
  };
}
