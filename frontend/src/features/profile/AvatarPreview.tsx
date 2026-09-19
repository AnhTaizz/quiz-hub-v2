import { useState } from "react";
import { initials } from "./profileValidation";

/**
 * Shows the avatar when there is one and it loads, otherwise the user's initials. `avatarUrl` is only ever
 * used as an <img src> prop (never interpolated into markup), so a hostile value cannot inject HTML or script.
 * /avatars/** is served by Spring behind authentication; the browser sends the jwt cookie with the image request.
 */
export function AvatarPreview({ url, name, size = 96 }: { url: string | null; name: string; size?: number }) {
  // Remember which URL failed, so a new URL gets a fresh attempt without an effect to reset state.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = url && url !== failedUrl;

  return (
    <div className="qh-avatar" style={{ width: size, height: size }}>
      {showImage ? (
        <img src={url} alt={`${name || "Your"} avatar`} className="qh-avatar__img" onError={() => setFailedUrl(url)} />
      ) : (
        <span className="qh-avatar__initials" aria-label={`${name || "Your"} avatar`} role="img">
          {initials(name)}
        </span>
      )}
    </div>
  );
}
