import { BookOpen, Clapperboard, Gamepad2, MessagesSquare, Shapes, type LucideIcon } from "lucide-react";

// Availability/session categories, mirroring the server's Category enum. Each has an
// icon as well as a color so the calendar never relies on color alone. Colors are
// muted to sit alongside the accent, and all pass AA with the dark text used on them.
export type Category = "GAMING" | "STUDYING" | "TALKING" | "MOVIE" | "OTHER";

export const CATEGORY_INFO: Record<Category, { label: string; color: string; text: string; icon: LucideIcon }> = {
  GAMING: { label: "Gaming", color: "#8e9af7", text: "#171821", icon: Gamepad2 },
  STUDYING: { label: "Studying", color: "#5fbfe0", text: "#171821", icon: BookOpen },
  TALKING: { label: "Talking", color: "#e6b465", text: "#171821", icon: MessagesSquare },
  MOVIE: { label: "Movie", color: "#dc8cc0", text: "#171821", icon: Clapperboard },
  OTHER: { label: "Other", color: "#9da0b4", text: "#171821", icon: Shapes },
};

export const CATEGORIES = Object.keys(CATEGORY_INFO) as Category[];

export function categoryInfo(category: string) {
  return CATEGORY_INFO[category as Category] ?? CATEGORY_INFO.OTHER;
}
