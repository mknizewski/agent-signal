import type { AppLanguage } from "../shared/types";

const translations = {
  pl: {
    common: {
      close: "Zamknij",
      cancel: "Anuluj",
      codex: "Codex",
      claude: "Claude Code",
      noProject: "Bez projektu"
    },
    app: {
      watched: "Obserwowane",
      working: "Pracujące",
      attention: "Do zatwierdzenia",
      idle: "Wolne",
      archive: "Archiwum",
      settings: "Ustawienia",
      sources: "Źródła",
      connected: "Połączono",
      unavailable: "Niedostępny",
      signals: "Sygnalizacja",
      dashboardEyebrow: "Dashboard agentów",
      archiveEyebrow: "Historia dashboardu",
      settingsEyebrow: "Preferencje Agent Signal",
      watchedTitle: "Obserwowane czaty",
      archiveTitle: "Archiwum",
      settingsTitle: "Ustawienia",
      watchedSubtitle: "Sesje Codex i Claude Code",
      archiveSubtitle: "Zakończone obserwowanie sesji",
      settingsSubtitle: "Dostosuj sposób działania dashboardu",
      mobileDevices: "Urządzenia mobilne",
      lightTheme: "Włącz jasny motyw",
      darkTheme: "Włącz ciemny motyw",
      refresh: "Odśwież sesje",
      addChat: "Dodaj czat",
      searchArchive: "Szukaj w archiwum",
      searchWatched: "Szukaj obserwowanych czatów",
      chatColumn: "Czat",
      statusColumn: "Status",
      activityColumn: "Aktywność",
      archivedColumn: "Zarchiwizowano",
      actionsColumn: "Akcje",
      archiveEmpty: "Archiwum jest puste",
      archiveNoMatches: "Brak wpisów pasujących do wyszukiwania",
      archiveEmptyDescription:
        "Archiwizuj zakończone czaty z widoku obserwowanych. Dopiero tutaj możesz usunąć wpis z Agent Signal.",
      changeSearch: "Zmień wyszukiwaną frazę.",
      watchedEmpty: "Nie obserwujesz jeszcze żadnego czatu",
      watchedNoMatches: "Brak czatów w tym widoku",
      watchedEmptyDescription:
        "Dodaj istniejącą sesję z Codex lub Claude Code. Agent Signal nie tworzy nowych rozmów — tylko pokazuje ich stan.",
      changeFilter: "Zmień filtr lub wyszukiwaną frazę.",
      chooseChats: "Wybierz czaty",
      previewMode: "Tryb podglądu UI",
      archiveSuccess: "Czat przeniesiono do archiwum.",
      restoreSuccess: "Czat przywrócono do obserwowanych.",
      deleteSuccess: "Wpis usunięto z archiwum.",
      archiveDeleteConfirm: (title: string) =>
        `Usunąć „${title}” z archiwum Agent Signal?\n\nOryginalna rozmowa w Codex lub Claude Code pozostanie bez zmian.`,
      watchedSection: "Obserwowane czaty",
      collapseWatched: "Zwiń obserwowane",
      expandWatched: "Rozwiń obserwowane",
      collapseSidebar: "Zwiń menu boczne",
      expandSidebar: "Rozwiń menu boczne",
      noWatched: "Brak obserwowanych czatów"
    },
    picker: {
      title: "Dodaj czaty",
      subtitle: "Wybierz istniejące sesje, które chcesz obserwować.",
      search: "Szukaj po tytule lub projekcie",
      all: "Wszystkie",
      empty: "Brak nowych czatów do dodania.",
      emptyDescription:
        "Uruchom sesję w Codex lub Claude Code, a następnie odśwież dashboard.",
      available: (count: number) => `${count} dostępnych`,
      selected: (count: number) => `Wybrano: ${count}`,
      adding: "Dodawanie…",
      addSelected: "Dodaj wybrane"
    },
    row: {
      open: "Otwórz czat",
      pin: "Przypnij czat",
      unpin: "Odepnij czat",
      archive: "Przenieś do archiwum",
      restore: "Przywróć do obserwowanych",
      delete: "Usuń z archiwum",
      archived: "Zarchiwizowano"
    },
    groups: {
      edit: "Edytuj grupę",
      drag: "Przeciągnij, aby zmienić kolejność",
      collapse: "Zwiń grupę",
      expand: "Rozwiń grupę",
      name: "Nazwa grupy",
      namePlaceholder: "Własna nazwa",
      symbol: "Litera",
      symbolPlaceholder: "Np. P",
      color: "Kolor",
      save: "Zapisz",
      reset: "Użyj automatycznych"
    },
    prompt: {
      eyebrow: "Nowy czat",
      title: "Obserwować tę sesję?",
      description: "Agent Signal wykrył nowy czat",
      observe: "Obserwuj",
      dismiss: "Nie teraz"
    },
    settings: {
      languageTitle: "Język",
      languageDescription:
        "Wybierz język całego desktopowego dashboardu.",
      polish: "Polski",
      english: "English",
      projectsTitle: "Projekty i organizacja",
      groupTracked: "Grupuj obserwowane czaty według projektów",
      groupTrackedDescription:
        "Pokazuje osobną sekcję dla każdego katalogu projektu.",
      autoGroup: "Automatycznie rozpoznawaj projekty",
      autoGroupDescription:
        "Synchronizuje nazwę projektu z katalogiem roboczym sesji.",
      groupPicker: "Grupuj projekty podczas dodawania czatów",
      groupPickerDescription:
        "Porządkuje listę nowych sesji w oknie wyboru.",
      interactionTitle: "Obsługa czatów",
      doubleClick: "Otwieraj czat dwuklikiem",
      doubleClickDescription:
        "Dwuklik przenosi bezpośrednio do rozmowy źródłowej.",
      pinning: "Włącz przypinanie czatów",
      pinningDescription:
        "Przypięte sesje są zawsze wyświetlane na początku.",
      sidebarExpanded: "Domyślnie rozwijaj listę obserwowanych",
      sidebarExpandedDescription:
        "Lista czatów w lewym panelu pozostaje dostępna po uruchomieniu.",
      discoveryTitle: "Wykrywanie nowych czatów",
      detect: "Nasłuchuj nowych sesji",
      detectDescription:
        "Rozpoznaje nowe czaty pojawiające się w Codex i Claude Code.",
      prompt: "Pytaj, czy rozpocząć obserwowanie",
      promptDescription:
        "Pokazuje dyskretny monit w prawym dolnym rogu.",
      notifications: "Powiadomienia systemowe",
      notificationsDescription:
        "Informuje o oczekującym zatwierdzeniu i zakończonej pracy.",
      approvalNotifications: "Alerty o oczekiwaniu na zatwierdzenie",
      approvalNotificationsDescription:
        "Wyłącz, aby wyciszyć krótkie alerty desktopowe i mobilne dla tego statusu.",
      petTitle: "Pupil i bezczynność",
      sleepingPet: "Pokazuj śpiącego pupila",
      sleepingPetDescription:
        "Pupil zasypia, gdy sesja pozostaje bezczynna przez określony czas.",
      idleAfter: "Uśpij po",
      minutes: "min",
      saved: "Preferencje zapisują się automatycznie."
    },
    compact: {
      eyebrow: "Tryb kompaktowy",
      noTracked: "Brak obserwowanych",
      attention: "Czeka na zatwierdzenie",
      working: "Agenci pracują",
      allIdle: "Wszystkie wolne",
      partial: "Stan częściowo nieznany",
      trackedOne: "obserwowany czat",
      trackedMany: "obserwowane czaty",
      trafficLabel: "Zagregowana sygnalizacja czatów",
      none: "Brak",
      inProgress: (count: number) => `${count} w trakcie pracy`,
      waiting: (count: number) => `${count} czeka na Ciebie`,
      inactive: (count: number) => `${count} bez aktywnej pracy`,
      noChats: "Brak czatów",
      requiresAttention: (count: number) =>
        `${count} ${count === 1 ? "czeka" : "czekają"} na zatwierdzenie`,
      isWorking: (count: number) =>
        `${count} ${count === 1 ? "pracuje" : "pracują"}`,
      isIdle: (count: number) =>
        `${count} ${count === 1 ? "wolny" : "wolne"}`,
      unknown: (count: number) => `${count} bez potwierdzonego stanu`,
      unknownSession: (count: number) =>
        `${count} ${
          count === 1
            ? "sesja bez potwierdzonego stanu"
            : "sesje bez potwierdzonego stanu"
        }`,
      lastSync: "Ostatnia synchronizacja"
    },
    titlebar: {
      file: "Plik",
      view: "Widok",
      exit: "Wyjście",
      fullView: "Pełny widok",
      compactView: "Tryb kompaktowy"
    },
    mobile: {
      title: "Urządzenia mobilne",
      subtitle: "Podgląd Agent Signal na telefonie w tej samej sieci Wi‑Fi.",
      active: "Dostęp mobilny aktywny",
      disabled: "Dostęp wyłączony",
      notListening: "Gateway nie nasłuchuje w sieci",
      connectPhone: "Połącz nowy telefon",
      certificate: "Certyfikat",
      pairing: "Parowanie",
      firstConnection: "Pierwsze połączenie",
      trustCertificate: "Zaufaj certyfikatowi Agent Signal",
      certificateSteps: [
        "Zeskanuj kod telefonem i pobierz plik CA.",
        "Zainstaluj go jako certyfikat CA w Androidzie.",
        "Porównaj odcisk certyfikatu z wartością poniżej."
      ],
      certificateInstalled: "Certyfikat zainstalowany",
      securePairing: "Bezpieczne parowanie",
      scanAndroid: "Zeskanuj kod w Androidzie",
      pairingDescription:
        "Kod działa jednorazowo i nie udostępnia telefonu poza lokalną siecią.",
      expiresIn: (seconds: number) => `Kod wygaśnie za ${seconds} s`,
      expired: "Kod wygasł",
      regenerate: "Wygeneruj nowy kod",
      pairedPhones: "Sparowane telefony",
      reset: "Resetuj dostęp",
      noPhones: "Nie połączono jeszcze żadnego telefonu.",
      connectedNow: "Połączono teraz",
      lastSeen: "Ostatnio",
      notificationsActive: "Powiadomienia aktywne",
      disconnect: "Odłącz telefon",
      disconnectConfirm: (name: string) => `Odłączyć urządzenie „${name}”?`,
      resetConfirm:
        "Zresetować cały dostęp mobilny?\n\nWszystkie telefony zostaną odłączone. Stary certyfikat trzeba będzie usunąć z Androida ręcznie.",
      certificateQrAlt: "Kod QR do pobrania certyfikatu",
      pairingQrAlt: "Kod QR do sparowania telefonu"
    }
  },
  en: {
    common: {
      close: "Close",
      cancel: "Cancel",
      codex: "Codex",
      claude: "Claude Code",
      noProject: "No project"
    },
    app: {
      watched: "Watched",
      working: "Working",
      attention: "Approval needed",
      idle: "Idle",
      archive: "Archive",
      settings: "Settings",
      sources: "Sources",
      connected: "Connected",
      unavailable: "Unavailable",
      signals: "Status guide",
      dashboardEyebrow: "Agent dashboard",
      archiveEyebrow: "Dashboard history",
      settingsEyebrow: "Agent Signal preferences",
      watchedTitle: "Watched chats",
      archiveTitle: "Archive",
      settingsTitle: "Settings",
      watchedSubtitle: "Codex and Claude Code sessions",
      archiveSubtitle: "Sessions you stopped watching",
      settingsSubtitle: "Choose how the dashboard behaves",
      mobileDevices: "Mobile devices",
      lightTheme: "Switch to light theme",
      darkTheme: "Switch to dark theme",
      refresh: "Refresh sessions",
      addChat: "Add chat",
      searchArchive: "Search the archive",
      searchWatched: "Search watched chats",
      chatColumn: "Chat",
      statusColumn: "Status",
      activityColumn: "Activity",
      archivedColumn: "Archived",
      actionsColumn: "Actions",
      archiveEmpty: "Your archive is empty",
      archiveNoMatches: "No archived chats match your search",
      archiveEmptyDescription:
        "Archive a chat when you no longer need it on the dashboard. Archived entries can be removed here without touching the original conversation.",
      changeSearch: "Try a different search.",
      watchedEmpty: "You are not watching any chats yet",
      watchedNoMatches: "No chats match this view",
      watchedEmptyDescription:
        "Add an existing Codex or Claude Code session. Agent Signal monitors conversations; it never creates or changes them.",
      changeFilter: "Try another filter or search term.",
      chooseChats: "Choose chats",
      previewMode: "UI preview",
      archiveSuccess: "Chat moved to the archive.",
      restoreSuccess: "Chat restored to your watch list.",
      deleteSuccess: "Archive entry removed.",
      archiveDeleteConfirm: (title: string) =>
        `Remove “${title}” from the Agent Signal archive?\n\nThe original conversation in Codex or Claude Code will not be changed.`,
      watchedSection: "Watched chats",
      collapseWatched: "Collapse watched chats",
      expandWatched: "Expand watched chats",
      collapseSidebar: "Collapse sidebar",
      expandSidebar: "Expand sidebar",
      noWatched: "No watched chats"
    },
    picker: {
      title: "Add chats",
      subtitle: "Choose existing sessions to watch in Agent Signal.",
      search: "Search by title or project",
      all: "All",
      empty: "No new chats available.",
      emptyDescription:
        "Start a session in Codex or Claude Code, then refresh the dashboard.",
      available: (count: number) => `${count} available`,
      selected: (count: number) => `${count} selected`,
      adding: "Adding…",
      addSelected: "Add selected"
    },
    row: {
      open: "Open chat",
      pin: "Pin chat",
      unpin: "Unpin chat",
      archive: "Move to archive",
      restore: "Restore to watched chats",
      delete: "Remove from archive",
      archived: "Archived"
    },
    groups: {
      edit: "Edit group",
      drag: "Drag to reorder",
      collapse: "Collapse group",
      expand: "Expand group",
      name: "Group name",
      namePlaceholder: "Custom name",
      symbol: "Letter",
      symbolPlaceholder: "For example, P",
      color: "Color",
      save: "Save",
      reset: "Use automatic values"
    },
    prompt: {
      eyebrow: "New chat",
      title: "Watch this session?",
      description: "Agent Signal detected a new chat",
      observe: "Watch",
      dismiss: "Not now"
    },
    settings: {
      languageTitle: "Language",
      languageDescription:
        "Choose the language used throughout the desktop dashboard.",
      polish: "Polski",
      english: "English",
      projectsTitle: "Projects and organization",
      groupTracked: "Group watched chats by project",
      groupTrackedDescription:
        "Creates a separate section for each project directory.",
      autoGroup: "Detect projects automatically",
      autoGroupDescription:
        "Keeps project names in sync with each session’s working directory.",
      groupPicker: "Group projects in the chat picker",
      groupPickerDescription:
        "Organizes new sessions by project while you choose what to watch.",
      interactionTitle: "Chat controls",
      doubleClick: "Open chats on double-click",
      doubleClickDescription:
        "Double-clicking a row jumps directly to the source conversation.",
      pinning: "Allow pinned chats",
      pinningDescription:
        "Pinned sessions stay at the top of the dashboard.",
      sidebarExpanded: "Keep the sidebar watch list expanded",
      sidebarExpandedDescription:
        "Shows watched chats in the left panel when Agent Signal starts.",
      discoveryTitle: "New chat detection",
      detect: "Listen for new sessions",
      detectDescription:
        "Detects chats created in Codex and Claude Code while Agent Signal runs.",
      prompt: "Ask whether to watch new chats",
      promptDescription:
        "Shows a small prompt in the bottom-right corner.",
      notifications: "System notifications",
      notificationsDescription:
        "Notifies you when a session needs approval or finishes working.",
      approvalNotifications: "Approval-wait alerts",
      approvalNotificationsDescription:
        "Turn off brief desktop and mobile alerts for this status.",
      petTitle: "Pet and idle behavior",
      sleepingPet: "Show sleeping pets",
      sleepingPetDescription:
        "A pet falls asleep after its session has been idle for a while.",
      idleAfter: "Sleep after",
      minutes: "min",
      saved: "Preferences are saved automatically."
    },
    compact: {
      eyebrow: "Compact mode",
      noTracked: "No watched chats",
      attention: "Waiting for approval",
      working: "Agents are working",
      allIdle: "All agents are idle",
      partial: "Some statuses are unknown",
      trackedOne: "watched chat",
      trackedMany: "watched chats",
      trafficLabel: "Combined chat status",
      none: "None",
      inProgress: (count: number) => `${count} in progress`,
      waiting: (count: number) => `${count} waiting for you`,
      inactive: (count: number) => `${count} not working`,
      noChats: "No chats",
      requiresAttention: (count: number) =>
        `${count} waiting for approval`,
      isWorking: (count: number) =>
        `${count} ${count === 1 ? "is" : "are"} working`,
      isIdle: (count: number) =>
        `${count} ${count === 1 ? "is" : "are"} idle`,
      unknown: (count: number) => `${count} with an unknown status`,
      unknownSession: (count: number) =>
        `${count} ${count === 1 ? "session" : "sessions"} with an unknown status`,
      lastSync: "Last synced"
    },
    titlebar: {
      file: "File",
      view: "View",
      exit: "Exit",
      fullView: "Full dashboard",
      compactView: "Compact mode"
    },
    mobile: {
      title: "Mobile devices",
      subtitle: "View Agent Signal on a phone connected to the same Wi‑Fi.",
      active: "Mobile access is on",
      disabled: "Mobile access is off",
      notListening: "The gateway is not listening on your network",
      connectPhone: "Connect a new phone",
      certificate: "Certificate",
      pairing: "Pairing",
      firstConnection: "First-time setup",
      trustCertificate: "Trust the Agent Signal certificate",
      certificateSteps: [
        "Scan the code with your phone and download the CA file.",
        "Install it as a CA certificate in Android settings.",
        "Compare its fingerprint with the value shown below."
      ],
      certificateInstalled: "Certificate installed",
      securePairing: "Secure pairing",
      scanAndroid: "Scan the code on Android",
      pairingDescription:
        "This one-time code works only on your local network.",
      expiresIn: (seconds: number) => `Code expires in ${seconds}s`,
      expired: "Code expired",
      regenerate: "Generate a new code",
      pairedPhones: "Paired phones",
      reset: "Reset access",
      noPhones: "No phones have been connected yet.",
      connectedNow: "Connected now",
      lastSeen: "Last seen",
      notificationsActive: "Notifications enabled",
      disconnect: "Disconnect phone",
      disconnectConfirm: (name: string) => `Disconnect “${name}”?`,
      resetConfirm:
        "Reset all mobile access?\n\nEvery phone will be disconnected. The old certificate must be removed manually from Android.",
      certificateQrAlt: "QR code for downloading the certificate",
      pairingQrAlt: "QR code for pairing a phone"
    }
  }
};

export function copyFor(language: AppLanguage) {
  return translations[language];
}

const runtimeEnglish = new Map<string, string>([
  ["Aktywność wykryta w Codex", "Activity detected in Codex"],
  ["Aktywność wykryta w Claude Code", "Activity detected in Claude Code"],
  ["Czeka na decyzję w aplikacji Codex", "Waiting for a decision in Codex"],
  [
    "Czeka na zatwierdzenie w aplikacji Codex",
    "Waiting for approval in Codex"
  ],
  ["Sesja Codexa zgłosiła błąd", "The Codex session reported an error"],
  ["Sesja jest bezczynna", "The session is idle"],
  [
    "Nie można potwierdzić stanu sesji Codexa",
    "The Codex session status could not be confirmed"
  ],
  [
    "Sesja nie jest obecnie widoczna",
    "The session is not currently visible"
  ],
  ["Agent wykonuje zadanie", "The agent is working"],
  [
    "Czeka na decyzję w aplikacji źródłowej",
    "Waiting for a decision in the source app"
  ]
]);

export function localizeRuntimeText(
  value: string,
  language: AppLanguage
): string {
  return language === "en" ? runtimeEnglish.get(value) ?? value : value;
}
