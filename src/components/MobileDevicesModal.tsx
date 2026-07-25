import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  Link2,
  LoaderCircle,
  MonitorSmartphone,
  Power,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
  X
} from "lucide-react";
import { agentApi } from "../lib/api";
import type {
  AppLanguage,
  MobileGatewayStatus,
  MobilePairingSession
} from "../shared/types";
import { formatRelativeTime } from "../shared/status";
import { copyFor } from "../lib/i18n";

interface MobileDevicesModalProps {
  open: boolean;
  language: AppLanguage;
  onClose(): void;
}

const emptyStatus: MobileGatewayStatus = {
  enabled: false,
  running: false,
  devices: []
};

export function MobileDevicesModal({
  open,
  language,
  onClose
}: MobileDevicesModalProps) {
  const copy = copyFor(language);
  const [status, setStatus] = useState(emptyStatus);
  const [pairing, setPairing] = useState<MobilePairingSession>();
  const [step, setStep] = useState<"certificate" | "pairing">("certificate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!open) return;
    setError("");
    void agentApi.getMobileGatewayStatus().then(setStatus).catch(showError);
    return agentApi.onMobileGatewayStatus(setStatus);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const secondsLeft = useMemo(
    () =>
      pairing
        ? Math.max(
            0,
            Math.ceil(
              (new Date(pairing.expiresAt).getTime() - now.getTime()) / 1_000
            )
          )
        : 0,
    [now, pairing]
  );

  if (!open) return null;

  function showError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : String(reason));
  }

  const toggleGateway = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await agentApi.setMobileGatewayEnabled(!status.enabled);
      setStatus(next);
      if (!next.enabled) setPairing(undefined);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  };

  const createPairing = async (
    targetStep: "certificate" | "pairing" = "certificate"
  ) => {
    setBusy(true);
    setError("");
    try {
      const next = await agentApi.createMobilePairing();
      setPairing(next);
      setStep(targetStep);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (deviceId: string, name: string) => {
    if (!window.confirm(copy.mobile.disconnectConfirm(name))) return;
    setBusy(true);
    try {
      setStatus(await agentApi.revokeMobileDevice(deviceId));
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (
      !window.confirm(
        copy.mobile.resetConfirm
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      setStatus(await agentApi.resetMobileAccess());
      setPairing(undefined);
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mobile-devices-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-devices-title"
      >
        <header className="mobile-devices-modal__header">
          <span className="mobile-devices-modal__icon">
            <MonitorSmartphone size={20} />
          </span>
          <div>
            <h2 id="mobile-devices-title">{copy.mobile.title}</h2>
            <p>{copy.mobile.subtitle}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={copy.common.close}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="mobile-devices-modal__content">
          <section className="mobile-gateway-card">
            <div className="mobile-gateway-card__state">
              <span
                className={`mobile-gateway-card__indicator ${
                  status.running ? "is-online" : ""
                }`}
              >
                {status.running ? <Wifi size={17} /> : <Power size={17} />}
              </span>
              <div>
                <strong>
                  {status.running
                    ? copy.mobile.active
                    : copy.mobile.disabled}
                </strong>
                <span>
                  {status.running
                    ? `${status.hostname} · ${status.address}`
                    : copy.mobile.notListening}
                </span>
              </div>
            </div>
            <button
              className={`mobile-toggle ${status.enabled ? "is-active" : ""}`}
              type="button"
              role="switch"
              aria-checked={status.enabled}
              disabled={busy}
              onClick={toggleGateway}
            >
              <i />
            </button>
          </section>

          {status.error && (
            <div className="mobile-device-error">{status.error}</div>
          )}
          {error && <div className="mobile-device-error">{error}</div>}

          {status.running && !pairing && (
            <button
              className="mobile-pair-button"
              type="button"
              disabled={busy}
              onClick={() => void createPairing("certificate")}
            >
              {busy ? (
                <LoaderCircle
                  className="is-spinning"
                  size={18}
                />
              ) : (
                <QrCode size={18} />
              )}
              {copy.mobile.connectPhone}
            </button>
          )}

          {pairing && (
            <section className="mobile-pairing">
              <div className="mobile-pairing__steps">
                <span className={step === "certificate" ? "is-active" : "is-done"}>
                  {step === "pairing" ? <Check size={12} /> : "1"}
                  {copy.mobile.certificate}
                </span>
                <i />
                <span className={step === "pairing" ? "is-active" : ""}>
                  2
                  {copy.mobile.pairing}
                </span>
              </div>

              {step === "certificate" ? (
                <div className="mobile-pairing__body">
                  <div className="mobile-pairing__qr">
                    <img
                      src={pairing.certificateQrDataUrl}
                      alt={copy.mobile.certificateQrAlt}
                    />
                  </div>
                  <div className="mobile-pairing__instructions">
                    <span className="eyebrow">
                      {copy.mobile.firstConnection}
                    </span>
                    <h3>{copy.mobile.trustCertificate}</h3>
                    <ol>
                      {copy.mobile.certificateSteps.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                    <code>{pairing.certificateFingerprint}</code>
                    <button
                      className="button button--primary"
                      type="button"
                      disabled={busy}
                      onClick={() => void createPairing("pairing")}
                    >
                      {busy ? (
                        <LoaderCircle
                          className="is-spinning"
                          size={16}
                        />
                      ) : (
                        <ShieldCheck size={16} />
                      )}
                      {copy.mobile.certificateInstalled}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mobile-pairing__body">
                  <div className="mobile-pairing__qr">
                    <img
                      src={pairing.pairingQrDataUrl}
                      alt={copy.mobile.pairingQrAlt}
                    />
                  </div>
                  <div className="mobile-pairing__instructions">
                    <span className="eyebrow">
                      {copy.mobile.securePairing}
                    </span>
                    <h3>{copy.mobile.scanAndroid}</h3>
                    <p>{copy.mobile.pairingDescription}</p>
                    <div
                      className={`mobile-pairing__timer ${
                        secondsLeft === 0 ? "is-expired" : ""
                      }`}
                    >
                      <Link2 size={14} />
                      {secondsLeft > 0
                        ? copy.mobile.expiresIn(secondsLeft)
                        : copy.mobile.expired}
                    </div>
                    {secondsLeft === 0 && (
                      <button
                        className="button button--secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => void createPairing("pairing")}
                      >
                        <RotateCcw size={15} />
                        {copy.mobile.regenerate}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="mobile-device-list">
            <div className="mobile-device-list__heading">
              <div>
                <strong>{copy.mobile.pairedPhones}</strong>
                <span>{status.devices.length}</span>
              </div>
              {status.devices.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                >
                  {copy.mobile.reset}
                </button>
              )}
            </div>

            {status.devices.length === 0 ? (
              <div className="mobile-device-list__empty">
                <Smartphone size={23} />
                <span>{copy.mobile.noPhones}</span>
              </div>
            ) : (
              status.devices.map((device) => (
                <article
                  className="mobile-device-row"
                  key={device.id}
                >
                  <span className="mobile-device-row__icon">
                    <Smartphone size={17} />
                    <i className={device.connected ? "is-online" : ""} />
                  </span>
                  <div>
                    <strong>{device.name}</strong>
                    <span>
                      {device.connected
                        ? copy.mobile.connectedNow
                        : `${copy.mobile.lastSeen} ${formatRelativeTime(
                            device.lastSeenAt,
                            now,
                            language
                          )}`}
                    </span>
                  </div>
                  {device.notificationsEnabled && (
                    <Bell
                      className="mobile-device-row__bell"
                      size={15}
                      aria-label={copy.mobile.notificationsActive}
                    />
                  )}
                  <button
                    className="row-action row-action--danger"
                    type="button"
                    title={copy.mobile.disconnect}
                    aria-label={`${copy.mobile.disconnect}: ${device.name}`}
                    onClick={() => revoke(device.id, device.name)}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
