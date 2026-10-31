Contents for the `shadowcoderbd.github.io` repository (GitHub's user site).

Android only hides Chrome's address bar in the Meal Expenses APK if it finds
`https://shadowcoderbd.github.io/.well-known/assetlinks.json` proving the app and the site
belong together. That path is at the root of the domain, so it can't live in the
`meal_expenses` repo. `.nojekyll` stops GitHub Pages from hiding the `.well-known` folder.
