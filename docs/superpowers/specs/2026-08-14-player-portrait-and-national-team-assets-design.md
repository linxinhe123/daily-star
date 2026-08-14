# Player Portrait and National Team Assets Design

## Goal

Keep archive cards visually consistent by using TheSportsDB cutouts for player portraits and TheSportsDB national-team badges for nationality metadata.

## Portrait Rules

- Preserve Transfermarkt ID and birth date as the identity authority.
- Resolve presentation images from TheSportsDB only after matching the intended player by full name plus identity evidence.
- Use transparent `strCutout` PNG files, matching the existing archive portrait source and composition.
- Never restore known same-name mismatches. When TheSportsDB metadata contains a minor date error, require an exact name plus matching current club/nationality and manually verified image.
- Keep Transfermarkt headshots only as a data-pipeline fallback, not as the preferred archive presentation.

## National Team Rules

- Download the official national-team badge returned by TheSportsDB `searchteams.php` for every nationality in the 200-player roster.
- Store badges locally under `apps/web/public/assets/nations/` so the UI does not depend on third-party availability.
- Render a compact badge beside the Chinese nationality name in archive and saved-player cards.
- Fall back to a neutral football icon when a badge is unavailable; do not render emoji flags because Windows can split them into country-code letters.

## Verification

- Audit every player identity after image synchronization.
- Build the production web application.
- Inspect archive cards at desktop and mobile widths, confirming consistent portrait composition, real national-team badges, no broken images, and no horizontal overflow.
