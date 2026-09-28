# planback-web

Statische Website von PlanBack (`planback`): Startseite, Datenschutz,
Impressum. **Privates Repo.**

Kein Build. `site/` ist genau das, was ausgeliefert wird. Ausgeliefert wird
per rsync nach `/srv/sites/planback` auf den Server; dort bedient der Caddy
des PlanBack-Stacks die Dateien aus einem read-only Bind-Mount (siehe
Abschnitt „Website (planback-web)" in `DEPLOYMENT.md` im Repo `planback`).

Mechanismus und Workflow sind 1:1 von `redumio-web` übernommen; nur Ziel
(`/srv/sites/planback`) und Concurrency-Gruppe unterscheiden sich.

## Seiten

| Pfad | Datei | Zweck |
|---|---|---|
| `/` | `site/index.html` | Startseite: Nutzen, Ablauf (Bedarfe → Chargen → Arbeitspläne → Kampagnen → Optimieren & freigeben), Zielgruppe, Kontakt. Texte aus `docs/BUSINESS_PLAN_PlanBack.md` und dem Handbuch-Kapitel „Einführung" |
| `/datenschutz/` | `site/datenschutz/index.html` | Datenschutzerklärung für die Website (nur Server-Logs, keine Cookies, keine externen Dienste) |
| `/impressum/` | `site/impressum/index.html` | Anbieterkennzeichnung |
| `/404.html` | `site/404.html` | Fehlerseite, die Caddy über `handle_errors` ausliefert |

Die Unterseiten liegen als `<name>/index.html`, damit die URLs ohne `.html`
funktionieren: Der Website-Block im Caddyfile hat kein `try_files`, ein
`impressum.html` wäre nur unter genau diesem Namen erreichbar.

**Rechtstexte sind Rohbau:** oben ein gelber Entwurfshinweis, offene Angaben
als `<span class="todo">[...]</span>` markiert, `<meta name="robots"
content="noindex">` bis zur geprüften Fassung. Beim Ersetzen durch die
geprüften Texte: Hinweis-Absatz (`.draft`), alle `.todo`-Spans und das
`noindex` entfernen, `Stand:` nachziehen.

**Offen auf der Startseite** (ebenfalls `.todo`): Kontakt-E-Mail und
Anbietername im Footer. Beides muss vor dem ersten Merge nach `main`
eingetragen sein, sonst geht es genau so live.

Gemeinsames Stylesheet: `site/assets/page.css`. Farben nach
`docs/CORPORATE_DESIGN.md` im Repo `planback` (Forest Green `#124737`,
Process Teal `#18A0A5`, Bread Gold `#F5A53E`). Schrift Inter als variable
Schrift lokal aus `site/fonts/` (Google Fonts, SIL Open Font License), kein
externer Request, keine Cookies. Logos in `site/assets/logo/` stammen aus
`frontend/public/` im Repo `planback`.

## Freischalten der Domain

Ausgeliefert wird erst, wenn auf dem Server in `/opt/planback/.env`
`WEBSITE_ADDRESS` und `WEBSITE_WWW_ADDRESS` gesetzt sind (dann
`docker compose -f docker-compose.prod.yml up -d frontend`) und die
A-/AAAA-Records der Domain auf den Server zeigen. Bis dahin hängt der
Caddy-Block am `.localhost`-Default und ist von außen nicht erreichbar.

## Ablauf

```
Branch -> Pull Request -> Review -> Merge nach main -> Deploy läuft
```

**Der Merge ist der Veröffentlichungsbeschluss.** Das trägt nur, solange
main ausschließlich über einen PR erreichbar ist -- ohne die Branch
Protection unten wäre der Trigger genau das, wonach er aussieht: „jeder
Tippfehler geht live".

`workflow_dispatch` bleibt zusätzlich, für den Fall „Server neu
aufgesetzt, Dateien noch einmal ausspielen" ohne inhaltliche Änderung.

## Einrichtung -- vor dem ersten Merge

### 0. Branch `main` anlegen

Das Repo wurde ohne Commit angelegt. Der erste Stand liegt auf einem
Arbeitsbranch; `main` daraus erzeugen (lokal `git checkout -b main && git push
-u origin main`, oder in GitHub unter Settings -> General -> Default branch
den Arbeitsbranch nach `main` umbenennen). Der Workflow deployt nur von
`main`.

### 1. Branch Protection auf `main`

Settings -> Branches -> Add rule für `main`:

| Einstellung | Wert |
|---|---|
| Require a pull request before merging | **an** |
| Required approvals | **0**, solange du allein arbeitest |
| Do not allow bypassing the above settings | **an** |

> **Warum 0 Approvals:** GitHub lässt niemanden den eigenen PR freigeben.
> Bei „1 Approval" und einem Ein-Personen-Team könntest du keinen einzigen
> PR mehr mergen. Mit 0 bleibt der PR-Zwang (kein direkter Push auf main,
> jede Änderung ist sichtbar und reversibel), ohne dich auszusperren. Kommt
> jemand dazu, hebst du den Wert.
>
> „Do not allow bypassing" gilt sonst nicht für Admins -- und du bist Admin.

### 2. Environment `production`

Settings -> Environments -> New environment -> `production`:

| Einstellung | Wert | Wirkung |
|---|---|---|
| Deployment branches | Selected branches -> `main` | Ein Dispatch von einem Feature-Branch erreicht das Environment nicht -- ein dort manipulierter Workflow läuft ohne jeden Zugang |
| Environment secrets | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` | **Hier** anlegen, nicht als Repository-Secrets -- sonst käme jeder Workflow im Repo daran |

`DEPLOY_USER` ist `deploy` (nicht `planback`, der App-Deploy-User mit
Docker-Gruppe). `DEPLOY_SSH_KEY` ist ein eigener Schlüssel ohne Passphrase
(`ssh-keygen -t ed25519 -N '' -f planback-web-deploy`), nicht der Key aus
dem Repo `planback`.

**Required reviewers** braucht es hier bewusst NICHT: Der PR-Merge ist bereits
der Freigabepunkt; ein zweiter Klick je Deploy wäre Reibung ohne Zugewinn.
Sinnvoll wird die Option, sobald mehrere Leute nach main mergen dürfen und
nicht alle deployen sollen.

### 3. Actions-Grundeinstellungen

Settings -> Actions -> General: Workflow permissions auf *Read repository
contents*.

### 4. Am Server

User `deploy`, Verzeichnis `/srv/sites/planback`, Deploy-Key in
`authorized_keys` auf rsync eingeschränkt:

```
command="rrsync /srv/sites",no-pty,no-agent-forwarding,no-port-forwarding,no-X11-forwarding <ssh-ed25519 ...>
```

Dann ist er kein Shell-Zugang mehr, sondern ein Schreibrecht auf ein
Verzeichnis. Die vollständige Server-Einrichtung (User, Verzeichnis, Caddy,
`.env`) steht in `DEPLOYMENT.md` im Repo `planback`, Abschnitt „Website
(planback-web)".

## Wo die Sperre wirklich liegt

Die Ref-Prüfung im Workflow („Nur von main deployen") ist bewusst nur
Bequemlichkeit -- sie liegt auf demselben Branch, den jemand ändern würde.
Die Sicherheitsgrenze sind Branch Protection und Environment-Regel, weil
GitHub beide serverseitig durchsetzt, außerhalb des Repo-Inhalts.
