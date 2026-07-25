import type { MessageValue } from "./ru.js"

/** English UI catalog — partial; missing keys fall back to Russian. */
export const en: Record<string, MessageValue> = {
  "common.cancel": "Cancel",
  "common.ok": "OK",
  "common.delete": "Delete",
  "common.save": "Save",
  "common.create": "Create",
  "common.back": "Back",
  "common.name": "Name",
  "common.color": "Color",
  "common.icon": "Icon",
  "common.open": "Open",
  "common.card": { one: "card", other: "cards" },
  "common.folder": { one: "folder", other: "folders" },
  "common.error": "Error",
  "common.unknownError": "Unknown error",
  "common.show": "Show",
  "common.hide": "Hide",
  "common.done": "Done",
  "common.download": "Download",

  "app.bootFailed":
    "Could not start the app. Open the browser console (F12) for details.",
  "app.bootError": "Startup error: {message}",

  "shell.nav.home": "Folders",
  "shell.nav.review": "Review",
  "shell.nav.stats": "Stats",
  "shell.nav.settings": "Settings",
  "shell.offline.short": "Offline",
  "shell.offline.local": "Offline — data stays on this device.",
  "shell.offline.cloud": "Offline — changes will be saved locally.",
  "shell.sync.checking": "Checking sync…",
  "shell.sync.waiting": "Offline — new changes will wait for a connection.",
  "shell.sync.pending": "In sync queue: {n}.",
  "shell.sync.failed": "Failed to send: {n}.",
  "shell.sync.doneFail": "Synced: {ok}, errors: {fail}",
  "shell.sync.doneOk": "Synced: {ok}",
  "shell.sync.retry": "Retry",
  "shell.sync.errorTitle": "Sync error",
  "shell.sync.retryStarted": "Retry sync started",
  "shell.sync.alreadyHandled": "Entry already handled",
  "shell.sync.retryError": "Retry failed item",
  "shell.sync.discarded": "Sync error dismissed",
  "shell.sync.hide": "Hide",
  "shell.sync.readFailed": "Could not read sync status.",

  "auth.sub":
    "Flashcards for words, terms, and quotes — with smart spaced repetition.",
  "auth.emailPlaceholder": "Email",
  "auth.passwordPlaceholder": "Password (min. 6 characters)",
  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.needCredentials": "Enter email and a password of at least 6 characters",
  "auth.confirmEmail": "Email sent — confirm your address and sign in",
  "auth.noAccount": "No account? ",
  "auth.cloudNotConfigured":
    "Cloud mode is not configured yet. Copy js/config.example.js → js/config.js and fill in Supabase keys (see docs/USER-GUIDE.md).",
  "auth.tryLocal": "Try without signing up",
  "auth.opening": "Opening…",
  "auth.demoNote": "Demo mode: data stays in this browser only.",
  "auth.loadingCloud": "Loading your cards…",
  "auth.cloudMissingKeys": "Cloud mode is not configured (missing Supabase keys)",
  "auth.loadFailed": "Could not load data: {message}",
  "auth.seed.folderName": "First folder",
  "auth.seed.cardFront": "KAR-dots",
  "auth.seed.cardBack":
    "Flashcards for memorizing.\nTap the card to flip it.",

  "home.toast.alreadyInBox": "Folder is already in this box",
  "home.toast.moveFailed": "Could not move folder",
  "home.toast.moved": "«{folder}» → «{box}»",
  "home.btn.newBox": "+ New box",
  "home.btn.newFolder": "+ New folder",
  "home.welcome.text":
    "I’m the crow of your memory. Create a folder or box, add words — or install a ready English A0–A2 pack.",
  "home.welcome.createFolder": "Create first folder",
  "home.welcome.packs": "Vocab packs",
  "home.section.library": "Library",
  "home.section.libraryAside": "boxes and folders",
  "home.hint.drag": "Drag a folder onto a box to group them.",
  "home.empty.title": "Nothing here yet",
  "home.empty.text":
    "Create a box or folder — for example, “English” or “Philosophy”.",

  "home.greeting.morning": "Good morning 👋",
  "home.greeting.afternoon": "Good afternoon 👋",
  "home.greeting.evening": "Good evening 👋",
  "home.greeting.done": "All caught up for today — time to rest",
  "home.greeting.dueOne": "1 card waiting for review",
  "home.greeting.dueMany": "{n} {cards} waiting for review",

  "home.day.title": "Today’s review",
  "home.day.subToday": "today’s results",
  "home.day.weekTitle": "Weekly activity",
  "home.day.weekSub": "weekly activity",
  "home.day.weekStats": "stats",
  "home.day.showWeek": "Show week",
  "home.day.showToday": "Show today",
  "home.day.of": "of {n}",
  "home.day.known": "Know",
  "home.day.unknown": "Don’t know",
  "home.day.left": "Left",
  "home.day.knownLower": "know",
  "home.day.unknownLower": "don’t know",
  "home.day.continue": "Continue",
  "home.day.repeat": "Review",
  "home.day.accuracy": "accuracy {n}%",

  "folder.dialog.titleEdit": "Folder",
  "folder.dialog.titleNew": "New folder",
  "folder.dialog.namePlaceholder": "e.g. English",
  "folder.dialog.iconHint":
    "If nothing is selected — the first letter of the name. Tap again to clear.",
  "folder.dialog.nameRequired": "Enter a name",

  "box.dialog.titleEdit": "Box",
  "box.dialog.titleNew": "New box",
  "box.dialog.namePlaceholder": "e.g. English",
  "box.dialog.foldersLabel": "Folders in box",
  "box.dialog.foldersHint":
    "A box groups folders by topic. Cards stay inside folders.",
  "box.dialog.noFolders":
    "No folders available — create a folder on the home screen.",
  "box.dialog.iconHint":
    "If nothing is selected — the first letter of the name. Tap again to clear.",
  "box.confirm.deleteTitle": "Delete box?",
  "box.confirm.deleteWithFolders":
    "«{name}» will be deleted. {n} {folders} will stay on the home screen.",
  "box.confirm.deleteEmpty": "«{name}» will be deleted.",

  "settings.title": "Settings",
  "settings.saveFailed": "Could not save: {message}",
  "settings.language.title": "Language",
  "settings.language.label": "Interface language",
  "settings.language.hint":
    "Russian is the default. English is filled in as screens are translated.",
  "settings.language.ru": "Русский",
  "settings.language.en": "English",
  "settings.about.title": "Project",
  "settings.about.github": "GitHub",
  "settings.about.githubHint": "App source code on GitHub.",
  "settings.footer": "KAR-dots · v{version}",

  "settings.calendar.title": "Calendar",
  "settings.calendar.desktopLabel": "On home (desktop)",
  "settings.calendar.desktopHint":
    "Left or right of “Today’s review”. On phone the calendar is always a collapsed strip at the top.",
  "settings.calendar.left": "Left",
  "settings.calendar.right": "Right",

  "settings.algo.title": "Spaced repetition",
  "settings.algo.algorithm": "Algorithm",
  "settings.algo.footnote":
    "When you switch algorithms, previous progress is kept — SM-2, FSRS, and Leitner store it separately.",
  "settings.algo.desc.sm2":
    "The Anki classic. Two buttons: Know and Don’t know. Each card has its own interval — Don’t know brings it back in 10 minutes; Know pushes it to a day and beyond. Simple and familiar.",
  "settings.algo.desc.fsrs":
    "Modern algorithm (like Anki 23.10+). Four grades: Again, Hard, Good, Easy — the more confident your answer, the longer until the next show. Usually schedules more accurately than SM-2.",
  "settings.algo.desc.leitner":
    "Five “boxes”. Two buttons: Remember moves a card to the next box; Forgot sends it back to the first. How many days before a card from each box is shown — configured below. Easiest to understand.",
  "settings.algo.leitner": "Leitner",
  "settings.algo.direction": "Direction",
  "settings.algo.directionHint": "Which side of the card to show first.",
  "settings.algo.directionMixed": "Mixed",
  "settings.algo.newPerDay": "New cards per day",
  "settings.algo.newPerDayHint": "So you don’t overload yourself at the start.",
  "settings.algo.reviewsPerDay": "Reviews per day",
  "settings.algo.reviewsPerDayHint":
    "Maximum grades per calendar day (Know / Don’t know).",
  "settings.algo.tts": "Speech on review",
  "settings.algo.ttsHint":
    "A 🔊 button appears on the review screen. Language follows text (Cyrillic / Latin). Voices and speed are set below.",
  "settings.algo.ttsAuto": "Speak on flip",
  "settings.algo.ttsAutoOn":
    "Without tapping 🔊: after each card flip (tap, space, or Enter) the visible side is read aloud. Does not run on Know / Don’t know grades and does not read before the first flip.",
  "settings.algo.ttsAutoOff":
    "Turn on “Speech on review” first — then you can enable automatic reading on flip.",
  "settings.algo.ttsRate": "Speech speed",
  "settings.algo.ttsRateHint": "From 0.5× (slower) to 2× (faster).",
  "settings.algo.voiceAuto": "Auto (best available)",
  "settings.algo.previewRu": "Preview «Привет»",
  "settings.algo.previewRuBtn": "▶ Привет",
  "settings.algo.previewEn": "Preview «Hello»",
  "settings.algo.previewEnBtn": "▶ Hello",
  "settings.algo.speechUnavailable": "Speech Synthesis is not available in this browser.",
  "settings.algo.speechVoicesCount":
    "System voices: {n}. “Auto” picks the best for the text language.",
  "settings.algo.speechVoicesLoading":
    "Loading voices… refresh the page if the list stays empty.",
  "settings.algo.speechVoicesTitle": "Browser voices",
  "settings.algo.speechVoicesHint":
    "Speech Synthesis API — no internet or limits. Text language is detected automatically: Cyrillic → Russian, Latin → English.",
  "settings.algo.voiceRu": "Russian",
  "settings.algo.voiceEn": "English",
  "settings.algo.leitnerBoxShort": "Box {n}",
  "settings.algo.leitnerIntervals": "Box intervals (days)",
  "settings.algo.leitnerIntervalsHint":
    "How many days before a card from each box is shown.",
  "settings.algo.fsrs.retention": "Target retention (FSRS)",
  "settings.algo.fsrs.retentionHint":
    "What fraction of cards you want to remember by review time. 85–90% is optimal: above 95% nearly doubles workload; below 80% — frequent forgetting.",
  "settings.algo.fsrs.fuzz": "Load balancing (fuzz)",
  "settings.algo.fsrs.fuzzHint":
    "Small random spread on intervals — reviews don’t pile up on one day.",
  "settings.algo.fsrs.measured": "Measured retention",
  "settings.algo.fsrs.measuredLoading": "Calculating measured retention…",
  "settings.algo.fsrs.measuredFact": "Actual: {pct} {reviews}. {advice}",
  "settings.algo.fsrs.reviewCount": {
    one: "across {n} review",
    other: "across {n} reviews"
  },
  "settings.algo.fsrs.logUnavailable": "Review log data unavailable.",
  "settings.algo.fsrs.adviceNodata":
    "Not enough data yet — an estimate appears after ~30 reviews of learned cards.",
  "settings.algo.fsrs.adviceHigh":
    "Measured retention {pct}% is above target. You can lower target retention to 0.85–0.90 — intervals grow and workload drops noticeably with little loss.",
  "settings.algo.fsrs.adviceLow":
    "Measured retention {pct}% is below 80% — cards are often forgotten. Raise target retention toward 0.90 or grade more strictly.",
  "settings.algo.fsrs.adviceOk":
    "Measured retention {pct}% — in the healthy 80–95% range. No need to change the target.",
  "settings.algo.fsrs.weightsPlaceholder":
    "e.g. 0.40, 1.18, 3.17, … — weights from the official FSRS optimizer",
  "settings.algo.fsrs.weightsInvalid": "Doesn’t look like a number list — not saved.",
  "settings.algo.fsrs.weightsSaved": {
    one: "Saved {n} weight.",
    other: "Saved {n} weights."
  },
  "settings.algo.fsrs.weightsReset": "Weights reset to defaults.",
  "settings.algo.fsrs.exportCsv": "Export review log (CSV)",
  "settings.algo.fsrs.weightsTitle": "Personal FSRS weights (advanced)",
  "settings.algo.fsrs.weightsHint":
    "Full optimization for your history uses the official FSRS optimizer. Export the log, run it through the optimizer, and paste the resulting weights here.",

  "settings.sounds.title": "Sounds",
  "settings.sounds.uiClicks": "UI clicks",
  "settings.sounds.uiClicksHint":
    "Sound on buttons, tabs, and menu items. “Silent” — quiet interface.",
  "settings.sounds.uiClicksLabel": "Clicks",
  "settings.sounds.answerMelodies": "Answer melodies",
  "settings.sounds.answerMelodiesHint":
    "Short cues in Type, Voice, and Match modes; plus a melody when the cup appears. Tap ▶ in the menu to preview.",
  "settings.sounds.correct": "Correct",
  "settings.sounds.wrong": "Wrong",
  "settings.sounds.cup": "Cup",
  "settings.sounds.playWhen": "Play",
  "settings.sounds.playWhenHint": "When to play the selected melodies.",
  "settings.sounds.modeBoth": "Both",
  "settings.sounds.modeCorrect": "Correct",
  "settings.sounds.modeWrong": "Wrong",
  "settings.sounds.modeNone": "Off",

  "settings.packs.title": "Vocab packs",
  "settings.packs.cefr": "CEFR levels",
  "settings.packs.cefrHint":
    "English A0, A1, A2 — ready cards from Oxford 3000 with translation. Installed as a folder, removed entirely.",
  "settings.packs.catalog": "Pack catalog",

  "settings.data.title": "Data",
  "settings.data.export": "Export",
  "settings.data.exportHint":
    "Download all folders and cards in one file (backup).",
  "settings.data.import": "Import",
  "settings.data.importHint":
    "Load an export file — e.g. move cards from demo mode to the cloud.",
  "settings.data.importFile": "Choose file",
  "settings.data.importDone": "Import complete",
  "settings.data.importFailed": "Import failed: {message}",

  "settings.account.title": "Mode",
  "settings.account.cloudLabel": "Cloud: {email}",
  "settings.account.demoMode": "Demo mode",
  "settings.account.cloudOffline":
    "Offline now — data will sync when you’re back online.",
  "settings.account.cloudOnline": "Cards sync across devices.",
  "settings.account.demoHint":
    "Data stays in this browser only. Set up Supabase (see README) to sync.",
  "settings.account.signOut": "Sign out",
  "settings.account.signOutCloudTitle": "Sign out of account?",
  "settings.account.signOutDemoTitle": "Leave demo mode?",
  "settings.account.signOutCloudText": "Your cards will stay in the cloud.",
  "settings.account.signOutDemoText":
    "Data stays in this browser — you can come back.",
  "settings.account.sync": "Sync",
  "settings.account.syncHint": "Force-send pending changes to the cloud.",
  "settings.account.syncBtn": "Sync now",
  "settings.account.syncStatsUpdated": "Stats and queue updated",

  "settings.yt.title": "Cards from YouTube",
  "settings.yt.apiKeys": "API keys",
  "settings.yt.configure": "Configure",
  "settings.yt.extension": "Chrome extension",
  "settings.yt.extensionHint":
    "Button on YouTube → Side Panel with the same mode settings",
  "settings.yt.installGuide": "How to install",
  "settings.yt.modalTitle": "YouTube API keys",
  "settings.yt.modalIntro":
    "Supadata is required for transcripts. For cards you need your own Gemini and/or Groq — import won’t work without them.",
  "settings.yt.supadata.title": "Supadata API key",
  "settings.yt.supadata.lead":
    "Required: fetches subtitles and transcript from YouTube.",
  "settings.yt.supadata.step1": "Sign up and open API Keys.",
  "settings.yt.supadata.step2": "Copy the key and paste it here.",
  "settings.yt.supadata.step3":
    "Free tier covers personal use; one video = one request.",
  "settings.yt.gemini.title": "Gemini API key",
  "settings.yt.gemini.lead": "Card generation: words and translations from transcript.",
  "settings.yt.gemini.step1": "Create an API key in Google AI Studio.",
  "settings.yt.gemini.step2": "Paste the key (AIza… or new AQ.… format).",
  "settings.yt.gemini.step3":
    "Without a key, card generation won’t work (Gemini or Groq required).",
  "settings.yt.groq.title": "Groq API key",
  "settings.yt.groq.lead": "Fallback when Gemini quota runs out.",
  "settings.yt.groq.step1": "Create an API key in Groq Console.",
  "settings.yt.groq.step2": "Paste the key (starts with gsk_…).",
  "settings.yt.groq.step3":
    "If models are disabled in the project — Project → Limits: enable GPT OSS.",
  "settings.yt.groq.step4":
    "Without a key, card generation won’t work (Gemini or Groq required).",
  "settings.yt.invalidGemini":
    "Invalid format — AI Studio key: AIza… or AQ.…",
  "settings.yt.invalidGroq": "Invalid format — Groq key starts with gsk_…",
  "settings.yt.invalidSupadata": "Invalid Supadata key format",
  "settings.yt.statusMissingRequired": "Not set — import unavailable",
  "settings.yt.statusMissingOptional": "Not set — Gemini or Groq required",
  "settings.yt.statusSaved": "Key saved",
  "settings.yt.helpOpen": "Open",
  "settings.yt.helpHow": "How to get",
  "settings.yt.keyNote":
    "Key is saved when you tap “Done”. Sent to the server only on import.",

  "settings.media.title": "Images for cards",
  "settings.media.providers": "Pixabay + Giphy",
  "settings.media.providersHint":
    "Free keys unlock millions of photos, illustrations, GIFs, and stickers.",
  "settings.media.configure": "Configure",
  "settings.media.modalTitle": "Image API keys",
  "settings.media.modalIntro":
    "Pixabay — photos and illustrations. Giphy — GIFs and stickers. Without keys, limited Openverse search works.",
  "settings.media.pixabay.title": "Pixabay API key",
  "settings.media.pixabay.lead":
    "5+ million photos and illustrations (Pixabay free license).",
  "settings.media.pixabay.step1":
    "Sign up on Pixabay and open API documentation.",
  "settings.media.pixabay.step2": "Copy the API key and paste it here.",
  "settings.media.pixabay.step3":
    "Free: up to 100 requests per minute — enough for personal cards.",
  "settings.media.giphy.title": "Giphy API key",
  "settings.media.giphy.lead": "Huge library of GIFs and stickers.",
  "settings.media.giphy.step1": "Create an app in Giphy Developers Dashboard.",
  "settings.media.giphy.step2": "Copy the API key.",
  "settings.media.giphy.step3": "Free tier suits personal use.",
  "settings.media.invalidPixabay": "Format: 12345678-abcdef…",
  "settings.media.invalidGiphy": "Invalid Giphy key format",
  "settings.media.statusMissing": "Not set — basic Openverse search",
  "settings.media.statusSaved": "Key saved",
  "settings.media.helpOpen": "Open",
  "settings.media.helpHow": "How to get",
  "settings.media.keyNote":
    "Key is stored locally and sent to the server only when searching images.",

  "common.grade": { one: "grade", other: "grades" },
  "common.undo": "Undo",

  "review.side.front": "Front",
  "review.side.frontDesc": "See the term — type or say the translation",
  "review.side.back": "Back",
  "review.side.backDesc": "See the translation — type or say the term",

  "review.mode.flip.title": "Classic",
  "review.mode.flip.desc": "Flip the card and swipe Know / Don’t know",
  "review.mode.type.title": "Type",
  "review.mode.type.desc": "Type the translation or answer",
  "review.mode.cloze.title": "Cloze",
  "review.mode.cloze.desc": "Fill missing letters in a word or words in a phrase",
  "review.mode.voice.title": "Voice",
  "review.mode.voice.desc": "Say the translation into the mic",
  "review.mode.combo.title": "Mix",
  "review.mode.combo.desc": "Random: type, voice, or 5 word pairs",
  "review.mode.match.title": "Match",
  "review.mode.match.desc": "Match terms with translations",

  "review.picker.title": "Review mode",
  "review.picker.cramTitle": "Folder cram",
  "review.picker.sub": "Choose how you want to review cards this session.",
  "review.picker.cramSub":
    "Choose the side, how many words, and the cram method.",
  "review.picker.sideLabel": "What to show on the card?",
  "review.picker.modesLabel": "Cram method",
  "review.picker.limitLabel": "How many words at once? ",
  "review.picker.limitInFolder": "(in folder {n})",
  "review.picker.limitAll": "All",
  "review.picker.limitOther": "Other",
  "review.picker.limitOtherAria": "Other amount, from 1 to {n}",
  "review.picker.unavailable": "Unavailable in this browser",

  "review.empty.limitTitle": "Daily limit reached",
  "review.empty.limitText":
    "Today you’ve done {done} {grades} of {limit}. Raise the limit in settings — or continue tomorrow.",
  "review.empty.toSettings": "To settings",
  "review.empty.toFolder": "To folder",
  "review.empty.toFolders": "To folders",
  "review.empty.toHome": "Home",
  "review.empty.doneTitle": "CAW! You were brilliant today!!!",
  "review.empty.doneText":
    "No cards due right now. Come back later — the crow will nudge you.",
  "review.empty.blankTitle": "Nothing here yet",
  "review.empty.blankText": "Add your first words — and we’ll start reviewing.",
  "review.empty.cramFolder": "Cram folder",

  "review.intro.cram": "Cram · {side} · {mode} — {n} {cards}",
  "review.intro.cramFrom": " from «{name}»",
  "review.intro.regular": "{mode} · {n} {cards}",
  "review.intro.folder": " · «{name}»",

  "review.toolbar.speak": "Speak current side",
  "review.toolbar.edit": "Edit card",

  "review.session.cardDeleted": "Card deleted",
  "review.session.cardSaved": "Card saved",
  "review.session.skipClozeShort": "Answer too short for cloze — skipped",
  "review.session.skipNoBack": "No translation to check — skipped",
  "review.session.skipNoFront": "No term to check — skipped",
  "review.session.noTts": "No text to speak",
  "review.session.doneTitle": "Session complete!",
  "review.session.doneSub":
    "The crow is pleased. Come back tomorrow — memory loves rhythm.",
  "review.session.statKnown": "know",
  "review.session.statRetry": "review again",
  "review.session.again": "Again",

  "review.grade.again": "Again",
  "review.grade.hard": "Hard",
  "review.grade.good": "Good",
  "review.grade.easy": "Easy",
  "review.grade.dontKnow": "Don’t know",
  "review.grade.know": "Know",
  "review.grade.swipeFsrs": "← again · → good",
  "review.grade.keysFsrs":
    "← again · → good · 1–4 grades · space — flip",
  "review.grade.swipeBinary": "← don’t know · → know",
  "review.grade.keysBinary":
    "keys: space — flip · ← don’t know · → know",
  "review.grade.saveFailed": "Could not save: {message}",
  "review.grade.saved": "Grade saved",
  "review.grade.undoFailed": "Could not undo: {message}",
  "review.grade.undone": "Grade undone",

  "review.flip.aria": "Card — tap to flip",
  "review.flip.hint": "tap to see the translation",

  "review.type.placeholderBack": "Type the translation…",
  "review.type.placeholderFront": "Type the term…",
  "review.type.check": "Check",
  "review.type.wrong": "Incorrect",
  "review.type.showAnswer": "Show answer",
  "review.type.correctIs": "Correct: {answer}",
  "review.type.dontKnow": "Don’t know",
  "review.type.correct": "Correct!",
  "review.type.hint": "Type your answer and tap «Check»",

  "review.match.hintTermFirst": "Tap the term, then the translation",
  "review.match.hintDefFirst": "Tap the translation, then the term",
  "review.match.empty": "(empty)",
  "review.match.allDone": "All pairs matched!",
  "review.match.keepGoing": "Nice! Keep going",
  "review.match.wrongPair": "Wrong pair — try again",
  "review.match.roundLabel": "Match pairs · {n}",

  "review.cloze.phraseLabel": "Phrase with blanks",
  "review.cloze.wordLabel": "Word with blanks",
  "review.cloze.ariaWord": "Missing word",
  "review.cloze.ariaLetter": "Missing letter",
  "review.cloze.hintWords":
    "Fill in the missing words in the text — only those, not the whole phrase",
  "review.cloze.hintLetters":
    "Fill in the missing letters in the word — only those, not the whole word",

  "review.voice.start": "🎤 Say answer",
  "review.voice.check": "✓ Check",
  "review.voice.statusIdle": "Space or the button — start recording",
  "review.voice.notRecognized":
    "Speech not recognized — say the translation aloud and tap «Check»",
  "review.voice.heard": "Heard: «{transcript}»",
  "review.voice.heardAndCorrect":
    "Heard: «{transcript}». Correct: {answer}",
  "review.voice.correctIs": "Correct: {answer}",
  "review.voice.retry": "🎤 Try again",
  "review.voice.checking": "Checking…",
  "review.voice.checkFailed":
    "Could not check — tap «Say answer» again",
  "review.voice.listening": "Listening: «{text}»",
  "review.voice.unavailable":
    "Voice mode unavailable — use typing instead"
}
