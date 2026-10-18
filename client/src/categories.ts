// Availability/event categories, mirroring the server's Category enum
export type Category = "GAMING" | "STUDYING" | "TALKING" | "MOVIE" | "OTHER";

export const CATEGORY_INFO: Record<Category, { label: string; color: string; text: string }> = {
  GAMING: { label: "Gaming", color: "#5865f2", text: "#fff" },
  STUDYING: { label: "Studying", color: "#23a55a", text: "#fff" },
  TALKING: { label: "Talking", color: "#f0b232", text: "#1e1f22" },
  MOVIE: { label: "Movie", color: "#eb459e", text: "#fff" },
  OTHER: { label: "Other", color: "#80848e", text: "#fff" },
};

export const CATEGORIES = Object.keys(CATEGORY_INFO) as Category[];

export function categoryInfo(category: string) {
  return CATEGORY_INFO[category as Category] ?? CATEGORY_INFO.OTHER;
}
