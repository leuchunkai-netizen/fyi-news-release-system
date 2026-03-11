/**
 * Preset profile photos users can choose from. Store paths in public/avatars/.
 * Add image files: 1.png, 2.png, ... 6.png (or use your own set).
 */
export const PROFILE_PHOTO_OPTIONS: string[] = [
  "/avatars/1.png",
  "/avatars/2.png",
  "/avatars/3.png",
  "/avatars/4.png",
  "/avatars/5.png",
  "/avatars/6.png",
];

/** Returns true if the value is one of the preset profile photo paths. */
export function isPresetAvatar(value: string | null | undefined): boolean {
  if (!value) return false;
  return PROFILE_PHOTO_OPTIONS.includes(value);
}
