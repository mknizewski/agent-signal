<p align="center">
  <img src="build/icon.png" width="88" alt="AgentSignal" />
</p>

<h1 align="center">AgentSignal</h1>

<p align="center">
  Spokojny, lokalny dashboard do obserwowania wybranych sesji Codex i Claude Code.
</p>

<p align="center">
  <img alt="Windows 10 i 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-2563eb" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-43-47848f" />
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-3db47a" />
  <img alt="Local first" src="https://img.shields.io/badge/data-local--first-e4a62b" />
</p>

AgentSignal nie jest kolejnym klientem czatu. Nie tworzy zadań, nie wysyła
promptów i nie zastępuje aplikacji Codex ani Claude Code. Pozwala wybrać
istniejące sesje, które mają pozostać widoczne na jednym dashboardzie.

![Główny dashboard AgentSignal](docs/screenshots/dashboard-dark.png)

> Screenshoty korzystają wyłącznie z danych demonstracyjnych. Nie zawierają
> prawdziwych rozmów ani ścieżek z komputera autora.

## Najważniejsze funkcje

- obserwowanie wybranych sesji Codex i Claude Code,
- automatyczne odświeżanie statusów bez wysyłania promptów,
- sygnalizacja świetlna: pracuje, wymaga uwagi i wolny,
- oddzielne, animowane pupile dla Codexa i Claude'a,
- powiadomienia systemowe, gdy sesja wymaga uwagi lub kończy pracę,
- wyszukiwanie obserwowanych rozmów,
- jasny i ciemny motyw,
- kompaktowy widok zagregowany,
- zapamiętywanie wybranych sesji i ustawień interfejsu,
- minimalistyczny interfejs dopasowany do ekosystemu Codex.

### Dodawanie istniejących sesji

Przycisk **Dodaj czat** pokazuje sesje wykryte w lokalnej historii Codexa i
Claude Code. Zaznaczenie pozycji dodaje ją wyłącznie do dashboardu.

![Wybór sesji do obserwowania](docs/screenshots/chat-picker.png)

Usunięcie pozycji z AgentSignal nie usuwa oryginalnej rozmowy.

### Tryb kompaktowy

Menu **Widok → Tryb kompaktowy** zmniejsza okno do niewielkiego semafora.
Widok pokazuje zagregowaną liczbę sesji w każdym stanie oraz osobny stan
Codexa i Claude'a.

<p align="center">
  <img src="docs/screenshots/compact-dark.png" width="372" alt="Tryb kompaktowy AgentSignal" />
</p>

## Statusy

| Kolor | Status | Znaczenie |
| --- | --- | --- |
| Czerwony | Pracuje | Agent wykonuje zadanie. |
| Żółty | Wymaga uwagi | Sesja czeka na decyzję lub odpowiedź użytkownika. |
| Zielony | Wolny | Agent nie wykonuje teraz pracy. |
| Szary | Niedostępny | Nie udało się potwierdzić aktualnego stanu sesji. |

Codex udostępnia listę sesji przez lokalny App Server. Dla obserwowanych
rozmów AgentSignal odczytuje również zdarzenia `task_started`,
`task_complete` i `turn_aborted` z lokalnego pliku JSONL. Dzięki temu długie
zadanie pozostaje oznaczone jako aktywne również wtedy, gdy przez chwilę nie
pojawiają się nowe wpisy.

Claude Code udostępnia lokalną historię przez metodę `listSessions` z
oficjalnego SDK. Status pracy jest określany na podstawie czasu ostatniej
aktywności sesji. Konsumenckie rozmowy z Claude Chat lub Cowork nie są
importowane.

## Instalacja

### Gotowy instalator

1. Otwórz stronę [najnowszego wydania](../../releases/latest).
2. Pobierz plik `AgentSignal-Setup-<wersja>.exe`.
3. Uruchom instalator i wybierz katalog instalacji.

Wymagany jest Windows 10 lub Windows 11 w wersji x64. AgentSignal może
działać z samym Codexem, samym Claude Code albo z oboma źródłami.

### Uruchomienie ze źródeł

Wymagane są Node.js 22+ i pnpm 11.

```powershell
git clone https://github.com/mknizewski/agent-signal.git
cd agent-signal
pnpm install
pnpm dev
```

Przydatne polecenia:

```powershell
pnpm typecheck       # kontrola TypeScript
pnpm test            # testy jednostkowe
pnpm test:sync-smoke # lokalny test integracji źródeł
pnpm build           # build produkcyjny
pnpm dist            # instalator Windows w katalogu release/
```

## Prywatność i bezpieczeństwo

AgentSignal jest aplikacją local-first:

- nie ma własnego backendu ani telemetrii,
- nie wysyła treści rozmów do serwera AgentSignal,
- nie tworzy agentów i nie wysyła promptów,
- nie modyfikuje ani nie usuwa oryginalnych sesji,
- uruchamia Codex App Server lokalnie przez `stdio`,
- korzysta z Claude SDK wyłącznie do listowania lokalnych sesji.

Wybrane sesje są zapisywane lokalnie przez Electron w pliku
`agent-signal-state.json` w katalogu danych aplikacji. Plik może zawierać
tytuły, identyfikatory i ścieżki projektów obserwowanych sesji. Nie jest
dołączany do repozytorium ani wysyłany przez AgentSignal.

Renderer działa z `contextIsolation`, sandboxem i bez dostępu do Node.js.
Komunikacja IPC jest ograniczona do jawnie zdefiniowanych i walidowanych
operacji. Aplikacja ma Content Security Policy, blokuje nowe okna i odmawia
żądań uprawnień przeglądarkowych.

Szczegóły zgłaszania problemów bezpieczeństwa znajdują się w
[SECURITY.md](SECURITY.md).

## Struktura projektu

```text
electron/        proces główny, wykrywanie źródeł i synchronizacja
src/             interfejs React oraz współdzielone modele statusów
docs/screenshots materiały używane w README
scripts/         smoke test i generator ikon
build/           ikona aplikacji
```

## Ograniczenia

- wykrywanie Claude Code opiera się na czasie ostatniej aktywności,
- AgentSignal nie steruje agentami i nie odpowiada na prośby o zgodę,
- dostępność historii zależy od lokalnej instalacji Codex lub Claude Code,
- obecny instalator jest przygotowany dla Windows x64.

## Licencja

[MIT](LICENSE)
