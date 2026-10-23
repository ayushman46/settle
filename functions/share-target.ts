/**
 * Cloudflare Pages Function for `POST /share-target` (the manifest's `share_target`): the
 * service worker normally answers it on the phone; this runs only when the worker isn't there
 * yet, and sends people to the paste screen (same as server/web.ts).
 */
const SHARE_TARGET_MISSED = '/app/share?missed=1'

export const onRequestPost = ({ request }: { request: Request }): Response =>
  Response.redirect(new URL(SHARE_TARGET_MISSED, request.url).toString(), 303)
