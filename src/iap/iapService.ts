import { ads } from "@/ads/adService";
import { EXTRA_PER_SIZE, IAP, SIZES } from "@/data/constants";
import type { useProgress } from "@/data/progressStore";

export type CatalogItem = {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  kind: "hints" | "removeAds" | "extra" | "bundle";
  hintAmount?: number;
  extraSize?: number;
};

export const catalog: CatalogItem[] = [
  {
    id: IAP.hints5.id,
    title: IAP.hints5.title,
    description: "加 5 個提示到庫存",
    priceLabel: IAP.hints5.price,
    kind: "hints",
    hintAmount: 5,
  },
  {
    id: IAP.hints20.id,
    title: IAP.hints20.title,
    description: "加 20 個提示到庫存",
    priceLabel: IAP.hints20.price,
    kind: "hints",
    hintAmount: 20,
  },
  {
    id: IAP.hints100.id,
    title: IAP.hints100.title,
    description: "加 100 個提示到庫存",
    priceLabel: IAP.hints100.price,
    kind: "hints",
    hintAmount: 100,
  },
  {
    id: IAP.removeAds.id,
    title: IAP.removeAds.title,
    description: "拿掉橫幅與插頁廣告。看影片換提示仍可用。",
    priceLabel: IAP.removeAds.price,
    kind: "removeAds",
  },
  ...SIZES.map((size) => ({
    id: IAP.extra(size).id,
    title: IAP.extra(size).title,
    description: `解鎖 ${size}×${size} 額外 ${EXTRA_PER_SIZE} 關`,
    priceLabel: IAP.extra(size).price,
    kind: "extra" as const,
    extraSize: size,
  })),
  {
    id: IAP.bundle.id,
    title: IAP.bundle.title,
    description: "去廣告、100 提示、全部 Extra Pack",
    priceLabel: IAP.bundle.price,
    kind: "bundle",
    hintAmount: IAP.bundle.hints,
  },
];

type Progress = ReturnType<typeof useProgress>;

export async function buyMock(item: CatalogItem, progress: Progress) {
  switch (item.kind) {
    case "hints":
      await progress.addHints(item.hintAmount ?? 0);
      break;
    case "removeAds":
      await progress.unlockRemoveAds();
      ads.setRemoved(true);
      break;
    case "extra":
      if (item.extraSize) await progress.unlockExtra(item.extraSize);
      break;
    case "bundle":
      await progress.unlockBundle();
      ads.setRemoved(true);
      break;
  }
  return true;
}
