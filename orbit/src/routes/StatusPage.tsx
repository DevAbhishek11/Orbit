import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '../api/endpoints';
import { Badge, ErrorBox } from '../components/ui';

export function StatusPage() {
  const query = useQuery({ queryKey: ['health'], queryFn: healthApi.ready, refetchInterval: 30_000, retry: false });
  const report = query.data;
  return <div className="page dashboard">
    <Link to="/" className="status-back">← Back to workspace</Link>
    <div className="page__header"><div className="page__header-text"><span className="eyebrow">SYSTEM OVERVIEW</span><h1>Service status</h1><p className="page__subtitle">Live dependency checks, refreshed every 30 seconds.</p></div><button className="btn" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Checking…' : '↻ Check now'}</button></div>
    {query.isError && <ErrorBox message="The API could not be reached. Check that the backend is running and the proxy is configured." />}
    <div className="panel status-summary"><span className={`status-dot ${report?.status === 'ok' ? 'healthy' : ''}`} /><div><h2>{!report ? 'Awaiting health report' : report.status === 'ok' ? 'All configured services operational' : report.status === 'unavailable' ? 'Some services are unavailable' : 'Running with reduced functionality'}</h2><p className="muted">{report ? `API version ${report.version} · Up for ${Math.floor(report.uptimeSeconds / 60)} minutes` : 'No service status is assumed until the API responds.'}</p></div></div>
    <div className="grid grid--two" style={{ marginTop: 20 }}>{Object.entries(report?.dependencies ?? {}).map(([name, state]) => <section className="panel" key={name}><div className="row row--between"><h2>{name === 'mongo' ? 'MongoDB database' : name === 'redisCache' ? 'Redis cache' : 'Redis queue'}</h2><Badge tone={state === 'up' ? 'success' : state === 'down' ? 'danger' : 'default'}>{state}</Badge></div><p className="muted">{name === 'mongo' ? 'Persistent workspace data and transactions.' : name === 'redisCache' ? 'Caching, throttling and session token denylist.' : 'Queue infrastructure; durable job workers are not implemented yet.'}</p></section>)}</div>
    {report?.runtime && <section className="panel" style={{ marginTop: 20 }}><h2>Database runtime</h2><dl className="runtime-grid"><div><dt>Topology</dt><dd>{report.runtime.topology}</dd></div><div><dt>Transactions</dt><dd>{report.runtime.transactionsSupported ? 'Supported' : 'Not verified / unavailable'}</dd></div><div><dt>Database</dt><dd>{report.runtime.dbName}</dd></div><div><dt>Mongo version</dt><dd>{report.runtime.mongoServerVersion}</dd></div></dl></section>}
    <p className="faint">Readiness is not a guarantee of every feature. Mail, realtime and durable job delivery are not yet implemented.</p>
  </div>;
}
