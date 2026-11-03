# Device checklist

What only a real device can show: installing the trainer, running it offline, taking an update, and the full touch flow. Everything a browser emulation can prove is already covered by the automated tests (see the README section "Install and offline use"). This list is the rest.

It blocks nothing. Work through what you have at hand, tick what passes, and report what does not. Each item names the roadmap criterion of Phase 8 it closes:

1. Install from iPhone and iPad Safari, Android Chrome, and desktop Chrome and Edge; the app launches standalone.
2. After one online load, in airplane mode, every situation can be started, played, finished and debriefed.
3. After a new deploy, a returning user gets the new version without a blank screen or stale files.
4. The full flow works by touch on a real iPhone, iPad and Android phone.

## Before you start

- [ ] Open the site online and note the deploy. Open **About and content policy**; the line reads `Offline: ready, version <id>` once the offline copy is complete, and `Offline: not available` when no worker controls the page. Write the id down. (Criteria 2 and 3)
- [ ] Optional, from a computer: run the two live specs against the deployed site with `PW_BASE_URL=<site url> npx playwright test e2e/pwa-offline.spec.ts e2e/pwa-install.spec.ts`. They need no hooks and no local build. (Criteria 1 and 2)
- [ ] Wait for the About line to say ready before you test anything offline. The very first visit is not yet controlled by the worker; open About again after a reload if it still says not available. (Criterion 2)

## Install and launch

For each device: install, launch from the new icon, and check that the app opens without browser bars, shows the name "DA50 Trainer", and the icon shows the DA50RG and GO-AROUND mark on a dark ground. The icon art is a placeholder; judge only that it is sharp and not cropped. (Criterion 1)

- [ ] iPhone, Safari: Share, then Add to Home Screen. (Criterion 1)
- [ ] iPad, Safari: Share, then Add to Home Screen.
- [ ] Android phone, Chrome: menu, then Install app (or Add to Home screen).
- [ ] Desktop Chrome: the install button in the address bar, or menu, then Install.
- [ ] Desktop Edge: menu, then Apps, then Install this site as an app.
- [ ] On Android, the icon looks right inside the round or squircle mask of the launcher (nothing cut off).

## Offline

Do this on at least one phone or tablet, installed and in the browser. (Criterion 2)

- [ ] Open the app once online, wait for the About line to say ready, then switch on airplane mode. (Criterion 2)
- [ ] Close the app completely (swipe it away), then open it again from the home screen. The panel appears at once.
- [ ] Run one situation of every pack to its debrief: engine, electrical, fire and icing. Each loads, runs and grades with no network message.
- [ ] Open the situation chooser, retry from a debrief and use Next situation; nothing asks for the network.
- [ ] Switch airplane mode off again; the app keeps working and nothing reloads by itself.

## Update

You can only test this after the next deploy following your install. (Criterion 3)

- [ ] Open the installed app after the deploy. On the free panel a notice reads "A new version is ready." with a button "Reload". It appears only there: not in the situation chooser, the level card, the briefing, a run or a debrief. (Criterion 3)
- [ ] Start a situation before you tap anything. Nothing happens during the run, however long you take; the notice does not appear and the page does not reload.
- [ ] Finish the run and go back to the free panel: the notice is there. Tap Reload once. The app reloads one time and opens the new version, and About shows a different version id than the one you wrote down.
- [ ] With the app open in two windows or tabs (desktop), tap Reload in one: the other shows the notice but does not reload until you tap it.
- [ ] Switch to airplane mode after the update and reload: the new version runs offline.

## The touch flow

On a real iPhone, iPad and Android phone, once in a Safari or Chrome tab and once installed. (Criterion 4)

- [ ] First start: the training-aid acknowledgment appears and can be accepted. (Criterion 4)
- [ ] New situation: choose a situation and a level, read the briefing, start the run.
- [ ] Operate the panel: toggles, guarded switches, levers, knobs and the transponder keys follow the finger.
- [ ] Finish, read the debrief, retry the same situation, then go back to the free panel.
- [ ] Full view scale: the whole panel is readable in landscape (on tablets the panel space is about 8 percent smaller than it once was; confirm this still feels fine).
- [ ] Double tap zooms into a region, a second double tap zooms out; a single tap never zooms.
- [ ] A drag pans the zoomed view; two fingers pinch, also when they start over a switch.
- [ ] A control acts when the finger lifts, not when it lands; a slide that starts on a control becomes a pan.
- [ ] Momentary buttons act only when held a moment and never zoom.
- [ ] The Full panel button sits clear of the controls in its corner and can be hit reliably.
- [ ] Circuit breakers can be tapped without hitting their neighbours.
- [ ] Sound: switch it on in the footer, start a run, hear the cues; switch it off again.

## Viewport and safe areas

- [ ] Landscape on a phone with a notch: no part of the panel or the footer lies under the notch or the rounded corners.
- [ ] The home indicator bar (iPhone and iPad) does not cover the footer links.
- [ ] While the browser bars collapse and return as you scroll or tap, the panel height follows (`100dvh`); no strip is cut off or left empty.
- [ ] Rotate portrait and back: the hint "Rotate to landscape for the full panel" shows in portrait on a phone and the panel redraws correctly.

## Expected differences, not defects

- The app installed on the iPhone or iPad home screen has its own storage: the first-run acknowledgment and the Sound choice start fresh there.
- A Safari tab that was not installed can lose its site data, and with it the offline copy, after a long time unused. Open the site online again to restore it.
- Android and desktop browsers decide themselves when to show the install offer; use the menu entry if no prompt appears.
- The icon is a placeholder; replacing the PNGs in `public/icons/` is the owner's call (`npm run icons` regenerates the current ones).

## How to report

Per finding: the device and its OS version, the browser (or installed app), the About version id, the criterion number, what you did and what you saw. A photo or screen recording helps. Failures go into a new todo or a UAT entry; none of them blocks the phase.
