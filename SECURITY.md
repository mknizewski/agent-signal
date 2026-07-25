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

Opcjonalny gateway mobilny udostępnia lokalny serwer HTTPS wyłącznie na
wybranym prywatnym interfejsie IPv4. Akceptuje klientów z tej samej podsieci i
wymaga trwałego tokenu urządzenia uzyskanego przez jednorazowy, wygasający kod
QR. Token jest przechowywany na telefonie w bezpiecznym cookie, a aplikacja
desktopowa zapisuje tylko jego skrót.

Gateway jest domyślnie wyłączony i można uruchomić go wyłącznie z aplikacji
desktopowej. Nie rozgłasza swojej obecności przez mDNS. Samo znalezienie
adresu i portu w sieci lokalnej nie daje dostępu do mobilnego API.

Mobilne API celowo nie zawiera podsumowań, ścieżek projektów, archiwum ani
źródłowych identyfikatorów sesji. Telefon otrzymuje wyłącznie nieodwracalny
klucz wpisu, tytuł, rodzaj agenta, status i czas aktualizacji.

Lokalny certyfikat CA oraz certyfikat serwera są unikalne dla instalacji.
Klucze prywatne i klucz VAPID są chronione przez Electron `safeStorage`.
Certyfikat CA powinien być instalowany wyłącznie na zaufanym telefonie po
porównaniu odcisku SHA-256 wyświetlanego na obu urządzeniach.

Powiadomienia Web Push są wysyłane bezpośrednio z działającej aplikacji
desktopowej do endpointu przeglądarki. Zaszyfrowany payload zawiera tytuł
powiadomienia, tytuł obserwowanej sesji i jej nowy status.

Plik stanu może zawierać tytuły, identyfikatory i ścieżki projektów. Należy
traktować go jak inne lokalne dane deweloperskie i nie publikować.

Warstwa interfejsu Electron działa z izolacją kontekstu, sandboxem i bez
integracji Node.js. Dostępne operacje IPC są jawnie ograniczone i walidowane.
