# CueLight replay — semantic

## Run identity

```json
{
  "metadata": {
    "createdAt": "2026-09-20T13:37:57.204Z",
    "codeCommit": "c5d71bf0fd5b1776e9088a87682dd8383698863c",
    "worktreeDiffSha256": "1161aeb3eff08387e706f943728488c26f92cc29afaa4de3395b0bb62e74e5e6",
    "engineSha256": "558484f05e3515597484fea58193ea19eaff550dc7bd2a6e8ff153e70a4ec461",
    "contextSha256": "663f6b5802bfd23cad5d51aa55e388b44166a7b2142f425a920792968d78883a",
    "contextVersion": "structured-v2",
    "inputSha256": "614a443d051b48280921582a4599b9cc10cc890a8294b78f863157d731a12d4c",
    "captionSha256": "b5ec6831b83173354110fb40097f666e9d7295da39160aba62b5a4a6dbcd66a8",
    "sourceUrl": "https://ocw.mit.edu/courses/5-111sc-principles-of-chemical-science-fall-2014/resources/lecture-9-periodic-table-ionic-and-covalent-bonds/",
    "modelRequested": "jev-latest",
    "live": true,
    "mode": "semantic",
    "from": 1028030,
    "to": 1118430,
    "fragmentCount": 33,
    "prefixRunSha256": "e46a0df240469c9b82b3c03e74e88758cd0f4c08fc0e4cb908ffbe41994f1180",
    "initialState": "reconstructed by same engine from archived decisions BEFORE range; timestamps re-created, no future decisions used",
    "boundary": "original MIT VTT captions, available at caption end; not Speechmatics Final",
    "window": "20 seconds / 32 fragments; unchanged latest 1/2/3 + current-source-to-latest candidates",
    "firstDisplayMeasurement": "engine Cue-state publication proxy; browser paint, ASR and speech latency not measured"
  },
  "summary": {
    "accepted": 33,
    "decisions": 33,
    "interrupted": false,
    "outcomes": {
      "applied": 0,
      "quiet": 33,
      "discarded": 0,
      "fallback": 0
    },
    "actions": {
      "QUIET": 33,
      "NEW_CUE": 0,
      "UPDATE_CURRENT": 0
    },
    "changesPerSourceMinute": 0,
    "providerMs": {
      "p50": 441.65641700000015,
      "p95": 530.065584,
      "max": 1024.648333
    },
    "sourceReadyToCueStateMs": {
      "p50": null,
      "p95": null
    },
    "elapsedMs": 16067.421833,
    "cost": "not supplied by provider; token usage retained when present"
  }
}
```

Semantic mode waits after each caption: its timings are API / local publication observations, not real arrival scheduling or speech-to-screen latency. Paced mode uses original caption end times at 1×. Neither measures browser paint or Speechmatics Final.

User and assistant annotations are separate offline references and are never sent to the model. Unmarked content is not automatically wrong.

## 1 · 17:08.030 · chem-09-0350

**Available evidence (oldest → latest)**

- chem-09-0339 · 16:45.890–16:48.317: We're going to talk about them more around Thanksgiving.
- chem-09-0340 · 16:48.317–16:49.900: That's my favorite part of the course.
- chem-09-0341 · 16:49.900–16:51.990: Those d electrons are always causing trouble.
- chem-09-0342 · 16:51.990–16:52.489: OK.
- chem-09-0343 · 16:52.489–16:55.200: Then we go up again, and then we go down, and go up,
- chem-09-0344 · 16:55.200–16:55.840: and go down.
- chem-09-0345 · 16:55.840–16:56.756: Those are pretty good.
- chem-09-0346 · 16:56.756–16:58.820: Those are pretty good trends.
- chem-09-0347 · 16:58.820–16:59.760: All right.
- chem-09-0348 · 16:59.760–17:00.960: OK.
- chem-09-0349 · 17:00.960–17:05.040: So ions.
- chem-09-0350 · 17:05.040–17:08.030: Ions are different than their neutral parent, once again.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0350"]: Ions are different than their neutral parent, once again.
- C1 ["chem-09-0349","chem-09-0350"]: So ions. Ions are different than their neutral parent, once again.
- C2 ["chem-09-0348","chem-09-0349","chem-09-0350"]: OK. So ions. Ions are different than their neutral parent, once again.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 1024.6 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 2 · 17:12.670 · chem-09-0351

**Available evidence (oldest → latest)**

- chem-09-0343 · 16:52.489–16:55.200: Then we go up again, and then we go down, and go up,
- chem-09-0344 · 16:55.200–16:55.840: and go down.
- chem-09-0345 · 16:55.840–16:56.756: Those are pretty good.
- chem-09-0346 · 16:56.756–16:58.820: Those are pretty good trends.
- chem-09-0347 · 16:58.820–16:59.760: All right.
- chem-09-0348 · 16:59.760–17:00.960: OK.
- chem-09-0349 · 17:00.960–17:05.040: So ions.
- chem-09-0350 · 17:05.040–17:08.030: Ions are different than their neutral parent, once again.
- chem-09-0351 · 17:08.030–17:12.670: So we saw this before, that when you start filling the 3d,

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0351"]: So we saw this before, that when you start filling the 3d,
- C1 ["chem-09-0350","chem-09-0351"]: Ions are different than their neutral parent, once again. So we saw this before, that when you start filling the 3d,
- C2 ["chem-09-0349","chem-09-0350","chem-09-0351"]: So ions. Ions are different than their neutral parent, once again. So we saw this before, that when you start filling the 3d,

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 407.7 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 3 · 17:14.710 · chem-09-0352

**Available evidence (oldest → latest)**

- chem-09-0343 · 16:52.489–16:55.200: Then we go up again, and then we go down, and go up,
- chem-09-0344 · 16:55.200–16:55.840: and go down.
- chem-09-0345 · 16:55.840–16:56.756: Those are pretty good.
- chem-09-0346 · 16:56.756–16:58.820: Those are pretty good trends.
- chem-09-0347 · 16:58.820–16:59.760: All right.
- chem-09-0348 · 16:59.760–17:00.960: OK.
- chem-09-0349 · 17:00.960–17:05.040: So ions.
- chem-09-0350 · 17:05.040–17:08.030: Ions are different than their neutral parent, once again.
- chem-09-0351 · 17:08.030–17:12.670: So we saw this before, that when you start filling the 3d,
- chem-09-0352 · 17:12.670–17:14.710: the energy levels change.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0352"]: the energy levels change.
- C1 ["chem-09-0351","chem-09-0352"]: So we saw this before, that when you start filling the 3d, the energy levels change.
- C2 ["chem-09-0350","chem-09-0351","chem-09-0352"]: Ions are different than their neutral parent, once again. So we saw this before, that when you start filling the 3d, the energy levels change.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 497.8 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 4 · 17:16.710 · chem-09-0353

**Available evidence (oldest → latest)**

- chem-09-0345 · 16:55.840–16:56.756: Those are pretty good.
- chem-09-0346 · 16:56.756–16:58.820: Those are pretty good trends.
- chem-09-0347 · 16:58.820–16:59.760: All right.
- chem-09-0348 · 16:59.760–17:00.960: OK.
- chem-09-0349 · 17:00.960–17:05.040: So ions.
- chem-09-0350 · 17:05.040–17:08.030: Ions are different than their neutral parent, once again.
- chem-09-0351 · 17:08.030–17:12.670: So we saw this before, that when you start filling the 3d,
- chem-09-0352 · 17:12.670–17:14.710: the energy levels change.
- chem-09-0353 · 17:14.710–17:16.710: So ions can have different properties

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0353"]: So ions can have different properties
- C1 ["chem-09-0352","chem-09-0353"]: the energy levels change. So ions can have different properties
- C2 ["chem-09-0351","chem-09-0352","chem-09-0353"]: So we saw this before, that when you start filling the 3d, the energy levels change. So ions can have different properties

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 402.3 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 5 · 17:18.420 · chem-09-0354

**Available evidence (oldest → latest)**

- chem-09-0346 · 16:56.756–16:58.820: Those are pretty good trends.
- chem-09-0347 · 16:58.820–16:59.760: All right.
- chem-09-0348 · 16:59.760–17:00.960: OK.
- chem-09-0349 · 17:00.960–17:05.040: So ions.
- chem-09-0350 · 17:05.040–17:08.030: Ions are different than their neutral parent, once again.
- chem-09-0351 · 17:08.030–17:12.670: So we saw this before, that when you start filling the 3d,
- chem-09-0352 · 17:12.670–17:14.710: the energy levels change.
- chem-09-0353 · 17:14.710–17:16.710: So ions can have different properties
- chem-09-0354 · 17:16.710–17:18.420: than their neutral parents.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0354"]: than their neutral parents.
- C1 ["chem-09-0353","chem-09-0354"]: So ions can have different properties than their neutral parents.
- C2 ["chem-09-0352","chem-09-0353","chem-09-0354"]: the energy levels change. So ions can have different properties than their neutral parents.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 411.5 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 6 · 17:21.410 · chem-09-0355

**Available evidence (oldest → latest)**

- chem-09-0349 · 17:00.960–17:05.040: So ions.
- chem-09-0350 · 17:05.040–17:08.030: Ions are different than their neutral parent, once again.
- chem-09-0351 · 17:08.030–17:12.670: So we saw this before, that when you start filling the 3d,
- chem-09-0352 · 17:12.670–17:14.710: the energy levels change.
- chem-09-0353 · 17:14.710–17:16.710: So ions can have different properties
- chem-09-0354 · 17:16.710–17:18.420: than their neutral parents.
- chem-09-0355 · 17:18.420–17:21.410: And so if we have two kinds of ions,

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0355"]: And so if we have two kinds of ions,
- C1 ["chem-09-0354","chem-09-0355"]: than their neutral parents. And so if we have two kinds of ions,
- C2 ["chem-09-0353","chem-09-0354","chem-09-0355"]: So ions can have different properties than their neutral parents. And so if we have two kinds of ions,

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 401.7 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 7 · 17:24.670 · chem-09-0356

**Available evidence (oldest → latest)**

- chem-09-0349 · 17:00.960–17:05.040: So ions.
- chem-09-0350 · 17:05.040–17:08.030: Ions are different than their neutral parent, once again.
- chem-09-0351 · 17:08.030–17:12.670: So we saw this before, that when you start filling the 3d,
- chem-09-0352 · 17:12.670–17:14.710: the energy levels change.
- chem-09-0353 · 17:14.710–17:16.710: So ions can have different properties
- chem-09-0354 · 17:16.710–17:18.420: than their neutral parents.
- chem-09-0355 · 17:18.420–17:21.410: And so if we have two kinds of ions,
- chem-09-0356 · 17:21.410–17:24.670: we can have cations, which are positively charged.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0356"]: we can have cations, which are positively charged.
- C1 ["chem-09-0355","chem-09-0356"]: And so if we have two kinds of ions, we can have cations, which are positively charged.
- C2 ["chem-09-0354","chem-09-0355","chem-09-0356"]: than their neutral parents. And so if we have two kinds of ions, we can have cations, which are positively charged.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 443.3 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 8 · 17:28.300 · chem-09-0357

**Available evidence (oldest → latest)**

- chem-09-0351 · 17:08.030–17:12.670: So we saw this before, that when you start filling the 3d,
- chem-09-0352 · 17:12.670–17:14.710: the energy levels change.
- chem-09-0353 · 17:14.710–17:16.710: So ions can have different properties
- chem-09-0354 · 17:16.710–17:18.420: than their neutral parents.
- chem-09-0355 · 17:18.420–17:21.410: And so if we have two kinds of ions,
- chem-09-0356 · 17:21.410–17:24.670: we can have cations, which are positively charged.
- chem-09-0357 · 17:24.670–17:28.300: And so a positively charged ion will have lost an electron,

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0357"]: And so a positively charged ion will have lost an electron,
- C1 ["chem-09-0356","chem-09-0357"]: we can have cations, which are positively charged. And so a positively charged ion will have lost an electron,
- C2 ["chem-09-0355","chem-09-0356","chem-09-0357"]: And so if we have two kinds of ions, we can have cations, which are positively charged. And so a positively charged ion will have lost an electron,

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 426.4 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 9 · 17:31.520 · chem-09-0358

**Available evidence (oldest → latest)**

- chem-09-0351 · 17:08.030–17:12.670: So we saw this before, that when you start filling the 3d,
- chem-09-0352 · 17:12.670–17:14.710: the energy levels change.
- chem-09-0353 · 17:14.710–17:16.710: So ions can have different properties
- chem-09-0354 · 17:16.710–17:18.420: than their neutral parents.
- chem-09-0355 · 17:18.420–17:21.410: And so if we have two kinds of ions,
- chem-09-0356 · 17:21.410–17:24.670: we can have cations, which are positively charged.
- chem-09-0357 · 17:24.670–17:28.300: And so a positively charged ion will have lost an electron,
- chem-09-0358 · 17:28.300–17:31.520: and so it's going to be smaller than its parent.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0358"]: and so it's going to be smaller than its parent.
- C1 ["chem-09-0357","chem-09-0358"]: And so a positively charged ion will have lost an electron, and so it's going to be smaller than its parent.
- C2 ["chem-09-0356","chem-09-0357","chem-09-0358"]: we can have cations, which are positively charged. And so a positively charged ion will have lost an electron, and so it's going to be smaller than its parent.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 451.1 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 10 · 17:34.620 · chem-09-0359

**Available evidence (oldest → latest)**

- chem-09-0352 · 17:12.670–17:14.710: the energy levels change.
- chem-09-0353 · 17:14.710–17:16.710: So ions can have different properties
- chem-09-0354 · 17:16.710–17:18.420: than their neutral parents.
- chem-09-0355 · 17:18.420–17:21.410: And so if we have two kinds of ions,
- chem-09-0356 · 17:21.410–17:24.670: we can have cations, which are positively charged.
- chem-09-0357 · 17:24.670–17:28.300: And so a positively charged ion will have lost an electron,
- chem-09-0358 · 17:28.300–17:31.520: and so it's going to be smaller than its parent.
- chem-09-0359 · 17:31.520–17:34.620: And so we can see here lithium.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0359"]: And so we can see here lithium.
- C1 ["chem-09-0358","chem-09-0359"]: and so it's going to be smaller than its parent. And so we can see here lithium.
- C2 ["chem-09-0357","chem-09-0358","chem-09-0359"]: And so a positively charged ion will have lost an electron, and so it's going to be smaller than its parent. And so we can see here lithium.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 417.9 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 11 · 17:37.460 · chem-09-0360

**Available evidence (oldest → latest)**

- chem-09-0354 · 17:16.710–17:18.420: than their neutral parents.
- chem-09-0355 · 17:18.420–17:21.410: And so if we have two kinds of ions,
- chem-09-0356 · 17:21.410–17:24.670: we can have cations, which are positively charged.
- chem-09-0357 · 17:24.670–17:28.300: And so a positively charged ion will have lost an electron,
- chem-09-0358 · 17:28.300–17:31.520: and so it's going to be smaller than its parent.
- chem-09-0359 · 17:31.520–17:34.620: And so we can see here lithium.
- chem-09-0360 · 17:34.620–17:37.460: And then in the center, that's lithium plus.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0360"]: And then in the center, that's lithium plus.
- C1 ["chem-09-0359","chem-09-0360"]: And so we can see here lithium. And then in the center, that's lithium plus.
- C2 ["chem-09-0358","chem-09-0359","chem-09-0360"]: and so it's going to be smaller than its parent. And so we can see here lithium. And then in the center, that's lithium plus.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 446.7 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 12 · 17:39.470 · chem-09-0361

**Available evidence (oldest → latest)**

- chem-09-0355 · 17:18.420–17:21.410: And so if we have two kinds of ions,
- chem-09-0356 · 17:21.410–17:24.670: we can have cations, which are positively charged.
- chem-09-0357 · 17:24.670–17:28.300: And so a positively charged ion will have lost an electron,
- chem-09-0358 · 17:28.300–17:31.520: and so it's going to be smaller than its parent.
- chem-09-0359 · 17:31.520–17:34.620: And so we can see here lithium.
- chem-09-0360 · 17:34.620–17:37.460: And then in the center, that's lithium plus.
- chem-09-0361 · 17:37.460–17:39.470: So when you lose the electron, the radius

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0361"]: So when you lose the electron, the radius
- C1 ["chem-09-0360","chem-09-0361"]: And then in the center, that's lithium plus. So when you lose the electron, the radius
- C2 ["chem-09-0359","chem-09-0360","chem-09-0361"]: And so we can see here lithium. And then in the center, that's lithium plus. So when you lose the electron, the radius

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 410.8 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 13 · 17:40.990 · chem-09-0362

**Available evidence (oldest → latest)**

- chem-09-0355 · 17:18.420–17:21.410: And so if we have two kinds of ions,
- chem-09-0356 · 17:21.410–17:24.670: we can have cations, which are positively charged.
- chem-09-0357 · 17:24.670–17:28.300: And so a positively charged ion will have lost an electron,
- chem-09-0358 · 17:28.300–17:31.520: and so it's going to be smaller than its parent.
- chem-09-0359 · 17:31.520–17:34.620: And so we can see here lithium.
- chem-09-0360 · 17:34.620–17:37.460: And then in the center, that's lithium plus.
- chem-09-0361 · 17:37.460–17:39.470: So when you lose the electron, the radius
- chem-09-0362 · 17:39.470–17:40.990: actually shrinks quite a bit.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0362"]: actually shrinks quite a bit.
- C1 ["chem-09-0361","chem-09-0362"]: So when you lose the electron, the radius actually shrinks quite a bit.
- C2 ["chem-09-0360","chem-09-0361","chem-09-0362"]: And then in the center, that's lithium plus. So when you lose the electron, the radius actually shrinks quite a bit.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 451.7 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 14 · 17:44.420 · chem-09-0363

**Available evidence (oldest → latest)**

- chem-09-0356 · 17:21.410–17:24.670: we can have cations, which are positively charged.
- chem-09-0357 · 17:24.670–17:28.300: And so a positively charged ion will have lost an electron,
- chem-09-0358 · 17:28.300–17:31.520: and so it's going to be smaller than its parent.
- chem-09-0359 · 17:31.520–17:34.620: And so we can see here lithium.
- chem-09-0360 · 17:34.620–17:37.460: And then in the center, that's lithium plus.
- chem-09-0361 · 17:37.460–17:39.470: So when you lose the electron, the radius
- chem-09-0362 · 17:39.470–17:40.990: actually shrinks quite a bit.
- chem-09-0363 · 17:40.990–17:44.420: It's like that electron was just really kind

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0363"]: It's like that electron was just really kind
- C1 ["chem-09-0362","chem-09-0363"]: actually shrinks quite a bit. It's like that electron was just really kind
- C2 ["chem-09-0361","chem-09-0362","chem-09-0363"]: So when you lose the electron, the radius actually shrinks quite a bit. It's like that electron was just really kind

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 390.2 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 15 · 17:46.190 · chem-09-0364

**Available evidence (oldest → latest)**

- chem-09-0357 · 17:24.670–17:28.300: And so a positively charged ion will have lost an electron,
- chem-09-0358 · 17:28.300–17:31.520: and so it's going to be smaller than its parent.
- chem-09-0359 · 17:31.520–17:34.620: And so we can see here lithium.
- chem-09-0360 · 17:34.620–17:37.460: And then in the center, that's lithium plus.
- chem-09-0361 · 17:37.460–17:39.470: So when you lose the electron, the radius
- chem-09-0362 · 17:39.470–17:40.990: actually shrinks quite a bit.
- chem-09-0363 · 17:40.990–17:44.420: It's like that electron was just really kind
- chem-09-0364 · 17:44.420–17:46.190: of causing a bigger radius.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0364"]: of causing a bigger radius.
- C1 ["chem-09-0363","chem-09-0364"]: It's like that electron was just really kind of causing a bigger radius.
- C2 ["chem-09-0362","chem-09-0363","chem-09-0364"]: actually shrinks quite a bit. It's like that electron was just really kind of causing a bigger radius.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 441.7 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 16 · 17:48.300 · chem-09-0365

**Available evidence (oldest → latest)**

- chem-09-0357 · 17:24.670–17:28.300: And so a positively charged ion will have lost an electron,
- chem-09-0358 · 17:28.300–17:31.520: and so it's going to be smaller than its parent.
- chem-09-0359 · 17:31.520–17:34.620: And so we can see here lithium.
- chem-09-0360 · 17:34.620–17:37.460: And then in the center, that's lithium plus.
- chem-09-0361 · 17:37.460–17:39.470: So when you lose the electron, the radius
- chem-09-0362 · 17:39.470–17:40.990: actually shrinks quite a bit.
- chem-09-0363 · 17:40.990–17:44.420: It's like that electron was just really kind
- chem-09-0364 · 17:44.420–17:46.190: of causing a bigger radius.
- chem-09-0365 · 17:46.190–17:48.300: And when it's finally gone, you're

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0365"]: And when it's finally gone, you're
- C1 ["chem-09-0364","chem-09-0365"]: of causing a bigger radius. And when it's finally gone, you're
- C2 ["chem-09-0363","chem-09-0364","chem-09-0365"]: It's like that electron was just really kind of causing a bigger radius. And when it's finally gone, you're

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 394.7 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 17 · 17:51.930 · chem-09-0366

**Available evidence (oldest → latest)**

- chem-09-0359 · 17:31.520–17:34.620: And so we can see here lithium.
- chem-09-0360 · 17:34.620–17:37.460: And then in the center, that's lithium plus.
- chem-09-0361 · 17:37.460–17:39.470: So when you lose the electron, the radius
- chem-09-0362 · 17:39.470–17:40.990: actually shrinks quite a bit.
- chem-09-0363 · 17:40.990–17:44.420: It's like that electron was just really kind
- chem-09-0364 · 17:44.420–17:46.190: of causing a bigger radius.
- chem-09-0365 · 17:46.190–17:48.300: And when it's finally gone, you're
- chem-09-0366 · 17:48.300–17:51.930: at a smaller size over there.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0366"]: at a smaller size over there.
- C1 ["chem-09-0365","chem-09-0366"]: And when it's finally gone, you're at a smaller size over there.
- C2 ["chem-09-0364","chem-09-0365","chem-09-0366"]: of causing a bigger radius. And when it's finally gone, you're at a smaller size over there.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 457.9 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 18 · 17:54.480 · chem-09-0367

**Available evidence (oldest → latest)**

- chem-09-0359 · 17:31.520–17:34.620: And so we can see here lithium.
- chem-09-0360 · 17:34.620–17:37.460: And then in the center, that's lithium plus.
- chem-09-0361 · 17:37.460–17:39.470: So when you lose the electron, the radius
- chem-09-0362 · 17:39.470–17:40.990: actually shrinks quite a bit.
- chem-09-0363 · 17:40.990–17:44.420: It's like that electron was just really kind
- chem-09-0364 · 17:44.420–17:46.190: of causing a bigger radius.
- chem-09-0365 · 17:46.190–17:48.300: And when it's finally gone, you're
- chem-09-0366 · 17:48.300–17:51.930: at a smaller size over there.
- chem-09-0367 · 17:51.930–17:54.480: Anions-- negatively charged ions.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0367"]: Anions-- negatively charged ions.
- C1 ["chem-09-0366","chem-09-0367"]: at a smaller size over there. Anions-- negatively charged ions.
- C2 ["chem-09-0365","chem-09-0366","chem-09-0367"]: And when it's finally gone, you're at a smaller size over there. Anions-- negatively charged ions.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 426.2 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 19 · 17:57.660 · chem-09-0368

**Available evidence (oldest → latest)**

- chem-09-0361 · 17:37.460–17:39.470: So when you lose the electron, the radius
- chem-09-0362 · 17:39.470–17:40.990: actually shrinks quite a bit.
- chem-09-0363 · 17:40.990–17:44.420: It's like that electron was just really kind
- chem-09-0364 · 17:44.420–17:46.190: of causing a bigger radius.
- chem-09-0365 · 17:46.190–17:48.300: And when it's finally gone, you're
- chem-09-0366 · 17:48.300–17:51.930: at a smaller size over there.
- chem-09-0367 · 17:51.930–17:54.480: Anions-- negatively charged ions.
- chem-09-0368 · 17:54.480–17:57.660: So they're gaining an electron, and their radius

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0368"]: So they're gaining an electron, and their radius
- C1 ["chem-09-0367","chem-09-0368"]: Anions-- negatively charged ions. So they're gaining an electron, and their radius
- C2 ["chem-09-0366","chem-09-0367","chem-09-0368"]: at a smaller size over there. Anions-- negatively charged ions. So they're gaining an electron, and their radius

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 403.3 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 20 · 17:59.510 · chem-09-0369

**Available evidence (oldest → latest)**

- chem-09-0362 · 17:39.470–17:40.990: actually shrinks quite a bit.
- chem-09-0363 · 17:40.990–17:44.420: It's like that electron was just really kind
- chem-09-0364 · 17:44.420–17:46.190: of causing a bigger radius.
- chem-09-0365 · 17:46.190–17:48.300: And when it's finally gone, you're
- chem-09-0366 · 17:48.300–17:51.930: at a smaller size over there.
- chem-09-0367 · 17:51.930–17:54.480: Anions-- negatively charged ions.
- chem-09-0368 · 17:54.480–17:57.660: So they're gaining an electron, and their radius
- chem-09-0369 · 17:57.660–17:59.510: is larger than their parent.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0369"]: is larger than their parent.
- C1 ["chem-09-0368","chem-09-0369"]: So they're gaining an electron, and their radius is larger than their parent.
- C2 ["chem-09-0367","chem-09-0368","chem-09-0369"]: Anions-- negatively charged ions. So they're gaining an electron, and their radius is larger than their parent.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 394.8 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 21 · 18:02.810 · chem-09-0370

**Available evidence (oldest → latest)**

- chem-09-0363 · 17:40.990–17:44.420: It's like that electron was just really kind
- chem-09-0364 · 17:44.420–17:46.190: of causing a bigger radius.
- chem-09-0365 · 17:46.190–17:48.300: And when it's finally gone, you're
- chem-09-0366 · 17:48.300–17:51.930: at a smaller size over there.
- chem-09-0367 · 17:51.930–17:54.480: Anions-- negatively charged ions.
- chem-09-0368 · 17:54.480–17:57.660: So they're gaining an electron, and their radius
- chem-09-0369 · 17:57.660–17:59.510: is larger than their parent.
- chem-09-0370 · 17:59.510–18:02.810: And so you can see over here, we have oxygen in the center.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0370"]: And so you can see over here, we have oxygen in the center.
- C1 ["chem-09-0369","chem-09-0370"]: is larger than their parent. And so you can see over here, we have oxygen in the center.
- C2 ["chem-09-0368","chem-09-0369","chem-09-0370"]: So they're gaining an electron, and their radius is larger than their parent. And so you can see over here, we have oxygen in the center.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 432.9 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 22 · 18:05.950 · chem-09-0371

**Available evidence (oldest → latest)**

- chem-09-0364 · 17:44.420–17:46.190: of causing a bigger radius.
- chem-09-0365 · 17:46.190–17:48.300: And when it's finally gone, you're
- chem-09-0366 · 17:48.300–17:51.930: at a smaller size over there.
- chem-09-0367 · 17:51.930–17:54.480: Anions-- negatively charged ions.
- chem-09-0368 · 17:54.480–17:57.660: So they're gaining an electron, and their radius
- chem-09-0369 · 17:57.660–17:59.510: is larger than their parent.
- chem-09-0370 · 17:59.510–18:02.810: And so you can see over here, we have oxygen in the center.
- chem-09-0371 · 18:02.810–18:05.950: Oxygen minus 2 is much larger.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0371"]: Oxygen minus 2 is much larger.
- C1 ["chem-09-0370","chem-09-0371"]: And so you can see over here, we have oxygen in the center. Oxygen minus 2 is much larger.
- C2 ["chem-09-0369","chem-09-0370","chem-09-0371"]: is larger than their parent. And so you can see over here, we have oxygen in the center. Oxygen minus 2 is much larger.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 505.9 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 23 · 18:08.090 · chem-09-0372

**Available evidence (oldest → latest)**

- chem-09-0365 · 17:46.190–17:48.300: And when it's finally gone, you're
- chem-09-0366 · 17:48.300–17:51.930: at a smaller size over there.
- chem-09-0367 · 17:51.930–17:54.480: Anions-- negatively charged ions.
- chem-09-0368 · 17:54.480–17:57.660: So they're gaining an electron, and their radius
- chem-09-0369 · 17:57.660–17:59.510: is larger than their parent.
- chem-09-0370 · 17:59.510–18:02.810: And so you can see over here, we have oxygen in the center.
- chem-09-0371 · 18:02.810–18:05.950: Oxygen minus 2 is much larger.
- chem-09-0372 · 18:05.950–18:08.090: And again, we can see some of the other trends.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0372"]: And again, we can see some of the other trends.
- C1 ["chem-09-0371","chem-09-0372"]: Oxygen minus 2 is much larger. And again, we can see some of the other trends.
- C2 ["chem-09-0370","chem-09-0371","chem-09-0372"]: And so you can see over here, we have oxygen in the center. Oxygen minus 2 is much larger. And again, we can see some of the other trends.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 477.5 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 24 · 18:09.850 · chem-09-0373

**Available evidence (oldest → latest)**

- chem-09-0366 · 17:48.300–17:51.930: at a smaller size over there.
- chem-09-0367 · 17:51.930–17:54.480: Anions-- negatively charged ions.
- chem-09-0368 · 17:54.480–17:57.660: So they're gaining an electron, and their radius
- chem-09-0369 · 17:57.660–17:59.510: is larger than their parent.
- chem-09-0370 · 17:59.510–18:02.810: And so you can see over here, we have oxygen in the center.
- chem-09-0371 · 18:02.810–18:05.950: Oxygen minus 2 is much larger.
- chem-09-0372 · 18:05.950–18:08.090: And again, we can see some of the other trends.
- chem-09-0373 · 18:08.090–18:09.850: Some of them are the same.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0373"]: Some of them are the same.
- C1 ["chem-09-0372","chem-09-0373"]: And again, we can see some of the other trends. Some of them are the same.
- C2 ["chem-09-0371","chem-09-0372","chem-09-0373"]: Oxygen minus 2 is much larger. And again, we can see some of the other trends. Some of them are the same.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 455.7 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 25 · 18:13.860 · chem-09-0374

**Available evidence (oldest → latest)**

- chem-09-0367 · 17:51.930–17:54.480: Anions-- negatively charged ions.
- chem-09-0368 · 17:54.480–17:57.660: So they're gaining an electron, and their radius
- chem-09-0369 · 17:57.660–17:59.510: is larger than their parent.
- chem-09-0370 · 17:59.510–18:02.810: And so you can see over here, we have oxygen in the center.
- chem-09-0371 · 18:02.810–18:05.950: Oxygen minus 2 is much larger.
- chem-09-0372 · 18:05.950–18:08.090: And again, we can see some of the other trends.
- chem-09-0373 · 18:08.090–18:09.850: Some of them are the same.
- chem-09-0374 · 18:09.850–18:13.860: The ionic radius also will increase

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0374"]: The ionic radius also will increase
- C1 ["chem-09-0373","chem-09-0374"]: Some of them are the same. The ionic radius also will increase
- C2 ["chem-09-0372","chem-09-0373","chem-09-0374"]: And again, we can see some of the other trends. Some of them are the same. The ionic radius also will increase

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 417.1 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 26 · 18:16.940 · chem-09-0375

**Available evidence (oldest → latest)**

- chem-09-0368 · 17:54.480–17:57.660: So they're gaining an electron, and their radius
- chem-09-0369 · 17:57.660–17:59.510: is larger than their parent.
- chem-09-0370 · 17:59.510–18:02.810: And so you can see over here, we have oxygen in the center.
- chem-09-0371 · 18:02.810–18:05.950: Oxygen minus 2 is much larger.
- chem-09-0372 · 18:05.950–18:08.090: And again, we can see some of the other trends.
- chem-09-0373 · 18:08.090–18:09.850: Some of them are the same.
- chem-09-0374 · 18:09.850–18:13.860: The ionic radius also will increase
- chem-09-0375 · 18:13.860–18:16.940: when we're going down a group, so when n is increasing,

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0375"]: when we're going down a group, so when n is increasing,
- C1 ["chem-09-0374","chem-09-0375"]: The ionic radius also will increase when we're going down a group, so when n is increasing,
- C2 ["chem-09-0373","chem-09-0374","chem-09-0375"]: Some of them are the same. The ionic radius also will increase when we're going down a group, so when n is increasing,

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 409.9 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 27 · 18:18.720 · chem-09-0376

**Available evidence (oldest → latest)**

- chem-09-0369 · 17:57.660–17:59.510: is larger than their parent.
- chem-09-0370 · 17:59.510–18:02.810: And so you can see over here, we have oxygen in the center.
- chem-09-0371 · 18:02.810–18:05.950: Oxygen minus 2 is much larger.
- chem-09-0372 · 18:05.950–18:08.090: And again, we can see some of the other trends.
- chem-09-0373 · 18:08.090–18:09.850: Some of them are the same.
- chem-09-0374 · 18:09.850–18:13.860: The ionic radius also will increase
- chem-09-0375 · 18:13.860–18:16.940: when we're going down a group, so when n is increasing,
- chem-09-0376 · 18:16.940–18:18.720: so from lithium to sodium.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0376"]: so from lithium to sodium.
- C1 ["chem-09-0375","chem-09-0376"]: when we're going down a group, so when n is increasing, so from lithium to sodium.
- C2 ["chem-09-0374","chem-09-0375","chem-09-0376"]: The ionic radius also will increase when we're going down a group, so when n is increasing, so from lithium to sodium.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 513.7 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 28 · 18:20.830 · chem-09-0377

**Available evidence (oldest → latest)**

- chem-09-0370 · 17:59.510–18:02.810: And so you can see over here, we have oxygen in the center.
- chem-09-0371 · 18:02.810–18:05.950: Oxygen minus 2 is much larger.
- chem-09-0372 · 18:05.950–18:08.090: And again, we can see some of the other trends.
- chem-09-0373 · 18:08.090–18:09.850: Some of them are the same.
- chem-09-0374 · 18:09.850–18:13.860: The ionic radius also will increase
- chem-09-0375 · 18:13.860–18:16.940: when we're going down a group, so when n is increasing,
- chem-09-0376 · 18:16.940–18:18.720: so from lithium to sodium.
- chem-09-0377 · 18:18.720–18:20.830: We have an increase from fluorine

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0377"]: We have an increase from fluorine
- C1 ["chem-09-0376","chem-09-0377"]: so from lithium to sodium. We have an increase from fluorine
- C2 ["chem-09-0375","chem-09-0376","chem-09-0377"]: when we're going down a group, so when n is increasing, so from lithium to sodium. We have an increase from fluorine

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 511.2 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 29 · 18:23.440 · chem-09-0378

**Available evidence (oldest → latest)**

- chem-09-0371 · 18:02.810–18:05.950: Oxygen minus 2 is much larger.
- chem-09-0372 · 18:05.950–18:08.090: And again, we can see some of the other trends.
- chem-09-0373 · 18:08.090–18:09.850: Some of them are the same.
- chem-09-0374 · 18:09.850–18:13.860: The ionic radius also will increase
- chem-09-0375 · 18:13.860–18:16.940: when we're going down a group, so when n is increasing,
- chem-09-0376 · 18:16.940–18:18.720: so from lithium to sodium.
- chem-09-0377 · 18:18.720–18:20.830: We have an increase from fluorine
- chem-09-0378 · 18:20.830–18:23.440: to the top of the periodic table to chlorine.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0378"]: to the top of the periodic table to chlorine.
- C1 ["chem-09-0377","chem-09-0378"]: We have an increase from fluorine to the top of the periodic table to chlorine.
- C2 ["chem-09-0376","chem-09-0377","chem-09-0378"]: so from lithium to sodium. We have an increase from fluorine to the top of the periodic table to chlorine.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 509.4 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 30 · 18:26.990 · chem-09-0379

**Available evidence (oldest → latest)**

- chem-09-0372 · 18:05.950–18:08.090: And again, we can see some of the other trends.
- chem-09-0373 · 18:08.090–18:09.850: Some of them are the same.
- chem-09-0374 · 18:09.850–18:13.860: The ionic radius also will increase
- chem-09-0375 · 18:13.860–18:16.940: when we're going down a group, so when n is increasing,
- chem-09-0376 · 18:16.940–18:18.720: so from lithium to sodium.
- chem-09-0377 · 18:18.720–18:20.830: We have an increase from fluorine
- chem-09-0378 · 18:20.830–18:23.440: to the top of the periodic table to chlorine.
- chem-09-0379 · 18:23.440–18:26.990: So we still, as we increase n, increase in size.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0379"]: So we still, as we increase n, increase in size.
- C1 ["chem-09-0378","chem-09-0379"]: to the top of the periodic table to chlorine. So we still, as we increase n, increase in size.
- C2 ["chem-09-0377","chem-09-0378","chem-09-0379"]: We have an increase from fluorine to the top of the periodic table to chlorine. So we still, as we increase n, increase in size.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 458.0 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 31 · 18:30.200 · chem-09-0380

**Available evidence (oldest → latest)**

- chem-09-0374 · 18:09.850–18:13.860: The ionic radius also will increase
- chem-09-0375 · 18:13.860–18:16.940: when we're going down a group, so when n is increasing,
- chem-09-0376 · 18:16.940–18:18.720: so from lithium to sodium.
- chem-09-0377 · 18:18.720–18:20.830: We have an increase from fluorine
- chem-09-0378 · 18:20.830–18:23.440: to the top of the periodic table to chlorine.
- chem-09-0379 · 18:23.440–18:26.990: So we still, as we increase n, increase in size.
- chem-09-0380 · 18:26.990–18:30.200: But you have to think about the ion-- did it lose an electron,

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0380"]: But you have to think about the ion-- did it lose an electron,
- C1 ["chem-09-0379","chem-09-0380"]: So we still, as we increase n, increase in size. But you have to think about the ion-- did it lose an electron,
- C2 ["chem-09-0378","chem-09-0379","chem-09-0380"]: to the top of the periodic table to chlorine. So we still, as we increase n, increase in size. But you have to think about the ion-- did it lose an electron,

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 424.1 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 32 · 18:32.220 · chem-09-0381

**Available evidence (oldest → latest)**

- chem-09-0374 · 18:09.850–18:13.860: The ionic radius also will increase
- chem-09-0375 · 18:13.860–18:16.940: when we're going down a group, so when n is increasing,
- chem-09-0376 · 18:16.940–18:18.720: so from lithium to sodium.
- chem-09-0377 · 18:18.720–18:20.830: We have an increase from fluorine
- chem-09-0378 · 18:20.830–18:23.440: to the top of the periodic table to chlorine.
- chem-09-0379 · 18:23.440–18:26.990: So we still, as we increase n, increase in size.
- chem-09-0380 · 18:26.990–18:30.200: But you have to think about the ion-- did it lose an electron,
- chem-09-0381 · 18:30.200–18:32.220: or did it gain an electron-- to think

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0381"]: or did it gain an electron-- to think
- C1 ["chem-09-0380","chem-09-0381"]: But you have to think about the ion-- did it lose an electron, or did it gain an electron-- to think
- C2 ["chem-09-0379","chem-09-0380","chem-09-0381"]: So we still, as we increase n, increase in size. But you have to think about the ion-- did it lose an electron, or did it gain an electron-- to think

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 466.0 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 33 · 18:38.430 · chem-09-0382

**Available evidence (oldest → latest)**

- chem-09-0376 · 18:16.940–18:18.720: so from lithium to sodium.
- chem-09-0377 · 18:18.720–18:20.830: We have an increase from fluorine
- chem-09-0378 · 18:20.830–18:23.440: to the top of the periodic table to chlorine.
- chem-09-0379 · 18:23.440–18:26.990: So we still, as we increase n, increase in size.
- chem-09-0380 · 18:26.990–18:30.200: But you have to think about the ion-- did it lose an electron,
- chem-09-0381 · 18:30.200–18:32.220: or did it gain an electron-- to think
- chem-09-0382 · 18:32.220–18:38.430: about how its size changed with respect to its parent.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0382"]: about how its size changed with respect to its parent.
- C1 ["chem-09-0381","chem-09-0382"]: or did it gain an electron-- to think about how its size changed with respect to its parent.
- C2 ["chem-09-0380","chem-09-0381","chem-09-0382"]: But you have to think about the ion-- did it lose an electron, or did it gain an electron-- to think about how its size changed with respect to its parent.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 530.1 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

