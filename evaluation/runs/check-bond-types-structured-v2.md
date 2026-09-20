# CueLight replay — semantic

## Run identity

```json
{
  "metadata": {
    "createdAt": "2026-09-20T13:38:44.314Z",
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
    "from": 1676646,
    "to": 1756180,
    "fragmentCount": 17,
    "prefixRunSha256": "e46a0df240469c9b82b3c03e74e88758cd0f4c08fc0e4cb908ffbe41994f1180",
    "initialState": "reconstructed by same engine from archived decisions BEFORE range; timestamps re-created, no future decisions used",
    "boundary": "original MIT VTT captions, available at caption end; not Speechmatics Final",
    "window": "20 seconds / 32 fragments; unchanged latest 1/2/3 + current-source-to-latest candidates",
    "firstDisplayMeasurement": "engine Cue-state publication proxy; browser paint, ASR and speech latency not measured"
  },
  "summary": {
    "accepted": 17,
    "decisions": 17,
    "interrupted": false,
    "outcomes": {
      "applied": 8,
      "quiet": 9,
      "discarded": 0,
      "fallback": 0
    },
    "actions": {
      "QUIET": 9,
      "NEW_CUE": 3,
      "UPDATE_CURRENT": 5
    },
    "changesPerSourceMinute": 6.035154776573541,
    "providerMs": {
      "p50": 435.33799999999974,
      "p95": 1183.570167,
      "max": 1183.570167
    },
    "sourceReadyToCueStateMs": {
      "p50": 415.4479999999994,
      "p95": 537.8873750000002
    },
    "elapsedMs": 9413.275375000001,
    "cost": "not supplied by provider; token usage retained when present"
  }
}
```

Semantic mode waits after each caption: its timings are API / local publication observations, not real arrival scheduling or speech-to-screen latency. Paced mode uses original caption end times at 1×. Neither measures browser paint or Speechmatics Final.

User and assistant annotations are separate offline references and are never sent to the model. Unmarked content is not automatically wrong.

## 1 · 27:59.634 · chem-09-0555

**Available evidence (oldest → latest)**

- chem-09-0549 · 27:37.079–27:40.530: The electrons that participate in a chemical bond
- chem-09-0550 · 27:40.530–27:42.009: are called valence electrons.
- chem-09-0551 · 27:42.009–27:44.967: These are electrons that are found in an atom's outermost
- chem-09-0552 · 27:44.967–27:47.450: shell.
- chem-09-0553 · 27:47.450–27:49.674: Let's take a look at the types of chemical bonds
- chem-09-0554 · 27:49.674–27:51.168: that can be formed between atoms.
- chem-09-0555 · 27:56.646–27:59.634: An ionic bond is formed when one of the atoms

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0555"]: An ionic bond is formed when one of the atoms
- C1 ["chem-09-0554","chem-09-0555"]: that can be formed between atoms. An ionic bond is formed when one of the atoms
- C2 ["chem-09-0553","chem-09-0554","chem-09-0555"]: Let's take a look at the types of chemical bonds that can be formed between atoms. An ionic bond is formed when one of the atoms

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 1183.6 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

## 2 · 28:02.640 · chem-09-0556

**Available evidence (oldest → latest)**

- chem-09-0551 · 27:42.009–27:44.967: These are electrons that are found in an atom's outermost
- chem-09-0552 · 27:44.967–27:47.450: shell.
- chem-09-0553 · 27:47.450–27:49.674: Let's take a look at the types of chemical bonds
- chem-09-0554 · 27:49.674–27:51.168: that can be formed between atoms.
- chem-09-0555 · 27:56.646–27:59.634: An ionic bond is formed when one of the atoms
- chem-09-0556 · 27:59.634–28:02.640: will lose its electron to the other atom.

**Current Cue before decision**

> Since chlorine is so electronegative, when bonded to carbon it pulls electrons away from the carbon atom. And so it makes the carbon to which it is attached much more reactive toward other molecules. And this increased reactivity, at least partially, accounts for the antibiotic effect of the molecule.

Sources: chem-09-0174, chem-09-0175, chem-09-0176, chem-09-0177, chem-09-0178, chem-09-0179, chem-09-0180

**Actual candidates**

- C0 ["chem-09-0556"]: will lose its electron to the other atom.
- C1 ["chem-09-0555","chem-09-0556"]: An ionic bond is formed when one of the atoms will lose its electron to the other atom.
- C2 ["chem-09-0554","chem-09-0555","chem-09-0556"]: that can be formed between atoms. An ionic bond is formed when one of the atoms will lose its electron to the other atom.

**Jev returned:** {"action":"NEW_CUE","candidateId":"[\"chem-09-0555\",\"chem-09-0556\"]"}

**Engine:** applied; discard reason: none; provider 414.6 ms; source-ready → Cue-state 414.8 ms.

**Current Cue after application**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom.

Sources: chem-09-0555, chem-09-0556

## 3 · 28:05.335 · chem-09-0557

**Available evidence (oldest → latest)**

- chem-09-0552 · 27:44.967–27:47.450: shell.
- chem-09-0553 · 27:47.450–27:49.674: Let's take a look at the types of chemical bonds
- chem-09-0554 · 27:49.674–27:51.168: that can be formed between atoms.
- chem-09-0555 · 27:56.646–27:59.634: An ionic bond is formed when one of the atoms
- chem-09-0556 · 27:59.634–28:02.640: will lose its electron to the other atom.
- chem-09-0557 · 28:02.640–28:05.335: This results in a positively charged ion

**Current Cue before decision**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom.

Sources: chem-09-0555, chem-09-0556

**Actual candidates**

- C0 ["chem-09-0557"]: This results in a positively charged ion
- C1 ["chem-09-0556","chem-09-0557"]: will lose its electron to the other atom. This results in a positively charged ion
- C2 ["chem-09-0555","chem-09-0556","chem-09-0557"]: An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion

**Jev returned:** {"action":"UPDATE_CURRENT","candidateId":"[\"chem-09-0555\",\"chem-09-0556\",\"chem-09-0557\"]"}

**Engine:** applied; discard reason: none; provider 390.6 ms; source-ready → Cue-state 390.9 ms.

**Current Cue after application**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion

Sources: chem-09-0555, chem-09-0556, chem-09-0557

## 4 · 28:09.279 · chem-09-0558

**Available evidence (oldest → latest)**

- chem-09-0553 · 27:47.450–27:49.674: Let's take a look at the types of chemical bonds
- chem-09-0554 · 27:49.674–27:51.168: that can be formed between atoms.
- chem-09-0555 · 27:56.646–27:59.634: An ionic bond is formed when one of the atoms
- chem-09-0556 · 27:59.634–28:02.640: will lose its electron to the other atom.
- chem-09-0557 · 28:02.640–28:05.335: This results in a positively charged ion
- chem-09-0558 · 28:05.335–28:09.279: called a cation and a negatively charged ion called an anion.

**Current Cue before decision**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion

Sources: chem-09-0555, chem-09-0556, chem-09-0557

**Actual candidates**

- C0 ["chem-09-0558"]: called a cation and a negatively charged ion called an anion.
- C1 ["chem-09-0557","chem-09-0558"]: This results in a positively charged ion called a cation and a negatively charged ion called an anion.
- C2 ["chem-09-0556","chem-09-0557","chem-09-0558"]: will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion.
- C3 ["chem-09-0555","chem-09-0556","chem-09-0557","chem-09-0558"]: An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion.

**Jev returned:** {"action":"UPDATE_CURRENT","candidateId":"[\"chem-09-0555\",\"chem-09-0556\",\"chem-09-0557\",\"chem-09-0558\"]"}

**Engine:** applied; discard reason: none; provider 452.4 ms; source-ready → Cue-state 452.8 ms.

**Current Cue after application**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion.

Sources: chem-09-0555, chem-09-0556, chem-09-0557, chem-09-0558

## 5 · 28:14.586 · chem-09-0559

**Available evidence (oldest → latest)**

- chem-09-0555 · 27:56.646–27:59.634: An ionic bond is formed when one of the atoms
- chem-09-0556 · 27:59.634–28:02.640: will lose its electron to the other atom.
- chem-09-0557 · 28:02.640–28:05.335: This results in a positively charged ion
- chem-09-0558 · 28:05.335–28:09.279: called a cation and a negatively charged ion called an anion.
- chem-09-0559 · 28:12.250–28:14.586: Positive and negative attract, and the result

**Current Cue before decision**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion.

Sources: chem-09-0555, chem-09-0556, chem-09-0557, chem-09-0558

**Actual candidates**

- C0 ["chem-09-0559"]: Positive and negative attract, and the result
- C1 ["chem-09-0558","chem-09-0559"]: called a cation and a negatively charged ion called an anion. Positive and negative attract, and the result
- C2 ["chem-09-0557","chem-09-0558","chem-09-0559"]: This results in a positively charged ion called a cation and a negatively charged ion called an anion. Positive and negative attract, and the result
- C3 ["chem-09-0555","chem-09-0556","chem-09-0557","chem-09-0558","chem-09-0559"]: An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion. Positive and negative attract, and the result

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 381.4 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion.

Sources: chem-09-0555, chem-09-0556, chem-09-0557, chem-09-0558

## 6 · 28:16.038 · chem-09-0560

**Available evidence (oldest → latest)**

- chem-09-0555 · 27:56.646–27:59.634: An ionic bond is formed when one of the atoms
- chem-09-0556 · 27:59.634–28:02.640: will lose its electron to the other atom.
- chem-09-0557 · 28:02.640–28:05.335: This results in a positively charged ion
- chem-09-0558 · 28:05.335–28:09.279: called a cation and a negatively charged ion called an anion.
- chem-09-0559 · 28:12.250–28:14.586: Positive and negative attract, and the result
- chem-09-0560 · 28:14.586–28:16.038: is an ionic bond.

**Current Cue before decision**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion.

Sources: chem-09-0555, chem-09-0556, chem-09-0557, chem-09-0558

**Actual candidates**

- C0 ["chem-09-0560"]: is an ionic bond.
- C1 ["chem-09-0559","chem-09-0560"]: Positive and negative attract, and the result is an ionic bond.
- C2 ["chem-09-0558","chem-09-0559","chem-09-0560"]: called a cation and a negatively charged ion called an anion. Positive and negative attract, and the result is an ionic bond.
- C3 ["chem-09-0555","chem-09-0556","chem-09-0557","chem-09-0558","chem-09-0559","chem-09-0560"]: An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion. Positive and negative attract, and the result is an ionic bond.

**Jev returned:** {"action":"UPDATE_CURRENT","candidateId":"[\"chem-09-0555\",\"chem-09-0556\",\"chem-09-0557\",\"chem-09-0558\",\"chem-09-0559\",\"chem-09-0560\"]"}

**Engine:** applied; discard reason: none; provider 537.5 ms; source-ready → Cue-state 537.9 ms.

**Current Cue after application**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion. Positive and negative attract, and the result is an ionic bond.

Sources: chem-09-0555, chem-09-0556, chem-09-0557, chem-09-0558, chem-09-0559, chem-09-0560

## 7 · 28:25.030 · chem-09-0561

**Available evidence (oldest → latest)**

- chem-09-0557 · 28:02.640–28:05.335: This results in a positively charged ion
- chem-09-0558 · 28:05.335–28:09.279: called a cation and a negatively charged ion called an anion.
- chem-09-0559 · 28:12.250–28:14.586: Positive and negative attract, and the result
- chem-09-0560 · 28:14.586–28:16.038: is an ionic bond.
- chem-09-0561 · 28:22.330–28:25.030: Covalent chemical bonds involve the sharing

**Current Cue before decision**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion. Positive and negative attract, and the result is an ionic bond.

Sources: chem-09-0555, chem-09-0556, chem-09-0557, chem-09-0558, chem-09-0559, chem-09-0560

**Actual candidates**

- C0 ["chem-09-0561"]: Covalent chemical bonds involve the sharing
- C1 ["chem-09-0560","chem-09-0561"]: is an ionic bond. Covalent chemical bonds involve the sharing
- C2 ["chem-09-0559","chem-09-0560","chem-09-0561"]: Positive and negative attract, and the result is an ionic bond. Covalent chemical bonds involve the sharing

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 438.0 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion. Positive and negative attract, and the result is an ionic bond.

Sources: chem-09-0555, chem-09-0556, chem-09-0557, chem-09-0558, chem-09-0559, chem-09-0560

## 8 · 28:29.361 · chem-09-0562

**Available evidence (oldest → latest)**

- chem-09-0559 · 28:12.250–28:14.586: Positive and negative attract, and the result
- chem-09-0560 · 28:14.586–28:16.038: is an ionic bond.
- chem-09-0561 · 28:22.330–28:25.030: Covalent chemical bonds involve the sharing
- chem-09-0562 · 28:25.030–28:29.361: of a pair of valence electrons by two atoms.

**Current Cue before decision**

> An ionic bond is formed when one of the atoms will lose its electron to the other atom. This results in a positively charged ion called a cation and a negatively charged ion called an anion. Positive and negative attract, and the result is an ionic bond.

Sources: chem-09-0555, chem-09-0556, chem-09-0557, chem-09-0558, chem-09-0559, chem-09-0560

**Actual candidates**

- C0 ["chem-09-0562"]: of a pair of valence electrons by two atoms.
- C1 ["chem-09-0561","chem-09-0562"]: Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms.
- C2 ["chem-09-0560","chem-09-0561","chem-09-0562"]: is an ionic bond. Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms.

**Jev returned:** {"action":"NEW_CUE","candidateId":"[\"chem-09-0561\",\"chem-09-0562\"]"}

**Engine:** applied; discard reason: none; provider 397.5 ms; source-ready → Cue-state 397.9 ms.

**Current Cue after application**

> Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms.

Sources: chem-09-0561, chem-09-0562

## 9 · 28:32.464 · chem-09-0563

**Available evidence (oldest → latest)**

- chem-09-0559 · 28:12.250–28:14.586: Positive and negative attract, and the result
- chem-09-0560 · 28:14.586–28:16.038: is an ionic bond.
- chem-09-0561 · 28:22.330–28:25.030: Covalent chemical bonds involve the sharing
- chem-09-0562 · 28:25.030–28:29.361: of a pair of valence electrons by two atoms.
- chem-09-0563 · 28:29.361–28:32.464: There is also what is called polar covalent bonds.

**Current Cue before decision**

> Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms.

Sources: chem-09-0561, chem-09-0562

**Actual candidates**

- C0 ["chem-09-0563"]: There is also what is called polar covalent bonds.
- C1 ["chem-09-0562","chem-09-0563"]: of a pair of valence electrons by two atoms. There is also what is called polar covalent bonds.
- C2 ["chem-09-0561","chem-09-0562","chem-09-0563"]: Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms. There is also what is called polar covalent bonds.

**Jev returned:** {"action":"NEW_CUE","candidateId":"[\"chem-09-0561\",\"chem-09-0562\",\"chem-09-0563\"]"}

**Engine:** applied; discard reason: none; provider 394.9 ms; source-ready → Cue-state 395.3 ms.

**Current Cue after application**

> Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms. There is also what is called polar covalent bonds.

Sources: chem-09-0561, chem-09-0562, chem-09-0563

## 10 · 28:34.844 · chem-09-0564

**Available evidence (oldest → latest)**

- chem-09-0560 · 28:14.586–28:16.038: is an ionic bond.
- chem-09-0561 · 28:22.330–28:25.030: Covalent chemical bonds involve the sharing
- chem-09-0562 · 28:25.030–28:29.361: of a pair of valence electrons by two atoms.
- chem-09-0563 · 28:29.361–28:32.464: There is also what is called polar covalent bonds.
- chem-09-0564 · 28:32.464–28:34.844: These are covalent bonds in which

**Current Cue before decision**

> Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms. There is also what is called polar covalent bonds.

Sources: chem-09-0561, chem-09-0562, chem-09-0563

**Actual candidates**

- C0 ["chem-09-0564"]: These are covalent bonds in which
- C1 ["chem-09-0563","chem-09-0564"]: There is also what is called polar covalent bonds. These are covalent bonds in which
- C2 ["chem-09-0562","chem-09-0563","chem-09-0564"]: of a pair of valence electrons by two atoms. There is also what is called polar covalent bonds. These are covalent bonds in which
- C3 ["chem-09-0561","chem-09-0562","chem-09-0563","chem-09-0564"]: Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms. There is also what is called polar covalent bonds. These are covalent bonds in which

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 407.5 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms. There is also what is called polar covalent bonds.

Sources: chem-09-0561, chem-09-0562, chem-09-0563

## 11 · 28:38.180 · chem-09-0565

**Available evidence (oldest → latest)**

- chem-09-0561 · 28:22.330–28:25.030: Covalent chemical bonds involve the sharing
- chem-09-0562 · 28:25.030–28:29.361: of a pair of valence electrons by two atoms.
- chem-09-0563 · 28:29.361–28:32.464: There is also what is called polar covalent bonds.
- chem-09-0564 · 28:32.464–28:34.844: These are covalent bonds in which
- chem-09-0565 · 28:34.844–28:38.180: the sharing of the electron pair is unequal.

**Current Cue before decision**

> Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms. There is also what is called polar covalent bonds.

Sources: chem-09-0561, chem-09-0562, chem-09-0563

**Actual candidates**

- C0 ["chem-09-0565"]: the sharing of the electron pair is unequal.
- C1 ["chem-09-0564","chem-09-0565"]: These are covalent bonds in which the sharing of the electron pair is unequal.
- C2 ["chem-09-0563","chem-09-0564","chem-09-0565"]: There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal.
- C3 ["chem-09-0561","chem-09-0562","chem-09-0563","chem-09-0564","chem-09-0565"]: Covalent chemical bonds involve the sharing of a pair of valence electrons by two atoms. There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal.

**Jev returned:** {"action":"UPDATE_CURRENT","candidateId":"[\"chem-09-0563\",\"chem-09-0564\",\"chem-09-0565\"]"}

**Engine:** applied; discard reason: none; provider 415.0 ms; source-ready → Cue-state 415.4 ms.

**Current Cue after application**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal.

Sources: chem-09-0563, chem-09-0564, chem-09-0565

## 12 · 28:40.515 · chem-09-0566

**Available evidence (oldest → latest)**

- chem-09-0561 · 28:22.330–28:25.030: Covalent chemical bonds involve the sharing
- chem-09-0562 · 28:25.030–28:29.361: of a pair of valence electrons by two atoms.
- chem-09-0563 · 28:29.361–28:32.464: There is also what is called polar covalent bonds.
- chem-09-0564 · 28:32.464–28:34.844: These are covalent bonds in which
- chem-09-0565 · 28:34.844–28:38.180: the sharing of the electron pair is unequal.
- chem-09-0566 · 28:38.180–28:40.515: The result is a bond where the electron

**Current Cue before decision**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal.

Sources: chem-09-0563, chem-09-0564, chem-09-0565

**Actual candidates**

- C0 ["chem-09-0566"]: The result is a bond where the electron
- C1 ["chem-09-0565","chem-09-0566"]: the sharing of the electron pair is unequal. The result is a bond where the electron
- C2 ["chem-09-0564","chem-09-0565","chem-09-0566"]: These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron
- C3 ["chem-09-0563","chem-09-0564","chem-09-0565","chem-09-0566"]: There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 489.0 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal.

Sources: chem-09-0563, chem-09-0564, chem-09-0565

## 13 · 28:43.872 · chem-09-0567

**Available evidence (oldest → latest)**

- chem-09-0561 · 28:22.330–28:25.030: Covalent chemical bonds involve the sharing
- chem-09-0562 · 28:25.030–28:29.361: of a pair of valence electrons by two atoms.
- chem-09-0563 · 28:29.361–28:32.464: There is also what is called polar covalent bonds.
- chem-09-0564 · 28:32.464–28:34.844: These are covalent bonds in which
- chem-09-0565 · 28:34.844–28:38.180: the sharing of the electron pair is unequal.
- chem-09-0566 · 28:38.180–28:40.515: The result is a bond where the electron
- chem-09-0567 · 28:40.515–28:43.872: pair is displaced toward the more electronegative atom.

**Current Cue before decision**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal.

Sources: chem-09-0563, chem-09-0564, chem-09-0565

**Actual candidates**

- C0 ["chem-09-0567"]: pair is displaced toward the more electronegative atom.
- C1 ["chem-09-0566","chem-09-0567"]: The result is a bond where the electron pair is displaced toward the more electronegative atom.
- C2 ["chem-09-0565","chem-09-0566","chem-09-0567"]: the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.
- C3 ["chem-09-0563","chem-09-0564","chem-09-0565","chem-09-0566","chem-09-0567"]: There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

**Jev returned:** {"action":"UPDATE_CURRENT","candidateId":"[\"chem-09-0563\",\"chem-09-0564\",\"chem-09-0565\",\"chem-09-0566\",\"chem-09-0567\"]"}

**Engine:** applied; discard reason: none; provider 470.6 ms; source-ready → Cue-state 471.0 ms.

**Current Cue after application**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

Sources: chem-09-0563, chem-09-0564, chem-09-0565, chem-09-0566, chem-09-0567

## 14 · 28:52.836 · chem-09-0568

**Available evidence (oldest → latest)**

- chem-09-0564 · 28:32.464–28:34.844: These are covalent bonds in which
- chem-09-0565 · 28:34.844–28:38.180: the sharing of the electron pair is unequal.
- chem-09-0566 · 28:38.180–28:40.515: The result is a bond where the electron
- chem-09-0567 · 28:40.515–28:43.872: pair is displaced toward the more electronegative atom.
- chem-09-0568 · 28:49.848–28:52.836: Thanks for watching, and we'll see you guys next time.

**Current Cue before decision**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

Sources: chem-09-0563, chem-09-0564, chem-09-0565, chem-09-0566, chem-09-0567

**Actual candidates**

- C0 ["chem-09-0568"]: Thanks for watching, and we'll see you guys next time.
- C1 ["chem-09-0567","chem-09-0568"]: pair is displaced toward the more electronegative atom. Thanks for watching, and we'll see you guys next time.
- C2 ["chem-09-0566","chem-09-0567","chem-09-0568"]: The result is a bond where the electron pair is displaced toward the more electronegative atom. Thanks for watching, and we'll see you guys next time.

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 453.7 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

Sources: chem-09-0563, chem-09-0564, chem-09-0565, chem-09-0566, chem-09-0567

## 15 · 29:03.792 · chem-09-0569

**Available evidence (oldest → latest)**

- chem-09-0567 · 28:40.515–28:43.872: pair is displaced toward the more electronegative atom.
- chem-09-0568 · 28:49.848–28:52.836: Thanks for watching, and we'll see you guys next time.
- chem-09-0569 · 29:02.796–29:03.792: [END PLAYBACK]

**Current Cue before decision**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

Sources: chem-09-0563, chem-09-0564, chem-09-0565, chem-09-0566, chem-09-0567

**Actual candidates**

- C0 ["chem-09-0569"]: [END PLAYBACK]
- C1 ["chem-09-0568","chem-09-0569"]: Thanks for watching, and we'll see you guys next time. [END PLAYBACK]
- C2 ["chem-09-0567","chem-09-0568","chem-09-0569"]: pair is displaced toward the more electronegative atom. Thanks for watching, and we'll see you guys next time. [END PLAYBACK]

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 390.4 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

Sources: chem-09-0563, chem-09-0564, chem-09-0565, chem-09-0566, chem-09-0567

## 16 · 29:09.768 · chem-09-0570

**Available evidence (oldest → latest)**

- chem-09-0568 · 28:49.848–28:52.836: Thanks for watching, and we'll see you guys next time.
- chem-09-0569 · 29:02.796–29:03.792: [END PLAYBACK]
- chem-09-0570 · 29:07.029–29:09.768: [APPLAUSE]

**Current Cue before decision**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

Sources: chem-09-0563, chem-09-0564, chem-09-0565, chem-09-0566, chem-09-0567

**Actual candidates**

- C0 ["chem-09-0570"]: [APPLAUSE]
- C1 ["chem-09-0569","chem-09-0570"]: [END PLAYBACK] [APPLAUSE]
- C2 ["chem-09-0568","chem-09-0569","chem-09-0570"]: Thanks for watching, and we'll see you guys next time. [END PLAYBACK] [APPLAUSE]

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 435.3 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

Sources: chem-09-0563, chem-09-0564, chem-09-0565, chem-09-0566, chem-09-0567

## 17 · 29:16.180 · chem-09-0571

**Available evidence (oldest → latest)**

- chem-09-0569 · 29:02.796–29:03.792: [END PLAYBACK]
- chem-09-0570 · 29:07.029–29:09.768: [APPLAUSE]
- chem-09-0571 · 29:14.055–29:16.180: CATHERINE DRENNAN: There's, I think, one other one,

**Current Cue before decision**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

Sources: chem-09-0563, chem-09-0564, chem-09-0565, chem-09-0566, chem-09-0567

**Actual candidates**

- C0 ["chem-09-0571"]: CATHERINE DRENNAN: There's, I think, one other one,
- C1 ["chem-09-0570","chem-09-0571"]: [APPLAUSE] CATHERINE DRENNAN: There's, I think, one other one,
- C2 ["chem-09-0569","chem-09-0570","chem-09-0571"]: [END PLAYBACK] [APPLAUSE] CATHERINE DRENNAN: There's, I think, one other one,

**Jev returned:** {"action":"QUIET"}

**Engine:** quiet; discard reason: none; provider 450.6 ms; source-ready → Cue-state n/a ms.

**Current Cue after application**

> There is also what is called polar covalent bonds. These are covalent bonds in which the sharing of the electron pair is unequal. The result is a bond where the electron pair is displaced toward the more electronegative atom.

Sources: chem-09-0563, chem-09-0564, chem-09-0565, chem-09-0566, chem-09-0567

