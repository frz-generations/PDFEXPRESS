# Contributing to FRZ PDF Express

FRZ PDF Express is an open-source application by FRZ Generations by
**Faraz Ahammed CM / FRZ Generations**. Contributions, forks and reuse are welcome.

- Code is MIT-licensed. By contributing you agree your contribution is licensed under the same MIT License.
- Keep the licence header at the top of each source file and keep `LICENSE` and `NOTICE` intact.
- There is no build step: edit the HTML/JS files and open `index.html` through any static server.
- Do not add tracking, analytics, user accounts or any upload of user files — all processing must stay in the browser.
- Do not add watermarks, hidden branding or footers to exported files.
- Open an issue before large changes. Report security problems privately to frzgenerations@gmail.com.

- Keep the copyright notice and licence intact (`python3 tools/check-notices.py` must pass). You may add your own copyright line; never remove the original.
- Keep accessibility: every new control needs a label, keyboard operation and sufficient contrast (WCAG 2.1 AA).
- Do not load anything from other websites (scripts, fonts, images, analytics); bundle it in `vendor/` with its licence.
