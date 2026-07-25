# Security Policy

## Supported versions

Poprawki bezpieczeństwa są przygotowywane dla najnowszego wydania
AgentSignal dostępnego w GitHub Releases.

## Reporting a vulnerability

Nie publikuj danych sesji, tokenów, pełnych ścieżek użytkownika ani treści
rozmów w publicznym zgłoszeniu.

Jeśli repozytorium udostępnia opcję **Security → Report a vulnerability**,
użyj prywatnego zgłoszenia bezpieczeństwa. W przeciwnym razie utwórz krótkie
zgłoszenie bez poufnych szczegółów i poproś właściciela repozytorium o
prywatny kanał kontaktu.

W zgłoszeniu warto podać:

- wersję AgentSignal,
- wersję systemu Windows,
- oczekiwane i rzeczywiste zachowanie,
- minimalne kroki reprodukcji bez danych prywatnych,
- ocenę potencjalnego wpływu.

## Security model

AgentSignal jest lokalnym dashboardem. Nie udostępnia publicznego serwera i
nie posiada własnego backendu. Odczytuje metadane lokalnych sesji Codex i
Claude Code, a wybór obserwowanych sesji zapisuje w katalogu danych aplikacji.

Plik stanu może zawierać tytuły, identyfikatory i ścieżki projektów. Należy
traktować go jak inne lokalne dane deweloperskie i nie publikować.

Warstwa interfejsu Electron działa z izolacją kontekstu, sandboxem i bez
integracji Node.js. Dostępne operacje IPC są jawnie ograniczone i walidowane.
