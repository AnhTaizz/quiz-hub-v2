import { httpClient } from "./httpClient";
import type { ChangePasswordRequest, UpdateProfileRequest, UserProfileResponse } from "@/types/api";

export const profileApi = {
  get: (signal?: AbortSignal) => httpClient.get<UserProfileResponse>("/users/my-profile", { signal }),

  // The backend overwrites all three fields on every PUT (omitted = cleared), so callers must always send the current values.
  update: (payload: UpdateProfileRequest) =>
    httpClient.put<UserProfileResponse>("/users/my-profile", { body: payload }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return httpClient.post<{ url: string }>("/users/upload-avatar", { formData });
  },

  changePassword: (payload: ChangePasswordRequest) =>
    httpClient.post<string>("/users/change-password", { body: payload }),
};
