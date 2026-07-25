import {
  Bell,
  FolderKanban,
  Languages,
  MessageSquareMore,
  MoonStar
} from "lucide-react";
import type { AppPreferences } from "../shared/types";
import { copyFor } from "../lib/i18n";

interface SettingsViewProps {
  preferences: AppPreferences;
  onUpdate(patch: Partial<AppPreferences>): void;
}

export function SettingsView({
  preferences,
  onUpdate
}: SettingsViewProps) {
  const copy = copyFor(preferences.language);

  return (
    <section className="settings-view">
      <SettingsCard
        icon={<Languages size={17} />}
        title={copy.settings.languageTitle}
        description={copy.settings.languageDescription}
      >
        <div className="language-picker">
          <button
            className={preferences.language === "pl" ? "is-active" : ""}
            type="button"
            onClick={() => onUpdate({ language: "pl" })}
          >
            {copy.settings.polish}
          </button>
          <button
            className={preferences.language === "en" ? "is-active" : ""}
            type="button"
            onClick={() => onUpdate({ language: "en" })}
          >
            {copy.settings.english}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<FolderKanban size={17} />}
        title={copy.settings.projectsTitle}
      >
        <PreferenceToggle
          checked={preferences.groupTrackedByProject}
          label={copy.settings.groupTracked}
          description={copy.settings.groupTrackedDescription}
          onChange={(value) => onUpdate({ groupTrackedByProject: value })}
        />
        <PreferenceToggle
          checked={preferences.autoGroupProjects}
          label={copy.settings.autoGroup}
          description={copy.settings.autoGroupDescription}
          onChange={(value) => onUpdate({ autoGroupProjects: value })}
        />
        <PreferenceToggle
          checked={preferences.groupPickerByProject}
          label={copy.settings.groupPicker}
          description={copy.settings.groupPickerDescription}
          onChange={(value) => onUpdate({ groupPickerByProject: value })}
        />
      </SettingsCard>

      <SettingsCard
        icon={<MessageSquareMore size={17} />}
        title={copy.settings.interactionTitle}
      >
        <PreferenceToggle
          checked={preferences.openChatOnDoubleClick}
          label={copy.settings.doubleClick}
          description={copy.settings.doubleClickDescription}
          onChange={(value) => onUpdate({ openChatOnDoubleClick: value })}
        />
        <PreferenceToggle
          checked={preferences.enablePinning}
          label={copy.settings.pinning}
          description={copy.settings.pinningDescription}
          onChange={(value) => onUpdate({ enablePinning: value })}
        />
        <PreferenceToggle
          checked={preferences.watchedSidebarExpanded}
          label={copy.settings.sidebarExpanded}
          description={copy.settings.sidebarExpandedDescription}
          onChange={(value) => onUpdate({ watchedSidebarExpanded: value })}
        />
      </SettingsCard>

      <SettingsCard
        icon={<Bell size={17} />}
        title={copy.settings.discoveryTitle}
      >
        <PreferenceToggle
          checked={preferences.detectNewSessions}
          label={copy.settings.detect}
          description={copy.settings.detectDescription}
          onChange={(value) => onUpdate({ detectNewSessions: value })}
        />
        <PreferenceToggle
          checked={preferences.promptForNewSessions}
          disabled={!preferences.detectNewSessions}
          label={copy.settings.prompt}
          description={copy.settings.promptDescription}
          onChange={(value) => onUpdate({ promptForNewSessions: value })}
        />
        <PreferenceToggle
          checked={preferences.systemNotifications}
          label={copy.settings.notifications}
          description={copy.settings.notificationsDescription}
          onChange={(value) => onUpdate({ systemNotifications: value })}
        />
      </SettingsCard>

      <SettingsCard
        icon={<MoonStar size={17} />}
        title={copy.settings.petTitle}
      >
        <PreferenceToggle
          checked={preferences.idlePetAnimation}
          label={copy.settings.sleepingPet}
          description={copy.settings.sleepingPetDescription}
          onChange={(value) => onUpdate({ idlePetAnimation: value })}
        />
        <label
          className={`preference-number ${
            !preferences.idlePetAnimation ? "is-disabled" : ""
          }`}
        >
          <span>{copy.settings.idleAfter}</span>
          <span>
            <input
              type="number"
              min={1}
              max={120}
              value={preferences.idleAfterMinutes}
              disabled={!preferences.idlePetAnimation}
              onChange={(event) =>
                onUpdate({
                  idleAfterMinutes: Number(event.target.value)
                })
              }
            />
            {copy.settings.minutes}
          </span>
        </label>
      </SettingsCard>

      <p className="settings-view__saved">{copy.settings.saved}</p>
    </section>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  children
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="settings-card">
      <header>
        <span>{icon}</span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      <div className="settings-card__content">{children}</div>
    </article>
  );
}

function PreferenceToggle({
  checked,
  disabled = false,
  label,
  description,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange(value: boolean): void;
}) {
  return (
    <label
      className={`preference-toggle ${disabled ? "is-disabled" : ""}`}
    >
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}
