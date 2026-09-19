import { httpClient } from "./httpClient";
import type { CategoryNode } from "@/types/api";

// Read-only: only what the practice setup screen needs to choose a category (category management is not migrated).
export const categoryApi = {
  listPublic: (signal?: AbortSignal) => httpClient.get<CategoryNode[]>("/student/categories/public", { signal }),
  listMine: (signal?: AbortSignal) => httpClient.get<CategoryNode[]>("/student/categories/mine", { signal }),
};
