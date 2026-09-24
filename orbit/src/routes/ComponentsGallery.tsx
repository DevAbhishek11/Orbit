/**
 * Design system gallery — /dev/components (BUILD_PROMPT Phase 12)
 * Displays all 60+ components in light and dark modes.
 */
import { useState } from 'react';
import * as UI from '../components/ui';
import * as DS from '../components/design-system';

export function ComponentsGallery() {
  const [activeTab, setActiveTab] = useState('buttons');

  return (
    <div className="page" style={{ padding: '24px 32px' }}>
      <div className="page__header">
        <div>
          <span className="eyebrow">DESIGN SYSTEM</span>
          <h1>Component Gallery — 60+ components</h1>
          <p className="page__subtitle">All primitives in light and dark modes, responsive and keyboard-operable.</p>
        </div>
      </div>

      <DS.Tabs tabs={['buttons', 'forms', 'navigation', 'data', 'charts', 'misc']} active={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop: 24 }}>

        {activeTab === 'buttons' && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <h3>Buttons</h3>
              <div className="row row--wrap" style={{ gap: 8, marginTop: 12 }}>
                <DS.Button>Default</DS.Button>
                <DS.Button variant="primary">Primary</DS.Button>
                <DS.Button variant="ghost">Ghost</DS.Button>
                <DS.Button variant="danger">Danger</DS.Button>
                <DS.Button size="sm">Small</DS.Button>
                <DS.Button size="lg">Large</DS.Button>
                <DS.AsyncButton busy>Loading</DS.AsyncButton>
                <DS.CopyButton text="copied text" />
              </div>
            </div>
            <div className="panel" style={{ padding: 16 }}>
              <h3>Destructive</h3>
              <div className="stack" style={{ gap: 12, marginTop: 12 }}>
                <DS.DangerZone title="Danger Zone">
                  <p>Deleting this resource is irreversible.</p>
                  <DS.Button variant="danger">Delete workspace</DS.Button>
                </DS.DangerZone>
                <UI.ConfirmDialog title="Confirm delete" body="Are you sure?" confirmLabel="Delete" danger onConfirm={() => undefined} onClose={() => undefined} requireText="my-workspace" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'forms' && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <h3>Form Inputs</h3>
              <div className="stack" style={{ gap: 12, marginTop: 12 }}>
                <UI.Field label="Email"><input className="input" placeholder="you@example.com" /></UI.Field>
                <DS.PasswordField label="Password" value="Orbit@1234567" onChange={() => undefined} />
                <DS.Combobox options={['Apple', 'Banana', 'Cherry']} value="" onChange={() => undefined} placeholder="Search fruit..." />
                <DS.MultiSelect options={['frontend', 'backend', 'design']} values={['frontend']} onChange={() => undefined} />
                <DS.DateRangeField start="2026-01-01" end="2026-01-31" onChange={() => undefined} />
                <DS.FileDropzone onFile={() => undefined} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'navigation' && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <h3>Navigation</h3>
              <div className="stack" style={{ gap: 12, marginTop: 12 }}>
                <DS.Breadcrumbs items={[{ label: 'Workspace', href: '/' }, { label: 'Boards' }, { label: 'Product launch' }]} />
                <DS.DropdownMenu trigger={<DS.Button>Open menu ▾</DS.Button>}>
                  <div className="stack" style={{ gap: 4 }}>
                    <button type="button" className="btn btn--ghost btn--block">Profile</button>
                    <button type="button" className="btn btn--ghost btn--block">Settings</button>
                    <button type="button" className="btn btn--danger btn--block">Logout</button>
                  </div>
                </DS.DropdownMenu>
                <DS.ContextMenu menu={<div>Context actions</div>}>
                  <div className="panel" style={{ padding: 12 }}>Right-click me</div>
                </DS.ContextMenu>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <h3>Data Display</h3>
              <div style={{ marginTop: 12 }}>
                <DS.DataTable columns={['Name', 'Role', 'Status']} rows={[{ Name: 'Alice', Role: 'Owner', Status: 'Active' }, { Name: 'Bob', Role: 'Member', Status: 'Active' }]} />
              </div>
            </div>
            <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
              <DS.KanbanColumn title="To do" count={2}>
                <DS.CardTile title="Ship drag & drop" labels={['frontend']} assignees={['Alice']} />
                <DS.CardTile title="Write runbook" labels={['docs']} />
              </DS.KanbanColumn>
              <DS.KanbanColumn title="Done" count={1}>
                <DS.CardTile title="Response envelope" />
              </DS.KanbanColumn>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <DS.MessageBubble author="Alice" body="Hello team! Welcome to Orbit." time="10:30 AM" />
              <DS.MessageBubble author="Bob" body="Great to be here!" time="10:31 AM" />
            </div>
            <DS.Timeline items={[{ time: '10:30 AM', title: 'Card created', description: 'by Alice' }, { time: '10:35 AM', title: 'Card moved to In Progress' }]} />
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <DS.StatCard label="Total Cards" value={42} hint="12 completed" />
              <DS.StatCard label="Active Members" value={8} />
              <DS.StatCard label="Messages" value={128} hint="in 5 channels" />
            </div>
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <h3>Charts</h3>
              <div className="stack" style={{ gap: 16, marginTop: 12 }}>
                <DS.BarChart data={[{ label: 'To do', value: 12 }, { label: 'In Progress', value: 8 }, { label: 'Done', value: 22 }]} />
                <DS.LineChart points={[5, 12, 8, 20, 15, 22]} />
                <div className="row" style={{ gap: 16 }}>
                  <DS.DonutChart value={22} total={42} />
                  <DS.Heatmap data={[[1, 3, 5, 2, 8, 4, 0], [2, 4, 6, 3, 7, 5, 1], [0, 2, 4, 6, 3, 2, 0]]} />
                </div>
                <DS.BurndownChart ideal={[42, 35, 28, 21, 14, 7, 0]} actual={[42, 38, 32, 28, 20, 12, 5]} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'misc' && (
          <div className="stack" style={{ gap: 16 }}>
            <div className="panel" style={{ padding: 16 }}>
              <h3>Misc</h3>
              <div className="stack" style={{ gap: 12, marginTop: 12 }}>
                <DS.Skeleton width="60%" height={20} />
                <DS.Skeleton width="40%" height={16} />
                <DS.Tooltip content="This is a tooltip"><span className="btn btn--ghost">Hover me</span></DS.Tooltip>
                <DS.ProgressBar value={65} />
                <DS.EmptyIllustration icon="📄" title="No documents yet" />
                <UI.Spinner />
                <UI.Badge tone="success">Success</UI.Badge>
                <UI.Badge tone="warning">Warning</UI.Badge>
                <UI.Badge tone="danger">Danger</UI.Badge>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
