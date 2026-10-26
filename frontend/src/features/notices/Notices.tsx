import { useApp, useT } from '../../state/appStore';
import { useLocate } from '../../app/hooks';
import { Icon } from '../../ui/Icon';

export function Notices({ error, onRetry, onPickCity }: { error: boolean; onRetry: () => void; onPickCity: () => void }) {
  const t = useT();
  const { locating, notice, onboarded, debug, setNotice, finishOnboarding } = useApp();
  const locate = useLocate();
  const showOnboarding = debug.ui === 'onboarding' || !onboarded;

  if (locating) {
    return (
      <div className="notice glass" role="status">
        <Icon name="loader" size={22} spin />
        <div className="txt"><p className="ttl">{t.locating}</p><p className="body">{t.locatingBody}</p></div>
      </div>
    );
  }
  if (notice === 'denied' || notice === 'geoFail') {
    return (
      <div className="notice glass" role="alert">
        <Icon name="pin" size={22} />
        <div className="txt">
          <p className="ttl">{notice === 'denied' ? t.deniedTitle : t.geoFailTitle}</p>
          <p className="body">{notice === 'denied' ? t.denied : t.geoFail}</p>
        </div>
        <div className="btns">
          <button className="btn" onClick={onPickCity}><Icon name="search" size={16} />{t.pickCity}</button>
          <button className="btn ghost" onClick={() => setNotice(null)}>{t.dismiss}</button>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="notice glass err" role="alert">
        <Icon name="alert" size={22} />
        <div className="txt"><p className="ttl">{t.errTitle}</p><p className="body">{t.err}</p></div>
        <div className="btns"><button className="btn primary" onClick={onRetry}><Icon name="refresh" size={16} />{t.retry}</button></div>
      </div>
    );
  }
  if (showOnboarding) {
    return (
      <div className="notice glass">
        <Icon name="pin" size={22} />
        <div className="txt"><p className="ttl">{t.onbTitle}</p><p className="body">{t.onbBody}</p></div>
        <div className="btns">
          <button className="btn primary" onClick={locate}><Icon name="locate" size={16} />{t.useLoc}</button>
          <button className="btn" onClick={() => { finishOnboarding(); onPickCity(); }}>{t.pickCity}</button>
          <button className="btn ghost" onClick={finishOnboarding}>{t.later}</button>
        </div>
      </div>
    );
  }
  return null;
}
