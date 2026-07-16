import { computed, ref } from "vue";

export type TileBrushGalleryKind = "appearance" | "overlay" | "feature";

const openKind = ref<TileBrushGalleryKind | null>(null);

export function useTileBrushGalleryUi() {
  const appearanceGalleryOpen = computed(() => openKind.value === "appearance");
  const overlayGalleryOpen = computed(() => openKind.value === "overlay");
  const featureGalleryOpen = computed(() => openKind.value === "feature");
  const galleryOpen = computed(() => openKind.value !== null);

  function openAppearanceGallery() {
    openKind.value = "appearance";
  }

  function openOverlayGallery() {
    openKind.value = "overlay";
  }

  function openFeatureGallery() {
    openKind.value = "feature";
  }

  function toggleAppearanceGallery() {
    openKind.value = openKind.value === "appearance" ? null : "appearance";
  }

  function toggleOverlayGallery() {
    openKind.value = openKind.value === "overlay" ? null : "overlay";
  }

  function toggleFeatureGallery() {
    openKind.value = openKind.value === "feature" ? null : "feature";
  }

  function closeGalleries() {
    openKind.value = null;
  }

  return {
    openKind,
    galleryOpen,
    appearanceGalleryOpen,
    overlayGalleryOpen,
    featureGalleryOpen,
    openAppearanceGallery,
    openOverlayGallery,
    openFeatureGallery,
    toggleAppearanceGallery,
    toggleOverlayGallery,
    toggleFeatureGallery,
    closeGalleries,
  };
}
