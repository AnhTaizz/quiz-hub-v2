import { httpClient } from "./httpClient";
import type {
  AuthResponse,
  LoginRequest,
  OAuth2PendingRegistration,
  OAuth2RegisterRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from "@/types/api";

export const authApi = {
  login: (payload: LoginRequest) => httpClient.post<AuthResponse>("/auth/login", { body: payload }),

  register: (payload: RegisterRequest) =>
    httpClient.post<AuthResponse>("/auth/register", { body: payload }),

  checkEmail: (email: string, signal?: AbortSignal) =>
    httpClient.get<boolean>("/auth/check-email", { query: { email }, signal }),

  // Backend binds this as @RequestParam, not a JSON body - see API_MAP.md.
  forgotPassword: (email: string) =>
    httpClient.post<string>("/auth/forgot-password", { query: { email } }),

  resetPassword: (payload: ResetPasswordRequest) =>
    httpClient.post<string>("/auth/reset-password", { body: payload }),

  // The identity behind this call comes from the oauth2_reg_ticket cookie the backend set after a real
  // Google login (see docs/backend/OAUTH2_REGISTRATION_SECURITY.md); httpClient already sends cookies
  // same-origin, so no extra wiring is needed here.
  oauth2Register: (payload: OAuth2RegisterRequest) =>
    httpClient.post<AuthResponse>("/auth/oauth2-register", { body: payload }),

  getPendingOAuth2Registration: (signal?: AbortSignal) =>
    httpClient.get<OAuth2PendingRegistration>("/auth/oauth2-register/pending", { signal }),

  // The identity behind this call comes from the oauth2_login_ticket cookie the backend set after a real
  // Google login for an EXISTING account (see docs/backend/OAUTH2_EXISTING_LOGIN_SECURITY.md); httpClient
  // already sends cookies same-origin, so no extra wiring is needed here. No request body: nothing the
  // client could supply would be meaningful - the account is entirely determined by the ticket.
  oauth2Login: (signal?: AbortSignal) => httpClient.post<AuthResponse>("/auth/oauth2-login", { signal }),
};
