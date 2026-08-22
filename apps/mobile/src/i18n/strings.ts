export const UI_LANGUAGES = ["he", "en"] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

/** A localized value from the content model: language code → text. */
export type LocalizedString = Record<string, string | undefined>;

const RTL_LANGUAGES: ReadonlySet<string> = new Set(["he", "ar", "fa", "ur"]);

export const isRtl = (language: string): boolean => RTL_LANGUAGES.has(language);

/** The first device language the UI supports, else English. */
export function pickLanguage(deviceLanguageCodes: readonly string[]): UiLanguage {
  for (const code of deviceLanguageCodes) {
    const base = code.toLowerCase().split(/[-_]/)[0] ?? "";
    if ((UI_LANGUAGES as readonly string[]).includes(base)) return base as UiLanguage;
  }
  return "en";
}

/** Picks the text for `language`, then English, then Hebrew, then whatever exists. */
export function localized(
  value: LocalizedString | undefined,
  language: string,
  fallback = "",
): string {
  if (!value) return fallback;
  for (const candidate of [language, "en", "he"]) {
    const text = value[candidate];
    if (text) return text;
  }
  return Object.values(value).find((text): text is string => Boolean(text)) ?? fallback;
}

const STRINGS = {
  en: {
    appName: "Riddles",
    tagline: "Riddle trails at the places you visit",
    scanVenueCode: "Scan a venue code",
    enterVenueCode: "Enter a venue code",
    venueCodePlaceholder: "e.g. ein-dror",
    go: "Go",
    invalidCode: "Letters, digits and dashes only",
    nearYou: "Near you",
    recent: "Recent",
    noRecent: "Venues you open will appear here.",
    settings: "Settings",
    back: "Back",
    loading: "Loading…",
    tracks: "Tracks",
    noTracks: "No tracks are published yet.",
    tracksUnavailable: "Couldn't load the tracks. You may be offline, or the server is waking up.",
    about: "About",
    support: "Support",
    phone: "Phone",
    email: "Email",
    website: "Website",
    privacy: "Privacy",
    terms: "Terms",
    emergency: "Emergency",
    police: "Police",
    ambulance: "Ambulance",
    emergencyServices: "Emergency services",
    start: "Start",
    startNotYet: "Starting a track arrives in the next step of the prototype.",
    safetyNotes: "Before you start",
    difficulty_easy: "Easy",
    difficulty_medium: "Moderate",
    difficulty_hard: "Hard",
    ages: "Ages {min}+",
    languages: "Languages",
    minutes: "{n} min",
    meters: "{n} m",
    kilometers: "{n} km",
    uiLanguage: "App language",
    restartNote: "Layout direction follows the chosen language and updates after the app restarts.",
    version: "Version",
    venueNotFound: "We couldn't find a venue with that code.",
    trackNotFound: "This track isn't available.",
    notFound: "Page not found",
    goHome: "Go to the start",
    scanInstruction: "Point the camera at the venue's QR code.",
    cameraPermission: "The camera is used only to read QR codes.",
    grantCamera: "Allow camera",
    cameraDenied: "Camera access is off. You can enter the venue code instead.",
    notAVenueCode: "That code isn't a venue or track code.",
    language_he: "עברית",
    language_en: "English",
    chooseLanguage: "Play in",
    teamName: "Team name",
    teamNameHint: "Shown on your result card and, if you choose, on the leaderboard.",
    teamNamePlaceholder: "e.g. The Foxes",
    teamNameInvalid: "Between 2 and 24 characters, please.",
    teamNameBlocked: "Pick a different name, please.",
    ideas: "Ideas",
    continue: "Continue",
    safetyAcknowledge: "Got it, let's go",
    downloadNeedsNetwork:
      "This part needs a connection; after the download everything works without one.",
    downloading: "Downloading the trail…",
    downloadFailed: "The download didn't finish. Check the connection and try again.",
    verifying: "Checking the files…",
    retry: "Try again",
    startTrack: "Start the trail",
    continueTrack: "Continue the trail",
    weAreHere: "We're here",
    headToPin: "Head to the pin on the map.",
    youveReached: "You've reached {station}",
    openStation: "Open the station",
    distanceAway: "{distance} away",
    stationNumber: "Station {n}",
    progress: "{done} of {total}",
    score: "Score",
    yourAnswer: "Your answer",
    check: "Check",
    correct: "Correct!",
    wrongTryAgain: "Not quite — try again.",
    wrongChoice: "Not that one. That costs {penalty} points; try again.",
    pointsEarned: "+{n} points",
    points: "{n} points",
    next: "Next",
    hints: "Hints",
    revealHint: "Reveal hint {n} — costs {cost} points",
    revealAnswer: "Show the answer and move on (0 points)",
    answerWas: "The answer: {answer}",
    stuck: "Stuck?",
    chooseAnswer: "Choose an answer",
    finished: "You finished!",
    resultTitle: "Your result",
    playTime: "Time",
    date: "Date",
    postToLeaderboard: "Post to the leaderboard",
    leaderboardLater: "Your result is posted when you're back online.",
    share: "Share",
    shareMessage: "{team} finished {track} with {score} points in {time}!",
    backToVenue: "Back to {venue}",
    leaveTrack: "Leave the trail",
    leaveConfirm: "Leave the trail? Your progress stays on this phone.",
    cancel: "Cancel",
    leave: "Leave",
    noSession: "This trail isn't in progress on this phone.",
    captureHere: "Set to my position",
    exportPins: "Share as JSON",
    downloads: "Downloaded tracks",
    manageDownloads: "Manage downloads",
    noDownloads: "No tracks are downloaded on this phone.",
    deleteDownload: "Delete",
    deleteDownloadConfirm: "Delete this download? You can download it again later.",
    deleteWhilePlaying:
      "A game on this track is in progress on this phone. Deleting it ends that game.",
    trackVersion: "Version {n}",
    appOutdated: "This track needs a newer version of the app. Please update, then try again.",
    bundleUnsupported: "This track can't be opened by this app.",
    leaderboard: "Leaderboard",
    viewLeaderboard: "View leaderboard",
    leaderboardAll: "All time",
    leaderboardToday: "Today",
    leaderboardEmpty: "No results yet. Be the first!",
    leaderboardOffline: "The leaderboard needs a connection. Try again when you're back online.",
    rank: "#{n}",
    you: "You",
  },
  he: {
    appName: "Riddles",
    tagline: "מסלולי חידות במקומות שאתם מבקרים בהם",
    scanVenueCode: "סריקת קוד אתר",
    enterVenueCode: "הזנת קוד אתר",
    venueCodePlaceholder: "לדוגמה: ein-dror",
    go: "המשך",
    invalidCode: "אותיות לטיניות, ספרות ומקפים בלבד",
    nearYou: "בקרבתכם",
    recent: "אחרונים",
    noRecent: "אתרים שתפתחו יופיעו כאן.",
    settings: "הגדרות",
    back: "חזרה",
    loading: "טוען…",
    tracks: "מסלולים",
    noTracks: "עדיין לא פורסמו מסלולים.",
    tracksUnavailable: "לא הצלחנו לטעון את המסלולים. ייתכן שאתם לא מחוברים, או שהשרת מתעורר.",
    about: "אודות",
    support: "תמיכה",
    phone: "טלפון",
    email: "אימייל",
    website: "אתר אינטרנט",
    privacy: "פרטיות",
    terms: "תנאי שימוש",
    emergency: "חירום",
    police: "משטרה",
    ambulance: "מד״א",
    emergencyServices: "שירותי חירום",
    start: "התחלה",
    startNotYet: "התחלת מסלול תתווסף בשלב הבא של האב-טיפוס.",
    safetyNotes: "לפני שמתחילים",
    difficulty_easy: "קל",
    difficulty_medium: "בינוני",
    difficulty_hard: "קשה",
    ages: "מגיל {min}",
    languages: "שפות",
    minutes: "{n} דק׳",
    meters: "{n} מ׳",
    kilometers: "{n} ק״מ",
    uiLanguage: "שפת האפליקציה",
    restartNote: "כיוון הפריסה נקבע לפי השפה שנבחרה ומתעדכן לאחר הפעלה מחדש של האפליקציה.",
    version: "גרסה",
    venueNotFound: "לא מצאנו אתר עם הקוד הזה.",
    trackNotFound: "המסלול הזה אינו זמין.",
    notFound: "הדף לא נמצא",
    goHome: "למסך הפתיחה",
    scanInstruction: "כוונו את המצלמה לקוד ה-QR של האתר.",
    cameraPermission: "המצלמה משמשת רק לקריאת קודי QR.",
    grantCamera: "אישור גישה למצלמה",
    cameraDenied: "הגישה למצלמה כבויה. אפשר להזין את קוד האתר במקום.",
    notAVenueCode: "הקוד הזה אינו קוד של אתר או מסלול.",
    language_he: "עברית",
    language_en: "English",
    chooseLanguage: "לשחק ב",
    teamName: "שם הקבוצה",
    teamNameHint: "יוצג בכרטיס התוצאה, ובלוח התוצאות אם תבחרו.",
    teamNamePlaceholder: "לדוגמה: הנמרים",
    teamNameInvalid: "בין 2 ל-24 תווים.",
    teamNameBlocked: "בחרו שם אחר, בבקשה.",
    ideas: "רעיונות",
    continue: "המשך",
    safetyAcknowledge: "הבנו, יוצאים לדרך",
    downloadNeedsNetwork: "לחלק הזה צריך חיבור; אחרי ההורדה הכול עובד גם בלי קליטה.",
    downloading: "מוריד את המסלול…",
    downloadFailed: "ההורדה לא הושלמה. בדקו את החיבור ונסו שוב.",
    verifying: "בודק את הקבצים…",
    retry: "נסו שוב",
    startTrack: "להתחיל את המסלול",
    continueTrack: "להמשיך את המסלול",
    weAreHere: "הגענו",
    headToPin: "לכו אל הסימון במפה.",
    youveReached: "הגעתם אל {station}",
    openStation: "לפתוח את התחנה",
    distanceAway: "במרחק {distance}",
    stationNumber: "תחנה {n}",
    progress: "{done} מתוך {total}",
    score: "ניקוד",
    yourAnswer: "התשובה שלכם",
    check: "בדיקה",
    correct: "נכון!",
    wrongTryAgain: "לא בדיוק — נסו שוב.",
    wrongChoice: "לא זה. זה עולה {penalty} נקודות; נסו שוב.",
    pointsEarned: "+{n} נקודות",
    points: "{n} נקודות",
    next: "הלאה",
    hints: "רמזים",
    revealHint: "לחשוף רמז {n} — עולה {cost} נקודות",
    revealAnswer: "להראות את התשובה ולהמשיך (0 נקודות)",
    answerWas: "התשובה: {answer}",
    stuck: "נתקעתם?",
    chooseAnswer: "בחרו תשובה",
    finished: "סיימתם!",
    resultTitle: "התוצאה שלכם",
    playTime: "זמן",
    date: "תאריך",
    postToLeaderboard: "לפרסם בלוח התוצאות",
    leaderboardLater: "התוצאה תפורסם כשתחזרו לקליטה.",
    share: "שיתוף",
    shareMessage: "{team} סיימו את {track} עם {score} נקודות ב-{time}!",
    backToVenue: "חזרה אל {venue}",
    leaveTrack: "לעזוב את המסלול",
    leaveConfirm: "לעזוב את המסלול? ההתקדמות נשמרת בטלפון הזה.",
    cancel: "ביטול",
    leave: "לעזוב",
    noSession: "המסלול הזה לא פעיל בטלפון הזה.",
    captureHere: "לקבוע למיקום שלי",
    exportPins: "לשתף כ-JSON",
    downloads: "מסלולים שהורדו",
    manageDownloads: "ניהול הורדות",
    noDownloads: "אין מסלולים שהורדו בטלפון הזה.",
    deleteDownload: "מחיקה",
    deleteDownloadConfirm: "למחוק את ההורדה? אפשר להוריד אותה שוב מאוחר יותר.",
    deleteWhilePlaying: "משחק במסלול הזה נמצא בעיצומו בטלפון. מחיקה תסיים אותו.",
    trackVersion: "גרסה {n}",
    appOutdated: "המסלול הזה דורש גרסה חדשה יותר של האפליקציה. עדכנו ונסו שוב.",
    bundleUnsupported: "האפליקציה הזו לא יכולה לפתוח את המסלול הזה.",
    leaderboard: "לוח התוצאות",
    viewLeaderboard: "צפייה בלוח התוצאות",
    leaderboardAll: "כל הזמנים",
    leaderboardToday: "היום",
    leaderboardEmpty: "אין עדיין תוצאות. היו הראשונים!",
    leaderboardOffline: "לוח התוצאות דורש חיבור. נסו שוב כשתחזרו לקליטה.",
    rank: "#{n}",
    you: "אתם",
  },
} as const satisfies Record<UiLanguage, Record<string, string>>;

export type StringKey = keyof (typeof STRINGS)["en"];

export function translate(
  language: UiLanguage,
  key: StringKey,
  params?: Record<string, string | number>,
): string {
  const template: string = STRINGS[language][key] ?? STRINGS.en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** Play time as m:ss, or h:mm:ss past an hour. */
export function formatPlayTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(hours ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(language: UiLanguage, minutes: number): string {
  return translate(language, "minutes", { n: Math.round(minutes) });
}

export function formatDistance(language: UiLanguage, meters: number): string {
  if (meters < 1000) return translate(language, "meters", { n: Math.round(meters) });
  const km = meters / 1000;
  return translate(language, "kilometers", { n: km < 10 ? km.toFixed(1) : Math.round(km) });
}
